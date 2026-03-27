'use client'

import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUsers } from '@/hooks/use-users'
import type { AuditLogFilters } from '@/types/database.types'

const MODULES = [
  { value: 'events',        label: 'Eventos' },
  { value: 'maintenance',   label: 'Manutenção' },
  { value: 'checklists',    label: 'Checklists' },
  { value: 'users',         label: 'Usuários' },
  { value: 'equipment',     label: 'Equipamentos' },
  { value: 'units',         label: 'Unidades' },
  { value: 'settings',      label: 'Configurações' },
  { value: 'reports',       label: 'Relatórios' },
  { value: 'audit_logs',    label: 'Auditoria' },
  { value: 'notifications', label: 'Notificações' },
]

const ACTIONS = [
  { value: 'create',        label: 'Criação' },
  { value: 'update',        label: 'Atualização' },
  { value: 'delete',        label: 'Exclusão' },
  { value: 'status_change', label: 'Mudança de Status' },
  { value: 'login',         label: 'Login' },
  { value: 'logout',        label: 'Logout' },
  { value: 'export',        label: 'Exportação' },
]

interface AuditFiltersProps {
  filters: AuditLogFilters
  onChange: (f: AuditLogFilters) => void
}

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  const { data: users = [] } = useUsers({ isActive: undefined })

  const hasActiveFilter =
    filters.dateFrom || filters.dateTo || filters.userId ||
    filters.module   || filters.action

  const set = (patch: Partial<AuditLogFilters>) => onChange({ ...filters, ...patch })
  const clear = () => onChange({})

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="size-4 text-muted-foreground" />
        Filtros
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={clear} className="ml-auto h-7 gap-1 text-xs">
            <X className="size-3" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Período: de */}
        <div className="space-y-1.5">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            className="h-8 text-sm"
          />
        </div>

        {/* Período: até */}
        <div className="space-y-1.5">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            className="h-8 text-sm"
          />
        </div>

        {/* Usuário */}
        <div className="space-y-1.5">
          <Label className="text-xs">Usuário</Label>
          <Select
            value={filters.userId ?? '__all__'}
            onValueChange={(v: string | null) => set({ userId: (v && v !== '__all__') ? v : undefined })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Módulo */}
        <div className="space-y-1.5">
          <Label className="text-xs">Módulo</Label>
          <Select
            value={filters.module ?? '__all__'}
            onValueChange={(v: string | null) => set({ module: (v && v !== '__all__') ? v : undefined })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {MODULES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ação */}
        <div className="space-y-1.5">
          <Label className="text-xs">Ação</Label>
          <Select
            value={filters.action ?? '__all__'}
            onValueChange={(v: string | null) => set({ action: (v && v !== '__all__') ? v : undefined })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
