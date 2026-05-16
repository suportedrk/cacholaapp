import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type AdminClient = SupabaseClient<Database>

/**
 * Atualiza events.guest_count com base na Order MAIS RECENTE do Deal,
 * independente de qual Order foi processada. Garante que edição em
 * Order antiga (via webhook) não sobrescreva o valor da Order mais recente.
 *
 * "Última Order vence, mesmo se vazia" — pressão visual intencional para
 * o time preencher contracted_guests em TODA Order nova (upsells, adicionais).
 *
 * Chamada em 2 syncs:
 * - sync-orders.ts: após upsert de cada Order
 * - sync.ts: após upsert de cada evento (puxa valor da última Order existente)
 */
export async function refreshEventGuestCountFromLatestOrder(
  dealId: number,
  supabase: AdminClient,
): Promise<void> {
  // contracted_guests existe no banco mas não está em database.types.ts —
  // padrão do projeto para colunas fora da tipagem gerada.
  const { data: latestOrder, error: queryError } = await (
    supabase
      .from('ploomes_orders')
      .select('contracted_guests')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ) as unknown as { data: { contracted_guests: number | null } | null; error: { message: string } | null }

  if (queryError) {
    console.warn(`[Orders Sync] Falha ao buscar última order para deal ${dealId}:`, queryError.message)
    return
  }

  if (!latestOrder) return

  const { error: updateError } = await supabase
    .from('events')
    .update({ guest_count: latestOrder.contracted_guests })
    .eq('ploomes_deal_id', String(dealId))

  if (updateError) {
    console.warn(`[Orders Sync] Falha ao atualizar guest_count para deal ${dealId}:`, updateError.message)
  }
}
