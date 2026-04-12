# Auditoria de Responsividade Mobile — Cachola OS
**Data:** 2026-04-12
**Escopo:** Todas as páginas e componentes do app

## Resumo Executivo
- **Total de problemas identificados:** 13
- **CRÍTICO (sobreposição/inacessível):** 0
- **ALTO (UX ruim mas funcional):** 5
- **MÉDIO (visual imperfeito):** 6
- **BAIXO (polish):** 2

---

## Problemas por Módulo

### 1. Shell/Layout Principal
**Status:** ✅ EXCELENTE

O layout principal está bem estruturado para mobile:
- Sidebar corretamente oculta em mobile, usa `lg:static` para desktop
- Overlay com `lg:hidden` aplicado corretamente
- Overlay escuro com `fixed inset-0 z-30` apropriado
- Hamburger button presente com classe `lg:hidden`
- Main content com `p-4 lg:p-6` — padding responsivo correto
- Navbar com altura `h-12 lg:h-14` — dimensões responsivas
- Breadcrumbs escondidas em mobile com `hidden lg:flex`

**Sem problemas identificados.**

---

### 2. Dashboard

| # | Sev | Arquivo | Linha | Descrição | Solução |
|---|-----|---------|-------|-----------|---------|
| 1 | ALTO | `src/app/(auth)/dashboard/page.tsx` | 105 | Grid KPI: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` — em tablets 640–768px fica com apenas 2 colunas quando deveria ter 3 | Adicionar `sm:grid-cols-3` |
| 2 | MÉDIO | `src/app/(auth)/dashboard/page.tsx` | 167 | 5º KPI Card usa `col-span-2 md:col-span-1` para preencher linha em mobile — funciona mas fica desproporcionado em telas 320–400px | Considerar `grid-cols-1 sm:grid-cols-2` na base |
| 3 | BAIXO | `src/components/features/dashboard/kpi-card.tsx` | 194 | Sparkline com altura fixa `h-20` e margem negativa `-mx-1` pode causar overflow em telas <320px | Adicionar `max-w-full` ou margins responsivos |

---

### 3. Eventos

| # | Sev | Arquivo | Linha | Descrição | Solução |
|---|-----|---------|-------|-----------|---------|
| 4 | ALTO | `src/app/(auth)/eventos/page.tsx` | 355 | Cards grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-2` — `sm` e `lg` têm mesmo valor, desperdiçando espaço em desktop (1024px+) | Mudar para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| 5 | MÉDIO | `src/app/(auth)/eventos/page.tsx` | 83 | Skeleton grid: mesmo padrão `lg:grid-cols-2` — inconsistente com cards reais | Mudar para `lg:grid-cols-3` |

---

### 4. Checklists

