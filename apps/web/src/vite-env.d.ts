/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin for the legacy API. Leave it UNSET in development: the
   * Vite proxy forwards same-origin /api to http://localhost:5001, which keeps
   * the client's baseUrl empty and avoids CORS.
   */
  readonly VITE_API_BASE_URL?: string;
  /**
   * Sage AI host, per environment (staging vs prod). Falls back to the legacy
   * default when unset — see `features/sage/sage-frame.tsx`.
   */
  readonly VITE_SAGE_URL?: string;
  /**
   * Set to `'true'` while certificate downloads are switched off server-side
   * (`CERTIFICATE_DOWNLOAD_MAINTENANCE`). The course landing page reads it to
   * decide whether a CME block may promise a certificate: 2,860 people already
   * hold a completion record with no file behind it, and advertising the
   * download to them is the difference between an honest page and a lie.
   *
   * A value, not a hard-coded boolean, so switching it back off when the
   * server flag clears is a deploy config change and not a code change.
   */
  readonly VITE_CERTIFICATES_UNAVAILABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Short commit the bundle was built from; `unknown` outside a git checkout. */
declare const __APP_COMMIT__: string;
