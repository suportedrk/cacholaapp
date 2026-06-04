// ============================================================
// Ploomes CRM — Resolução canônica de unidade (Order > Deal)
// ============================================================
// Fonte ÚNICA da hierarquia de unidade. Consumida tanto pelo sync de
// eventos (events.unit_id em sync.ts) quanto pelo sync de produtos
// vendidos (ploomes_order_products.unit_id em sync-orders.ts), para
// que as duas escritas nunca divergam.
//
// Regra canônica (ver skill ploomes-cachola-api → fieldkeys-customs.md,
// seção "Hierarquia canônica de UNIDADE para events.unit_id"):
//   1. Unidade ESCOLHIDA do Order (FieldKey order_EDD14E93...) — definitiva
//   2. Unidade do Deal — fallback
//
// O Order vence o Deal SEM EXCEÇÃO. Quando o Order não traz unidade
// escolhida (chosen ausente), cai no Deal — comportamento idêntico ao
// histórico, garantindo idempotência da correção.

/**
 * Resolve a unidade efetiva de uma festa/venda segundo a hierarquia
 * canônica Order > Deal.
 *
 * Função pura (sem I/O): cada chamador resolve seus próprios UUIDs a
 * partir da sua fonte (a coluna `ploomes_orders.chosen_unit_id` no sync
 * de eventos; o `OtherProperties` do Order vivo no sync de produtos) e
 * delega a decisão a esta função.
 *
 * Overloads preservam o estreitamento de tipo dos call sites: ambos
 * passam um `dealUnitId` já garantido não-nulo (há guard antes), e as
 * colunas `unit_id` de destino são NOT NULL — então o retorno precisa
 * ser `string`, não `string | null`, quando o fallback é não-nulo.
 *
 * @param orderChosenUnitId UUID da unidade escolhida no Order
 *   (`ploomes_orders.chosen_unit_id` / FieldKey `order_EDD14E93...`),
 *   ou `null`/`undefined` quando o Order não a define.
 * @param dealUnitId UUID da unidade resolvida a partir do Deal.
 * @returns o UUID da unidade efetiva (Order vence Deal); `null` apenas
 *   quando ambas as fontes são nulas.
 */
export function resolveEffectiveUnitId(
  orderChosenUnitId: string | null | undefined,
  dealUnitId: string,
): string
export function resolveEffectiveUnitId(
  orderChosenUnitId: string | null | undefined,
  dealUnitId: string | null,
): string | null
export function resolveEffectiveUnitId(
  orderChosenUnitId: string | null | undefined,
  dealUnitId: string | null,
): string | null {
  return orderChosenUnitId ?? dealUnitId ?? null
}

/**
 * Resolve a unidade efetiva da festa pela hierarquia canônica de 3 níveis:
 * `chosen (Order) > Escolhida (deal_A583075F) > Pretendida (deal_BD9C4B07)`.
 *
 * Paridade EXATA com a função SQL `public.resolve_festa_unit(uuid,uuid,uuid)`
 * (migration 149): ambas são `COALESCE(chosen, escolhida, pretendida)`. O
 * fallback final é a Pretendida — NUNCA "primeira unidade ativa".
 *
 * Os overloads preservam o estreitamento de tipo dos call sites: quando a
 * Pretendida é garantidamente não-nula (coluna NOT NULL de destino), o retorno
 * é `string`; quando pode ser nula, é `string | null`.
 *
 * @param chosen     UUID da unidade escolhida no Order, ou `null`/`undefined`.
 * @param escolhida  UUID da unidade Escolhida do Deal (deal_A583075F), ou `null`.
 * @param pretendida UUID da unidade Pretendida do Deal (deal_BD9C4B07).
 */
export function resolveFestaUnit(
  chosen: string | null | undefined,
  escolhida: string | null | undefined,
  pretendida: string,
): string
export function resolveFestaUnit(
  chosen: string | null | undefined,
  escolhida: string | null | undefined,
  pretendida: string | null,
): string | null
export function resolveFestaUnit(
  chosen: string | null | undefined,
  escolhida: string | null | undefined,
  pretendida: string | null,
): string | null {
  return chosen ?? escolhida ?? pretendida ?? null
}
