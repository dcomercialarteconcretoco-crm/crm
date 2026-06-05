import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

// Devuelve las opciones disponibles para los dropdowns de filtro en la UI
// de Leads Crudos (Departamento, Ciudad, Sector, Tamaño). Se llama una sola
// vez al cargar la página; la UI lo cachea hasta que el usuario refresca.

function isAdmin(role: string | undefined): boolean {
    return role === 'SuperAdmin' || role === 'Admin';
}

export async function GET(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) {
        return NextResponse.json({ departments: [], cities: [], sizes: [], activities: [] });
    }

    await ensureCrmSchema();
    const pool = getPool();

    // Vendedor sólo ve facetas de los leads que tiene asignados (refleja la
    // misma restricción del listado principal).
    const ownerWhere = isAdmin(user.role) ? '' : `WHERE assigned_to = $1`;
    const ownerParams = isAdmin(user.role) ? [] : [user.id];

    // Si la UI filtra por departamento, queremos que el dropdown de ciudades
    // muestre sólo las ciudades de ese departamento. Lo aceptamos como param.
    const departmentFilter = request.nextUrl.searchParams.get('department') || '';
    const cityFilter = departmentFilter
        ? `${ownerWhere ? 'AND' : 'WHERE'} department = $${ownerParams.length + 1}`
        : '';
    const cityParams = departmentFilter ? [...ownerParams, departmentFilter] : ownerParams;

    const [deps, cities, sizes, activities] = await Promise.all([
        pool.query(
            `SELECT department, COUNT(*)::int AS count
               FROM crm_raw_leads
               ${ownerWhere}
               ${ownerWhere ? 'AND' : 'WHERE'} department IS NOT NULL
              GROUP BY department
              ORDER BY count DESC`,
            ownerParams
        ),
        pool.query(
            `SELECT city, COUNT(*)::int AS count
               FROM crm_raw_leads
               ${ownerWhere}
               ${ownerWhere ? 'AND' : 'WHERE'} city IS NOT NULL
               ${cityFilter}
              GROUP BY city
              ORDER BY count DESC
              LIMIT 500`,
            cityParams
        ),
        pool.query(
            `SELECT company_size, COUNT(*)::int AS count
               FROM crm_raw_leads
               ${ownerWhere}
               ${ownerWhere ? 'AND' : 'WHERE'} company_size IS NOT NULL
              GROUP BY company_size
              ORDER BY count DESC`,
            ownerParams
        ),
        pool.query(
            `SELECT activity, COUNT(*)::int AS count
               FROM (
                 SELECT unnest(activities) AS activity
                   FROM crm_raw_leads
                   ${ownerWhere}
               ) t
               WHERE activity IS NOT NULL AND length(trim(activity)) > 0
               GROUP BY activity
               ORDER BY count DESC
               LIMIT 300`,
            ownerParams
        ),
    ]);

    return NextResponse.json({
        departments: deps.rows.map(r => ({ value: r.department, count: r.count })),
        cities: cities.rows.map(r => ({ value: r.city, count: r.count })),
        sizes: sizes.rows.map(r => ({ value: r.company_size, count: r.count })),
        activities: activities.rows.map(r => ({ value: r.activity, count: r.count })),
    });
}
