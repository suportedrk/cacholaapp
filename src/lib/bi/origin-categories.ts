// ============================================================
// BI — Categorias de Origem de Leads
// ============================================================
// Mapeamento 13 origens cruas do Ploomes → 8 categorias lógicas.
// Esta constante define a paleta de cores e a ordem de exibição
// no gráfico de barras empilhadas do painel "Origem dos Leads".
//
// A lógica de agrupamento por origin_id vive na RPC SQL
// (get_bi_lead_origin_breakdown — Migration 079), que é a
// ÚNICA fonte da verdade para o mapeamento. Este arquivo
// apenas define apresentação (cores + ordem).
// ============================================================

export const ORIGIN_CATEGORIES = [
  { key: 'Instagram',          color: '#E1306C', order: 1 },
  { key: 'Indicação',          color: '#22C55E', order: 2 },
  { key: 'Cliente recorrente', color: '#F97316', order: 3 },
  { key: 'WhatsApp',           color: '#25D366', order: 4 },
  { key: 'Site/Web',           color: '#3B82F6', order: 5 },
  { key: 'TikTok',             color: '#18181B', order: 6 },
  { key: 'Outros canais',      color: '#71717A', order: 7 },
  { key: '(sem origem)',       color: '#D4D4D8', order: 8 },
] as const

export type OriginCategoryKey = typeof ORIGIN_CATEGORIES[number]['key']

/** Map rápido: key → cor (para uso no tooltip e no resumo) */
export const ORIGIN_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ORIGIN_CATEGORIES.map((c) => [c.key, c.color]),
)
