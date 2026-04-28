import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { DEFAULT_PIPELINE_STAGES } from '@/context/AppContext';

/**
 * /api/track-open?q=<quoteNumber>&e=<clientEmail>
 *
 * Pixel de tracking que se embebe en el correo de la cotización. Cada vez que
 * el cliente abre el email (o lo previsualiza Outlook/Gmail), su lector pide
 * este pixel y caemos acá. Hacemos dos cosas:
 *
 *   1) Incrementar `opens` y registrar `firstOpenedAt` en la cotización.
 *   2) Mover la task asociada del kanban a la etapa marcada como
 *      `autoOnQuoteOpen: true` (default: "En caliente"). El movimiento es
 *      "una sola vez" — sólo aplica si la task está en una etapa ANTERIOR
 *      al stage caliente. Si el asesor ya la movió a Facturado o más allá,
 *      no la regresamos.
 *
 * Devuelve siempre el pixel transparente. Errores se loggean pero no se
 * comunican al cliente — un cliente externo no debería sentir que el correo
 * "rebota" si nuestro tracking falla.
 */

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const PIXEL_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function GET(req: NextRequest) {
  const quoteNumber = req.nextUrl.searchParams.get('q') || '';
  const clientEmail = req.nextUrl.searchParams.get('e') || '';

  // Sin DB no hay nada que persistir; devolvemos el pixel para no romper el
  // render del correo aunque estemos en local sin DATABASE_URL.
  if (!hasDatabase() || !quoteNumber) {
    return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
  }

  try {
    await ensureCrmSchema();
    const pool = getPool();

    // Leemos quotes, tasks y settings en una sola query — todo vive en
    // crm_state como key-value JSONB. Lo procesamos en memoria y volvemos
    // a escribir sólo lo que cambió.
    const { rows } = await pool.query(
      `SELECT key, value FROM crm_state WHERE key = ANY($1::text[])`,
      [['quotes', 'tasks', 'settings']]
    );
    const stateMap = new Map(rows.map(r => [r.key, r.value]));
    const quotes: any[] = Array.isArray(stateMap.get('quotes')) ? stateMap.get('quotes') : [];
    const tasks: any[] = Array.isArray(stateMap.get('tasks')) ? stateMap.get('tasks') : [];
    const settings: any = stateMap.get('settings') || {};
    const stages: Array<{ id: string; autoOnQuoteOpen?: boolean }> =
      Array.isArray(settings.pipelineStages) && settings.pipelineStages.length > 0
        ? settings.pipelineStages
        : DEFAULT_PIPELINE_STAGES;

    // Encontrar la cotización por número (case-insensitive porque algunos
    // bots normalizan el query string).
    const quoteIdx = quotes.findIndex(
      q => (q.quoteNumber || q.number || '').toLowerCase() === quoteNumber.toLowerCase()
    );
    if (quoteIdx === -1) {
      console.log('[track-open] cotización no encontrada', { quoteNumber, clientEmail });
      return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
    }

    const quote = quotes[quoteIdx];
    const newOpens = (quote.opens || 0) + 1;
    const firstOpen = quote.firstOpenedAt || new Date().toISOString();
    quotes[quoteIdx] = {
      ...quote,
      opens: newOpens,
      firstOpenedAt: firstOpen,
      lastOpenedAt: new Date().toISOString(),
    };

    let tasksChanged = false;
    const hotStage = stages.find(s => s.autoOnQuoteOpen);
    if (hotStage) {
      const stageOrder = stages.map(s => s.id);
      const hotIdx = stageOrder.indexOf(hotStage.id);
      // Buscamos la task asociada — primero por taskId que la quote conoce,
      // si no por quoteId que la task conoce. Cubrimos ambos schemas.
      const taskIdx = tasks.findIndex(
        t => (quote.taskId && t.id === quote.taskId) || (t.quoteId && t.quoteId === quote.id)
      );
      if (taskIdx !== -1) {
        const t = tasks[taskIdx];
        const currentIdx = stageOrder.indexOf(t.stageId);
        // Sólo mueve si la task está antes del hot stage (no la "regresa"
        // si el asesor ya la marcó como Facturado).
        if (currentIdx === -1 || currentIdx < hotIdx) {
          tasks[taskIdx] = {
            ...t,
            stageId: hotStage.id,
            activities: [
              {
                id: `auto-open-${Date.now()}`,
                type: 'system',
                content: `🔔 El cliente abrió la cotización — pasó a ${hotStage.id}.`,
                timestamp: new Date().toISOString(),
              },
              ...(Array.isArray(t.activities) ? t.activities : []),
            ],
          };
          tasksChanged = true;
        }
      }
    }

    // Persistimos sólo lo modificado. Si no movimos task, evitamos un write
    // extra al JSONB grande de tasks.
    await pool.query(
      `INSERT INTO crm_state (key, value, updated_at) VALUES ('quotes', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(quotes)]
    );
    if (tasksChanged) {
      await pool.query(
        `INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(tasks)]
      );
    }

    console.log('[track-open]', {
      quoteNumber,
      clientEmail,
      opens: newOpens,
      firstOpen,
      autoMoved: tasksChanged,
    });
  } catch (error) {
    // Nunca rompemos el pixel — sólo loggeamos.
    console.error('[track-open] error', error);
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}
