import { SSOProvider } from '@enterprisestandard/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

// Extract tenant from URL path (e.g., /admin -> "admin")
const tenant = window.location.pathname.split('/')[1];
if (!tenant) {
  window.location.href = '/admin';
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <StrictMode>
      <SSOProvider userUrl={`/api/es/${tenant}/auth/user`} storage="local">
        <App />
      </SSOProvider>
    </StrictMode>,
  );
}
