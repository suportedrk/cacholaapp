# CLAUDE.md — Design System & UI/UX Instructions

> **Este arquivo é a fonte única de verdade para toda decisão de UI/UX neste projeto.**
> Claude Code DEVE ler e seguir estas instruções antes de criar qualquer componente, página ou layout.

---

## 0. FILOSOFIA CENTRAL

```
NUNCA invente componentes novos.
NUNCA crie variantes que não existam aqui.
SEMPRE reutilize o que já existe.
Se algo não está documentado aqui, PERGUNTE antes de criar.
```

- **Consistência > Criatividade**: Toda interface deve parecer ter sido feita pela mesma pessoa.
- **Composição > Invenção**: Monte telas combinando componentes existentes — não crie novos.
- **Semântica > Estética**: Cada token, componente e padrão tem um MOTIVO para existir.
- **Acessibilidade é obrigatória**: WCAG 2.1 AA mínimo. Sem exceções.

---

## 1. DESIGN TOKENS

### 1.1 Cores

```css
:root {
  /* ═══════════════════════════════════════════
     CORES PRIMITIVAS (nunca usar diretamente na UI)
     ═══════════════════════════════════════════ */
  --gray-50:  #FAFAFA;
  --gray-100: #F4F4F5;
  --gray-200: #E4E4E7;
  --gray-300: #D4D4D8;
  --gray-400: #A1A1AA;
  --gray-500: #71717A;
  --gray-600: #52525B;
  --gray-700: #3F3F46;
  --gray-800: #27272A;
  --gray-900: #18181B;
  --gray-950: #09090B;

  --brand-50:  #EFF6FF;
  --brand-100: #DBEAFE;
  --brand-200: #BFDBFE;
  --brand-300: #93C5FD;
  --brand-400: #60A5FA;
  --brand-500: #3B82F6;
  --brand-600: #2563EB;
  --brand-700: #1D4ED8;
  --brand-800: #1E40AF;
  --brand-900: #1E3A8A;

  --red-50:  #FEF2F2;
  --red-500: #EF4444;
  --red-600: #DC2626;
  --red-700: #B91C1C;

  --green-50:  #F0FDF4;
  --green-500: #22C55E;
  --green-600: #16A34A;
  --green-700: #15803D;

  --amber-50:  #FFFBEB;
  --amber-500: #F59E0B;
  --amber-600: #D97706;

  /* ═══════════════════════════════════════════
     TOKENS SEMÂNTICOS (USE ESTES na UI)
     ═══════════════════════════════════════════ */

  /* — Superfícies — */
  --surface-primary:    var(--gray-50);    /* fundo principal da página      */
  --surface-secondary:  #FFFFFF;           /* cards, modais, popovers       */
  --surface-tertiary:   var(--gray-100);   /* áreas agrupadas, sidebars     */
  --surface-inverse:    var(--gray-900);   /* banners escuros, tooltips     */

  /* — Texto — */
  --text-primary:    var(--gray-900);   /* títulos, corpo principal       */
  --text-secondary:  var(--gray-600);   /* descrições, labels             */
  --text-tertiary:   var(--gray-400);   /* placeholders, texto desabilitado */
  --text-inverse:    #FFFFFF;           /* texto sobre superfície escura  */
  --text-link:       var(--brand-600);  /* links                          */
  --text-link-hover: var(--brand-700);  /* links :hover                   */

  /* — Bordas — */
  --border-default:  var(--gray-200);   /* bordas padrão                  */
  --border-strong:   var(--gray-300);   /* bordas com mais ênfase         */
  --border-focus:    var(--brand-500);  /* anel de foco                   */

  /* — Status — */
  --status-error-bg:     var(--red-50);
  --status-error-text:   var(--red-700);
  --status-error-border: var(--red-500);

  --status-success-bg:     var(--green-50);
  --status-success-text:   var(--green-700);
  --status-success-border: var(--green-500);

  --status-warning-bg:     var(--amber-50);
  --status-warning-text:   var(--amber-600);
  --status-warning-border: var(--amber-500);

  --status-info-bg:     var(--brand-50);
  --status-info-text:   var(--brand-700);
  --status-info-border: var(--brand-500);

  /* — Interativos — */
  --interactive-primary:       var(--brand-600);
  --interactive-primary-hover: var(--brand-700);
  --interactive-primary-text:  #FFFFFF;

  --interactive-secondary:       var(--gray-100);
  --interactive-secondary-hover: var(--gray-200);
  --interactive-secondary-text:  var(--gray-900);

  --interactive-ghost-hover: var(--gray-100);

  --interactive-danger:       var(--red-600);
  --interactive-danger-hover: var(--red-700);
  --interactive-danger-text:  #FFFFFF;
}
```

#### Modo Escuro (Dark Mode)

