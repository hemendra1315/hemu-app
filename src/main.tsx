import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { registerPwa } from './pwa';
import { reportError } from './lib/logger';
import './styles/index.css';

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, { scope: 'unhandledrejection' });
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerPwa();
