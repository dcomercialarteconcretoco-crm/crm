import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { hasPermission } from '@/lib/permissions';
import { collectFootprint, loadMember } from '@/lib/handover';

/**
 * GET /api/team/:id/footprint
 *
 * Todo lo que cuelga de un integrante, partido en dos: lo que se le puede pasar
 * a un reemplazo (cartera, leads, negocios abiertos, agenda futura) y lo que se
 * queda a su nombre para siempre (cotizaciones enviadas, negocios cerrados,
 * historial de contacto, adjuntos).
 *
 * La pantalla de relevo lo pide ANTES de confirmar, para que el admin vea
 * "se mueven 344 clientes / no se tocan 56 cotizaciones" en vez de apretar un
 * botón a ciegas sobre la cartera más grande de la empresa.
 *
 * Lo puede consultar quien administra el equipo, o el propio usuario sobre sí
 * mismo (el caso "me voy y entrego mi puesto" — ver /api/team/handover).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 });
    }

    const session = await loadFreshSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }

    const { id } = await params;
    const canManage = hasPermission(
        { role: session.role, permissions: session.permissions },
        'team.manage'
    );
    if (!canManage && session.id !== id) {
        return NextResponse.json({ error: 'No tienes permiso para ver esta información.' }, { status: 403 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const user = await loadMember(pool, id);
    if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const footprint = await collectFootprint(pool, user);

    return NextResponse.json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status,
            archivedAt: user.archived_at,
        },
        movable: footprint.movable,
        kept: footprint.kept,
    });
}
