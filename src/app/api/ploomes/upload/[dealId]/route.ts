// POST /api/ploomes/upload/[dealId] — Upload de arquivo (ex: PDF de checklist) para um Deal
import { NextRequest, NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { SETTINGS_ROLES } from '@/config/roles'
import { uploadFileToDeal } from '@/lib/ploomes/upload'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const

type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number]

// Detecta o tipo REAL do arquivo pela assinatura (magic bytes) do cabeçalho.
// O `file.type` do FormData é o MIME declarado pelo client e é forjável; esta
// checagem garante que o conteúdo corresponde a um dos tipos permitidos.
function sniffFileType(bytes: Uint8Array): AllowedUploadType | null {
  // PDF: "%PDF-" → 25 50 44 46 2D
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg'
  }
  return null
}

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

    // dealId é interpolado no path OData da API do Ploomes (Deals(<id>)/UploadFile).
    // Restringir a dígitos fecha injeção de segmentos de path/param.
    if (!/^\d+$/.test(dealId)) {
      return NextResponse.json(
        { error: 'Identificador de deal inválido.' },
        { status: 400 },
      )
    }

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
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type as AllowedUploadType)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido (use PDF, PNG ou JPEG).' },
        { status: 400 },
      )
    }

    // Validação autoritativa: confere a assinatura real do conteúdo (magic bytes).
    // Ler só o cabeçalho via slice não consome o File — o upload abaixo segue íntegro.
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const sniffedType = sniffFileType(header)
    if (!sniffedType || sniffedType !== file.type) {
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
