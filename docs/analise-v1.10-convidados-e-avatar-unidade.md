# Análise v1.10.0 — Convidados (fonte Order) + Chip de Unidade

> Documento de análise pré-implementação. Não representa código pronto.
> Gerado em 2026-05-13 — sessão análise somente leitura.

---

## Seção 0 — Pre-flight (cachola-dev-sync)

| Check | Resultado |
|-------|-----------|
| Check 1 — Git drift | ✅ HEAD alinhado com `origin/main`; `develop` alinhado com `main` |
| Check 2 — Versão package.json | ✅ v1.9.2 alinhada em local / origin/main / origin/develop |
| Check 3 — Migrations Docker local | ✅ 92 arquivos sql no repo; última migration `090_pre_reserva_chosen_unit.sql` aplicada (coluna `chosen_unit_id` confirmada em `ploomes_orders`) |
| Check 4 — Dev server reiniciado | ✅ processo `next dev` iniciado após último pull |

**Veredicto:** prosseguir com o trabalho.

Nota: o repo tem 92 `.sql` mas última numeração é `090` — há dois arquivos com prefixo `087` (`087_fase_c_rollback.sql` e `087_fase_c_valor_festa_soma_produtos.sql`), o que explica a diferença. Não é drift.

---

## Seção 1 — FieldKey descoberta (Mod 1)

Chamada realizada contra `https://api2.ploomes.com/Fields?$filter=EntityId eq 4` usando a User-Key armazenada em `ploomes_config`.

| Atributo | Valor |
|----------|-------|
| **FieldKey** | `order_3620B917-6DCD-4977-824F-F159CC196E29` |
| FieldId | 60315507 |
| Name | `Convidados contratados` |
| TypeId | 4 (Número inteiro → `IntegerValue`) |
| EntityId | 4 (Order) |

Campo adicional identificado (distinto, fora de escopo):
- `Número de pessoas do evento` → `order_0EA97B08-E272-4032-80DD-2578F36ADAA3`, também TypeId=4 — **NÃO é o campo alvo**.

O campo `Convidados contratados` (`order_3620B917…`) é a nova fonte de verdade para `events.guest_count`.

---

## Seção 2 — Mod 1: Convidados via Order — Pontos afetados

### 2.1 Schema / Migration

**Nova migration `091_ploomes_orders_contracted_guests.sql`** necessária com:

```sql
ALTER TABLE public.ploomes_orders
  ADD COLUMN IF NOT EXISTS contracted_guests INTEGER;

COMMENT ON COLUMN public.ploomes_orders.contracted_guests IS
  'Convidados contratados (FieldKey order_3620B917-6DCD-4977-824F-F159CC196E29, TypeId=4 IntegerValue).';
```

Não é necessário índice (coluna será lida em JOIN por `deal_id`, já indexado).

`events.guest_count` (migration 001, linha 125) **permanece como está** — é o campo que o sync vai continuar populando, agora a partir da Order em vez do Deal.

### 2.2 Sync — `src/lib/ploomes/sync-orders.ts`

**Gap bloqueador (linha 50):**
```typescript
// ATUAL — interface incompleta
interface PloomesOrderOtherProperty {
  FieldKey?: string
  ObjectValueName?: string | null
  // ❌ FALTA IntegerValue?: number
}
```

Correção necessária:
```typescript
interface PloomesOrderOtherProperty {
  FieldKey?: string
  ObjectValueName?: string | null
  IntegerValue?: number | null  // TypeId=4 usa este campo
}
```

**Nova constante (após linha 76):**
```typescript
const ORDER_FIELD_KEY_CONTRACTED_GUESTS = 'order_3620B917-6DCD-4977-824F-F159CC196E29'
```

**Nova função extratora (após `extractChosenUnitName`):**
```typescript
function extractContractedGuests(order: PloomesOrder): number | null {
  const prop = order.OtherProperties?.find(
    (p) => p.FieldKey === ORDER_FIELD_KEY_CONTRACTED_GUESTS,
  )
  return prop?.IntegerValue ?? null
}
```

**Upsert `ploomes_orders` (linhas 298-322):** adicionar campo `contracted_guests: extractContractedGuests(order) ?? null` no payload.

**Push para `events.guest_count` (após upsert de `ploomes_orders`, ainda dentro do loop):** após o upsert da order ser bem-sucedido, se `contractedGuests !== null` e `order.DealId` existir, fazer:
```typescript
const contractedGuests = extractContractedGuests(order)
if (contractedGuests !== null && order.DealId) {
  await supabase
    .from('events')
    .update({ guest_count: contractedGuests })
    .eq('ploomes_deal_id', String(order.DealId))
}
```
Isso é o **modelo Push** — atualiza `events.guest_count` no momento do sync da Order.

