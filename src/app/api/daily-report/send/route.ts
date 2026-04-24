import { NextRequest, NextResponse } from 'next/server';
import { executeDailyReport, type DailyReportInput } from '@/lib/daily-report-engine';

/**
 * POST /api/daily-report/send
 *
 * Wrapper HTTP delgado sobre `executeDailyReport`. Next.js solo permite a un
 * route.ts exportar handlers HTTP, así que la lógica vive en
 * `@/lib/daily-report-engine` y el cron (`/api/daily-report/cron`) la llama
 * directamente como función — evitando el round-trip HTTP que antes era
 * cortado por el middleware con 401, silenciando el correo diario.
 */
export async function POST(request: NextRequest) {
    const body = (await request.json().catch(() => ({}))) as DailyReportInput;
    const result = await executeDailyReport(body);
    if (result.ok) {
        return NextResponse.json(result);
    }
    return NextResponse.json(
        { error: result.error, from: (result as any).from, status: result.status },
        { status: result.status }
    );
}
