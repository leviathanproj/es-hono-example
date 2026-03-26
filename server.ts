import {
  // Uncomment as you enable features:
  // type EnterpriseStandard,
  // InMemoryGroupStore,
  // InMemoryMagicLinkStore,
  // InMemorySessionStore,
  // InMemoryTenantStore,
  // InMemoryUserStore,
  // InMemoryWorkloadTokenStore,
  // getWorkloadToken,
  // resolveSessions,
  // switchSession,
  // tenantManager,
  // validateWorkloadToken,
  // validationFailureResponse,
  enterpriseStandard,
  envConfig,
} from '@enterprisestandard/server';
import { createValidators } from '@enterprisestandard/valibot';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();
const validators = createValidators();

// ─── Core SSO setup ───────────────────────────────────────────────────────────
// This is the minimum needed to run an SSO app. Everything below is optional.

const es = enterpriseStandard(envConfig(), {
  validators,
  basePath: '/api/es',
  // Uncomment stores as you enable features. In-memory stores are for
  // development only — use Redis adapters in production.
  // stores: {
  //   sessionStore: new InMemorySessionStore(),
  //   userStore: new InMemoryUserStore(),
  //   groupStore: new InMemoryGroupStore(),
  //   magicLinkStore: new InMemoryMagicLinkStore(),   // required for CIAM
  //   workloadTokenStore: new InMemoryWorkloadTokenStore(), // required for workload auth
  // },
});
app.all('/api/es/*', ({ req }) => es.handler(req.raw));

// ─── Health checks ────────────────────────────────────────────────────────────

app.get('/api/livez', (c) => c.json({ ok: true }, 200));

app.get('/api/readyz', (c) => {
  if (!es.isReady()) {
    return c.json({ enterpriseStandard: 'not ready' }, 503);
  }
  return c.json({ enterpriseStandard: 'ready' }, 200);
});



// ─── CIAM (magic links) ───────────────────────────────────────────────────────
// Passwordless sign-in via magic links. Requires magicLinkStore in stores above.
//
// Magic links are generated server-side and sent to users out-of-band (e.g. email).
// The ES handler already exposes the magic-link endpoint at /api/es/magic-link,
// but you can generate links programmatically and proxy them to other apps.
//
// Example: generate a magic link for a user and return it to the caller.
// Useful for cross-app sign-in or admin-initiated login flows.
//
// app.post('/api/magic-link', async (c) => {
//   const raw = await c.req.json();
//   const result = await validators.ciam.baseUser.validate(raw);
//   if (result.issues) {
//     return validationFailureResponse(result.issues, 'Invalid request body');
//   }
//   const { userName, name, email, avatar, redirect } = result.value;
//   const magicLinkResponse = await fetch(`${process.env.APP_BASE_URL}/api/es/magic-link`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${await getWorkloadToken('my-app', es)}`,
//     },
//     body: JSON.stringify({ userName, name, email, avatar, redirect }),
//   });
//   if (!magicLinkResponse.ok) {
//     return Response.json({ error: 'Failed to generate magic link' }, { status: 500 });
//   }
//   const data = await magicLinkResponse.json();
//   return c.json({ magicLink: data.magicLink, expiresAt: data.expiresAt });
// });

// ─── Workload authentication ──────────────────────────────────────────────────
// Machine-to-machine auth using workload tokens. Requires workloadTokenStore above.
//
// Use getWorkloadToken(slug, es) to obtain a token for a named workload client
// registered in the vault (ESI). Use validateWorkloadToken(request, es) to
// verify inbound tokens on protected endpoints.
//
// Example: protect an endpoint so only trusted workloads can call it.
//
// app.post('/api/internal/action', async (c) => {
//   const workload = await validateWorkloadToken(c.req.raw, es);
//   if (!workload) {
//     return Response.json({ error: 'Unauthorized' }, { status: 401 });
//   }
//   // workload.clientId identifies which registered workload made the request
//   return c.json({ ok: true, caller: workload.clientId });
// });
//
// Example: call another app using a workload token.
//
// const token = await getWorkloadToken('target-app-slug', es);
// const response = await fetch('https://other-app/api/internal/action', {
//   method: 'POST',
//   headers: { Authorization: `Bearer ${token}` },
// });

// ─── Multi-tenancy ────────────────────────────────────────────────────────────
// Uncomment to add tenant provisioning and per-tenant SSO instances.
//
// const tenants = new InMemoryTenantStore({
//   userMode: 'singleTenantOnly', // or 'multipleTenantsPerUser'
//   ttl: 60 * 60 * 1000,
//   createEs: (tenant) =>
//     enterpriseStandard(tenant.config(), {
//       validators,
//       basePath: `/api/${tenant.tenantId}/es`,
//     }),
// });
//
// const tm = tenantManager(es, {
//   validators,
//   basePath: '/api/tenants',
//   store: tenants,
//   requireWorkloadAuth: false,
// });
//
// // Tenant management endpoints (create, update, delete tenants)
// app.all('/api/tenants/*', ({ req }) => tm.handler(req.raw));
//
// // Per-tenant SSO handler
// app.all('/api/:tenantId/es/*', async (c) => {
//   const tenantId = c.req.param('tenantId');
//   const tenantEs = await tenants.getEs(tenantId);
//   if (!tenantEs) return Response.json({ error: 'Not Found' }, { status: 404 });
//   return tenantEs.handler(c.req.raw);
// });
//
// // Per-tenant readiness status
// app.get('/api/:tenantId/status', async (c) => {
//   const tenantId = c.req.param('tenantId');
//   const tenant = await tm.getTenant(tenantId);
//   if (!tenant) return Response.json({ error: 'Tenant Not Found' }, { status: 404 });
//   const tenantEs = await tenants.getEs(tenantId);
//   if (!tenantEs) return Response.json({ error: 'Tenant Not Found' }, { status: 404 });
//   await tenantEs.ready();
//   return Response.json({ ready: tenantEs.isReady(), tenantId, status: tenant.status }, { status: 200 });
// });

