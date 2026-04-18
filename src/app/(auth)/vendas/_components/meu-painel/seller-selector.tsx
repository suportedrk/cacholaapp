'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VendasRankingRow } from '@/hooks/use-vendas'

interface Props {
  sellers:   Pick<VendasRankingRow, 'seller_id' | 'seller_name'>[]
  value:     string | null  // null = "Todas"
  onChange:  (id: string | null) => void
}

export function SellerSelector({ sellers, value, onChange }: Props) {
  return (
    <Select
      value={value ?? '__all__'}
      onValueChange={(v) => onChange(v === '__all__' ? null : v)}
    >
      <SelectTrigger className="w-48 h-8 text-xs">
        <SelectValue placeholder="Todas (agregada)" />
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
