import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import { App } from './App';
import { useStadiumStore } from './store/stadium-store';
import { buildBaselineSnapshot } from './domain/scenarios';

// Boot into the consistent baseline (normal match day) without an audit entry.
useStadiumStore.setState(buildBaselineSnapshot());

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
