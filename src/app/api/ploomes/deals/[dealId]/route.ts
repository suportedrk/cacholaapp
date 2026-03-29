// GET /api/ploomes/deals/[dealId] — Proxy: deal específico com campos parseados
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ploomesGetOne } from '@/lib/ploomes/client'
import { parseDeal } from '@/lib/ploomes/field-mapping'
import type { PloomesDeal } from '@/lib/ploomes/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    const supabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { dealId } = await params

    const deal = await ploomesGetOne<PloomesDeal>(
      `Deals(${dealId})?$expand=OtherProperties,Contact($select=Id,Name,Email,Phones),Attachments`,
    )

    return NextResponse.json({ deal, parsed: parseDeal(deal) })
  } catch (err) {
    console.error('[GET /api/ploomes/deals/[dealId]]', err)
    return NextResponse.json({ error: 'Erro ao buscar deal do Ploomes.' }, { status: 500 })
  }
}
