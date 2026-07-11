import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { mergeStateRecords } from '@/lib/state-merge';
import { pickNextSeller } from '@/lib/round-robin';
import { appendNotification } from '@/lib/server-notifications';
import { sendAdvisorNeededEmail } from '@/lib/advisor-alert-email';

export interface WidgetConversation {
  id: string;
  lead: {
    name: string;
    email: string;
    phone: string;
    city: string;
    company: string;
  };
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'closed';
  clientId?: string;
  source: 'widget' | 'whatsapp';
}

async function readConversations(): Promise<WidgetConversation[]> {
  if (!hasDatabase()) return [];
  await ensureCrmSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT value FROM crm_state WHERE key = 'widget_conversations'`
  );
  return (rows[0]?.value as WidgetConversation[]) || [];
}

async function writeConversations(convs: WidgetConversation[]): Promise<void> {
  if (!hasDatabase()) return;
  const pool = getPool();
  await pool.query(
    `INSERT INTO crm_state (key, value, updated_at)
     VALUES ('widget_conversations', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(convs)]
  );
}

// GET /api/conversations — list all widget conversations
export async function GET() {
  try {
    const conversations = await readConversations();
    // Return most-recent first, limit 100
    return NextResponse.json({
      conversations: conversations.slice(0, 100),
      ok: true,
    });
  } catch (err: any) {
    return NextResponse.json({ conversations: [], error: err.message }, { status: 500 });
  }
}

// POST /api/conversations — upsert a conversation
// When a widget session first submits a lead with email/phone, we:
//   1. Upsert a crm_clients row with round-robin seller assignment
//   2. Stamp the conversation.clientId so the seller's file shows the full chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const conversation: WidgetConversation = body.conversation;
    if (!conversation?.id) {
      return NextResponse.json({ error: 'Missing conversation.id' }, { status: 400 });
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const existing = await readConversations();
    const previous = existing.find(c => c.id === conversation.id);
    const previousUserMessages = (previous?.messages || []).filter(m => m.role === 'user').length;
    const incomingUserMessages = (conversation.messages || []).filter(m => m.role === 'user').length;
    const shouldNotifyInbound = incomingUserMessages > previousUserMessages;

    // Lead capture + seller assignment — only when we have enough info and no client yet
    let clientId = conversation.clientId || previous?.clientId || '';
    let ownerId: string | null = null;
    const lead = conversation.lead || {};
    const hasLeadInfo = Boolean((lead.email || '').trim() || (lead.phone || '').replace(/\D/g, '').length >= 7);
    if (!clientId && hasLeadInfo) {
      const rr = await pickNextSeller();
      ownerId = rr?.id || null;
      const ownerName = rr?.name || null;

      // Check-then-upsert by email (fallback to phone if no email)
      const { rows: existingClient } = lead.email
        ? await pool.query(`SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE email = $1 LIMIT 1`, [lead.email])
        : await pool.query(`SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE phone = $1 LIMIT 1`, [lead.phone]);

      const today = new Date().toISOString().split('T')[0];
      if (existingClient.length > 0) {
        clientId = existingClient[0].id;
        ownerId = existingClient[0].assigned_to || null;
        // Don't steal ownership from an existing owner
        await pool.query(
          `UPDATE crm_clients SET
             name = COALESCE(NULLIF($1, ''), name),
             phone = COALESCE(NULLIF($2, ''), phone),
             city = COALESCE(NULLIF($3, ''), city),
             company = COALESCE(NULLIF($4, ''), company),
             last_contact = $5,
             assigned_to = COALESCE(assigned_to, $6),
             assigned_to_name = COALESCE(assigned_to_name, $7),
             source = COALESCE(source, 'ConcreBOT Widget'),
             updated_at = NOW()
           WHERE id = $8`,
          [lead.name || '', lead.phone || '', lead.city || '', lead.company || '', today, ownerId, ownerName, clientId]
        );
      } else {
        clientId = `c-bot-${Date.now()}`;
        ownerId = rr?.id || null;
        await pool.query(
          `INSERT INTO crm_clients (
             id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date,
             assigned_to, assigned_to_name, source, updated_at
           ) VALUES ($1,$2,$3,$4,$5,'Lead','Por cotizar',0,$6,$7,55,'ConcreBOT Widget',$8,$9,$10,'ConcreBOT Widget',NOW())`,
          [
            clientId,
            lead.name || 'Lead Bot',
            lead.company || lead.name || 'Sin empresa',
            lead.email || '',
            lead.phone || '',
            today,
            lead.city || 'No especificada',
            today,
            ownerId,
            ownerName,
          ]
        );

        // Also drop a pipeline task so the seller sees it in their board
        const newTask = {
          id: `t-bot-${Date.now()}`,
          title: `ConcreBOT: ${lead.name || 'Lead'}`,
          client: lead.company || lead.name || 'Sin empresa',
          clientId,
          contactName: lead.name || '',
          value: 'Por definir', numericValue: 0,
          priority: 'Medium', tags: ['ConcreBOT', 'Widget'],
          aiScore: 60, source: 'ConcreBOT Widget',
          assignedTo: ownerId || '',
          assignedToName: ownerName || '',
          email: lead.email || '',
          phone: lead.phone || '',
          city: lead.city || '',
          activities: [{
            id: `act-${Date.now()}`,
            type: 'system',
            content: `Lead capturado por ConcreBOT. Revisa el chat completo en la ficha del cliente → pestaña ConcreBOT.`,
            timestamp: new Date().toISOString(),
          }],
          stageId: 'stage-1',
        };
        // Merge-por-id: agrega SOLO esta task sin reescribir el arreglo entero.
        await mergeStateRecords(pool, { tasks: [newTask] });
      }
    } else if (clientId) {
      const { rows } = await pool.query(`SELECT assigned_to FROM crm_clients WHERE id = $1 LIMIT 1`, [clientId]);
      ownerId = rows[0]?.assigned_to || null;
    }

    // Now upsert the conversation with the resolved clientId
    const conversationToSave = { ...conversation, clientId: clientId || conversation.clientId };
    const idx = existing.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...conversationToSave, updatedAt: new Date().toISOString() };
    } else {
      existing.unshift({ ...conversationToSave, updatedAt: new Date().toISOString() });
    }

    await writeConversations(existing);

    if (shouldNotifyInbound) {
      const lastUserMessage = [...(conversation.messages || [])].reverse().find(m => m.role === 'user');
      await appendNotification(pool, {
        title: conversation.source === 'whatsapp' ? 'WhatsApp entrante' : 'ConcreBOT activo',
        description: `${lead.name || lead.phone || lead.email || 'Nuevo visitante'}: ${(lastUserMessage?.content || '').slice(0, 120) || 'Escribió al CRM'}`,
        type: 'lead',
        targetUserId: ownerId,
        clientId: clientId || undefined,
      });
      sendAdvisorNeededEmail({
        leadName: lead.name,
        phone: lead.phone,
        email: lead.email,
        company: lead.company,
        city: lead.city,
        message: lastUserMessage?.content,
        source: conversation.source === 'whatsapp' ? 'WhatsApp' : 'ConcreBOT',
        conversationId: conversation.id,
        clientId,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
      }).catch(error => console.error('[advisor-alert] conversation email failed:', error));
    }

    return NextResponse.json({ ok: true, id: conversation.id, clientId });
  } catch (err: any) {
    console.error('POST /api/conversations error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
