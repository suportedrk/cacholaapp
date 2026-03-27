import type { Json } from '@/types/database.types'

type DiffEntry =
  | { key: string; type: 'added';    newValue: unknown }
  | { key: string; type: 'removed';  oldValue: unknown }
  | { key: string; type: 'modified'; oldValue: unknown; newValue: unknown }

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function computeDiff(oldData: Json | null, newData: Json | null): DiffEntry[] {
  const old_ = (oldData && typeof oldData === 'object' && !Array.isArray(oldData))
    ? oldData as Record<string, unknown>
    : {}
  const new_ = (newData && typeof newData === 'object' && !Array.isArray(newData))
    ? newData as Record<string, unknown>
    : {}

  const allKeys = new Set([...Object.keys(old_), ...Object.keys(new_)])
  const entries: DiffEntry[] = []

  // Campos a ignorar no diff (ids internos, timestamps redundantes)
  const IGNORE = new Set(['id', 'created_at', 'updated_at'])

  for (const key of allKeys) {
    if (IGNORE.has(key)) continue
    const inOld = key in old_
    const inNew = key in new_
    const oldVal = old_[key]
    const newVal = new_[key]

    if (!inOld) {
      entries.push({ key, type: 'added', newValue: newVal })
    } else if (!inNew) {
      entries.push({ key, type: 'removed', oldValue: oldVal })
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      entries.push({ key, type: 'modified', oldValue: oldVal, newValue: newVal })
    }
  }

  return entries
}

interface AuditDiffProps {
  oldData: Json | null
  newData: Json | null
  action: string
}

export function AuditDiff({ oldData, newData, action }: AuditDiffProps) {
  // Para create/delete, mostra os dados sem diff
  if (action === 'create' && newData) {
    const data = (typeof newData === 'object' && !Array.isArray(newData))
      ? newData as Record<string, unknown>
      : {}
    const keys = Object.keys(data).filter(k => !['id', 'created_at', 'updated_at'].includes(k))
    if (!keys.length) return <p className="text-xs text-muted-foreground italic">Nenhum detalhe disponível.</p>
    return (
      <div className="space-y-1">
        {keys.map(key => (
          <div key={key} className="flex gap-2 rounded px-2 py-0.5 bg-green-50 text-green-800 text-xs">
            <span className="font-medium min-w-[120px] shrink-0">{key}</span>
            <span>{formatValue(data[key])}</span>
          </div>
        ))}
      </div>
    )
  }

  if (action === 'delete' && oldData) {
    const data = (typeof oldData === 'object' && !Array.isArray(oldData))
      ? oldData as Record<string, unknown>
      : {}
    const keys = Object.keys(data).filter(k => !['id', 'created_at', 'updated_at'].includes(k))
    if (!keys.length) return <p className="text-xs text-muted-foreground italic">Nenhum detalhe disponível.</p>
    return (
      <div className="space-y-1">
        {keys.map(key => (
          <div key={key} className="flex gap-2 rounded px-2 py-0.5 bg-red-50 text-red-800 text-xs">
            <span className="font-medium min-w-[120px] shrink-0">{key}</span>
            <span>{formatValue(data[key])}</span>
          </div>
        ))}
      </div>
    )
  }

  const diff = computeDiff(oldData, newData)

  if (!diff.length) {
    return <p className="text-xs text-muted-foreground italic">Nenhuma alteração detectada nos dados.</p>
  }

  return (
    <div className="space-y-1">
      {diff.map((entry) => {
        if (entry.type === 'added') {
          return (
            <div key={entry.key} className="flex gap-2 rounded px-2 py-0.5 bg-green-50 text-green-800 text-xs">
              <span className="font-medium min-w-[120px] shrink-0">{entry.key}</span>
              <span className="text-green-600 mr-1">+</span>
              <span>{formatValue(entry.newValue)}</span>
            </div>
          )
        }
        if (entry.type === 'removed') {
          return (
            <div key={entry.key} className="flex gap-2 rounded px-2 py-0.5 bg-red-50 text-red-800 text-xs">
              <span className="font-medium min-w-[120px] shrink-0">{entry.key}</span>
              <span className="text-red-600 mr-1">−</span>
              <span className="line-through">{formatValue(entry.oldValue)}</span>
            </div>
          )
        }
        // modified
        return (
          <div key={entry.key} className="flex flex-wrap gap-1 rounded px-2 py-0.5 bg-amber-50 text-amber-800 text-xs">
            <span className="font-medium min-w-[120px] shrink-0">{entry.key}</span>
            <span className="line-through text-amber-600">{formatValue(entry.oldValue)}</span>
            <span className="text-amber-400 mx-0.5">→</span>
            <span className="font-medium">{formatValue(entry.newValue)}</span>
          </div>
        )
      })}
    </div>
  )
}