```css
[data-theme="dark"], .dark {
  --surface-primary:   var(--gray-950);
  --surface-secondary: var(--gray-900);
  --surface-tertiary:  var(--gray-800);
  --surface-inverse:   var(--gray-50);

  --text-primary:   var(--gray-50);
  --text-secondary: var(--gray-400);
  --text-tertiary:  var(--gray-600);
  --text-inverse:   var(--gray-900);
  --text-link:      var(--brand-400);
  --text-link-hover:var(--brand-300);

  --border-default: var(--gray-800);
  --border-strong:  var(--gray-700);
  --border-focus:   var(--brand-400);

  --interactive-primary:       var(--brand-500);
  --interactive-primary-hover: var(--brand-400);
  --interactive-secondary:       var(--gray-800);
  --interactive-secondary-hover: var(--gray-700);
  --interactive-secondary-text:  var(--gray-50);

  --interactive-ghost-hover: var(--gray-800);
}
```

> **REGRA ABSOLUTA**: Nunca usar cores primitivas (--gray-500, --brand-600, etc.) diretamente na UI.
> Sempre usar os tokens semânticos (--text-primary, --surface-secondary, etc.).

---

### 1.2 Tipografia

```css
:root {
  /* Família */
  --font-sans:  'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* Escala de tamanho (rem) — base 16px */
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.875rem;   /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg:   1.125rem;   /* 18px */
  --text-xl:   1.25rem;    /* 20px */
  --text-2xl:  1.5rem;     /* 24px */
  --text-3xl:  1.875rem;   /* 30px */
  --text-4xl:  2.25rem;    /* 36px */

  /* Pesos */
  --font-regular:  400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* Line-heights */
  --leading-tight:  1.25;
  --leading-snug:   1.375;
  --leading-normal: 1.5;
  --leading-relaxed:1.625;

  /* Letter spacing */
  --tracking-tight:  -0.025em;
  --tracking-normal:  0;
  --tracking-wide:    0.025em;
}
```

#### Estilos de texto compostos (USE ESTES):

| Nome             | Tamanho      | Peso         | Line-height       | Uso                           |
|------------------|--------------|--------------|--------------------|-------------------------------|
| `heading-1`      | --text-4xl   | --font-bold  | --leading-tight    | Título de página              |
| `heading-2`      | --text-3xl   | --font-semibold | --leading-tight | Título de seção               |
| `heading-3`      | --text-2xl   | --font-semibold | --leading-snug  | Subtítulo                     |
| `heading-4`      | --text-xl    | --font-semibold | --leading-snug  | Título de card/grupo          |
| `body-lg`        | --text-lg    | --font-regular  | --leading-relaxed| Texto de destaque             |
| `body`           | --text-base  | --font-regular  | --leading-normal | Texto padrão                  |
| `body-sm`        | --text-sm    | --font-regular  | --leading-normal | Texto auxiliar, labels        |
| `caption`        | --text-xs    | --font-medium   | --leading-normal | Captions, badges, timestamps  |
| `code`           | --text-sm    | --font-regular  | --leading-normal | Código (usar --font-mono)     |

> **REGRA**: Nunca usar tamanhos de fonte fora desta escala.

---

### 1.3 Espaçamento

```css
:root {
  --space-0:   0;
  --space-0.5: 0.125rem;  /*  2px */
  --space-1:   0.25rem;   /*  4px */
  --space-1.5: 0.375rem;  /*  6px */
  --space-2:   0.5rem;    /*  8px */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.25rem;   /* 20px */
  --space-6:   1.5rem;    /* 24px */
  --space-8:   2rem;      /* 32px */
  --space-10:  2.5rem;    /* 40px */
  --space-12:  3rem;      /* 48px */
  --space-16:  4rem;      /* 64px */
  --space-20:  5rem;      /* 80px */
  --space-24:  6rem;      /* 96px */
}
```

#### Como usar espaçamento:

| Contexto                           | Token recomendado           |
|------------------------------------|-----------------------------|
| Gap entre ícone e label            | --space-1.5 a --space-2     |
| Padding interno de botão           | --space-2 (y) --space-4 (x) |
| Padding interno de card            | --space-4 a --space-6       |
| Gap entre campos de formulário     | --space-4                   |
| Gap entre seções na página         | --space-8 a --space-12      |
| Margem do container principal      | --space-4 (mobile), --space-8 (desktop) |

> **REGRA**: Nunca usar valores mágicos (13px, 17px, 22px). Sempre usar tokens da escala.

---

### 1.4 Bordas & Sombras

```css
:root {
  /* Border Radius */
  --radius-none: 0;
  --radius-sm:   0.25rem;   /*  4px — chips, badges           */
  --radius-md:   0.5rem;    /*  8px — botões, inputs, cards   */
  --radius-lg:   0.75rem;   /* 12px — cards maiores, modais   */
  --radius-xl:   1rem;      /* 16px — containers arredondados */
  --radius-full: 9999px;    /* pills, avatares                */

  /* Sombras (elevação) */
  --shadow-xs:  0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm:  0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10);
  --shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10);
  --shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10);
  --shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10);

  /* Hierarquia de elevação:
     Nível 0: Página (sem sombra)
     Nível 1: Cards no fluxo (--shadow-sm)
     Nível 2: Dropdowns, popovers (--shadow-md)
     Nível 3: Modais, dialogs (--shadow-lg)
     Nível 4: Notificações toast (--shadow-xl)
  */
}
```