### 2.3 Sync — `src/lib/ploomes/sync.ts`

**Linha 295 (event payload):**
```typescript
// ATUAL
guest_count: parsed.guestCount ?? null,
```

Como o valor de convidados agora vem da Order (syncada em `sync-orders.ts`), o sync de Deals **não deve mais sobrescrever** `guest_count` quando um Order já definiu o valor.

Opções:
- **Opção A (recomendada):** remover `guest_count` do `eventPayload` em `sync.ts`. O sync de deals deixa de tocar neste campo; só `sync-orders.ts` o alimenta. Risco: eventos manuais (sem deal) perdem a propagação — mas esses nunca tiveram esse campo via Ploomes de qualquer forma.
- **Opção B:** manter `guest_count: parsed.guestCount ?? null` como fallback, mas o sync de Orders sobrescreverá com o valor definitivo na próxima execução. Menos limpo — cria janela de ~15min com valor errado.

**Opção A recomendada.** O campo `guestCount` no `parseDeal()` pode ser mantido no tipo mas ignorado no sync de eventos. (Ver 2.4 sobre deprecar o campo.)

### 2.4 Parser — `src/lib/ploomes/field-mapping.ts`

**Linha 41:** entrada `deal_05EE1763-7254-4C41-B419-365794B1CA06` → `guestCount`.

Ação: marcar como **deprecated no comentário** mas manter a extração em `ParsedDeal`. Isso preserva retrocompatibilidade com `sync-deals.ts` (BI) que pode consumir `guestCount`. Verificar se `sync-deals.ts` usa `guestCount` — se não usar, pode ser removido completamente.

Busca em `src/lib/ploomes/sync-deals.ts`: nenhum `guestCount` encontrado → campo pode ser removido da extração em `field-mapping.ts` e do tipo `ParsedDeal` **como tarefa separada** (não bloqueia esta PR).

### 2.5 Tipos — `src/types/database.types.ts`

**Linha 517:** `guest_count: number | null` em `Event` — **sem mudança** (coluna persiste).

`EventForList` herda de `Event` via `*` — sem mudança.

### 2.6 UI — Pontos de exibição de `guest_count`

Todos os pontos abaixo **não precisam mudar na lógica** — continuam lendo `event.guest_count`. A mudança é semântica (origem), não na UI. Exceto a regra de exibição:

| Arquivo | Linha | Comportamento atual | Comportamento v1.10 |
|---------|-------|--------------------|--------------------|
| `src/components/features/events/event-card.tsx` | 173-178 | Oculta quando `null` | Mostrar `"não definido"` quando `null` (ver 2.7) |
| `src/app/(auth)/eventos/[id]/page.tsx` | 430-434 e 460-476 | Oculta quando `null` | Mostrar `"não definido"` quando `null` (ver 2.7) |
| `src/components/features/dashboard/next-event-card.tsx` | 79-84 | Oculta quando `null` | Mostrar `"não definido"` quando `null` (ver 2.7) |
| `src/components/features/ploomes/ploomes-event-details.tsx` | 52-53 | `null` → oculta linha | Mostrar `"não definido"` quando `null` (ver 2.7) |
| `src/components/features/reports/events-tab.tsx` | 102, 114, 131-132 | `?? 0` para cálculos | **Sem mudança** — relatórios usam 0 como neutro; `avg_guests` da RPC já lida com NULL |

### 2.7 Regra de exibição: `null` → `"não definido"`

A instrução do produto é exibir literalmente `"não definido"` quando `guest_count === null` (nunca ocultar o campo). Isso implica mudanças nos 4 pontos de UI acima, trocando condicionais `{event.guest_count && ...}` por renderização incondicional com fallback de texto.

**Exemplo de padrão unificado:**
```tsx
<span>{event.guest_count !== null ? `${event.guest_count} convidados` : 'não definido'}</span>
```

### 2.8 Formulário de evento manual — sem mudança

`src/components/features/events/event-form.tsx:329-335` — campo "Nº de Convidados" permanece para eventos manuais (sem deal Ploomes). O sync não sobrescreve campos de eventos manuais porque `ploomes_deal_id` é null.

### 2.9 Sanitize (risco de privacidade)

`src/components/features/dashboard/calendar-export/sanitize-events.ts` — não encontrada referência a `guest_count`. Isso significa que o número de convidados **é incluído no PNG exportado ao cliente**. Avaliar se deve ser removido do sanitizer na mesma PR (baixo risco de privacidade, mas merece decisão consciente).

