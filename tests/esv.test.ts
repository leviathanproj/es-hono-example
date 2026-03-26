/**
 * Enterprise Standard Validation Tests
 *
 * These tests validate that this application correctly implements
 * Enterprise Standard functionality.
 *
 * Usage: Just run `bun run test:esv` - it handles everything automatically.
 *
 * The test will:
 *   1. Start the ESV mock server on port 3555
 *   2. Start the Hono API server with ES_VAULT_URL, ES_VAULT_TOKEN, and ES_VAULT_PATH set
 *   3. Run the validation tests
 *   4. Clean up both servers
 */
import { type ChildProcess, spawn } from 'node:child_process';
import {
  createIAMTests,
  createSSOTests,
  createTenantTests,
  createWorkloadTests,
  getTenantAuthToken,
  startServer,
  stopServer,
} from '@enterprisestandard/esv';
import {
  type EnterpriseStandard,
  enterpriseStandard,
  InMemorySessionStore,
  vault,
  vaultConfig,
} from '@enterprisestandard/server';
import { createValidators } from '@enterprisestandard/valibot';
import { afterAll, beforeAll, describe, it } from 'vitest';

// Base URL for the application under test
// Note: Hono example runs on port 3544 (internal API; use 3543 for public)
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3544';

let appProcess: ChildProcess | null = null;
let es: EnterpriseStandard | null = null;
let testAppId: string = 'test-app'; // Default value, will be confirmed in beforeAll
const testTenantName: string = 'testcompany'; // Derived from companyName: 'Test Company'
/** Workload token for authenticating tenant creation requests (from ESV mock) */
let tenantAuthToken: string = '';

// Start the ESV mock server and the application
beforeAll(async () => {
  // 1. Start the ESV mock server first
  await startServer();
  console.log('✅ ESV mock server started at http://localhost:3555');

  // 2. Set environment variables in the test process so enterpriseStandard can use them
  process.env.ES_CONFIG_TYPE = 'openbao';
  process.env.ES_VAULT_URL = 'http://localhost:3555/vault/v1/secret/data';
  process.env.ES_VAULT_TOKEN = 'local-esv-token';
  process.env.ES_VAULT_PATH = 'esv/config';

  // 3. Initialize enterpriseStandard with workload configuration from ESV mock server
  const vaultPath = process.env.ES_VAULT_PATH ?? '';
  if (!vaultPath) throw new Error('ES_VAULT_PATH must be set');
  const vaultClient = vault({
    type: 'openbao',
    url: process.env.ES_VAULT_URL,
    token: process.env.ES_VAULT_TOKEN,
  });
  es = enterpriseStandard(vaultConfig({ vault: vaultClient, path: vaultPath }), {
    validators: createValidators(),
    ciam: {
      sessionStore: new InMemorySessionStore(),
    },
  });

  // 4. Start the Hono API server with APP_BASE_URL so OIDC redirect_uri matches test callback path (direct 3544 in tests)
  appProcess = spawn('bun', ['run', 'api'], {
    env: {
      ...process.env,
      APP_BASE_URL: BASE_URL,
      ES_VAULT_URL: 'http://localhost:3555/vault/v1/secret/data',
      ES_VAULT_TOKEN: 'local-esv-token',
      ES_VAULT_PATH: 'esv/config',
    },
    stdio: 'inherit',
  });

  // Handle process errors
  appProcess.on('error', (err) => {
    console.error('Failed to start application:', err);
  });

  // 5. Get workload token from ESV mock (POST /api/tenants requires workload identity)
  tenantAuthToken = await getTenantAuthToken('http://localhost:3555');

  // 6. Wait for the application to be ready and create test tenant
  const maxRetries = 30;
  const retryDelay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAuthToken}`,
        },
        body: JSON.stringify({
          tenantId: 'test-app',
          companyId: 'test-company',
          companyName: 'Test Company',
          environmentType: 'POC',
          email: 'test@example.com',
          webhookUrl: 'http://localhost:3555/webhook',
          callbackUrl: `${BASE_URL}/tenants?tenantId=test-app`,
          tenantUrl: `${BASE_URL}/api/es/testcompany`,
          configSource: {
            type: 'vault',
            url: 'http://localhost:3555/vault/v1/secret/data',
            token: 'local-esv-token',
            path: 'esv/config',
          },
        }),
      });

      if (response.ok) {
        await response.json();
        testAppId = 'test-app'; // Use the appId we sent
        console.log(`✅ Application ready at ${BASE_URL}, tenant created: ${testAppId}`);

        // Wait a bit for tenant initialization
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      } else {
        // Server responded but with error - might be duplicate tenant, try to continue
        const errorText = await response.text();
        if (response.status === 400 && errorText.includes('already exists')) {
          // Tenant already exists, that's OK
          testAppId = 'test-app';
          console.log(`✅ Application ready at ${BASE_URL}, using existing tenant: ${testAppId}`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return;
        }
        // Other error, wait and retry
        if (i === maxRetries - 1) {
          throw new Error(`Failed to create tenant: ${response.status} ${errorText}`);
        }
      }
    } catch (error) {
      // Connection error - server not ready yet
      if (i === maxRetries - 1) {
        throw new Error(
          `Application not ready at ${BASE_URL} after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
});