| # | Sev | Arquivo | Linha | Descrição | Solução |
|---|-----|---------|-------|-----------|---------|
| 6 | ALTO | `src/app/(auth)/checklists/components/create-checklist-modal.tsx` | 322 | Tipo buttons: `grid grid-cols-3 gap-2` sem breakpoint base — em mobile <384px os 3 botões ficam ~75px cada, inacessíveis | Mudar para `grid-cols-2 sm:grid-cols-3` |
| 7 | MÉDIO | `src/app/(auth)/checklists/minhas-tarefas/page.tsx` | 398 | KPI filter: `grid-cols-2 sm:grid-cols-4` sem md/lg — em tablet mantém 4 colunas quando layout poderia ser melhor | Adicionar `md:grid-cols-6` ou ajustar |
| 8 | MÉDIO | `src/app/(auth)/checklists/page.tsx` | 96 | Cards: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` — pulo direto de sm para xl; tablet 768–1280px fica preso em 2 colunas | Adicionar `md:grid-cols-3` entre sm e xl |

---

### 5. Manutenção

| # | Sev | Arquivo | Linha | Descrição | Solução |
|---|-----|---------|-------|-----------|---------|
| 9 | ALTO | `src/app/(auth)/manutencao/chamados/page.tsx` | 238 | Skeleton KPI grid: `grid grid-cols-2 sm:grid-cols-4` sem breakpoint base — em mobile <640px mostra 2 colunas sem garantia de espaço mínimo | Verificar se `grid-cols-2` tem espaço adequado ou usar `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` |
| 10 | MÉDIO | `src/app/(auth)/manutencao/chamados/page.tsx` | 322 | Filter chips: `overflow-x-auto no-scrollbar` — sem feedback visual de scroll em mobile reduz discoverability | Considerar scroll-indicator ou edge-fade |

---

### 6. Configurações / Integrações

| # | Sev | Arquivo | Linha | Descrição | Solução |
|---|-----|---------|-------|-----------|---------|
| 11 | ALTO | `src/app/(auth)/configuracoes/integracoes/ploomes/page.tsx` | 163 | Skeleton métricas: `grid grid-cols-4 gap-3` SEM responsive — hardcoded 4 colunas em mobile torna cada skeleton <80px, visualmente quebrado | Mudar para `grid-cols-2 sm:grid-cols-4` |
| 12 | MÉDIO | `src/app/(auth)/configuracoes/page.tsx` | 56 | TabsList com `overflow-x-auto [scrollbar-width:none]` — sem visual feedback de abas adicionais em mobile | Adicionar edge-fade ou scroll-indicator |

---

### 7. Equipamentos
**Status:** ✅ BOM

Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — bem estruturado com breakpoints lógicos.

---

### 8. Admin / Usuários
**Status:** ✅ BOM

Tabela responsiva com transição card-view (mobile) → tabela (desktop) via `hidden md:grid`.

---

### 9. Componentes Compartilhados
**Status:** ✅ BOM

| Componente | Avaliação |
|-----------|-----------|
| `PageHeader` (`page-header.tsx`) | `flex flex-col gap-1 sm:flex-row` — correto em todas as páginas ✅ |
| `EventCard` | Layout flexível `flex items-start gap-3` — sem problemas ✅ |
| `Command Palette` | `w-full rounded-t-2xl max-h-[85svh]` mobile, `sm:rounded-2xl sm:max-w-[560px]` desktop — excelente ✅ |
| `Welcome Modal` | `p-4 sm:p-6` + `w-full max-w-md` — correto ✅ |

---

## Problemas Globais de CSS

### Padrão 1 — Pulo de breakpoints (SM → LG/XL sem MD)
Múltiplas páginas usam `sm:` e `lg:`/`xl:` sem `md:`, causando tablets (768–1024px) ficarem presos no layout de sm.

**Localizações:**
- `checklists/page.tsx` (linhas 96, 114, 256)
- `eventos/page.tsx` (linhas 83, 355)
- Componentes de KPI/cards em geral

**Impacto:** Tablets aparecem espremidos com 2 colunas quando poderiam ter 3.

### Padrão 2 — Grids sem breakpoint base (`grid-cols-N` sem `grid-cols-1` em mobile)
Alguns grids começam direto em `grid-cols-2`, `grid-cols-3` ou `grid-cols-4`.

**Localizações:**
- `checklists/components/create-checklist-modal.tsx` linha 322 (`grid-cols-3`)
- `configuracoes/integracoes/ploomes/page.tsx` linha 163 (`grid-cols-4`)

**Impacto:** Componentes muito estreitos em telas pequenas (<640px).

### Padrão 3 — Overflow horizontal sem feedback visual
Elementos com `overflow-x-auto` e `no-scrollbar`/`[scrollbar-width:none]` em filtros/abas deixam ambíguo se há mais conteúdo.

**Localizações:**
- `checklists/[id]/page.tsx` linha 45
- `manutencao/chamados/page.tsx` linha 322

---

## Recomendações de Implementação

### Fase 1 — Hotfix ALTO (estimativa: ~20 min)

1. `ploomes/page.tsx:163` — `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
2. `dashboard/page.tsx:105` — adicionar `sm:grid-cols-3`
3. `eventos/page.tsx:355` (e skeleton :83) — `lg:grid-cols-2` → `lg:grid-cols-3`
4. `checklists/create-checklist-modal.tsx:322` — `grid-cols-3` → `grid-cols-2 sm:grid-cols-3`
5. `manutencao/chamados/page.tsx:238` — verificar e ajustar skeleton KPI

### Fase 2 — Padronização MÉDIO (estimativa: ~2h)

6. Adicionar `md:grid-cols-3` entre `sm:` e `xl:` nas páginas de checklists e eventos
7. Corrigir `col-span-2` do 5º KPI card no dashboard

### Fase 3 — Polish BAIXO (estimativa: ~1h)

8. Feedback visual para containers com scroll horizontal (`overflow-x-auto`)
9. Ajustar sparkline margins (`-mx-1`) para telas <320px

---

## Checklist de Testes Recomendados

- [ ] 320px (iPhone SE) — verificar grid collapses
- [ ] 640px (sm) — verificar breakpoint sm funciona
- [ ] 768px (md/iPad) — verificar se md adicionado funciona
- [ ] 1024px (lg/iPad Pro) — verificar lg
- [ ] 1280px+ (desktop) — verificar xl
- [ ] Landscape em mobile — verificar overflow horizontal
- [ ] Form inputs com `w-full` em mobile
- [ ] Modais com `w-full max-w-*` em mobile
