# Design Tokens Cachola

A identidade visual do Cachola é **verde sálvia (sage) + bege quente** — paleta orgânica, aconchegante, alinhada com o universo de festa infantil sem ser infantilizada.

> **Fonte de verdade real:** `src/app/globals.css`. Este arquivo é um resumo navegável; em conflito, vale o `globals.css` + a seção DESIGN SYSTEM do `CLAUDE.md` raiz.
>
> ⚠️ **Tailwind v4 — NÃO existe `tailwind.config.ts`.** A config vive em `globals.css` via `@theme inline { … }`. Cores são definidas em **`oklch()`** (não hex), e o dark mode usa `@custom-variant dark (&:is(.dark *))`.

---

## Regra de ouro: use TOKENS SEMÂNTICOS e CLASSES UTILITÁRIAS, não cor crua

A causa nº 1 de dívida visual no projeto é escrever `bg-amber-100 text-amber-700` (tint cru, **quebra no dark mode**) em vez da classe utilitária que já embute o `dark:`. Antes de escrever cor, procure nesta ordem:

1. **Classe utilitária pronta** (`.badge-{cor}`, `.icon-{cor}`, `.card-interactive`, `.skeleton-shimmer`) — já é dark-mode-safe.
2. **Token semântico** (`bg-surface-*`, `text-text-*`, `border-border-*`, `bg-status-*`).
3. **Rampa de marca** (`bg-brand-*`, `bg-beige-*`) só quando precisa do tom da marca.
4. **Hex cru:** proibido na UI. Exceções: Recharts/SVG de chart, jsPDF, templates de e-mail, e HTML gerado para print/html2canvas (lá hex inline é OBRIGATÓRIO — `oklch()` quebra a captura).

---

## Cores da marca (rampas)

Verde sálvia = ramp **`brand-50…900`** (o nome é `brand`, **não** `sage`). Bege = **`beige-50…900`**. Ambas em `oklch` no `@theme inline`.

| Token | Equivalente | Uso |
|---|---|---|
| `--primary` / `bg-primary` | `#7C8D78` (`oklch(0.567 0.044 144)`) | Verde sálvia — botão primário, navbar ativa, link |
| `--secondary` / `bg-secondary` | `#E3DAD1` | Bege quente — backgrounds, cards suaves |
| `--background` | `#FAFAF8` | Fundo geral |
| `--card` / `bg-card` | `#FFFFFF` | Cards, modais |

Rampas completas: `bg-brand-50 … bg-brand-900` e `bg-beige-50 … bg-beige-900`.

⚠️ **`brand-950` NÃO EXISTE** — a rampa termina em `900`. `bg-brand-950` é alucinação → corrigir para `brand-900`.

## Tokens semânticos (preferir a cor crua)

- **Superfícies:** `bg-surface-primary` / `-secondary` / `-tertiary` / `-inverse`
- **Texto:** `text-text-primary` / `-secondary` / `-tertiary` / `-inverse` / `-link`
- **Bordas:** `border-border-default` / `-strong` / `-focus`
- **Status (par bg/text/border):** `bg-status-error-bg` + `text-status-error-text` + `border-status-error-border` — idem `success`, `warning`, `info`. Use em banners/alerts.
- **Z-index:** `z-dropdown`(10) `z-sticky`(20) `z-overlay`(30) `z-modal`(40) `z-toast`(50) `z-tooltip`(60)
- **Sombras:** `shadow-xs/sm/md/lg/xl`

## Classes utilitárias do DS (dark-mode-safe — definidas em `globals.css`)

| Classe | Para quê | Em vez de |
|---|---|---|
| `.icon-{brand,blue,green,amber,orange,red,purple,gray}` | fundo+texto de ícone em card | `bg-*-50`/`bg-*-100` cru |
| `.badge-{brand,blue,green,amber,orange,red,purple,gray}` | pill/badge de status (use com `border`) | `bg-*-100 text-*-700` cru |
| `.card-interactive` | hover/active de card clicável | `hover:shadow-md` manual |
| `.skeleton-shimmer` | placeholder de loading | `animate-pulse` |
| `.focus-ring` | anel de foco acessível | ring manual |
| `.animate-badge-pulse` | ênfase pulsante (com guard `prefers-reduced-motion`) | `animate-pulse` cru em badge |

