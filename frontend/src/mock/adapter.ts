// Demo rejim: axios so'rovlarini backend o'rniga brauzer ichidagi
// mock API'ga yo'naltiruvchi adapter.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { MockError, matchRoute, type Auth, type Ctx } from './core';
import { getDb, saveDb } from './store';
import './routes/hr';
import './routes/workflow';
import './routes/attendance';
import './routes/learning';
import './routes/learningAdmin';

function decodeToken(header: unknown): Auth | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const payload = header.slice(7).split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const user = getDb().users.find((u) => u.id === json.userId && u.isActive);
    if (!user) return null;
    return { userId: user.id, organizationId: user.organizationId, role: user.role };
  } catch {
    return null;
  }
}

function parseRequest(config: InternalAxiosRequestConfig) {
  const raw = config.url ?? '';
  const base = config.baseURL ?? '';
  let path = raw;
  if (/^https?:\/\//.test(raw)) path = new URL(raw).pathname;
  else if (/^https?:\/\//.test(base)) path = new URL(base).pathname.replace(/\/$/, '') + (raw.startsWith('/') ? raw : `/${raw}`);
  const [pathname, qs] = path.split('?');
  const cleanPath = pathname.replace(/^\/api(?=\/)/, '').replace(/\/+$/, '') || '/';
  const query: Record<string, any> = {};
  new URLSearchParams(qs ?? '').forEach((v, k) => (query[k] = v));
  for (const [k, v] of Object.entries(config.params ?? {})) {
    if (v !== undefined && v !== null && v !== '') query[k] = v;
  }
  let body = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* oddiy matn */
    }
  }
  return { path: cleanPath, query, body };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = (v: unknown) => (v === undefined || v === null || v instanceof Blob ? v ?? null : JSON.parse(JSON.stringify(v)));

export const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const { path, query, body } = parseRequest(config);
  await delay(80 + Math.random() * 120);

  const respond = (status: number, data: unknown) => ({
    data,
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
    config,
    request: {},
  });

  const fail = (status: number, message: string): never => {
    const response = respond(status, { error: { message } });
    throw new AxiosError(message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response as any);
  };

  const match = matchRoute(method, path);
  if (!match) return fail(404, `Yo'l topilmadi: ${method} /api${path}`);

  const auth = decodeToken((config.headers as any)?.Authorization ?? (config.headers as any)?.get?.('Authorization'));
  if (!match.route.public && !auth) return fail(401, "Avtorizatsiyadan o'tilmagan");

  const ctx: Ctx = { db: getDb(), auth, params: match.params, query, body };
  try {
    const result = await match.route.handler(ctx);
    saveDb(); // GET ham holatni o'zgartirishi mumkin (eslatmalar, qoidalar)
    const status = result === null && method === 'PATCH' ? 204 : match.route.status;
    return respond(status, clone(result));
  } catch (err) {
    if (err instanceof MockError) return fail(err.status, err.message);
    console.error('[demo-api]', err);
    return fail(500, 'Serverda kutilmagan xatolik yuz berdi');
  }
};
