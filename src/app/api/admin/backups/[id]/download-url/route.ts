import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireRoleApi } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { BACKUP_VIEW_ROLES } from '@/config/roles'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json(
      {
        error: 'R2 não configurado neste ambiente',
        hint: 'Download disponível apenas em produção. Em ambiente local, use o backup via SSH.',
      },
      { status: 503 },
    )
  }

  const guard = await requireRoleApi(BACKUP_VIEW_ROLES)
  if (!guard.ok) return guard.response

  const { id } = await params

  // backup_log não está nos DB types gerados ainda (migration pendente de apply)
  type RowShape = { r2_key: string | null; filename: string; status: string }

  const supabase = await createClient()
  const { data: row, error } = await (
    supabase
      .from('backup_log' as never)
      .select('r2_key, filename, status')
      .eq('id', id)
      .single() as unknown as Promise<{ data: RowShape | null; error: unknown }>
  )

  if (error || !row) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  if (row.status !== 'success') {
    return NextResponse.json(
      { error: 'Backup sem status "success" — download indisponível.' },
      { status: 409 },
    )
  }

  if (!row.r2_key) {
    return NextResponse.json({ error: 'r2_key ausente neste registro.' }, { status: 422 })
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET ?? 'cacholaos-backups',
    Key: row.r2_key,
    ResponseContentDisposition: `attachment; filename="${row.filename}"`,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 900 })

  return NextResponse.json({ url })
}
