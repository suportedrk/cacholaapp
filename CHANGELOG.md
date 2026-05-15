# Changelog

Todas as mudanças notáveis do Cachola OS são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

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
