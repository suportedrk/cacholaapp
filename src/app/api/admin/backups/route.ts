import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const guard = await requirePermissionApi('backups', 'view')
  if (!guard.ok) return guard.response

  const supabase = await createClient()

  // backup_log não está nos DB types gerados ainda (migration pendente de apply)
  const { data, error } = await (
    supabase
      .from('backup_log' as never)
      .select('*')
      .order('started_at', { ascending: false })
      .limit(200) as unknown as Promise<{ data: unknown[] | null; error: { message: string } | null }>
  )

  if (error) {
    console.error('[GET /api/admin/backups]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