---

### 1.5 Transições & Animações

```css
:root {
  --duration-fast:   100ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);    /* ease padrão        */
  --ease-in:      cubic-bezier(0.4, 0, 1, 1);       /* entrada             */
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);       /* saída               */
  --ease-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1);/* efeito elástico    */
}

/* Transições padrão (aplicar a TODOS elementos interativos) */
.interactive {
  transition-property: color, background-color, border-color, box-shadow, opacity, transform;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-default);
}
```

#### O que animar e o que NÃO:

| ✅ ANIMAR                          | ❌ NUNCA ANIMAR                    |
|------------------------------------|------------------------------------|
| hover de botões/links              | largura/altura (usar transform)    |
| abertura de modais (opacity+scale) | propriedade `left/top` (usar transform) |
| mudanças de cor                    | layout thrashing                   |
| focus ring                         | animações que duram > 500ms        |
| entrada de toasts                  | animações que bloqueiam interação  |

---

## 2. COMPONENTES — Catálogo Completo

> **INSTRUÇÃO**: Use SOMENTE estes componentes. Se precisar de algo que não existe aqui,
> combine componentes existentes. Se realmente não for possível, PARE e pergunte.

---

### 2.1 Button

**Variantes permitidas (e SOMENTE estas):**

| Variante    | Quando usar                                    |
|-------------|------------------------------------------------|
| `primary`   | Ação principal da tela (1 por grupo no máximo) |
| `secondary` | Ação secundária, alternativa                   |
| `ghost`     | Ação terciária, navegação sutil, toolbars      |
| `danger`    | Ação destrutiva (deletar, remover)             |
| `link`      | Ação inline que parece link                    |

**Tamanhos permitidos:**

| Tamanho | Altura | Padding-x | Font-size  | Uso                  |
|---------|--------|-----------|------------|----------------------|
| `sm`    | 32px   | 12px      | --text-sm  | Toolbars, tabelas    |
| `md`    | 40px   | 16px      | --text-sm  | Padrão (usar este)   |
| `lg`    | 48px   | 24px      | --text-base| CTAs, hero sections  |

**Regras:**
```
- Sempre ter border-radius: var(--radius-md)
- Sempre ter transition com --duration-normal
- Sempre ter focus-visible ring: 2px solid var(--border-focus), offset 2px
- Ícones: 16px (sm), 18px (md), 20px (lg) — à esquerda do label ou sozinhos
- Botão com ícone sozinho: aspect-ratio 1/1 (quadrado)
- Loading state: spinner de 16px substituindo o ícone/conteúdo, botão desabilitado
- Disabled: opacity 0.5, cursor not-allowed
- Máximo 2 botões lado a lado. Se precisar de mais, use dropdown ou toolbar
- Em mobile: botão full-width (width: 100%) para ações primárias
```

**HTML de referência:**
```html
<button class="btn btn-primary btn-md" type="button">
  <svg class="btn-icon" aria-hidden="true"><!-- ícone --></svg>
  <span>Label do Botão</span>
</button>
```

---

### 2.2 Input / TextField

**Variantes:**

| Estado     | Visual                                           |
|------------|--------------------------------------------------|
| default    | border: 1px solid var(--border-default)          |
| hover      | border-color: var(--border-strong)               |
| focus      | border-color: var(--border-focus), ring 2px      |
| error      | border-color: var(--status-error-border)         |
| disabled   | opacity: 0.5, background: var(--surface-tertiary)|
| readonly   | background: var(--surface-tertiary), sem borda   |

**Estrutura obrigatória:**
```
<label>         → SEMPRE presente (pode ser sr-only se necessário)
<input>         → altura: 40px (md), 32px (sm), 48px (lg)
<helper-text>   → Abaixo, --text-sm, --text-secondary
<error-message> → Abaixo, --text-sm, --status-error-text, com role="alert"
```

**Regras:**
```
- SEMPRE ter label (acessibilidade). Nunca só placeholder.
- Placeholder: dica de formato, nunca substituir label.
- border-radius: var(--radius-md)
- padding: var(--space-2) var(--space-3)
- Font: --text-base (md), --text-sm (sm)
- Ícone de prefixo: dentro do input, à esquerda, 18px, cor --text-tertiary
- Ícone de sufixo: dentro do input, à direita (ex: toggle password, clear)
- Largura máxima recomendada: 400px para inputs de texto curto
- Em formulários: gap de --space-4 entre campos
- Grupo de campos relacionados: usar <fieldset> com <legend>
```

---

### 2.3 Select / Dropdown

```
- Mesmo estilo visual do Input (borda, radius, tamanho, estados)
- Seta/chevron: ícone à direita, 18px, --text-tertiary
- Dropdown menu: surface-secondary, shadow-md, radius-md
- Opções: padding --space-2 --space-3, hover com --interactive-ghost-hover
- Opção selecionada: fundo --brand-50, ícone de check à direita
- Máximo 8 opções visíveis, depois scroll
- Para > 15 opções: usar combobox com busca
```

