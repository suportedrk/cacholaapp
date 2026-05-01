# Recharts no Cachola — Pixel Fixo, NUNCA ResponsiveContainer

Recharts é a biblioteca de gráficos do Cachola (BI, Vendas, Dashboard). **Tem uma regra de ouro absoluta:** sempre use largura/altura em pixel fixo, nunca `ResponsiveContainer`.

## ❌ Por que `ResponsiveContainer` quebra

```tsx
// ❌ NUNCA FAÇA ISSO
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={data}>...</AreaChart>
</ResponsiveContainer>
```

**Sintomas reais que o time já sangrou:**
- Gráfico renderiza com dimensões negativas no primeiro frame.
- Console enche de `Cannot read properties of undefined (reading 'width')`.
- Em tabs ocultos (display:none), `ResponsiveContainer` recebe 0×0 e nunca recalcula quando o tab abre.
- Em layouts com transição, dimensões "flickam" e o gráfico salta.

A causa raiz: `ResponsiveContainer` mede o pai com `ResizeObserver`, mas se o pai ainda não tem dimensões finais (CSS Grid, Flex com `min-width: 0`, animação), recebe valor inválido. Recharts não trata isso bem.

## ✅ Padrão Cachola: pixel fixo + scroll horizontal

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

function VendasMensaisChart({ data }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <AreaChart width={800} height={300} data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-beige-200)" />
        <XAxis dataKey="mes" stroke="var(--color-sage-700)" />
        <YAxis stroke="var(--color-sage-700)" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="receita"
          stroke="var(--color-sage-500)"
          fill="var(--color-sage-100)"
        />
      </AreaChart>
    </div>
  )
}
```

**Por que funciona:**
- `width={800} height={300}` — Recharts recebe valores certos no primeiro render.
- `<div className="w-full overflow-x-auto">` — em tela pequena, o gráfico simplesmente "rola" horizontalmente. Sem cálculo dinâmico, sem layout shift.
- Mobile usuário arrasta para ver tudo. Aceitável e previsível.

## Tamanhos padrão sugeridos

Para consistência visual, use estes pares (largura × altura):

| Uso | Width | Height |
|---|---|---|
| Card pequeno (KPI mini-chart) | 200 | 80 |
| Card médio | 400 | 200 |
| Painel padrão (BI, Vendas) | 800 | 300 |
| Painel largo (BI tela cheia) | 1200 | 400 |

Se precisar de outro tamanho, mantenha proporção ~3:1 ou ~4:1 para legibilidade.

## Cores — usar variáveis CSS dos tokens Cachola

❌ **Não use cores hardcoded ou da paleta default do Recharts** (azuis berrantes, etc.):
```tsx
<Area fill="#8884d8" />              // ❌ default Recharts
<Area fill="#3b82f6" />              // ❌ azul Tailwind
```

✅ **Use variáveis CSS dos tokens Cachola:**
```tsx
<Area fill="var(--color-sage-500)" />
<Area fill="var(--color-beige-200)" />
<Bar fill="var(--color-sage-700)" />
```

Cores principais para gráficos (ver `design-tokens.md` para escala completa):
- **Primária** (linha/área principal): `--color-sage-500` (#7C8D78)
- **Secundária** (comparação): `--color-sage-300`
- **Fundo/grid**: `--color-beige-200`
- **Texto eixos**: `--color-sage-700`
- **Hover/destaque**: `--color-sage-700`

## Componentes Recharts mais usados

### AreaChart (vendas mês a mês, evolução)
```tsx
<AreaChart width={800} height={300} data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="mes" />
  <YAxis />
  <Tooltip />
  <Area type="monotone" dataKey="valor" stroke="var(--color-sage-500)" fill="var(--color-sage-100)" />
</AreaChart>
```

### BarChart (ranking, comparação categórica)
```tsx
<BarChart width={800} height={300} data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="vendedora" />
  <YAxis />
  <Tooltip />
  <Bar dataKey="vendas" fill="var(--color-sage-500)" />
</BarChart>
```

### PieChart (distribuição)
```tsx
<PieChart width={400} height={300}>
  <Pie data={data} dataKey="valor" nameKey="categoria" cx={200} cy={150} outerRadius={100}>
    {data.map((entry, i) => (
      <Cell key={i} fill={`var(--color-sage-${[300, 500, 700, 900][i % 4]})`} />
    ))}
  </Pie>
  <Tooltip />
</PieChart>
```

## Tooltips customizados

O default visual do Recharts é cinza neutro — fica feio com nossa paleta. Use Tooltip customizado:

```tsx
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-beige-200 rounded-md shadow-lg p-3">
      <p className="text-sm font-medium text-sage-900">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-sage-700">
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Uso:
<Tooltip content={<CustomTooltip />} />
```

## Performance

- Mais de **500 pontos de dados** num AreaChart degrada bastante. Agregue antes (semana, mês).
- BarChart com **mais de 30 categorias** vira papinha — use scroll horizontal e width grande (1200+).
- Animações default de Recharts (`isAnimationActive={true}`) somam ~200ms ao TTI. Em dashboards com 4+ charts, considere `isAnimationActive={false}`.

## Checklist antes de fazer commit de chart novo

- [ ] Sem `<ResponsiveContainer>`.
- [ ] `width` e `height` em pixel inteiro.
- [ ] Wrapper `<div className="w-full overflow-x-auto">`.
- [ ] Cores via `var(--color-sage-*)` ou `var(--color-beige-*)`.
- [ ] Tooltip customizado se for tela visível ao cliente.
- [ ] Testado em mobile (scroll horizontal funcionando).