---

## Seção 3 — Mod 2: Chip de Unidade — Pontos afetados

### 3.1 Novo token de cor: terracota (Moema)

**`src/app/globals.css`** — adicionar ramp terracota após a ramp sage existente:

```css
@theme inline {
  /* ... sage vars existentes ... */

  /* Terracota — identidade visual Moema */
  --color-terracota-50:  oklch(0.970 0.012 48);
  --color-terracota-100: oklch(0.940 0.025 48);
  --color-terracota-200: oklch(0.880 0.050 48);
  --color-terracota-300: oklch(0.800 0.080 48);
  --color-terracota-400: oklch(0.720 0.095 48);
  --color-terracota-500: oklch(0.630 0.102 48); /* ≈ #C97B5A */
  --color-terracota-600: oklch(0.560 0.090 48);
  --color-terracota-700: oklch(0.480 0.075 48);
  --color-terracota-800: oklch(0.400 0.060 48);
  --color-terracota-900: oklch(0.330 0.045 48);
}
```

Validar contraste WCAG AA para chip: `text-terracota-700` sobre `bg-terracota-100` ≥ 4.5:1 (ver Seção 6).

**`src/lib/constants/brand-colors.ts`** — adicionar para uso em Recharts/jsPDF/e-mail:
```typescript
export const BRAND_TERRACOTA: Record<number, string> = {
  500: '#C97B5A',
  700: '#A05A3A',
}
```

### 3.2 Helper de mapeamento unidade → cor

Criar helper (pode ser inline em `event-card.tsx` ou extraído em `src/lib/utils/unit-colors.ts` se usado em múltiplos lugares):

```typescript
export function getUnitChipStyle(slug: string | undefined): {
  bg: string
  text: string
  border: string
} {
  if (slug?.includes('moema')) {
    return {
      bg: 'bg-terracota-100',
      text: 'text-terracota-700',
      border: 'border-terracota-200',
    }
  }
  // Pinheiros (default)
  return {
    bg: 'bg-sage-100',
    text: 'text-sage-700',
    border: 'border-sage-200',
  }
}
```

Matching por `slug.includes()` é resiliente a variações de capitalização e prefixos futuros.

### 3.3 Dados de unidade disponíveis em `EventForList`

**`src/hooks/use-events.ts`** — `EVENT_FOR_LIST_SELECT` usa `*` e não inclui join de `units`. Necessário adicionar:

```typescript
// Adicionar ao select:
unit:units(id, name, slug)
```

**`src/types/database.types.ts`** — `EventForList` precisa receber o join:
```typescript
unit?: {
  id: string
  name: string
  slug: string
} | null
```

> Alternativa descartada: derivar unidade do `useUnitStore` — frágil para super_admin em modo "Todas as unidades".

### 3.4 EventCard — substituir avatar circular pelo chip

**`src/components/features/events/event-card.tsx`**

Remover (linhas 35-56 e 133-138):
- Constante `AVATAR_COLORS`
- Função `getAvatarColor(name)`
- Função `getInitials(name)`
- Div do avatar circular

Adicionar (no lugar do avatar, ou como elemento separado no card):
```tsx
<UnitChip slug={event.unit?.slug} name={event.unit?.name ?? 'Unidade'} />
```

Componente `UnitChip` (pode ser inline ou extraído):
```tsx
function UnitChip({ slug, name }: { slug?: string; name: string }) {
  const style = getUnitChipStyle(slug)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      style.bg, style.text, style.border,
    )}>
      <Building2 className="w-3 h-3" />
      {name}
    </span>
  )
}
```

`name` vem de `event.unit?.name` (ex: "Cachola Pinheiros" ou "Cachola Moema"). Se preferir label curto, usar `formatSlug(slug)` do padrão de `unit-switcher.tsx` para obter "Pinheiros" / "Moema".

### 3.5 Outros pontos de identidade visual de unidade

| Arquivo | Linha | Situação | Ação |
|---------|-------|----------|------|
| `src/components/features/dashboard/calendar-view.tsx` | pills de evento | Pills usam cores de status (confirmed/lost), não de unidade | **Sem mudança** — escopo não inclui calendário |
| `src/components/layout/unit-switcher.tsx` | dropdown | Texto puro + `Building2`, sem cor | **Sem mudança** — escopo não inclui switcher |
| `src/components/features/bi/bi-breakdown-by-unit.tsx` | `h4` | Texto puro | **Fora de escopo** — BI não faz parte desta PR |
| `src/components/features/bi/bi-unit-comparison.tsx` | 109, 182 | Texto puro | **Fora de escopo** — BI não faz parte desta PR |
| `src/components/features/events/pre-reserva-ploomes-card.tsx` | — | Rosa fixo (pink), sem unidade | **Sem mudança** — PR pré-reserva tem identidade própria |
| `src/app/(auth)/eventos/[id]/page.tsx` | header | Sem exibição de unidade | **Avaliar** adicionar chip no cabeçalho do detalhe do evento — baixa prioridade, não bloqueia |

