/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin for the legacy API. Leave it UNSET in development: the
   * Vite proxy forwards same-origin /api to http://localhost:5001, which keeps
   * the client's baseUrl empty and avoids CORS.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
