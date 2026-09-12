import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { initI18n } from '@/i18n';

import './styles.css';

// Before the first render, so no component mounts against an uninitialised
// i18next and flashes raw keys.
initI18n();

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
