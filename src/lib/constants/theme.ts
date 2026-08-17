/**
 * Single source of truth for UI geometry and design system tokens.
 */
export const BORDER_RADIUS = 10;
export const BORDER_RADIUS_PX = `${BORDER_RADIUS}px`;

/** Semantic priority colors — mirror the theme's green/amber/red/indigo accents. */
export const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  default: '#6366f1',
} as const;

/** Elevation tokens used across the Kanban board. */
export const SHADOWS = {
  card: '0 1px 3px rgba(0, 0, 0, 0.2)',
  hover: '0 4px 16px rgba(0, 0, 0, 0.3)',
  drag: '0 16px 32px rgba(0, 0, 0, 0.4)',
  pop: '0 4px 12px rgba(0, 0, 0, 0.2)',
} as const;

/** Translucent indigo fills for interactive emphasis on the dark surfaces. */
export const PRIMARY_TINTS = {
  subtle: 'rgba(99, 102, 241, 0.05)',
  strong: 'rgba(99, 102, 241, 0.1)',
} as const;
