import type { CourseOutlineItem } from '@sector/api-client';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@sector/ui';
import { ListTree } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OutlineSidebar } from '../runner/outline-sidebar';
import { positionLabel } from '../runner/player-position';

export type ContentsDrawerProps = {
  courseId: string;
  items: readonly CourseOutlineItem[];
  currentItemId: string;
};

/**
 * The contents list, for a screen with no room for a column.
 *
 * Below `lg` the pane used to sit ABOVE the video, so opening a topic on a
 * phone meant scrolling past a list of 46 items to reach the thing you had
 * just chosen. The list moves in here and the video leads.
 *
 * The trigger carries the one fact the list was giving away for free — how far
 * through the course this item is — so collapsing it costs the learner nothing
 * they were reading.
 */
export function ContentsDrawer({ courseId, items, currentItemId }: ContentsDrawerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { index, total } = positionLabel(items, currentItemId);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="inline-flex items-center gap-1.5 rounded-token border border-line bg-surface px-2 py-1 text-[12px] text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink lg:hidden">
        <ListTree className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
        <span className="sv-num">
          {index > 0
            ? t('courses.runner.contents.open', { index, total })
            : t('courses.runner.contents.title')}
        </span>
      </DrawerTrigger>

      <DrawerContent side="left" aria-describedby={undefined}>
        <DrawerTitle className="mb-3">{t('courses.runner.contents.title')}</DrawerTitle>
        {/* Closing on navigation rather than leaving the sheet over the item
            the learner just picked. */}
        <OutlineSidebar
          courseId={courseId}
          items={items}
          currentItemId={currentItemId}
          onNavigate={() => setOpen(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
