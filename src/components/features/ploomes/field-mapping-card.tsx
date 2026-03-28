import { Info } from 'lucide-react'
import { DEAL_FIELD_MAP } from '@/lib/ploomes/field-mapping'

// Campos que queremos exibir (na ordem de exibição)
const VISIBLE_FIELDS = [
  'deal_7CE92372',
  'deal_30E82221',
  'deal_FD135180',
  'deal_2C5D41C4',
  'deal_36E32E61',
  'deal_05EE1763',
  'deal_A583075F',
  'deal_40C1C918',
  'deal_9910A472',
] as const

const CACHOLA_LABELS: Record<string, string> = {
  eventDate:      'Data da Festa',
  startTime:      'Horário de Início',
  endTime:        'Horário de Término',
  birthdayPerson: 'Aniversariante',
  age:            'Idade',
  guestCount:     'Nº de Convidados',
  unitName:       'Unidade (informativo)',
  venueName:      'Espaço/Casa',
  theme:          'Tema da Festa',
}

export function FieldMappingCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Mapeamento de Campos</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Campos customizados do Ploomes que são importados para o Cachola OS na sincronização.
        Este mapeamento é fixo e definido pelo desenvolvedor.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Campo no Ploomes</th>
              <th className="px-3 py-2 font-medium">FieldKey</th>
              <th className="px-3 py-2 font-medium">Campo no Cachola</th>
            </tr>
          </thead>
          <tbody>
            {VISIBLE_FIELDS.map((key) => {
              const def = DEAL_FIELD_MAP[key]
              return (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{def.label}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{key}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {CACHOLA_LABELS[def.field] ?? def.field}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