---

### 2.4 Checkbox & Radio

```
- Checkbox: 16px × 16px, radius-sm, border 2px
- Radio: 16px × 16px, radius-full, border 2px
- Checked: fundo var(--interactive-primary), ícone branco
- Label: --text-base, ao lado direito com gap --space-2
- Grupo: gap --space-3 entre opções (vertical)
- Indeterminate (checkbox): traço horizontal ao invés de check
- Focus: ring 2px var(--border-focus) com offset
- Toque mínimo: 44px × 44px de área clicável (incluindo label)
```

---

### 2.5 Toggle / Switch

```
- Track: 40px × 22px, radius-full
- Thumb: 18px × 18px, circular, branco
- Off: track com --gray-300, thumb à esquerda
- On: track com --interactive-primary, thumb à direita
- Transição: --duration-normal, --ease-default
- Label: ao lado direito ou esquerdo (consistente por contexto)
- NUNCA usar toggle para ações que precisam de "salvar"
  (toggle é para efeito imediato, como ligar/desligar)
```

---

### 2.6 Card

**Variantes:**

| Variante    | Uso                               | Estilo                                    |
|-------------|-----------------------------------|-------------------------------------------|
| `elevated`  | Cards padrão em grid              | surface-secondary, shadow-sm, radius-lg   |
| `outlined`  | Listas, dashboards densos         | surface-secondary, border 1px, radius-lg  |
| `filled`    | Destaque, estatísticas            | surface-tertiary, sem borda, radius-lg    |
| `interactive`| Card clicável (link/ação)        | elevated + hover:shadow-md + cursor pointer|

**Estrutura:**
```
Card
├── Card.Header   → padding: --space-4 --space-6 (top,sides), opcional
│   ├── título (heading-4)
│   ├── descrição (body-sm, text-secondary)
│   └── ação do header (botão ghost/icon)
├── Card.Body     → padding: --space-6 (sides), --space-4 (top se sem header)
└── Card.Footer   → padding: --space-4 --space-6, border-top, opcional
    └── ações (botões alinhados à direita)
```

**Regras:**
```
- Nunca aninhar cards dentro de cards
- Máximo 1 ação primária por card
- Em grid: todas as cards do grupo com mesma altura (usar CSS grid)
- Gap entre cards: --space-4 (compacto) ou --space-6 (respiro)
- Conteúdo mínimo: pelo menos título OU conteúdo no body
```

---

### 2.7 Modal / Dialog

```
Estrutura:
- Overlay: fundo rgba(0,0,0,0.5), backdrop-blur: 4px
- Container: surface-secondary, shadow-xl, radius-lg
- Larguras: sm(400px), md(560px), lg(720px), full(calc(100vw - 64px))
- Padding interno: --space-6

Anatomia:
├── Header    → título (heading-3), botão fechar (X) no canto superior direito
├── Body      → conteúdo, scroll se necessário (max-height: 70vh)
└── Footer    → botões de ação alinhados à direita, gap --space-3

Regras:
- SEMPRE ter botão de fechar (X) E opção de fechar com Escape
- SEMPRE prender foco dentro do modal (focus trap)
- SEMPRE retornar foco ao elemento que abriu o modal ao fechar
- Overlay clicável para fechar (exceto modais destrutivos)
- Máximo 2 botões no footer (Cancel + Action)
- Animação: entrada com opacity 0→1 e scale 0.95→1, --duration-slow
- Nunca empilhar modais (modal sobre modal)
- Em mobile: modal vira bottom-sheet (alinhado ao fundo, radius-lg no topo)
```

---

### 2.8 Toast / Notification

```
Posição: top-right (desktop), top-center (mobile)
Largura: 360px (desktop), calc(100vw - 32px) (mobile)
Estrutura:
├── Ícone de status (success/error/warning/info) — 20px
├── Texto (body-sm, max 2 linhas)
└── Botão fechar (ghost, ícone X)

Variantes: success, error, warning, info (mesmas cores de --status-*)
Aparência: surface-secondary, shadow-xl, radius-md, borda-esquerda 4px na cor do status
Duração: 5s padrão, 8s para erro (erros requerem mais tempo para ler)
Animação: entra deslizando da direita, sai deslizando para direita
Empilhamento: máximo 3 visíveis, gap --space-2
Acessibilidade: role="status" para info/success, role="alert" para error/warning
```

---

### 2.9 Badge / Tag

```
Tamanhos:
  sm: height 20px, padding 0 --space-1.5, font --caption
  md: height 24px, padding 0 --space-2, font --caption

Variantes visuais:
  solid:   fundo na cor, texto branco
  subtle:  fundo na cor-50, texto na cor-700
  outline: borda 1px na cor, fundo transparente

Cores: brand, gray, red, green, amber (mapear de --status-*)
Border-radius: --radius-full (pill) ou --radius-sm (retangular)
Ícone: opcional, 12px, à esquerda
Removível: botão X de 12px à direita (somente em tags)

Regras:
- Badge = informação estática (status, contagem)
- Tag = interativa (filtragem, remoção)
- Máximo 3 badges por linha antes de truncar com "+N"
```

