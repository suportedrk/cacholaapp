// GET /api/ploomes/deals — Proxy: lista deals do pipeline Ploomes
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ploomesGet } from '@/lib/ploomes/client'
import { loadPloomesConfig } from '@/lib/ploomes/sync'
import { parseDeal } from '@/lib/ploomes/field-mapping'
import type { PloomesDeal } from '@/lib/ploomes/types'

export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const dbConfig = await loadPloomesConfig(supabase, null)
    const pipelineId = dbConfig?.pipeline_id ?? parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
    const stageId    = dbConfig?.stage_id    ?? parseInt(process.env.PLOOMES_STAGE_FESTA_FECHADA_ID ?? '60004787', 10)
    const userKey    = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    const query = [
      `$filter=PipelineId eq ${pipelineId} and StageId eq ${stageId}`,
      `$expand=OtherProperties,Contact($select=Id,Name,Email,Phones)`,
      `$select=Id,Title,ContactId,Amount,StageId,StatusId,CreateDate,LastUpdateDate,OtherProperties`,
      `$top=200`,
      `$orderby=CreateDate desc`,
    ].join('&')

    const response = await ploomesGet<PloomesDeal>(`Deals?${query}`, userKey)
    const parsed = (response.value ?? []).map(parseDeal)

    return NextResponse.json({ deals: parsed, total: parsed.length })
  } catch (err) {
    console.error('[GET /api/ploomes/deals]', err)
    return NextResponse.json({ error: 'Erro ao buscar deals do Ploomes.' }, { status: 500 })
  }
}