### 3.6 Filtro de unidade em `/eventos`

`src/app/(auth)/eventos/_components/event-filters.tsx` — verificar se há filtro de unidade. O UnitSwitcher já controla filtragem via store. Sem mudança esperada, mas validar visualmente após deploy.

---

## Seção 4 — Plano de Migration

### Migration 091 — `091_ploomes_orders_contracted_guests.sql`

```sql
-- supabase/migrations/091_ploomes_orders_contracted_guests.sql
-- Objetivo: armazenar convidados contratados (Convidados contratados, Order FieldKey
-- order_3620B917-6DCD-4977-824F-F159CC196E29, TypeId=4 IntegerValue) em ploomes_orders.
-- Fonte de verdade para events.guest_count em vez do campo de Deal (deal_05EE1763...).

BEGIN;

ALTER TABLE public.ploomes_orders
  ADD COLUMN IF NOT EXISTS contracted_guests INTEGER;

COMMENT ON COLUMN public.ploomes_orders.contracted_guests IS
  'Convidados contratados (FieldKey order_3620B917-6DCD-4977-824F-F159CC196E29, TypeId=4). '
  'Fonte de verdade para events.guest_count. NULL = campo não preenchido no Ploomes.';

COMMIT;
```

**Sem backfill automático na migration.** O backfill ocorre naturalmente nas próximas execuções do cron `sync-orders` (a cada 30min) após o deploy. Para backfill imediato, pode-se disparar manualmente via `/api/cron/ploomes-sync` ou aguardar.

### Não são necessárias outras migrations

- `events.guest_count` permanece — sem ALTER TABLE.
- Token CSS (terracota) vai em `globals.css`, não em migration.
- Sem novas RPCs para esta PR.

---

## Seção 5 — Plano de PR

### Opção recomendada: **PR único**

As duas modificações são independentes na camada de sync/banco mas convergem no componente `EventCard` (guest_count display + unit chip). Uma PR única reduz overhead de review e evita estado intermediário onde o chip existe mas o `EVENT_FOR_LIST_SELECT` ainda não inclui `unit`.

**Ordem interna de commits sugerida:**

1. **`chore(db): migration 091 — contracted_guests em ploomes_orders`**
   - `supabase/migrations/091_ploomes_orders_contracted_guests.sql`

2. **`feat(sync): extrair contracted_guests da Order Ploomes`**
   - `src/lib/ploomes/sync-orders.ts` (interface, constante, extrator, upsert, push para events)

3. **`feat(tokens): adicionar ramp terracota em globals.css e brand-colors.ts`**
   - `src/app/globals.css`
   - `src/lib/constants/brand-colors.ts`

4. **`feat(events): chip de unidade em EventCard + join unit em EVENT_FOR_LIST_SELECT`**
   - `src/hooks/use-events.ts`
   - `src/types/database.types.ts`
   - `src/components/features/events/event-card.tsx`

5. **`fix(events): exibir "não definido" quando guest_count é null`**
   - `src/components/features/events/event-card.tsx`
   - `src/app/(auth)/eventos/[id]/page.tsx`
   - `src/components/features/dashboard/next-event-card.tsx`
   - `src/components/features/ploomes/ploomes-event-details.tsx`

### Branch sugerida: `feat/v1.10-convidados-order-e-chip-unidade`

---

## Seção 6 — Riscos e Edge Cases

### R1 — Sem webhook para Orders (alto impacto, baixo risco de regressão)

O cron `sync-orders` roda a cada 30min. Não há receptor de webhook para Orders no projeto (`src/app/api/**/*ploomes*` não retorna nenhum arquivo). Isso significa que após o vendedor fechar uma Order no Ploomes, `events.guest_count` só será atualizado em até 30min. Comportamento aceitável para o caso de uso (dado de planejamento, não tempo-real), mas deve ser documentado para o produto.

### R2 — Eventos com guest_count preenchido via Deal (histórico)

