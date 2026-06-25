import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type AdminClient = SupabaseClient<Database>

/**
 * Recalcula events.contract_signed (Contrato assinado — Clicksign) a partir
 * de TODAS as orders do deal. Uma festa pode ter vários documentos de venda;
 * nem todos são assinados. Regra:
 *
 *   sem nenhuma order  -> NULL  (festa sem documento de venda; etiqueta escondida)
 *   tem order(s)       -> bool_or(contract_signed)  (true se QUALQUER assinada)
 *
 * Chamada em 2 syncs (mesmo padrão de refreshEventGuestCountFromLatestOrder):
 * - sync-orders.ts: após upsert de cada Order
 * - sync.ts:        após upsert de cada evento (puxa o agregado das orders existentes)
 */
export async function refreshEventContractSignedFromOrders(
  dealId: number,
  supabase: AdminClient,
): Promise<void> {
  // contract_signed em ploomes_orders existe no banco mas não está em
  // database.types.ts — padrão do projeto para colunas fora da tipagem gerada.
  const { data: orders, error: queryError } = await (
    supabase
      .from('ploomes_orders')
      .select('contract_signed')
      .eq('deal_id', dealId)
  ) as unknown as { data: Array<{ contract_signed: boolean }> | null; error: { message: string } | null }

  if (queryError) {
    console.warn(`[Orders Sync] Falha ao buscar orders para contrato do deal ${dealId}:`, queryError.message)
    return
  }

  // NULL quando não há nenhuma order (festa sem documento de venda).
  const aggregate: boolean | null =
    orders && orders.length > 0 ? orders.some((o) => o.contract_signed === true) : null

  const { error: updateError } = await supabase
    .from('events')
    .update({ contract_signed: aggregate })
    .eq('ploomes_deal_id', String(dealId))

  if (updateError) {
    console.warn(`[Orders Sync] Falha ao atualizar contract_signed para deal ${dealId}:`, updateError.message)
  }
}
