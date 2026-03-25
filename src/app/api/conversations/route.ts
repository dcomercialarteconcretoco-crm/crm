import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';

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
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const conversation: WidgetConversation = body.conversation;
    if (!conversation?.id) {
      return NextResponse.json({ error: 'Missing conversation.id' }, { status: 400 });
    }

    const existing = await readConversations();
    const idx = existing.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...conversation, updatedAt: new Date().toISOString() };
    } else {
      existing.unshift({ ...conversation, updatedAt: new Date().toISOString() });
    }

    await writeConversations(existing);
    return NextResponse.json({ ok: true, id: conversation.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
