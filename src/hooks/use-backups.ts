'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface BackupLogRow {
  id: string
  kind: 'daily' | 'weekly' | 'monthly'
  source: 'local' | 'r2_upload'
  filename: string
  r2_key: string | null
  size_bytes: number | null
  checksum: string | null
  status: 'in_progress' | 'success' | 'failed'
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export function useBackups() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<BackupLogRow[]>({
    queryKey: ['backup-log'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    networkMode: 'always',
    queryFn: async () => {
      const supabase = createClient()
      // backup_log não está nos DB types gerados ainda (migration pendente de apply)
      const { data, error } = await (
        supabase
          .from('backup_log' as never)
          .select('*')
          .order('started_at', { ascending: false })
          .limit(200) as unknown as Promise<{
            data: BackupLogRow[] | null
            error: { message: string } | null
          }>
      )
      if (error) throw error
      return data ?? []
    },
    retry: (count, err) => count < 3 && (err as { status?: number })?.status !== 401,
  })
}

export async function requestDownloadUrl(id: string): Promise<string> {
  const res = await fetch(`/api/admin/backups/${id}/download-url`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.hint ?? body.error ?? 'Erro ao gerar URL'), {
      status: res.status,
      hint: body.hint,
    })
  }
  const { url } = await res.json()
  return url as string
}
