'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuditLog } from '@/types/database.types'

const ACTION_LABEL: Record<string, string> = {
  INSERT: 'criou esta ordem',
  UPDATE: 'atualizou esta ordem',
  DELETE: 'excluiu esta ordem',
}

interface Props {
  orderId: string
}

export function MaintenanceTimeline({ orderId }: Props) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', 'maintenance_orders', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', 'maintenance_orders')
        .eq('entity_id', orderId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as AuditLog[]
    },
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!logs?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum histórico registrado.
      </p>
    )
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {logs.map((log) => {
        const diff = log.new_data as Record<string, unknown> | null
        const changed = diff?.status ? `Status → ${diff.status}` : undefined
        return (
          <li key={log.id} className="ml-4">
            <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full bg-muted border border-border">
              <Clock className="w-2.5 h-2.5 text-muted-foreground" />
            </span>
            <p className="text-xs text-foreground">
              {ACTION_LABEL[log.action] ?? log.action}
              {changed && <span className="font-medium"> — {changed}</span>}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