Cada `.icon-*`/`.badge-*` já inclui os overrides `dark:` — por isso são a forma correta. Escrever o tint na mão sem `dark:` é o bug recorrente.

## Tipografia

```
--font-sans:    'Inter', system-ui, sans-serif    /* texto geral */
--font-display: 'Playfair Display', serif          /* títulos grandes, marca (login/landing) */
```

Escala Tailwind: `text-xs`(12) `text-sm`(14) `text-base`(16) `text-lg`(18) `text-xl`(20) `text-2xl`(24) `text-3xl`(30) `text-5xl`(48, H1 landing com Playfair).
Pesos: `font-normal`(400) corrido · `font-medium`(500) labels/links · `font-semibold`(600) H2/H3 · `font-bold`(700) H1/KPIs.

## Espaçamento (escala Tailwind padrão)

- **Padding card:** `p-4` (16px) ou `p-6` (24px).
- **Gap entre cards:** `gap-4` / `gap-6`.
- **Página:** `px-6 py-8` desktop, `px-4 py-6` mobile.
- **Inline (botão, badge):** `px-3 py-1.5`.

## Border radius

- `rounded-md` (6px) — botões, inputs, badges (default).
- `rounded-lg` (8px) — cards, dialogs.
- `rounded-full` — avatars, pílulas, chips de status.
- Evitar `rounded-2xl`+ (descaracteriza).

## Botão — variantes (`src/components/ui/button.tsx`)

```tsx
buttonVariants({ variant: 'default' })     // primary (verde sálvia) texto branco
buttonVariants({ variant: 'secondary' })   // bege, texto escuro
buttonVariants({ variant: 'outline' })     // borda, fundo transparente
buttonVariants({ variant: 'ghost' })       // sem borda, hover suave
buttonVariants({ variant: 'destructive' }) // status danger, texto branco
buttonVariants({ variant: 'link' })        // só texto sublinhado
```
Tamanhos: `size: 'sm' | 'default' | 'lg' | 'icon'`.

⚠️ **`Button asChild` NÃO é suportado** (stack @base-ui). Para um link com cara de botão: `<Link className={cn(buttonVariants({ … }))}>`.

## Chips de urgência (Vendas Recompra Fase D)

```tsx
🔥  0–7 dias    badge-red    (urgente)
⚡  8–30 dias   badge-amber  (atenção)
🎂  31–60 dias  badge-blue   (próximo)
📅  61–90 dias  badge-gray   (planejamento)
```
Manter os emojis — fazem parte da linguagem visual estabelecida.

## Dark mode — IMPLEMENTADO

Dark mode **está ativo** (toggle Sol/Lua na navbar → `localStorage: cachola-theme` `'light'|'dark'|'system'`; anti-FOUC inline no `<head>`; classe `.dark` com overrides `oklch` em `globals.css`).

- **USE** os tokens semânticos e as classes `.icon-*`/`.badge-*`/`.card-interactive` — elas já trazem o comportamento dark embutido.
- Quando precisar de um tint específico não coberto por elas, **escreva o par claro+escuro**: `bg-amber-50 dark:bg-amber-900/30 …`. Tint claro **sem** `dark:` é bug (fundo claro + texto claro no dark).
- `@custom-variant dark (&:is(.dark *))` — a variante `dark:` do Tailwind funciona normalmente.
- `prefers-reduced-motion` desabilita transições/`.animate-badge-pulse` globalmente.

## Acessibilidade — contraste

- Texto sobre `primary`: branco.
- Conferir WCAG AA (4.5:1 texto normal) — https://webaim.org/resources/contrastchecker/
- Touch target mínimo 44px: o `globals.css` já força `min-height/width: 44px` em `button`/`a`/`[role=button]`. Para um `<div onClick>` pequeno e clicável, envolver num wrapper `w-11 h-11`.

## Onde editar / estender

- **Cores/tokens novos:** `globals.css` — dentro de `@theme inline { }` (mapeia `--color-*`) + a definição da variável em `:root` e o override em `.dark`. **NÃO** há `tailwind.config.ts`.
- **Classe utilitária nova:** `@layer components` / `@layer utilities` no `globals.css`, seguindo o molde `.badge-*`/`.icon-*` (sempre com o par `dark:`).
- **NÃO criar** cor ad-hoc em componente (`#7C8D78` hardcoded) — sempre via token/classe.
