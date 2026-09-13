export type DrawerSide = 'left' | 'right';

/**
 * The position/sizing classes for <DrawerContent>, kept as a pure lookup so
 * the left/right split is a data decision rather than a duplicated template
 * literal inside the component.
 */
export function drawerContentClass(side: DrawerSide): string {
  const edge = side === 'right' ? 'right-0' : 'left-0';
  return `fixed inset-y-0 ${edge} h-full w-[min(24rem,100vw)]`;
}
