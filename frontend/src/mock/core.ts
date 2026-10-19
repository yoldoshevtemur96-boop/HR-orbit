// Demo API'ning umumiy qismi: marshrut jadvali, xatolar va yordamchilar.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, type DemoDb, type Row } from './store';

export interface Auth {
  userId: string;
  organizationId: string;
  role: string;
}

export interface Ctx {
  db: DemoDb;
  auth: Auth | null;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
}

export class MockError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (m: string) => new MockError(400, m);
export const notFound = (m = 'Topilmadi') => new MockError(404, m);
export const forbidden = (m = "Ruxsat yo'q") => new MockError(403, m);
export const unauthorized = (m = "Avtorizatsiyadan o'tilmagan") => new MockError(401, m);
export const conflict = (m: string) => new MockError(409, m);

type Handler = (ctx: Ctx) => any;
interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
  public: boolean;
  status: number;
}

const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler, opts: { public?: boolean; status?: number } = {}) {
  const keys: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  });
  routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler, public: Boolean(opts.public), status: opts.status ?? 200 });
}

export function matchRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.regex);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { route: r, params };
  }
  return null;
}

export function db(): DemoDb {
  return getDb();
}

export function requireRole(ctx: Ctx, ...roles: string[]) {
  if (!ctx.auth) throw unauthorized();
  if (!roles.includes(ctx.auth.role)) throw forbidden();
}

// ---------------------------------------------------------------------------
// Ma'lumot yordamchilari
// ---------------------------------------------------------------------------

export const byId = <T extends Row>(list: T[], id: string | null | undefined) => (id ? list.find((x) => x.id === id) : undefined);

export function selfEmployee(ctx: Ctx) {
  const emp = ctx.db.employees.find((e) => e.userId === ctx.auth!.userId);
  if (!emp) throw notFound("Sizga bog'langan xodim profili topilmadi");
  return emp;
}

export function ref(row: Row | undefined, withCode = true) {
  if (!row) return null;
  return withCode ? { id: row.id, name: row.name, code: row.code } : { id: row.id, name: row.name };
}

export function employeeWithRefs(d: DemoDb, e: Row) {
  const manager = byId(d.employees, e.managerId);
  return {
    ...e,
    position: ref(byId(d.positions, e.positionId)),
    department: ref(byId(d.departments, e.departmentId)),
    branch: ref(byId(d.branches, e.branchId)),
    manager: manager ? { id: manager.id, fullName: manager.fullName, employeeCode: manager.employeeCode } : null,
  };
}

export function sanitizeEmployee(e: Row, role: string, isSelf: boolean) {
  if (role === 'SUPER_ADMIN' || role === 'HR_MANAGER' || role === 'HR_SPECIALIST' || isSelf) return e;
  const { pinfl: _p, passportNumber: _n, ...rest } = e;
  return rest;
}

export function userEmail(d: DemoDb, userId: string | null | undefined) {
  const u = byId(d.users, userId);
  return u ? { id: u.id, email: u.email } : null;
}

export function notify(d: DemoDb, userId: string | null | undefined, type: string, message: string, entityType?: string, entityId?: string) {
  if (!userId) return;
  d.notifications.push({
    id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    organizationId: d.organization.id,
    userId,
    type,
    message,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

export const ACTIVE_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'];

export function contains(value: unknown, search: string) {
  return typeof value === 'string' && value.toLowerCase().includes(search.toLowerCase());
}

export function sortBy<T>(list: T[], key: (x: T) => any, dir: 'asc' | 'desc' = 'asc') {
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const va = key(a);
    const vb = key(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb, 'uz') : va - vb) * mul;
  });
}

export function toDateOnlyIso(value: string | Date) {
  const s = typeof value === 'string' ? value : value.toISOString();
  const day = s.slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`).toISOString();
}

export function formatDateUz(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' });
}
