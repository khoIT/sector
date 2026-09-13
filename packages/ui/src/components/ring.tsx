import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { ringArc } from './ring-geometry';

export type RingProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 0-100. */
  percentage: number;
  /** Overall box size in px. Stroke width scales with it. */
  size?: number;
  label?: ReactNode;
  children?: ReactNode;
};

/**
 * A circular progress ring — the quiz results score ("78%" centred inside
 * it). The arc maths (circumference, dash offset) lives in ./ring-geometry.ts
 * and is what is actually tested; this component only draws two circles.
 */
export const Ring = forwardRef<HTMLDivElement, RingProps>(function Ring(
  { percentage, size = 72, label, children, className, ...props },
  ref,
) {
  const strokeWidth = Math.max(3, size / 12);
  const radius = size / 2 - strokeWidth / 2;
  const { circumference, offset } = ringArc(percentage, radius);
  const center = size / 2;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={typeof label === 'string' ? label : `${Math.round(percentage)}%`}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-2"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent-ink transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <span className="sv-num absolute text-[13px] font-semibold text-ink">{children}</span>
    </div>
  );
});
