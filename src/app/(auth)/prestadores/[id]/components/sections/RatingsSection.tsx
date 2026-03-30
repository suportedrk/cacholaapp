'use client'

import Link from 'next/link'
import { Star, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StarRating } from '../../../components/StarRating'
import { AccordionSection } from '../AccordionSection'
import type { ProviderRating } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Criteria row (avg per criterion)
// ─────────────────────────────────────────────────────────────
function CriteriaRow({ label, avg }: { label: string; avg: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <StarRating rating={avg} size="sm" showValue />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Single rating card
// ─────────────────────────────────────────────────────────────
function RatingCard({ rating }: { rating: ProviderRating }) {
  const dateLabel = format(parseISO(rating.created_at), "d 'de' MMM yyyy", { locale: ptBR })
  const reviewerName = rating.rated_by_user?.name?.split(' ')[0] ?? 'Usuário'

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <StarRating rating={rating.rating} size="sm" showValue />
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
          <p className="text-xs text-muted-foreground/60">por {reviewerName}</p>
        </div>
      </div>

      {rating.event && (
        <Link
          href={`/eventos/${rating.event.id}`}
          className="inline-flex items-center gap-1 text-xs text-text-link hover:underline"
        >
          {rating.event.title ?? 'Ver evento'}
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}

      {rating.comment && (
        <p className="text-sm text-muted-foreground italic">
          &ldquo;{rating.comment}&rdquo;
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
interface Props {
  ratings: ProviderRating[]
  avgRating: number
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && v > 0)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10
}

export function RatingsSection({ ratings, avgRating }: Props) {
  if (ratings.length === 0) return null

  const avgPunctuality    = avg(ratings.map((r) => r.punctuality))
  const avgQuality        = avg(ratings.map((r) => r.quality))
  const avgProfessionalism = avg(ratings.map((r) => r.professionalism))

  const hasCriteria = avgPunctuality !== null || avgQuality !== null || avgProfessionalism !== null

  const badgeLabel = `${avgRating > 0 ? avgRating.toFixed(1) : '—'} · ${ratings.length}`

  const sorted = [...ratings].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  return (
    <AccordionSection title="Avaliações" icon={Star} badge={badgeLabel}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <StarRating rating={avgRating} size="md" showValue />
            <span className="text-xs text-muted-foreground">
              ({ratings.length} {ratings.length === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </div>

          {hasCriteria && (
            <div className="space-y-1 pt-1 border-t border-border">
              {avgPunctuality !== null && (
                <CriteriaRow label="Pontualidade" avg={avgPunctuality} />
              )}
              {avgQuality !== null && (
                <CriteriaRow label="Qualidade" avg={avgQuality} />
              )}
              {avgProfessionalism !== null && (
                <CriteriaRow label="Profissionalismo" avg={avgProfessionalism} />
              )}
            </div>
          )}
        </div>

        {/* Individual ratings */}
        <div className="space-y-2">
          {sorted.map((r) => (
            <RatingCard key={r.id} rating={r} />
          ))}
        </div>
      </div>
    </AccordionSection>
  )
}
