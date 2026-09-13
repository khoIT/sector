import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { migratePersistedStorage } from '@/app/storage-migration';
import { initI18n } from '@/i18n';

import './styles.css';

// First, and before the first render: the session, the theme and the draft
// are all read on the way to the first paint, and a value still sitting under
// the pre-rename `scanvault.` name would read as absent — a signed-out user
// staring at an empty draft, with nothing to say what happened.
//
// A call here in the module body is early enough because nothing reads storage
// at import time: `createSessionStore()` in lib/api.ts builds closures and
// touches localStorage only when something asks it for a token, and
// ThemeProvider reads its key in a useState initialiser during the first
// render. If either ever became eager, this would have to move into a
// side-effect import above `@/app` instead.
migratePersistedStorage();

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
