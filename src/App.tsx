import {
  // Uncomment as you enable features:
  // SignInButton,
  // UserButton,
  SignedIn,
  SignedOut,
  SignInLoading,
  SSOProvider,
  logout,
  useUser,
} from '@enterprisestandard/react';

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <SSOProvider userUrl="/api/es/auth/user" storage="local">
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="space-y-8 text-center">
          <div className="flex items-center justify-center space-x-8">
            <a href="https://vite.dev" target="_blank" rel="noopener">
              <img src="https://vite.dev/logo.svg" alt="Vite logo" className="h-24 w-24" />
            </a>
            <div className="font-light text-4xl text-gray-400">+</div>
            <a href="https://enterprisestandard.com/" target="_blank" rel="noopener">
              <img
                src="https://enterprisestandard.com/enterprisestandard.svg"
                alt="Enterprise Standard logo"
                className="h-24 w-24"
              />
            </a>
            <div className="font-light text-4xl text-gray-400">+</div>
            <a href="https://hono.dev" target="_blank" rel="noopener">
              <img src="https://hono.dev/images/logo.svg" alt="Hono logo" className="h-24 w-24" />
            </a>
          </div>

          <h1 className="font-bold text-4xl text-white">Vite React + Enterprise Standard + Hono API</h1>

          {/* ─── Auth state ─────────────────────────────────────────────────── */}

          <div className="text-gray-300">
            <SignInLoading>Loading...</SignInLoading>

            <SignedIn>
              <UserPanel />
            </SignedIn>

            <SignedOut>
              You are signed out
              <br />
              <a href={`/api/es/auth/login?redirect=${encodeURIComponent(location.href)}`}>Login</a>
              {/* Alternatively, use the pre-built sign-in button: */}
              {/* <SignInButton /> */}
            </SignedOut>
          </div>

          <p className="text-gray-400 text-sm">Brought to you by</p>

          <div>
            <a href="https://ionite.com/">
              <img src="https://enterprisestandard.com/ionite.svg" alt="Ionite logo" className="mx-auto h-24" />
            </a>
          </div>
        </div>
      </div>
    </SSOProvider>
  );
}

// ─── Signed-in user panel ─────────────────────────────────────────────────────

function UserPanel() {
  const { user } = useUser();

  return (
    <>
      You are signed in: {user?.name}
      <br />

      {/* Hard redirect logout */}
      <a href="/api/es/auth/logout?redirect=/">
        <button type="button" className="mt-2 rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">
          Logout
        </button>
      </a>

      {/* Async logout — components update reactively, no page reload needed */}
      <button
        type="button"
        onClick={async () => {
          const result = await logout('/api/es/auth/logout');
          if (!result.success) console.error('Logout failed:', result.error);
        }}
        className="mt-2 ml-2 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
      >
        Logout Async
      </button>

      {/* Alternatively, use the pre-built user button: */}
      {/* <UserButton /> */}

      {/* ─── CIAM: magic link generation ──────────────────────────────────────
          Requires /api/magic-link on the server and magicLinkStore in stores.
          Uncomment the MagicLinkForm component below to use this.

      <div className="mt-6 border-gray-700 border-t pt-4">
        <h2 className="mb-2 font-semibold text-lg text-white">Magic Link</h2>
        <p className="mb-2 text-gray-400 text-sm">Generate a passwordless sign-in link for a user.</p>
        <MagicLinkForm />
      </div>
      */}

      {/* ─── Session switching (multi-tenant) ─────────────────────────────────
          Requires /api/sessions/targets and /api/sessions/switch on the server.
          Uncomment the SessionSwitcher component and server routes to use this.

      <div className="mt-6 border-gray-700 border-t pt-4">
        <h2 className="mb-2 font-semibold text-lg text-white">Switch Tenant Session</h2>
        <SessionSwitcher />
      </div>
      */}
    </>
  );
}

// ─── CIAM: magic link form ────────────────────────────────────────────────────
// Uncomment this component and the /api/magic-link route in server.ts to enable
// server-side magic link generation. Requires magicLinkStore in stores.
//
// import { useEffect, useState } from 'react'; // add to existing import if needed
//
// function MagicLinkForm() {
//   const [userData, setUserData] = useState({ userName: '', name: '', email: '' });
//   const [result, setResult] = useState<{ magicLink: string; expiresAt: string } | null>(null);
//   const [loading, setLoading] = useState(false);
//
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     try {
//       const res = await fetch('/api/magic-link', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(userData),
//       });
//       if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
//       setResult(await res.json());
//     } catch (err) {
//       alert(err instanceof Error ? err.message : 'Failed to generate magic link');
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   return (
//     <form onSubmit={handleSubmit} className="space-y-2 text-left">
//       <input
//         required
//         placeholder="Username"
//         value={userData.userName}
//         onChange={(e) => setUserData({ ...userData, userName: e.target.value })}
//         className="block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
//       />
//       <input
//         required
//         placeholder="Name"
//         value={userData.name}
//         onChange={(e) => setUserData({ ...userData, name: e.target.value })}
//         className="block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
//       />
//       <input
//         required
//         type="email"
//         placeholder="Email"
//         value={userData.email}
//         onChange={(e) => setUserData({ ...userData, email: e.target.value })}
//         className="block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
//       />
//       <button
//         type="submit"
//         disabled={loading}
//         className="w-full rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-400"
//       >
//         {loading ? 'Generating...' : 'Generate Magic Link'}
//       </button>
//       {result && (
//         <a href={result.magicLink} className="block break-all text-blue-400 text-sm hover:underline">
//           {result.magicLink}
//         </a>
//       )}
//     </form>
//   );
// }

// ─── Session switcher (multi-tenant) ─────────────────────────────────────────
// Uncomment this component and the session routes in server.ts to enable
// cross-tenant session switching.
//
// import { useEffect, useState } from 'react';
//
// type SessionTarget = {
//   tenantId: string;
//   clientId: string;
//   tenantName: string;
//   companyName?: string;
// };
//
// function SessionSwitcher() {
//   const [targets, setTargets] = useState<SessionTarget[]>([]);
//   const [switching, setSwitching] = useState<string | null>(null);
//
//   useEffect(() => {
//     fetch('/api/sessions/targets')
//       .then((r) => r.json())
//       .then(setTargets)
//       .catch(console.error);
//   }, []);
//
//   const handleSwitch = async (clientId: string) => {
//     setSwitching(clientId);
//     try {
//       const res = await fetch('/api/sessions/switch', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ clientId, redirectTo: window.location.href }),
//       });
//       if (res.redirected) window.location.href = res.url;
//     } finally {
//       setSwitching(null);
//     }
//   };
//
//   if (targets.length === 0) return <p className="text-gray-500 text-sm">No tenants registered.</p>;
//
//   return (
//     <div className="mt-2 space-y-2">
//       {targets.map((t) => (
//         <button
//           key={t.clientId}
//           type="button"
//           disabled={switching === t.clientId}
//           onClick={() => handleSwitch(t.clientId)}
//           className="rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600 disabled:bg-gray-400"
//         >
//           {switching === t.clientId ? 'Switching...' : `Switch to ${t.tenantName}`}
//         </button>
//       ))}
//     </div>
//   );
// }
