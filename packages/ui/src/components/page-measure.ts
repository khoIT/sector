/**
 * How wide a page is allowed to get, by what the page is FOR.
 *
 * Width used to be one number in the app shell — every route capped at
 * 1400px, centred, no opt-out. That is two mistakes in one line: a paragraph
 * of prose is unreadable at 1400px, and a table of 1,477 groups has no reason
 * to stop there on a 2200px screen. Neither surface could say so, because the
 * shell decided for both.
 *
 * So the shell decides nothing and each route declares its measure:
 *
 *   reading  a column of text or a single-column form
 *   working  lists, grids and dashboards — fluid, with a far edge
 *   full     media surfaces that own their own width
 *
 * `42rem` is not a new number: `question-bank-detail-page.tsx` and the quiz
 * runner already shipped exactly that cap for their reading surfaces, so this
 * generalises a decision the codebase had already made twice.
 *
 * A route that forgets to declare one is a bug, and `route-measures.test.ts`
 * is what turns it into a failing test rather than a page nobody notices is
 * full-bleed.
 */
export type PageMeasure = 'reading' | 'working' | 'full';

const MEASURE_CLASS: Record<PageMeasure, string> = {
  // Prose and forms. Blocks inside a page keep their own `max-w-[62ch]`
  // clamps — this measures the PAGE, that measures the PARAGRAPH.
  reading: 'mx-auto w-full max-w-[42rem]',
  // Fluid to 1920. Wide enough that a six-column table stops scrolling
  // internally on a large screen, bounded so a 2560px monitor does not stretch
  // one row of text across its whole width.
  working: 'mx-auto w-full max-w-[120rem]',
  // The scan viewer and the course player: they letterbox themselves, and a
  // cap here would waste the screen they exist for.
  full: 'w-full',
};

/**
 * The class string for a measure. Unknown or absent falls back to `working`,
 * which is what most routes want — a forgotten measure should look ordinary,
 * not full-bleed, and never throw.
 */
export function pageMeasureClass(measure: PageMeasure = 'working'): string {
  return MEASURE_CLASS[measure] ?? MEASURE_CLASS.working;
}
