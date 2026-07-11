import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { mergeStateRecords } from '@/lib/state-merge';
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
    // bots normalizan el query string). Actualizamos TODAS las que compartan
    // el número: pueden existir duplicados legacy con ids distintos y el
    // cliente solo muestra uno (dedup por quoteNumber) — si marcáramos solo
    // el primer match, el tracking podía caer en el duplicado invisible y el
    // equipo jamás veía la apertura.
    const matches = quotes.filter(
      q => (q.quoteNumber || q.number || '').toLowerCase() === quoteNumber.toLowerCase()
    );
    if (matches.length === 0) {
      console.log('[track-open] cotización no encontrada', { quoteNumber, clientEmail });
      return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
    }

    const nowIso = new Date().toISOString();
    const updatedQuotes = matches.map(q => ({
      ...q,
      opens: (q.opens || 0) + 1,
      firstOpenedAt: q.firstOpenedAt || nowIso,
      lastOpenedAt: nowIso,
    }));
    const newOpens = updatedQuotes[0].opens;
    const firstOpen = updatedQuotes[0].firstOpenedAt;

    let updatedTask: any = null;
    const hotStage = stages.find(s => s.autoOnQuoteOpen);
    if (hotStage) {
      const stageOrder = stages.map(s => s.id);
      const hotIdx = stageOrder.indexOf(hotStage.id);
      // Buscamos la task asociada — primero por taskId que la quote conoce,
      // si no por quoteId que la task conoce. Cubrimos ambos schemas y todos
      // los duplicados del número.
      const task = tasks.find(
        t => matches.some(q => (q.taskId && t.id === q.taskId) || (t.quoteId && t.quoteId === q.id))
      );
      if (task) {
        const currentIdx = stageOrder.indexOf(task.stageId);
        // Sólo mueve si la task está antes del hot stage (no la "regresa"
        // si el asesor ya la marcó como Facturado).
        if (currentIdx === -1 || currentIdx < hotIdx) {
          updatedTask = {
            ...task,
            stageId: hotStage.id,
            activities: [
              {
                id: `auto-open-${Date.now()}`,
                type: 'system',
                content: `🔔 El cliente abrió la cotización — pasó a ${hotStage.id}.`,
                timestamp: new Date().toISOString(),
              },
              ...(Array.isArray(task.activities) ? task.activities : []),
            ],
          };
        }
      }
    }

    // Merge-por-id: upsertea SOLO los registros tocados. Antes este endpoint
    // reescribía el arreglo completo de quotes en cada apertura de email
    // (incluidos los prefetch de Outlook/Gmail) — cualquier cotización creada
    // entre su lectura y su escritura moría pisada.
    await mergeStateRecords(pool, {
      quotes: updatedQuotes,
      ...(updatedTask ? { tasks: [updatedTask] } : {}),
    });

    console.log('[track-open]', {
      quoteNumber,
      clientEmail,
      opens: newOpens,
      firstOpen,
      autoMoved: !!updatedTask,
    });
  } catch (error) {
    // Nunca rompemos el pixel — sólo loggeamos.
    console.error('[track-open] error', error);
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}
