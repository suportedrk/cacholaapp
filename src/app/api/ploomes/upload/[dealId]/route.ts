// POST /api/ploomes/upload/[dealId] — Upload de arquivo (ex: PDF de checklist) para um Deal
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { uploadFileToDeal } from '@/lib/ploomes/upload'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    const supabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { dealId } = await params

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Campo "file" ausente ou inválido no FormData.' },
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
