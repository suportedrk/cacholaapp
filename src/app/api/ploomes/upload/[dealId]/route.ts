// POST /api/ploomes/upload/[dealId] — Upload de arquivo (ex: PDF de checklist) para um Deal
import { NextRequest, NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { SETTINGS_ROLES } from '@/config/roles'
import { uploadFileToDeal } from '@/lib/ploomes/upload'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    // Guard: grava anexo em qualquer deal do CRM via service_role — restringir
    // a quem administra a integração (super_admin, diretor).
    const guard = await requireRoleApi(SETTINGS_ROLES)
    if (!guard.ok) return guard.response

    const { dealId } = await params

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Campo "file" ausente ou inválido no FormData.' },
        { status: 400 },
      )
    }

    // Validação server-side de tipo e tamanho (não confiar só no client).
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo excede o limite de 10 MB.' },
        { status: 400 },
      )
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido (use PDF, PNG ou JPEG).' },
        { status: 400 },
      )
    }

    const attachment = await uploadFileToDeal(dealId, file, file.name)

    return NextResponse.json({ success: true, attachment })
  } catch (err) {
    console.error('[POST /api/ploomes/upload/[dealId]]', err)
    return NextResponse.json({ error: 'Erro ao fazer upload para o Ploomes.' }, { status: 500 })
  }
}