---

### 2.10 Table

```
Estrutura:
<table>
  <thead>  → fundo --surface-tertiary, texto --text-secondary, font --font-semibold, --text-sm
  <tbody>
    <tr>   → border-bottom 1px --border-default, hover: --surface-tertiary
    <td>   → padding --space-3 --space-4, font --text-sm, alinhamento por tipo de dado

Alinhamento:
  Texto:    à esquerda
  Números:  à direita
  Status:   centro
  Ações:    à direita (coluna fixa)

Regras:
- Header fixo em scroll (position: sticky, top: 0)
- Linha selecionada: fundo --brand-50, borda-esquerda 2px --brand-500
- Responsivo: scroll horizontal com sombra de fade nas bordas
- Ações por linha: máximo 2 ícones visíveis + menu "..." para mais
- Linhas clicáveis: cursor pointer, estado hover
- Paginação: componente separado abaixo da tabela
- Empty state: ilustração + texto centralizado
- Loading: skeleton rows (3-5 linhas com shimmer)
- Colunas ordenáveis: ícone de seta no header, 3 estados (none/asc/desc)
```

---

### 2.11 Tabs

```
Variantes:
  underline: borda-inferior 2px na tab ativa (USAR ESTA COMO PADRÃO)
  pills:     fundo na tab ativa, radius-md (para filtros/sub-navegação)
  enclosed:  bordas ao redor da tab ativa (para painéis de conteúdo)

Anatomia:
  Tab item: padding --space-2 --space-4, font --text-sm --font-medium
  Tab ativa: cor --interactive-primary (underline) ou fundo (pills)
  Tab inativa: cor --text-secondary, hover --text-primary
  Barra: border-bottom 1px --border-default (para underline)
  Painel: margin-top --space-4

Regras:
- SEMPRE usar role="tablist", role="tab", role="tabpanel"
- Navegação com seta esquerda/direita no teclado
- Máximo 6 tabs visíveis — depois usar scroll horizontal com setas
- Tab ativa: aria-selected="true"
- Em mobile: tabs com scroll horizontal (nunca empilhar verticalmente)
- Nunca usar tabs para wizard/stepper — use Stepper dedicado
```

---

### 2.12 Avatar

```
Tamanhos: xs(24px), sm(32px), md(40px), lg(56px), xl(80px)
Forma: radius-full (circular)
Fallback em cascata: imagem → iniciais (2 letras) → ícone genérico
Iniciais: fundo gerado por hash do nome (consistente), texto branco
Badge de status: bolinha 8-12px no canto inferior direito
  online = green, offline = gray, busy = red, away = amber
Borda: 2px solid --surface-primary (para grupo de avatares sobrepostos)
Grupo: sobreposição de -8px por avatar, máximo 5 + contador "+N"
```

---

### 2.13 Tooltip

```
Posição: top (padrão), bottom, left, right — com auto-flip se overflow
Aparência: surface-inverse, text-inverse, radius-sm, shadow-md
Font: --text-xs
Padding: --space-1 --space-2
Max-width: 200px
Seta: triângulo CSS 4px, mesma cor do fundo
Delay: 200ms para aparecer, 0ms para desaparecer
Não usar para: conteúdo interativo (usar Popover), texto longo (usar Popover)
Acessibilidade: aria-describedby, aparece em focus (não apenas hover)
```

---

### 2.14 Popover

```
Aparência: surface-secondary, shadow-lg, radius-lg, border 1px --border-default
Padding: --space-4
Max-width: 320px
Trigger: clique (NUNCA hover — popover tem conteúdo interativo)
Fechamento: clique fora, Escape, botão X (se tiver form)
Focus trap: sim, se contiver inputs
Seta: 8px, mesma cor do fundo/borda
Animação: opacity + scale como modal, mas mais rápida (--duration-normal)
```

---

### 2.15 Alert / Banner

```
Variantes: info, success, warning, error (cores de --status-*)
Estrutura:
├── Ícone (20px) — à esquerda
├── Conteúdo
│   ├── Título (font-medium, opcional)
│   └── Descrição (body-sm)
└── Ação (botão link/ghost) ou Fechar (X) — à direita

Estilo: padding --space-4, radius-md, fundo na cor-50, borda-esquerda 4px na cor
Regras:
- Inline alerts: dentro do fluxo do conteúdo
- Banner (page-level): full-width no topo, sem radius
- Dismissible: só info e success (erros e warnings persistem até resolução)
```

---

### 2.16 Skeleton / Loading

```
Forma: replica o layout do conteúdo real (mesmo tamanho, posição)
Cor: --surface-tertiary com animação shimmer para direita
Shimmer: gradiente linear de surface-tertiary → surface-secondary → surface-tertiary
Duração do shimmer: 1.5s, ease-in-out, infinite
Radius: mesmo do elemento que está carregando

Regras:
- Texto: barras retangulares (altura da linha de texto, ~60-80% da largura)
- Avatar: círculo
- Imagem: retângulo na proporção esperada
- Botão: retângulo do tamanho do botão
- Nunca mostrar skeleton + spinner ao mesmo tempo
- Mostrar skeleton para carregamentos > 300ms (evitar flash)
```

