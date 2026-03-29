'use client'

import { cn } from '@/lib/utils'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'

interface ProgressRingProps {
  /** Percentual de 0 a 100 */
  pct: number
  /** Diâmetro em px (padrão: 48) */
  size?: number
  /** Espessura do anel em px (padrão: 4) */
  strokeWidth?: number
  /** Exibir texto de percentual no centro */
  label?: boolean
  className?: string
}

/**
 * Anel de progresso SVG animado.
 * Cor: verde (100%), primário (≥50%), âmbar (<50%).
 * Transição via stroke-dashoffset — coberta pelo guard global prefers-reduced-motion.
 */
export function ProgressRing({
  pct,
  size = 48,
  strokeWidth = 4,
  label = false,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, pct))
  const radius = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (clamped / 100) * circ

  const progressColor =
    clamped === 100
      ? '#22C55E'
      : clamped >= 50
      ? BRAND_GREEN[500]
      : '#F59E0B'

  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% concluído`}
    >
      {/* Trilha (track) */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground opacity-20"
        transform={`rotate(-90 ${cx} ${cy})`}
      />

      {/* Progresso */}
      {clamped > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
          }}
        />
      )}

      {/* Label central (opcional) */}
      {label && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          className="text-foreground font-semibold"
          style={{ fontSize: Math.max(8, size * 0.22) }}
        >
          {clamped}%
        </text>
      )}
    </svg>
  )
}