// ─── Session management (multi-tenant) ────────────────────────────────────────
// Uncomment to support cross-tenant session discovery and switching.
// Requires the multi-tenancy block above to be enabled.
//
// type TenantSessionTarget = {
//   tenantId: string;
//   clientId: string;
//   companyName?: string;
//   tenantName: string;
//   es: EnterpriseStandard;
// };
//
// async function listTenantSessionTargets(): Promise<TenantSessionTarget[]> {
//   const result = await tenants.list();
//   const targets: TenantSessionTarget[] = [];
//   for (const tenant of result.items) {
//     const tenantEs = await tenants.getEs(tenant.tenantId);
//     if (!tenantEs) continue;
//     targets.push({
//       tenantId: tenant.tenantId,
//       clientId: tenantEs.sso?.clientId?.trim() || tenant.tenantId,
//       companyName: tenant.companyName,
//       tenantName: tenant.companyName || tenant.tenantId,
//       es: tenantEs,
//     });
//   }
//   return targets;
// }
//
// // List all tenant session targets (tenantId, clientId, tenantName)
// app.get('/api/sessions/targets', async () => {
//   const targets = await listTenantSessionTargets();
//   return Response.json(
//     targets.map(({ tenantId, clientId, companyName, tenantName }) => ({
//       tenantId,
//       clientId,
//       companyName,
//       tenantName,
//     })),
//   );
// });
//
// // Resolve active sessions across all tenants for the current user.
// // Pass ?tenantId=<id> to prefer a specific tenant's session as active.
// app.get('/api/sessions', async (c) => {
//   const requestedTenantId = c.req.query('tenantId')?.trim();
//   const targets = await listTenantSessionTargets();
//   const esInstances = new Map(targets.map((t) => [t.clientId, t.es]));
//   const metaByClientId = new Map(
//     targets.map((t) => [
//       t.clientId,
//       { tenantId: t.tenantId, companyName: t.companyName, tenantName: t.tenantName },
//     ]),
//   );
//   const preferredTarget = requestedTenantId
//     ? (targets.find((t) => t.tenantId === requestedTenantId) ?? null)
//     : null;
//   const result = await resolveSessions(c.req.raw, esInstances, {
//     describeSession: (session) => metaByClientId.get(session.clientId),
//     preferredClientId: preferredTarget?.clientId ?? null,
//   });
//   return new Response(
//     JSON.stringify({
//       activeSession: result.activeClientId,
//       staleActiveSession: result.staleActiveClientId,
//       sessions: result.sessions,
//     }),
//     {
//       status: 200,
//       headers: {
//         'Content-Type': 'application/json',
//         ...(result.setCookie ? { 'Set-Cookie': result.setCookie } : {}),
//       },
//     },
//   );
// });
//
// // Switch the active session to a different tenant.
// // Body: { clientId: string, redirectTo?: string }
// app.post('/api/sessions/switch', async (c) => {
//   let body: { clientId?: string; redirectTo?: string } = {};
//   try {
//     body = (await c.req.json()) as { clientId?: string; redirectTo?: string };
//   } catch {
//     return Response.json({ error: 'Invalid JSON' }, { status: 400 });
//   }
//   if (!body.clientId?.trim()) {
//     return Response.json({ error: 'Missing clientId' }, { status: 400 });
//   }
//   const targets = await listTenantSessionTargets();
//   const esInstances = new Map(targets.map((t) => [t.clientId, t.es]));
//   const targetByClientId = new Map(targets.map((t) => [t.clientId, t]));
//   return switchSession(c.req.raw, body.clientId.trim(), esInstances, {
//     loginUrl: ({ clientId, request }) => {
//       const target = targetByClientId.get(clientId);
//       if (!target) return null;
//       const loginUrl = new URL(`/api/${target.tenantId}/es/auth/login`, request.url);
//       if (body.redirectTo?.trim()) loginUrl.searchParams.set('redirect', body.redirectTo.trim());
//       return loginUrl.toString();
//     },
//   });
// });

// ─── LFV (secret delivery) ────────────────────────────────────────────────────
// Uncomment to handle LFV secret delivery and event webhooks from the vault.
//
// app.post('/api/lfv', async (c) => {
//   const request = c.req.raw;
//   if (es.secrets?.isLfvDeliveryRequest?.(request)) return es.secrets.handleLfvDelivery!(request);
//   if (es.secrets?.isLfvEventsRequest?.(request)) return es.secrets.handleLfvEvents!(request);
//   return new Response('Not Found', { status: 404 });
// });

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
console.log(`Hono API server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