---

### 2.17 Empty State

```
Estrutura (centralizada no container):
├── Ilustração ou ícone (64px, --text-tertiary)
├── Título (heading-4, --text-primary, margin-top --space-4)
├── Descrição (body-sm, --text-secondary, max 2 linhas, margin-top --space-2)
└── Ação (botão primary ou secondary, margin-top --space-6)

Regras:
- Sempre sugerir uma ação ("Criar primeiro item", "Ajustar filtros")
- Tom positivo e útil, nunca "Nada encontrado" seco
- Usar em: tabelas vazias, listas vazias, busca sem resultados, primeiro uso
```

---

### 2.18 Breadcrumb

```
Separador: "/" ou chevron-right (16px), cor --text-tertiary
Item: link (--text-link), font --text-sm
Item ativo (último): --text-primary, sem link, aria-current="page"
Overflow: truncar itens do meio com "..." se > 4 níveis
Não usar em: apps single-page simples, mobile (usar back button)
```

---

### 2.19 Pagination

```
Estilo: grupo de botões ghost com números
Página ativa: fundo --interactive-primary, texto branco
Hover: --interactive-ghost-hover
Truncamento: "..." quando > 7 páginas (mostrar: 1 ... 4 5 6 ... 20)
Prev/Next: sempre visíveis (disabled quando na primeira/última)
Posição: centralizada abaixo da tabela/lista, margin-top --space-6
Info: "Mostrando 1-10 de 234" à esquerda (optional)
```

---

### 2.20 Sidebar Navigation

```
Largura: 240px (expandido), 64px (colapsado)
Fundo: --surface-secondary ou --surface-tertiary
Estrutura:
├── Logo/Marca (topo, padding --space-4)
├── Nav items
│   ├── Ícone (20px) + Label (--text-sm, --font-medium)
│   ├── Padding: --space-2 --space-3
│   ├── Radius: --radius-md
│   ├── Ativo: fundo --brand-50, texto --brand-700, ícone --brand-600
│   ├── Hover: fundo --interactive-ghost-hover
│   └── Grupo: label de seção (--caption, --text-tertiary, uppercase, margin-top --space-6)
├── Divisor (border-top --border-default, margin --space-2 0)
└── Footer (perfil/settings, border-top, padding --space-4)

Regras:
- Máximo 2 níveis de aninhamento
- Colapsar em mobile para hamburger menu
- Transição suave na largura (--duration-slow)
- Badge/counter: badge sm à direita do label
```

---

## 3. PADRÕES DE LAYOUT

### 3.1 Grid System

```css
/* Container */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-4); /* mobile */
}

@media (min-width: 768px) {
  .container { padding: 0 var(--space-8); }
}

/* Grid: usar CSS Grid, NÃO flexbox para layouts 2D */
.grid {
  display: grid;
  gap: var(--space-6);
}

/* Colunas responsivas */
.grid-cols-1 { grid-template-columns: 1fr; }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

/* Auto-fit para grids responsivos sem media queries */
.grid-auto {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
```

### 3.2 Breakpoints

```css
/* Mobile first. SEMPRE começar pelo menor. */
--bp-sm:  640px;    /* mobile landscape     */
--bp-md:  768px;    /* tablet portrait      */
--bp-lg:  1024px;   /* tablet landscape     */
--bp-xl:  1280px;   /* desktop              */
--bp-2xl: 1536px;   /* wide desktop         */
```

### 3.3 Layouts de Página Padrão

```
Layout: Dashboard
┌──────────────────────────────────────────┐
│ Sidebar │ Header (topbar)                │
│  240px  │────────────────────────────────│
│         │ Main Content                   │
│         │ ┌─container max-1280px──────┐  │
│         │ │ Page Title + Actions      │  │
│         │ │ Grid de Cards / Tabela    │  │
│         │ └───────────────────────────┘  │
└──────────────────────────────────────────┘

Layout: Settings / Form
┌──────────────────────────────────────────┐
│ Sidebar │ Header                         │
│         │────────────────────────────────│
│         │ ┌──max-640px (centrado)─────┐  │
│         │ │ Heading                   │  │
│         │ │ Form fields (vertical)    │  │
│         │ │ Actions (sticky bottom)   │  │
│         │ └───────────────────────────┘  │
└──────────────────────────────────────────┘

Layout: List + Detail (Master-Detail)
┌──────────────────────────────────────────┐
│ Sidebar │ Lista    │ Detalhe            │
│  240px  │  320px   │  restante          │
│         │ scroll   │  scroll            │
└──────────────────────────────────────────┘
```

---

## 4. PADRÕES DE INTERAÇÃO

### 4.1 Formulários

