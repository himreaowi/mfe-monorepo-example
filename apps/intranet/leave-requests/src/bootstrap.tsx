// Standalone entry only (`pnpm dev` in this folder). Never imported by the exposed module.
import '@org/design-tokens/global.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StandaloneApp } from './app/apps';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <StandaloneApp />
  </StrictMode>,
);
