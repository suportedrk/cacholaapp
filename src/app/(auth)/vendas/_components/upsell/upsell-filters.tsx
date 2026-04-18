'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface UpsellFiltersProps {
  showContacted:   boolean
  onToggle:        (v: boolean) => void
  totalShown:      number
}

export function UpsellFilters({ showContacted, onToggle, totalShown }: UpsellFiltersProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {totalShown === 0
          ? 'Nenhuma oportunidade encontrada'
          : `${totalShown} oportunidade${totalShown !== 1 ? 's' : ''}`}
      </p>
      <div className="flex items-center gap-2">
        <Switch
          id="show-contacted"
          checked={showContacted}
          onCheckedChange={onToggle}
        />
        <Label htmlFor="show-contacted" className="text-sm text-muted-foreground cursor-pointer">
          Incluir já contatadas
        </Label>
      </div>
    </div>
  )
}
