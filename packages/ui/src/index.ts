/**
 * @scanvault/ui public surface.
 *
 * Import the stylesheet ONCE from the app entry:
 *   import '@scanvault/ui/styles.css';
 *
 * Everything else comes from the package root:
 *   import { Button, Card, StatusPill } from '@scanvault/ui';
 */

export { cn } from './lib/cn';

export {
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

export { Skeleton, SkeletonTable, type SkeletonProps, type SkeletonTableProps } from './components/skeleton';

export { EmptyState, type EmptyStateProps } from './components/empty-state';
export { Textarea, type TextareaProps } from './components/textarea';

export { Progress, type ProgressProps, type ProgressTone } from './components/progress';

