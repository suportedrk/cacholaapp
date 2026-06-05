// GET /api/cron/orders-reconcile — Varredura periódica de segurança das Orders órfãs
//
// Lista TODAS as Orders vivas do funil CACHOLA no Ploomes, compara com o banco e:
//   - remove órfãs de deals NÃO-ganhos (lixo inócuo);
//   - SINALIZA (sem remover) deals GANHOS sem nenhuma venda viva — anomalia de
//     negócio que se corrige no Ploomes (recriar Order ou rever o ganho).
// Cobre o caso que o sync por janela de data nunca toca: deals cuja única venda foi
// excluída no Ploomes (não aparecem em nenhuma rodada → nunca reconciliados por-deal).
//
// Guardrails fortes (age global) em reconcileAllOrders: aborta se a listagem viva vier
// incompleta/implausível ou se fosse remover acima do teto de volume — nesses casos
// NADA é removido e o motivo sai no log para alerta.
//
// Agendamento previsto: 1x/dia, ~30min APÓS o sync de Orders, para não competir por
// rate limit com o sync. Ativação só na etapa 4b, após um dry-run em produção.
//
// Modo dry-run: `?dryRun=1` calcula e loga sem remover nada (validação pré-ativação).
//
// Configuração:
//   Manual:  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/orders-reconcile?dryRun=1
//   Cron:    curl -H "Authorization: Bearer $CRON_SECRET" https://app/.../api/cron/orders-reconcile
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { loadPloomesConfig } from '@/lib/ploomes/sync'
import { reconcileAllOrders } from '@/lib/ploomes/sync-orders'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function GET(req: NextRequest) {
  // Validar secret
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const supabase = await createAdminClient()

  try {
    const config = await loadPloomesConfig(supabase, null)
    const userKey = config?.user_key || process.env.PLOOMES_USER_KEY || ''
    if (!userKey) {
      return NextResponse.json({ success: false, error: 'User-Key não configurada.' }, { status: 500 })
    }

    // A própria reconcileAllOrders loga início/fim/aborts — sem console.info redundante aqui.
    const result = await reconcileAllOrders(supabase, userKey, { dryRun })

    // Abort por guardrail não é erro fatal — é proteção. Devolve 200 com aborted
    // preenchido (o alerta sai no log) para não gerar falso-positivo de "cron quebrado"
    // em monitores externos. success=false sinaliza que houve abort/guardrail.
    return NextResponse.json({ success: result.aborted === null, dryRun, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/orders-reconcile] Erro fatal:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
