'use client'

import { FileText, Plus } from 'lucide-react'

interface Props {
  hasFilters: boolean
  onClearFilters: () => void
  onCreateMinute: () => void
}

export function MeetingMinutesEmptyState({ hasFilters, onClearFilters, onCreateMinute }: Props) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-foreground">Nenhuma ata encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhuma ata corresponde aos filtros aplicados.
          </p>
        </div>
        <button
          onClick={onClearFilters}
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Limpar filtros
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <FileText className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium text-foreground">Nenhuma ata registrada</p>
        <p className="text-sm text-muted-foreground mt-1">
          Crie a primeira ata de reunião da sua unidade.
        </p>
      </div>
      <button
        onClick={onCreateMinute}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Nova Ata
      </button>
    </div>
  )
}
