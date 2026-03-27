/**
 * CRM Permission System
 * Each user has a role (SuperAdmin, Admin, Manager, Vendedor) with default permissions.
 * Individual permissions can be overridden per-user via the permissions field.
 */

export type PermissionKey =
  // Comercial
  | 'quotes.view'
  | 'quotes.create'
  | 'quotes.approve'
  | 'quotes.delete'
  | 'clients.view'
  | 'clients.create'
  | 'clients.delete'
  | 'clients.export'
  | 'pipeline.view'
  | 'pipeline.reassign'
  // Operaciones
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.export'
  | 'scheduler.view'
  | 'scheduler.manage'
  | 'analytics.view'
  // Equipo
  | 'team.view'
  | 'team.manage'
  | 'team.delete'
  // Herramientas
  | 'forms.view'
  | 'forms.manage'
  | 'documents.view'
  | 'documents.manage'
  | 'biolinks.view'
  | 'biolinks.manage'
  | 'bot.use'
  // Sistema
  | 'audit.view'
  | 'settings.view'
  | 'settings.manage';

export interface PermissionItem {
  key: PermissionKey;
  label: string;
}

export interface PermissionGroup {
  label: string;
  color: string;
  keys: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Comercial',
    color: 'sky',
    keys: [
      { key: 'quotes.view', label: 'Ver Cotizaciones' },
      { key: 'quotes.create', label: 'Crear / Editar Cotizaciones' },
      { key: 'quotes.approve', label: 'Aprobar Cotizaciones' },
      { key: 'quotes.delete', label: 'Eliminar Cotizaciones' },
      { key: 'clients.view', label: 'Ver Clientes' },
      { key: 'clients.create', label: 'Crear / Editar Clientes' },
      { key: 'clients.delete', label: 'Eliminar Clientes' },
      { key: 'clients.export', label: 'Exportar Clientes' },
      { key: 'pipeline.view', label: 'Ver Pipeline' },
      { key: 'pipeline.reassign', label: 'Reasignar Negocios' },
    ],
  },
  {
    label: 'Operaciones',
    color: 'violet',
    keys: [
      { key: 'inventory.view', label: 'Ver Inventario' },
      { key: 'inventory.manage', label: 'Gestionar Inventario' },
      { key: 'inventory.export', label: 'Exportar Inventario' },
      { key: 'scheduler.view', label: 'Ver Agenda' },
      { key: 'scheduler.manage', label: 'Gestionar Eventos' },
      { key: 'analytics.view', label: 'Ver Analíticas' },
    ],
  },
  {
    label: 'Equipo',
    color: 'amber',
    keys: [
      { key: 'team.view', label: 'Ver Equipo' },
      { key: 'team.manage', label: 'Crear / Editar Usuarios' },
      { key: 'team.delete', label: 'Eliminar Usuarios' },
    ],
  },
  {
    label: 'Herramientas',
    color: 'emerald',
    keys: [
      { key: 'forms.view', label: 'Ver Formularios' },
      { key: 'forms.manage', label: 'Gestionar Formularios' },
      { key: 'documents.view', label: 'Ver Documentos' },
      { key: 'documents.manage', label: 'Gestionar Documentos' },
      { key: 'biolinks.view', label: 'Ver Tarjetas Digitales' },
      { key: 'biolinks.manage', label: 'Gestionar Tarjetas Digitales' },
      { key: 'bot.use', label: 'Usar ConcreBOT' },
    ],
  },
  {
    label: 'Sistema',
    color: 'rose',
    keys: [
      { key: 'audit.view', label: 'Ver Auditoría' },
      { key: 'settings.view', label: 'Ver Configuración' },
      { key: 'settings.manage', label: 'Gestionar Configuración' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g =>
  g.keys.map(k => k.key)
);

const allTrue = (): Record<string, boolean> =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, true]));

export const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  SuperAdmin: allTrue(),
  Admin: allTrue(),
  Manager: {
    'quotes.view': true,
    'quotes.create': true,
    'quotes.approve': true,
    'quotes.delete': false,
    'clients.view': true,
    'clients.create': true,
    'clients.delete': false,
    'clients.export': false,
    'pipeline.view': true,
    'pipeline.reassign': false,
    'inventory.view': true,
    'inventory.manage': true,
    'inventory.export': false,
    'scheduler.view': true,
    'scheduler.manage': true,
    'analytics.view': true,
    'team.view': true,
    'team.manage': false,
    'team.delete': false,
    'forms.view': true,
    'forms.manage': true,
    'documents.view': true,
    'documents.manage': true,
    'biolinks.view': true,
    'biolinks.manage': true,
    'bot.use': true,
    'audit.view': true,
    'settings.view': true,
    'settings.manage': false,
  },
  Vendedor: {
    'quotes.view': true,
    'quotes.create': true,
    'quotes.approve': false,
    'quotes.delete': false,
    'clients.view': true,
    'clients.create': true,
    'clients.delete': false,
    'clients.export': false,
    'pipeline.view': true,
    'pipeline.reassign': false,
    'inventory.view': true,
    'inventory.manage': false,
    'inventory.export': false,
    'scheduler.view': true,
    'scheduler.manage': true,
    'analytics.view': false,
    'team.view': false,
    'team.manage': false,
    'team.delete': false,
    'forms.view': true,
    'forms.manage': false,
    'documents.view': true,
    'documents.manage': false,
    'biolinks.view': true,
    'biolinks.manage': false,
    'bot.use': true,
    'audit.view': false,
    'settings.view': false,
    'settings.manage': false,
  },
};

/** Returns the default permissions object for a given role */
export function getDefaultPermissions(role: string): Record<string, boolean> {
  return DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS['Vendedor'];
}

/** Resolves whether a user has a specific permission.
 *  SuperAdmin always returns true regardless of stored permissions.
 *  For other roles: check user.permissions overrides first, then fall back to role defaults.
 */
export function hasPermission(
  user: { role: string; permissions?: Record<string, boolean> } | null | undefined,
  key: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  if (user.permissions && key in user.permissions) {
    return Boolean(user.permissions[key]);
  }
  return getDefaultPermissions(user.role)[key] ?? false;
}
