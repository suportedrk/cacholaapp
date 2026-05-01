# Design Tokens Cachola

A identidade visual do Cachola é **sage green + warm beige** — paleta orgânica, aconchegante, alinhada com o universo de festa infantil sem ser infantilizada. Esta referência é a fonte de verdade para qualquer cor, tipografia ou espaçamento.

## Cores principais (decorar)

| Token | Hex | Uso |
|---|---|---|
| `sage-500` | `#7C8D78` | **Cor primária.** Botão default, link, ícone ativo, chart principal. |
| `beige-200` | `#E3DAD1` | **Fundo suave.** Cards, hover states, divisórias claras. |
| `sage-900` | `#3F4A3D` | Texto em fundo claro, ícone enfático. |
| `beige-50` | `#FAF7F4` | Fundo de página principal. |

## Escala completa

### Sage (verde-acinzentado, primária)
```
sage-50   #F4F6F3    fundo muito suave, pílulas claras
sage-100  #E5EAE3    fill de área em chart
sage-200  #C9D1C5    borda suave, divisores
sage-300  #ACB7A6    hover claro, segundo plano em chart
sage-500  #7C8D78    PRIMÁRIA — botões, links, ações
sage-600  #6A7A66    hover de botão primário
sage-700  #586854    texto sobre fundo claro, eixo de chart
sage-900  #3F4A3D    texto principal, ícone preenchido
```

### Beige (warm beige, secundária)
```
beige-50   #FAF7F4    fundo de página
beige-100  #F0EBE5    fundo de card
beige-200  #E3DAD1    SECUNDÁRIA — fundo suave, hover, borda card
beige-300  #D2C5B7    borda padrão
beige-500  #A89580    texto secundário em fundo escuro
```

⚠️ **`brand-950` NÃO EXISTE.** A paleta termina em `900`. Se Claude Code escrever `bg-brand-950`, é alucinação — corrigir para `brand-900`.

### Cores semânticas

```
success-500  #6B8E5A    confirmação, KPI positivo
warning-500  #C99D4A    aviso, atenção
danger-500   #B85C5C    erro, ação destrutiva, perdido
info-500     #6B8FA8    info neutra
```

Notar que `success` puxa para o verde da paleta (combina com `sage`), e `danger` é vinho/terracota suave (não vermelho neon). Mantém a coesão visual.

### Cores neutras (cinza)

Use **`sage-700/900` para texto** e **`beige-200/300` para divisores** sempre que possível. Cinza puro (Tailwind `gray-*`) só em casos onde nem sage nem beige se encaixam (raro).

## Variáveis CSS — fonte de verdade

Todas as cores são expostas em `:root` no `globals.css`:

```css
:root {
  --color-sage-50: #F4F6F3;
  --color-sage-100: #E5EAE3;
  --color-sage-500: #7C8D78;
  /* ... */
  --color-beige-50: #FAF7F4;
  --color-beige-200: #E3DAD1;
  /* ... */
}
```

**Como usar:**
- **Tailwind**: `bg-sage-500`, `text-beige-200`, `border-sage-300` (configurado em `tailwind.config.ts`).
- **Recharts/SVG inline**: `fill="var(--color-sage-500)"`, `stroke="var(--color-beige-300)"`.
- **CSS custom**: `background: var(--color-sage-500)`.

## Tipografia

### Fonts

```
--font-sans: 'Inter', system-ui, sans-serif    /* texto geral */
--font-display: 'Playfair Display', serif      /* títulos grandes, marca */
```

`Playfair Display` para H1/H2 da landing e tela de login (carrega identidade). Resto: `Inter`.

### Escala (Tailwind)

```
text-xs    12px    legenda, badge
text-sm    14px    texto secundário, table cells
text-base  16px    texto padrão
text-lg    18px    subtítulos
text-xl    20px    H3
text-2xl   24px    H2
text-3xl   30px    H1 dashboard
text-5xl   48px    H1 landing (com Playfair)
```