// Stop both servers after all tests
afterAll(async () => {
  // Kill the application process
  if (appProcess) {
    appProcess.kill('SIGTERM');
    // Give it a moment to clean up
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('✅ Application stopped');
  }

  // Stop the ESV mock server
  await stopServer();
  console.log('✅ ESV mock server stopped');
});

describe('Enterprise Standard Validation', () => {
  describe('Tenant', () => {
    const tests = createTenantTests({
      baseUrl: BASE_URL,
      tenantPath: '/api/tenants',
      headers: () => ({ Authorization: `Bearer ${tenantAuthToken}` }),
      testTenantData: {
        tenantId: 'tenant-test-app',
        companyId: 'tenant-test-company',
        companyName: 'Tenant Test Company',
        environmentType: 'POC',
        email: 'tenant-test@example.com',
        configSource: {
          type: 'dev',
          ioniteUrl: 'https://ionite.com',
        },
      },
      webhookPath: '/webhook', // ESV mock server webhook endpoint
    });

    // Register all Tenant tests
    tests.map(({ name, fn }) => it(name, fn));
  });

  describe('SSO', () => {
    const { tests, ext } = createSSOTests({
      baseUrl: BASE_URL,
      loginPath: `/api/es/${testTenantName}/auth/login`,
      callbackPath: `/api/es/${testTenantName}/auth/callback`,
      userPath: `/api/es/${testTenantName}/auth/user`,
      logoutPath: `/api/es/${testTenantName}/auth/logout`,
      backChannelLogoutPath: `/api/es/${testTenantName}/auth/logout/backchannel`,
    });

    tests.map(({ name, fn }) => it(name, fn));

    // Optional: JIT user provisioning tests
    describe('JIT', () => {
      ext.createJITTests().map(({ name, fn }) => it(name, fn));
    });

    // Optional: Logout endpoint tests
    describe('Logout', () => {
      ext.createLogoutTests().map(({ name, fn }) => it(name, fn));
    });

    // Optional: Back-channel logout tests
    describe('Back-Channel Logout', () => {
      ext.createBackChannelLogoutTests().map(({ name, fn }) => it(name, fn));
    });
  });

  describe('Workload', () => {
    const tests = createWorkloadTests({
      baseUrl: BASE_URL,
      // Workload endpoints - may not all be implemented
      tokenPath: `/api/es/${testTenantName}/workload/token`,
      validatePath: `/api/es/${testTenantName}/workload/validate`,
      jwksPath: `/api/es/${testTenantName}/workload/jwks`,
      refreshPath: `/api/es/${testTenantName}/workload/refresh`,
    });

    // Register all Workload tests
    tests.map(({ name, fn }) => it(name, fn));
  });

  describe('IAM', () => {
    const { tests, ext } = createIAMTests({
      baseUrl: BASE_URL,
      scimPath: `/api/es/${testTenantName}/iam`,
      groupsInboundPath: `/api/es/${testTenantName}/iam/Groups`,
      es: () => es,
    });

    // Core user management tests
    tests.map(({ name, fn }) => it(name, fn));

    // Optional: Groups Outbound tests (app -> external IAM)
    describe('Groups Outbound', () => {
      ext.createGroupsOutboundTests().map(({ name, fn }) => it(name, fn));
    });

    // Optional: Groups Inbound tests (external IAM -> app)
    describe('Groups Inbound', () => {
      ext.createGroupsInboundTests().map(({ name, fn }) => it(name, fn));
    });
  });
});

// For developers who just want to quickly see what enterprise standards have been implemented
// defineESVTests(describe, it, {
//   baseUrl: BASE_URL,
//   sso: {
//     baseUrl: BASE_URL,
//     loginPath: `/${testAppId}/api/auth/login`,
//     callbackPath: `/${testAppId}/api/auth/callback`,
//     userPath: `/${testAppId}/api/auth/user`,
//     logoutPath: `/${testAppId}/api/auth/logout`,
//     backChannelLogoutPath: `/${testAppId}/api/auth/logout/backchannel`,
//   },
//   iam: {
//     es: () => es,
//     baseUrl: BASE_URL,
//     scimPath: `/${testAppId}/api/iam`,
//     groupsInboundPath: `/${testAppId}/api/iam/Groups`,
//   },
//   workload: {
//     baseUrl: BASE_URL,
//     tokenPath: `/${testAppId}/api/workload/token`,
//     validatePath: `/${testAppId}/api/workload/validate`,
//     jwksPath: `/${testAppId}/api/workload/jwks`,
//     refreshPath: `/${testAppId}/api/workload/refresh`,
//   },
//   tenant: {
//     baseUrl: BASE_URL,
//     tenantPath: `/api/tenant`,
//     testTenantData: {
//       appId: 'test-app',
//       companyId: 'test-company',
//       companyName: 'Test Company',
//       environmentType: 'POC',
//       email: 'test@example.com',
//     },
//   },
// });
