import { Button, Card, CardContent } from '@scanvault/ui';
import { ClipboardList, MessageSquareText, Plus, UploadCloud } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { CREATE_SCAN_PATH } from '../scan-list-views';

const STEPS: Array<{
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = [
  {
    icon: ClipboardList,
    title: 'Pick a scan type',
    body: 'Lung, Cardiac, FAST, Vascular and the rest. The type decides which findings form you fill in.',
  },
  {
    icon: UploadCloud,
    title: 'Upload what you captured',
    body: 'Clips and stills straight off the probe. They are de-identified and rendered after upload, which takes a few seconds.',
  },
  {
    icon: MessageSquareText,
    title: 'Get it assessed',
    body: 'A reviewer in your group — or a GUSI expert — marks it achieved or not achieved and writes back teaching points.',
  },
];

/**
 * What a first-time learner sees instead of a table.
 *
 * My Scans is empty for every new account, and an empty table with "No
 * results." under it answers a question nobody asked. The first thing this
 * page has to do is explain what a scan study IS and get the learner into the
 * create flow; the table can appear once there is something to put in it.
 */
export function MyScansEmptyState() {
  const { can } = useAuth();
  const canCreate = can('create:scan');

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[17px] font-semibold text-ink">
            You have not created a scan study yet
          </h2>
          <p className="max-w-prose text-body text-ink-dim">
            A scan study is one ultrasound exam, kept as a single record: the images you captured,
            the findings you recorded, and the feedback you got back. It is the unit everything in
            the Scan Vault is built on — your progress, your reviewers’ notes, and your competency
            sign-offs all hang off it.
          </p>
        </div>

        <ol className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex flex-col gap-1.5 rounded-token border border-line bg-surface-2 p-3"
              >
                <span className="flex items-center gap-2 text-ink">
                  <Icon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                  <span className="sv-num text-[11px] text-ink-dim">Step {index + 1}</span>
                </span>
                <span className="text-body font-medium text-ink">{step.title}</span>
                <span className="text-body text-ink-dim">{step.body}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col items-center gap-2">
          {canCreate ? (
            <Button asChild size="lg">
              <Link to={CREATE_SCAN_PATH}>
                <Plus className="h-4 w-4" aria-hidden />
                Create Scan Study
              </Link>
            </Button>
          ) : (
            <p className="text-body text-ink-dim">
              Your role cannot create scans. Ask a GUSI administrator for the{' '}
              <code className="rounded bg-surface-2 px-1">create:scan</code> permission.
            </p>
          )}

          <p className="text-[11px] text-ink-dim">
            Nothing is shared until you submit it for review.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
