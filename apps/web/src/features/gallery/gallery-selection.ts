import type { PathologyCategory } from '@sector/api-client';

/**
 * Which category the bar should select, given what the server returned and
 * what the URL asked for. `null` means the URL is already fine.
 *
 * The rule is one line of code and two lines of reasoning, so it lives apart
 * from the component that applies it: the component's effect cannot be tested
 * in this app's node test environment, and this is the part worth testing.
 *
 * A category name is not a stable identifier. It is a scan type's name, or the
 * raw text of a category that has no scan type behind it — and the two of those
 * on the production data, `FAST/EFAST` and `Rapid Reviews`, are waiting on a
 * decision that will rename or retire them. So `?category=` in a shared or
 * bookmarked link can name something the server no longer returns, and that has
 * to resolve to a real category rather than to no selection at all.
 */
export function categoryToSelect(
  categories: readonly PathologyCategory[],
  selected: string,
): string | null {
  const first = categories[0];
  if (!first) return null;

  const isKnown = categories.some((category) => category.name === selected);
  return isKnown ? null : first.name;
}
