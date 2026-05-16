# Changelog

Todas as mudanças notáveis do Cachola OS são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [1.10.3] — 2026-05-15

### Added
- **BI Adoção do campo Convidados Contratados**: novo card em `/bi` → Vendas Realizadas com KPI global de % de Orders preenchidas, ranking por vendedora com cores semafóricas (verde ≥80%, âmbar ≥50%, vermelho <50%), filtros de período (3M / 6M / 12M / Tudo) e toggle para incluir vendedoras inativas. (#34)

### Fixed
- Regra de propagação `events.guest_count` agora segue "última Order vence sempre, mesmo se vazia". Implementado via `refreshEventGuestCountFromLatestOrder`: ao processar qualquer Order, sempre busca a Order mais recente do Deal e propaga seu valor — garantindo que edições em Orders antigas (via webhook) não corrompam o estado. Cria pressão visual ("não definido") para que toda Order nova tenha o campo Convidados Contratados preenchido. (#33)
- E-mail de alerta de prestadores passa a usar `event.title` como título do evento, alinhando com a UI do sistema. (#32)

### Changed
- `loadPloomesConfig` agora emite `console.warn` explícito quando cai no fallback de env var, em vez de silenciar o erro. (#32)

### Docs
- Adicionado `docs/analise-v1.10-convidados-e-avatar-unidade.md` — relatório de análise de impacto da família v1.10. (#32)

### Migrations
- `092_bi_adoption_rpcs.sql`

---

## [1.10.2] — 2026-05-14

### Fix
- Cards de evento agora usam `event.title` como fonte única do título visual, eliminando divergência com o Title do Deal no Ploomes (#30).
  Pontos corrigidos: `EventCard` (/eventos), breadcrumb e prop `eventTitle` em `/eventos/[id]`, `SellerDrilldownSheet` (/bi).

---

## [1.10.1] — 2026-05-14

### Fix
- Push condicional em `sync-orders.ts`: Orders sem o campo "Convidados Contratados" preenchido não sobrescrevem mais o valor de Orders anteriores que estavam preenchidas (#29).
  Comportamento após o fix: "Order mais recente com valor preenchido vence".

---

## [1.10.0] — 2026-05-14

### Added
- Componente `UnitChip` (sage Pinheiros / terracota Moema) aplicado em lista de eventos, seletor global, detalhe do evento e BI por unidade.
- Ramp de cor terracota adicionada ao design system para identidade visual da unidade Moema, com suporte completo a dark mode.

### Changed
- Fonte de verdade de convidados migrada do campo "Convidados" do Deal para o campo personalizado "Convidados Contratados" (Order) no Ploomes (FieldKey `order_3620B917`).
- UI exibe "não definido" quando o campo não está preenchido, em vez de ocultar a informação.

### Removed
- Avatares circulares de iniciais nos cards de evento, substituídos pelo `UnitChip`.

### Migrations
- `091_ploomes_orders_contracted_guests.sql`