```
Regras obrigatórias:
1. Label acima do input (nunca ao lado em mobile)
2. Campos obrigatórios: asterisco vermelho no label OU texto "(obrigatório)"
3. Validação:
   - Inline (ao sair do campo) para formato
   - No submit para lógica de negócio
   - Mostrar TODOS os erros de uma vez, não um por um
4. Mensagem de erro: abaixo do campo, --status-error-text, com ícone ⚠
5. Ação primária: à direita (ou full-width em mobile)
6. Cancelar: botão ghost à esquerda do primário
7. Seções de formulário: usar heading-4 + divisor entre seções
8. Campos longos (textarea): min-height 120px, resize vertical
9. Agrupamento: máximo 6 campos por seção visual
```

### 4.2 Confirmação de Ações Destrutivas

```
Sempre pedir confirmação para:
- Deletar dados
- Ações irreversíveis
- Ações que afetam outros usuários

Formato: Modal com:
- Título claro: "Excluir [item]?"
- Descrição do impacto: "Esta ação não pode ser desfeita."
- Botão cancel (secondary) + botão danger com label explícito ("Excluir", não "OK")
- Para ações críticas: digitar o nome do recurso para confirmar
```

### 4.3 Feedback de Ações

```
Toda ação do usuário DEVE ter feedback:
- Clique em botão → loading state imediato (< 100ms)
- Sucesso → toast de sucesso (se ação assíncrona) ou atualização inline
- Erro → toast de erro OU erro inline no formulário
- Saving → indicador "Salvando..." / "Salvo ✓" inline
- Debounce em buscas: 300ms antes de disparar
```

### 4.4 Estados de Carregamento

```
Hierarquia de preferência:
1. Skeleton (para conteúdo estruturado — tabelas, cards, listas)
2. Spinner + texto (para ações pontuais — "Carregando...")
3. Progress bar (para processos com progresso mensurável — upload, import)
4. Inline spinner (para botões e campos — dentro do próprio elemento)

Spinner padrão:
- Ícone: circle com stroke-dasharray animado (rotação)
- Tamanhos: 16px (inline), 24px (botão), 40px (página)
- Cor: --interactive-primary (ou --text-inverse em botões primários)
```

---

## 5. ACESSIBILIDADE — CHECKLIST OBRIGATÓRIO

```
TODO componente DEVE cumprir:

[ ] Navegável por teclado (Tab, Enter, Escape, Arrows quando aplicável)
[ ] Focus visível (ring 2px var(--border-focus), offset 2px)
[ ] Contraste mínimo: 4.5:1 para texto, 3:1 para componentes grandes
[ ] Roles ARIA corretos (button, dialog, tablist, alert, etc.)
[ ] Labels para todos os inputs (label htmlFor ou aria-label)
[ ] Alt text para todas as imagens (ou aria-hidden se decorativa)
[ ] Não depender apenas de cor para transmitir informação
[ ] Área de toque mínima: 44px × 44px
[ ] Reduzir animações com prefers-reduced-motion
[ ] Textos legíveis em zoom 200%
```

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. ÍCONES

```
Biblioteca: Lucide Icons (https://lucide.dev)
Tamanhos padrão: 16px, 18px, 20px, 24px
Stroke-width: 2px (padrão), 1.5px (tamanhos maiores)
Cor: currentColor (herda do texto)

NUNCA usar:
- Emojis como ícones de UI
- Ícones de bibliotecas diferentes na mesma interface
- Ícones sem label ou tooltip (exceto ícones universais: X, search, menu)
```

---

## 7. REGRAS DE IMPLEMENTAÇÃO PARA CLAUDE CODE

### 7.1 Ao criar qualquer componente:

```
1. CONSULTAR este documento primeiro
2. Verificar se o componente já existe no catálogo acima
3. Se existir: seguir a especificação EXATAMENTE
4. Se NÃO existir: compor com componentes existentes
5. Se impossível compor: PARAR e informar ao usuário
6. Aplicar TODOS os estados (default, hover, focus, active, disabled, loading, error, empty)
7. Garantir responsividade (mobile-first)
8. Rodar checklist de acessibilidade
```

### 7.2 Ao criar qualquer página:

```
1. Identificar qual Layout de Página se aplica (seção 3.3)
2. Montar com componentes do catálogo
3. Espaçamento SOMENTE com tokens (seção 1.3)
4. Cores SOMENTE semânticas (seção 1.1)
5. Tipografia SOMENTE da escala (seção 1.2)
6. Testar em: 375px, 768px, 1280px
```

### 7.3 Ao usar Tailwind CSS:

```
Se o projeto usa Tailwind, mapear os tokens assim:

/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)',
        },
        // ... mapear todos os tokens semânticos
      },
      spacing: {
        // Usar escala padrão do Tailwind (já é baseada em 4px)
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      }
    }
  }
}

REGRA: Mesmo com Tailwind, nunca usar classes de cor arbitrárias
(bg-[#1a1a1a]). Sempre via tokens ou tema configurado.
```

### 7.4 Ao usar shadcn/ui:

