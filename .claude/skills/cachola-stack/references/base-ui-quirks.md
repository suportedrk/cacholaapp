# @base-ui/react — Peculiaridades no Cachola

O Cachola usa `@base-ui/react` como biblioteca de primitivos UI (Select, Dialog, Tabs, Popover, etc.). **Não é Radix, não é shadcn.** A API é parecida (porque é "filhinha" do Radix), mas tem diferenças que quebram código copiado da internet.

## TL;DR — diferenças críticas vs Radix/shadcn

| Coisa | Radix/shadcn | @base-ui/react |
|---|---|---|
| `asChild` para herdar tag filha | ✅ suporta | ❌ **não suporta** |
| `<Select.Value>` mostra valor selecionado | ✅ direto | ⚠️ mostra raw value até o popup abrir — precisa pattern `<span data-slot>` |
| Empty state em Select com lista dinâmica | ✅ aceita item disabled | ⚠️ buga, precisa placeholder no trigger |
| Importação | `@radix-ui/react-select` | `@base-ui/react/select` |
| `Slot` exportado | ✅ | ❌ não existe |

## 1. ❌ `asChild` não existe

Em Radix/shadcn é comum:
```tsx
<Button asChild>
  <Link href="/dashboard">Ir</Link>
</Button>
```

**No Cachola, isso quebra.** O `@base-ui/react` (e o nosso `Button` baseado nele) não suporta `asChild`. Use `buttonVariants` ou `cn()` aplicado direto na tag:

```tsx
// ✅ Certo
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

<Link href="/dashboard" className={cn(buttonVariants({ variant: 'default' }))}>
  Ir
</Link>
```

Mesma lógica para qualquer caso onde Radix usaria `asChild`: copie as classes da variante e aplique na tag desejada.

## 2. ⚠️ `Select.Value` — pattern `<span data-slot="select-value">`

Por padrão, `Select.Value` do `@base-ui/react` mostra o **valor cru** (id, código) até o popup abrir pela primeira vez. Aí ele troca para o label. UX horrível.

**Solução:** controlar manualmente com helper `findLabel()` e `<span>` interno:

```tsx
import { Select } from '@base-ui/react/select'

const items = [
  { value: '1', label: 'Pinheiros' },
  { value: '2', label: 'Moema' },
]

const findLabel = (val: string | null) =>
  items.find(i => i.value === val)?.label ?? 'Selecione a unidade'

function UnitSelect({ value, onChange }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger>
        <span data-slot="select-value">{findLabel(value)}</span>
        <Select.Icon><ChevronDown /></Select.Icon>
      </Select.Trigger>
      <Select.Popup>
        {items.map(item => (
          <Select.Item key={item.value} value={item.value}>
            {item.label}
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}
```

A `<span data-slot="select-value">` é um marcador convencional do Cachola para CSS direcionar e para devs reconhecerem o pattern. Mantenha consistente.

## 3. ⚠️ Select dinâmico vazio — placeholder no TRIGGER

Quando a lista de opções é dinâmica (vem de query) e pode estar vazia, **NUNCA** faça:

```tsx
// ❌ Errado — buga visualmente e na navegação por teclado
<Select.Popup>
  {items.length === 0 ? (
    <Select.Item value="__empty__" disabled>Nenhuma unidade disponível</Select.Item>
  ) : items.map(...)}
</Select.Popup>
```

**Em vez disso**, mostre o estado vazio no **trigger**, contextualmente:

```tsx
// ✅ Certo
<Select.Trigger disabled={items.length === 0}>
  <span data-slot="select-value">
    {items.length === 0
      ? 'Nenhuma unidade disponível'
      : findLabel(value)}
  </span>
</Select.Trigger>
<Select.Popup>
  {items.map(item => (
    <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>
  ))}
</Select.Popup>
```

## 4. Componentes mais usados — guia rápido

### Dialog (modal)
```tsx
import { Dialog } from '@base-ui/react/dialog'

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Título</Dialog.Title>
      <Dialog.Description>Descrição</Dialog.Description>
      {/* conteúdo */}
      <Dialog.Close>Fechar</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### Tabs
```tsx
import { Tabs } from '@base-ui/react/tabs'

<Tabs.Root defaultValue="minhas">
  <Tabs.List>
    <Tabs.Tab value="minhas">Minhas</Tabs.Tab>
    <Tabs.Tab value="livre">Carteira Livre</Tabs.Tab>
    <Tabs.Tab value="todas">Todas</Tabs.Tab>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel value="minhas">{/* ... */}</Tabs.Panel>
  <Tabs.Panel value="livre">{/* ... */}</Tabs.Panel>
  <Tabs.Panel value="todas">{/* ... */}</Tabs.Panel>
</Tabs.Root>
```

### Popover
```tsx
import { Popover } from '@base-ui/react/popover'

<Popover.Root>
  <Popover.Trigger>Abrir</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner>
      <Popover.Popup>{/* conteúdo */}</Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

## 5. Classes Tailwind — atenção

- ❌ `bg-brand-950`, `text-brand-950`, `border-brand-950` — **NÃO EXISTEM**. A paleta `brand` termina em `900`. Use `brand-900` se quiser o tom mais escuro.
- ✅ `bg-brand-500`, `bg-brand-600` — existem (mas confira `references/design-tokens.md` se a cor é a Cachola correta).

## 6. Estados (focus, hover, disabled)

`@base-ui/react` expõe data-attributes para estilização:

```tsx
<Select.Trigger
  className="
    data-[disabled]:opacity-50
    data-[popup-open]:ring-2
    hover:bg-beige-100
    focus-visible:ring-2 focus-visible:ring-brand-500
  "
>
```

Atributos comuns:
- `data-disabled` — quando `disabled` é true.
- `data-popup-open` — quando o popup do componente está aberto.
- `data-highlighted` — item de menu sob navegação por teclado.
- `data-selected` — item selecionado.

## 7. Quando em dúvida

1. Olhar componentes existentes em `src/components/ui/` — provavelmente já tem o pattern certo.
2. Conferir `node_modules/@base-ui/react/dist/` para a tipagem exata do componente.
3. **Não** copiar exemplo de Radix da internet sem adaptar — a API é diferente em ~30% dos casos.
