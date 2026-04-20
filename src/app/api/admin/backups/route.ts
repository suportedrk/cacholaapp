import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { BACKUP_VIEW_ROLES } from '@/config/roles'

export async function GET() {
  const guard = await requireRoleApi(BACKUP_VIEW_ROLES)
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