```
Se o projeto usa shadcn/ui como base:
1. Adaptar os CSS variables do shadcn para os tokens deste documento
2. Usar os componentes do shadcn que correspondem ao catálogo acima
3. Customizar via CSS variables — NUNCA modificar o JSX interno dos componentes
4. Se o shadcn tiver um componente que NÃO está neste catálogo, não usar
5. Se este catálogo exigir algo que o shadcn não tem, construir com primitivos

Mapeamento shadcn → Design System:
  shadcn Button     → 2.1 Button (ajustar variantes para as permitidas aqui)
  shadcn Input      → 2.2 Input
  shadcn Select     → 2.3 Select
  shadcn Dialog     → 2.7 Modal
  shadcn Table      → 2.10 Table
  shadcn Tabs       → 2.11 Tabs
  shadcn Badge      → 2.9 Badge
  shadcn Tooltip    → 2.13 Tooltip
  shadcn Popover    → 2.14 Popover
  shadcn Alert      → 2.15 Alert
  shadcn Skeleton   → 2.16 Skeleton
  shadcn Breadcrumb → 2.18 Breadcrumb
```

---

## 8. ANTI-PADRÕES — NUNCA FAZER

```
❌ Criar componentes custom que replicam o que já existe aqui
❌ Usar cores hex/rgb diretas no código (sempre tokens)
❌ Usar px para font-size (sempre rem via tokens)
❌ Misturar idiomas na UI (ou tudo pt-BR ou tudo en-US, consistente)
❌ Botão sem estado de loading em ações assíncronas
❌ Input sem label
❌ Modal sem focus trap e Escape para fechar
❌ Tabela sem empty state
❌ Ação destrutiva sem confirmação
❌ Feedback invisível (ação sem toast/indicador)
❌ Scroll horizontal em mobile (exceto tabelas)
❌ Texto sobre imagem sem overlay garantindo contraste
❌ Z-index aleatórios (usar escala: 10 dropdown, 20 sticky, 30 modal, 40 toast, 50 tooltip)
❌ !important (exceto prefers-reduced-motion)
❌ Layout com position absolute/fixed quando flex/grid resolve
❌ Animações sem prefers-reduced-motion fallback
❌ bg-*-50 / bg-*-100 em ícones de card — quebram no dark mode (fundo claro em tela escura)
```

### Ícones coloridos em cards — padrão obrigatório

Para containers de ícone dentro de cards (ex: StatsCard, cards de módulo), **NUNCA** use
`bg-blue-50 text-blue-600` diretamente. Use as classes utilitárias de `globals.css`:

```tsx
// ✅ CORRETO — adapta automaticamente a light e dark
<div className="icon-blue">   <Icon /></div>
<div className="icon-amber">  <Icon /></div>
<div className="icon-green">  <Icon /></div>
<div className="icon-orange"> <Icon /></div>
<div className="icon-red">    <Icon /></div>
<div className="icon-purple"> <Icon /></div>
<div className="icon-brand">  <Icon /></div>
<div className="icon-gray">   <Icon /></div>

// ❌ ERRADO — bg-*-50 é tint claro, fica estranho no dark mode
<div className="bg-blue-50 text-blue-600"><Icon /></div>
```

Essas classes estão definidas em `src/app/globals.css` → `@layer utilities` → seção `ICON CONTAINERS`.

### Status / Type Badges — padrão obrigatório

Para pills de status e tipo (ex: EventStatusBadge, MaintenanceTypeBadge), **NUNCA** use
`bg-blue-50 text-blue-700 border-blue-200` diretamente. Use as classes `.badge-{cor}`:

```tsx
// ✅ CORRETO — adapta a light e dark automaticamente
className: 'badge-blue border'     // Aberta, Confirmado
className: 'badge-green border'    // Concluído, Recorrente
className: 'badge-amber border'    // Pendente, Aguardando
className: 'badge-orange border'   // Alta prioridade
className: 'badge-red border'      // Emergencial, Crítico
className: 'badge-purple border'   // Em Preparo, Em Andamento
className: 'badge-gray border'     // Cancelado, Finalizado

// ❌ ERRADO — bg-*-50 é tint claro, fica branco/claro no dark mode
className: 'bg-blue-50 text-blue-700 border border-blue-200'
```

Componentes que usam este padrão: `event-status-badge.tsx`, `maintenance-type-badge.tsx`,
`maintenance-status-badge.tsx`. Ao criar novos badges, usar sempre `.badge-{cor}`.

---

## 9. Z-INDEX SCALE

```css
:root {
  --z-base:     0;
  --z-dropdown: 10;
  --z-sticky:   20;
  --z-overlay:  30;
  --z-modal:    40;
  --z-toast:    50;
  --z-tooltip:  60;
}
```

---

## 10. COMO USAR ESTE DOCUMENTO

```
Este arquivo deve estar na raiz do projeto como CLAUDE.md ou referenciado
em .cursorrules / .claude/settings ou equivalente.

Quando Claude Code receber qualquer instrução de UI:
1. Ler este documento PRIMEIRO
2. Identificar componentes necessários no catálogo
3. Implementar seguindo tokens + especificações
4. Validar contra os anti-padrões (seção 8)
5. Validar acessibilidade (seção 5)

Se o usuário pedir algo que conflita com este documento,
informar o conflito e sugerir a alternativa correta do design system.
```
