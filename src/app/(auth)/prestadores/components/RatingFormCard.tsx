'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StarRating } from './StarRating'
import { ProviderAvatar } from './ProviderAvatar'
import { useCreateRating } from '@/hooks/use-provider-ratings'
import type { CreateRatingInput } from '@/types/providers'

interface Props {
  eventProviderId: string
  providerId: string
  providerName: string
  eventId: string
  eventTitle: string
  eventDate?: string   // 'YYYY-MM-DD'
  unitId: string
  onSuccess: () => void
  onCancel: () => void
}

export function RatingFormCard({
  eventProviderId,
  providerId,
  providerName,
  eventId,
  eventTitle,
  eventDate,
  unitId,
  onSuccess,
  onCancel,
}: Props) {
  const [rating, setRating]             = useState(0)
  const [punctuality, setPunctuality]   = useState(0)
  const [quality, setQuality]           = useState(0)
  const [professionalism, setProf]      = useState(0)
  const [comment, setComment]           = useState('')

  const createRating = useCreateRating()

  const canSubmit = rating >= 1 && !createRating.isPending

  async function handleSubmit() {
    if (!canSubmit) return
    const input: CreateRatingInput = {
      event_provider_id: eventProviderId,
      provider_id:       providerId,
      event_id:          eventId,
      unit_id:           unitId,
      rating,
      comment:       comment.trim() || undefined,
      punctuality:   punctuality   > 0 ? punctuality   : undefined,
      quality:       quality       > 0 ? quality       : undefined,
      professionalism: professionalism > 0 ? professionalism : undefined,
    }
    await createRating.mutateAsync(input)
    onSuccess()
  }

  const formattedDate = eventDate
    ? format(parseISO(eventDate), "d 'de' MMM 'de' yyyy", { locale: ptBR })
    : null

  const criteria = [
    { label: 'Pontualidade',        value: punctuality,   onChange: setPunctuality },
    { label: 'Qualidade do serviço', value: quality,      onChange: setQuality },
    { label: 'Profissionalismo',    value: professionalism, onChange: setProf },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Avaliar Prestador"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={cn(
        'relative z-10 w-full bg-card rounded-t-2xl sm:rounded-2xl shadow-xl',
        'sm:max-w-md sm:mx-4 animate-scale-in',
        'max-h-[90svh] overflow-y-auto',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Avaliar Prestador</h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-text-tertiary"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Provider info */}
          <div className="flex items-center gap-3">
            <ProviderAvatar name={providerName} size="md" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-text-primary">{providerName}</p>
              <p className="text-xs text-text-tertiary truncate">
                {eventTitle}{formattedDate ? ` · ${formattedDate}` : ''}
              </p>
            </div>
          </div>

          {/* Overall rating — obrigatório */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Avaliação geral{' '}
              <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <StarRating
              rating={rating}
              size="md"
              interactive
              onChange={setRating}
            />
            {rating === 0 && (
              <p className="text-xs text-text-tertiary mt-1">
                Clique nas estrelas para avaliar
              </p>
            )}
          </div>

          {/* Critérios opcionais */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
              Critérios opcionais
            </p>
            <div className="space-y-2.5">
              {criteria.map(({ label, value, onChange }) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-secondary flex-1">{label}</span>
                  <StarRating
                    rating={value}
                    size="sm"
                    interactive
                    onChange={onChange}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Comentário */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Comentário{' '}
              <span className="text-xs text-text-tertiary font-normal">(opcional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte como foi a experiência..."
              rows={3}
              className={cn(
                'w-full px-3 py-2.5 text-sm rounded-lg border border-input bg-background',
                'placeholder:text-muted-foreground resize-none',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                'transition-colors',
              )}
            />
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={createRating.isPending}
              className="flex-1 h-10 px-4 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex-1 h-10 px-4 rounded-lg text-sm font-medium transition-colors',
                canSubmit
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              {createRating.isPending ? 'Salvando…' : 'Salvar Avaliação'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