Após deploy, events existentes que tinham `guest_count` populado via Deal continuarão com aquele valor até que o cron de Orders rode e encontre uma Order com `contracted_guests` preenchido. Se o campo `Convidados contratados` da Order estiver vazio no Ploomes, o valor histórico do Deal **não será sobrescrito** (push condicional: `if contractedGuests !== null`). Comportamento correto.

### R3 — Eventos manuais (sem deal Ploomes)

`guest_count` em eventos manuais só pode ser editado via formulário (`event-form.tsx`). O sync de Orders nunca toca eventos sem `ploomes_deal_id`. Sem impacto. A exibição `"não definido"` aparecerá para eventos manuais cujo organizador não preencheu o campo — aceitável.

### R4 — Contraste WCAG para terracota

`text-terracota-700` (`oklch(0.480 0.075 48)`) sobre `bg-terracota-100` (`oklch(0.940 0.025 48)`) precisa de verificação de contraste ≥ 4.5:1 (WCAG AA para texto normal). A proposta de oklch aproximada resulta em ~5.2:1 estimado — dentro do AA, mas deve ser validado com ferramenta (Figma, Chrome DevTools, ou browser-side contrast checker) após implementação visual.

### R5 — `sanitize-events.ts` e privacidade de guest_count no PNG exportado

`src/components/features/dashboard/calendar-export/sanitize-events.ts` não filtra `guest_count`. O número de convidados aparece no PNG enviado ao cliente. Este campo provavelmente não é sensível (clientes sabem quantas pessoas contrataram), mas deve ser decisão explícita. Recomendação: manter como está, registrar como comportamento consciente.

### R6 — Dark mode do chip de unidade

Os tokens `bg-terracota-100` e `text-terracota-700` são definidos com valores fixos de oklch. Verificar que o design do chip fica legível tanto no modo claro quanto escuro. Se o dark mode requerir ajuste de contraste, usar `dark:` variants nas classes do chip.

### R7 — `event.unit` pode ser `null` em eventos antigos

Eventos criados antes de `unit_id` ser obrigatório podem ter `unit_id = null`. O join `unit:units(id, name, slug)` retornará `null` nesse caso. O chip precisa de fallback gracioso — por exemplo, omitir o chip quando `event.unit` é nulo, ou exibir um chip neutro "—".

### R8 — `sync.ts` deixar de escrever `guest_count`

Ao remover `guest_count` do payload do sync de Deals, existe uma janela onde um evento já tem `guest_count` populado via Deal (valor antigo) e o sync de Orders ainda não rodou para sobrescrever. Isso é aceitável e transitório. O dado continuará correto após a primeira execução do sync de Orders.

---

## Seção 7 — Estimativas

### Mod 1 — Convidados via Order

| Área | Arquivos | Tamanho estimado |
|------|----------|-----------------|
| Migration | 1 (`091_…`) | XS (10 linhas) |
| Sync (`sync-orders.ts`) | 1 | S (~30 linhas) |
| Sync (`sync.ts`) | 1 | XS (remover 1 linha) |
| Field-mapping (`field-mapping.ts`) | 1 | XS (comentar entrada) |
| UI — exibição "não definido" | 4 arquivos | S (~20 linhas total) |
| **Subtotal Mod 1** | **8 arquivos** | **S** |

### Mod 2 — Chip de Unidade

| Área | Arquivos | Tamanho estimado |
|------|----------|-----------------|
| CSS tokens (`globals.css`) | 1 | S (~12 linhas oklch) |
| `brand-colors.ts` | 1 | XS (~4 linhas) |
| `use-events.ts` | 1 | XS (1 linha no select) |
| `database.types.ts` | 1 | XS (~5 linhas) |
| `event-card.tsx` | 1 | M (remover avatar + adicionar chip + helper) |
| **Subtotal Mod 2** | **5 arquivos** | **S–M** |

### Total PR

- **13 arquivos** (8 + 5, sem sobreposição)
- **1 migration**
- **Tamanho total estimado:** M
- **Tempo de implementação estimado:** 2–3h (sem contabilizar validação visual e testes)
- **Categoria CLAUDE.md:** A (mudança percebida pelo usuário) — `npm run dev` + validação visual obrigatórios antes de commitar

---

## Referências rápidas para implementação

```
FieldKey convidados contratados: order_3620B917-6DCD-4977-824F-F159CC196E29
FieldKey unidade escolhida (já em uso): order_EDD14E93-ECEB-4EEE-A362-80416A78E61D
Cor sage-500 (Pinheiros): #7C8D78 = oklch(0.567 0.044 144)
Cor terracota-500 (Moema): #C97B5A = oklch(0.630 0.102 48) (aproximado)
Container Docker local: cacholaos-db
```
