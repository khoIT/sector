import { Button } from '@sector/ui';
import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type CourseLayout = 'grid' | 'list';

export type CourseLayoutToggleProps = {
  value: CourseLayout;
  onChange: (layout: CourseLayout) => void;
};

/**
 * Grid or list, as a pair of buttons rather than a menu: two options do not
 * need a popup, and the current one has to be visible without opening
 * anything.
 *
 * `aria-pressed` rather than `aria-current`: this is a toggle between two
 * states of the same list, not navigation between two places. The group needs
 * no label of its own — each button names itself and reports its own pressed
 * state, which is the whole of what a reader needs here.
 */
export function CourseLayoutToggle({ value, onChange }: CourseLayoutToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 rounded-token border border-line p-0.5">
      {(
        [
          ['grid', LayoutGrid, 'courses.index.layout.grid'],
          ['list', List, 'courses.index.layout.list'],
        ] as const
      ).map(([layout, Icon, labelKey]) => (
        <Button
          key={layout}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === layout}
          aria-label={t(labelKey)}
          title={t(labelKey)}
          onClick={() => onChange(layout)}
          className={value === layout ? 'text-accent-ink' : 'text-ink-dim'}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </Button>
      ))}
    </div>
  );
}