### Pesos

- `font-normal` (400) — texto corrido
- `font-medium` (500) — labels, links
- `font-semibold` (600) — H3, H2
- `font-bold` (700) — H1, KPIs

## Espaçamento (Tailwind padrão)

Cachola segue a escala default do Tailwind. Padrões mais usados:
- **Padding card**: `p-4` (16px) ou `p-6` (24px) em telas largas.
- **Gap entre cards**: `gap-4` ou `gap-6`.
- **Página**: `px-6 py-8` em desktop, `px-4 py-6` em mobile.
- **Inline (botão, badge)**: `px-3 py-1.5`.

## Border radius

- `rounded-md` (6px) — botões, inputs, badges (default).
- `rounded-lg` (8px) — cards, dialogs.
- `rounded-full` — avatars, pílulas, chips de status.

Evite `rounded-2xl`+ (muito arredondado descaracteriza).

## Shadows

```
shadow-sm    sutil — hover de card
shadow-md    padrão — card destacado, dialog
shadow-lg    enfático — popover, dropdown aberto
shadow-xl    raro — modal full em mobile
```

Custom Cachola (em `tailwind.config.ts`):
```
shadow-cachola: '0 2px 8px -2px rgba(124, 141, 120, 0.15)'   /* tom verde sutil, mais orgânico que cinza */
```

## Estados — convenções

| Estado | Visual |
|---|---|
| Default | `bg-white`, `border-beige-200`, `text-sage-900` |
| Hover | `bg-beige-100` (background) ou `bg-sage-600` (primary) |
| Focus | `ring-2 ring-sage-500 ring-offset-2` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Active/Selected | `bg-sage-500 text-white` (botão), `bg-beige-200` (item de menu) |

## Botão — variantes

```tsx
// src/components/ui/button.tsx
buttonVariants({ variant: 'default' })    // sage-500 com texto branco
buttonVariants({ variant: 'secondary' })  // beige-200 com texto sage-900
buttonVariants({ variant: 'outline' })    // border sage-300, fundo transparente
buttonVariants({ variant: 'ghost' })      // sem borda, hover beige-100
buttonVariants({ variant: 'destructive' })// danger-500 com texto branco
buttonVariants({ variant: 'link' })       // só texto sage-500 sublinhado
```

Tamanhos: `size: 'sm' | 'default' | 'lg' | 'icon'`.

## Chips de urgência (Vendas Recompra Fase D)

Padrão estabelecido para sinalizar urgência por tempo:

```tsx
🔥  0–7 dias    bg-danger-500 text-white       (urgente)
⚡  8–30 dias   bg-warning-500 text-white      (atenção)
🎂  31–60 dias  bg-info-500 text-white         (próximo)
📅  61–90 dias  bg-sage-300 text-sage-900      (planejamento)
```

Manter os emojis — fazem parte da linguagem visual já estabelecida.

## Dark mode

**Ainda não implementado.** Quando vier, será via prefix `dark:` do Tailwind. As variáveis CSS serão sobrescritas em `.dark { ... }` em `globals.css`.

Por enquanto, **não use** `dark:bg-...` em código novo (vira ruído sem efeito).

## Acessibilidade — contraste mínimo

- Texto sobre `sage-500`: usar **branco**.
- Texto sobre `beige-200`: usar `sage-900`.
- Texto sobre `beige-100`: usar `sage-700` ou `sage-900`.
- ❌ NUNCA `sage-300 sobre beige-200` ou similar — contraste insuficiente, falha WCAG AA.

Quando em dúvida, conferir em https://webaim.org/resources/contrastchecker/.

## Onde editar / estender

- **Cores novas:** `tailwind.config.ts` (`theme.extend.colors`) E `globals.css` (variável CSS).
- **Tokens semânticos:** `src/styles/tokens.css` se existir, ou direto em `globals.css`.
- **NÃO criar:** cores ad-hoc em componente individual (`#7C8D78` hardcoded). Sempre via token.
