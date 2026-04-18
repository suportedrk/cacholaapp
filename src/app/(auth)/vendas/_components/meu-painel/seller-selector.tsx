'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import type { VendasRankingRow } from '@/hooks/use-vendas'

interface Props {
  sellers:  Pick<VendasRankingRow, 'seller_id' | 'seller_name'>[]
  value:    string | null  // null = "Todas"
  onChange: (id: string | null) => void
}

export function SellerSelector({ sellers, value, onChange }: Props) {
  const currentValue = value ?? '__all__'

  function getLabel(v: string): string {
    if (v === '__all__') return 'Todas (agregada)'
    return sellers.find((s) => s.seller_id === v)?.seller_name ?? 'Selecione'
  }

  return (
    <Select
      value={currentValue}
      onValueChange={(v) => onChange(v === '__all__' ? null : v)}
    >
      <SelectTrigger className="w-48 h-8 text-xs">
        <span data-slot="select-value">{getLabel(currentValue)}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Todas (agregada)</SelectItem>
        {sellers.map((s) => (
          <SelectItem key={s.seller_id} value={s.seller_id}>
            {s.seller_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
