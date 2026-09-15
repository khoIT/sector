import { userDisplayName } from '@sector/api-client';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

import { ContinueLearningRow } from './continue-learning-row';
import { DueThisWeekPanel } from './due-this-week-panel';
import { MyLearningPanel } from './my-learning-panel';

/**
 * The subscriber/learner home. The whole home-screen decision this phase
 * carries: this dashboard alone is the deferrable fallback if the other
 * three run out of runway — see the phase's risk note — so it stands on its
 * own rather than importing anything the other three depend on.
 */
export function LearnerHome() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">
        {t('home.greeting', { name: user ? userDisplayName(user) : '' })}
      </h1>
      <ContinueLearningRow />
      <DueThisWeekPanel />
      <MyLearningPanel />
    </div>
  );
}
