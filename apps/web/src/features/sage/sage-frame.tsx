import { Card, EmptyState } from '@sector/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

/**
 * Sage AI: an iframe onto GUSI's own tutor, not rebuilt here — the legacy
 * dashboard's version was itself six lines around this same iframe, plus a
 * long marketing "user guide" dialog that is out of scope for this port.
 *
 * The entitlement check is the one thing that has to survive the port: the
 * iframe asserts identity via `?user=<userName>` in its query string, so it
 * must never render before a real signed-in user is known. The route this
 * page mounts at is already behind `<RequireAuth>`, which makes `user` null
 * only for the instant before a session restore settles — this guard is what
 * keeps that instant from ever reaching the iframe with an empty identity.
 */
const SAGE_BASE_URL = import.meta.env.VITE_SAGE_URL || 'https://sage.gusiaidev.com';

export function SageFrame() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  if (!user) {
    return (
      <EmptyState title={t('sage.signedOut.title')} description={t('sage.signedOut.description')} />
    );
  }

  const src = `${SAGE_BASE_URL}/?use_iframe&allow_selection=true&user=${encodeURIComponent(user.userName)}`;

  return (
    <section aria-label={t('sage.title')} className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-[17px] font-semibold text-ink">{t('sage.title')}</h2>
        <p className="text-body text-ink-dim">{t('sage.description')}</p>
      </div>
      <Card className="relative flex-1 overflow-hidden p-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <p className="text-body text-ink-dim">{t('sage.loading')}</p>
          </div>
        )}
        <iframe
          src={src}
          title={t('sage.title')}
          className="h-full min-h-[70vh] w-full border-0"
          onLoad={() => setLoading(false)}
        />
      </Card>
    </section>
  );
}
