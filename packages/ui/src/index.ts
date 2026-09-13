/**
 * @sector/ui public surface.
 *
 * Import the stylesheet ONCE from the app entry:
 *   import '@sector/ui/styles.css';
 *
 * Everything else comes from the package root:
 *   import { Button, Card, StatusPill } from '@sector/ui';
 */

export { cn } from './lib/cn';

export {
  THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
  type ThemeProviderProps,
} from './theme/theme-provider';

export {
  AA_LARGE_TEXT,
  AA_NORMAL_TEXT,
  contrastRatio,
  meetsAA,
  parseHex,
  relativeLuminance,
  type Rgb,
} from './styles/contrast';

export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Combobox, type ComboboxOption, type ComboboxProps } from './components/combobox';
export { filterComboboxOptions, nextHighlight } from './components/combobox-filter';
export { Input, type InputProps } from './components/input';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type SelectItemProps,
  type SelectTriggerProps,
} from './components/select';

export {
  Badge,
  badgeVariants,
  StatusPill,
  type BadgeProps,
  type BadgeTone,
  type StatusPillProps,
} from './components/badge';

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type TableCellProps,
  type TableHeaderCellProps,
  type TableRowProps,
} from './components/table';

// ─── charts (recharts wrapped so the library stays swappable and every
// colour comes from the design tokens) ─────────────────────────────────────
export {
  CHART_AXIS_TEXT_COLOR,
  CHART_GRID_COLOR,
  CHART_SERIES_PRIMARY,
  CHART_TOOLTIP_BACKGROUND,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_TEXT,
  chartToneColor,
  type ChartTone,
} from './charts/chart-colors';
export { Donut, type DonutDatum, type DonutProps } from './charts/donut';
export { Bars, type BarsDatum, type BarsProps } from './charts/bars';
export { LineTrend, type LinePoint, type LineTrendProps } from './charts/line';
export { Sparkline, type SparklineProps } from './charts/sparkline';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from './components/dialog';

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuHint,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type DropdownMenuItemProps,
} from './components/dropdown-menu';

export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';

export {
  Skeleton,
  SkeletonTable,
  type SkeletonProps,
  type SkeletonTableProps,
} from './components/skeleton';

export { EmptyState, type EmptyStateProps } from './components/empty-state';
export { Textarea, type TextareaProps } from './components/textarea';

export { Progress, type ProgressProps, type ProgressTone } from './components/progress';

// ─── rich text ────────────────────────────────────────────────────────────────
export { RichText, type RichTextProps } from './components/rich-text';
export { sanitizeRichText } from './components/sanitize-rich-text';

// ─── quiz / question-bank primitives ──────────────────────────────────────────
export { ProgressMeter, type ProgressMeterProps } from './components/progress-meter';
export { progressMeterPercentage } from './components/progress-meter-percentage';

export { SegmentedProgress, type SegmentedProgressProps } from './components/segmented-progress';
export {
  segmentState,
  segmentStates,
  type SegmentState,
} from './components/segmented-progress-state';

export { RadioCard, type RadioCardProps } from './components/radio-card';
export { radioCardStateClasses, type RadioCardReveal } from './components/radio-card-state';

export { Ring, type RingProps } from './components/ring';
export { clampPercentage, ringArc, type RingArc } from './components/ring-geometry';

export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './components/accordion';

export { Toolbar } from './components/toolbar';
export { Stat, type StatProps } from './components/stat';
export { EmptyGrid, type EmptyGridProps } from './components/empty-grid';

export {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  type DrawerContentProps,
} from './components/drawer';
export { drawerContentClass, type DrawerSide } from './components/drawer-position';
