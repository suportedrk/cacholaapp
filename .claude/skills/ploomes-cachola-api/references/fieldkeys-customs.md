# FieldKeys & Campos Customizados — Ploomes

No Ploomes, **todo campo** (padrão ou customizado) tem uma `FieldKey` — uma string única que identifica o campo na API. Campos customizados aparecem em arrays `OtherProperties`. Esta referência ensina a descobrir e usar.

## Como `FieldKey` é estruturado

Padrão: `<entidade>_<sufixo>`

- Padrões: `deal_title`, `deal_amount`, `contact_name`, `contact_email`, `order_number`, `order_amount`.
- Customizados: `deal_<UUID>` (ex: `deal_13506031-C53E-48A0-A92B-686F76AC77ED`).

O sufixo UUID é gerado pelo Ploomes quando o admin cria um campo custom no painel. Esse UUID é estável — não muda. Salve no seu banco.

## Como descobrir as FieldKeys de uma conta

Use o endpoint `Fields` filtrando por `EntityId`:

```http
GET https://api2.ploomes.com/Fields?$filter=EntityId eq 2&$expand=OptionsTable($expand=Options)
User-Key: <chave>
```

**EntityId mapping (mesmo dos webhooks):**
| ID | Entidade |
|----|----------|
| 1  | Contact |
| 2  | Deal |
| 4  | Order |
| 7  | Product |
| 8  | Quote |
| 12 | Task |

Resposta traz cada campo com: `Id`, `Key` (a FieldKey), `Name` (label visível), `TypeId` (tipo de dado), `EntityId`.

### Tipos (`TypeId`) mais comuns

| TypeId | Tipo |
|--------|------|
| 1 | Texto curto (StringValue) |
| 2 | Texto longo (StringValue) |
| 3 | Inteiro (IntegerValue) |
| 4 | Decimal (DecimalValue) |
| 5 | Data/hora (DateTimeValue) |
| 6 | Booleano (BoolValue) |
| 7 | Opção de lista (ObjectValueName + IntegerValue do Id da opção) |

Saber o TypeId é o que diz **qual campo de valor** preencher quando vai gravar.

## Estrutura de `OtherProperties` na resposta

Quando você faz `GET /Deals(123)?$expand=OtherProperties`, vem assim:

```json
{
  "Id": 123,
  "Title": "Festa João 5 anos",
  "OtherProperties": [
    {
      "FieldId": 192019,
      "FieldKey": "deal_13506031-C53E-48A0-A92B-686F76AC77ED",
      "DateTimeValue": "2026-08-12T00:00:00-03:00",
      "StringValue": null,
      "IntegerValue": null,
      "DecimalValue": null,
      "BoolValue": null,
      "ObjectValueName": null
    },
    {
      "FieldId": 192033,
      "FieldKey": "deal_82F5...",
      "StringValue": "Buffet Pinheiros",
      "DateTimeValue": null
    }
  ]
}
```

### Lendo OtherProperties (helper canônico)

```typescript
function readField(
  others: PloomesOtherProperty[],
  fieldKey: string,
  type: 'string' | 'date' | 'int' | 'decimal' | 'bool' | 'option'
) {
  const prop = others.find(o => o.FieldKey === fieldKey)
  if (!prop) return null

  switch (type) {
    case 'string':  return prop.StringValue
    case 'date':    return prop.DateTimeValue ? new Date(prop.DateTimeValue) : null
    case 'int':     return prop.IntegerValue
    case 'decimal': return prop.DecimalValue
    case 'bool':    return prop.BoolValue
    case 'option':  return prop.ObjectValueName  // texto da opção
  }
}

// Uso:
const aniversario = readField(
  deal.OtherProperties,
  'deal_13506031-C53E-48A0-A92B-686F76AC77ED',
  'date'
)
```

### Gravando OtherProperties (POST/PATCH)

```http
PATCH https://api2.ploomes.com/Deals(123)
User-Key: <chave>
Content-Type: application/json

{
  "Title": "Festa João 5 anos — atualizado",
  "OtherProperties": [
    {
      "FieldKey": "deal_13506031-C53E-48A0-A92B-686F76AC77ED",
      "DateTimeValue": "2026-08-15T00:00:00-03:00"
    }
  ]
}
```

Para **um TypeId específico**, preencha apenas o campo de valor correspondente; deixe os outros como `null` ou ausentes.

## Campos customizados de UNIDADE — nível Deal (para BI e `ploomes_deals.unit_option_name`)

> **Nota:** Esta seção trata exclusivamente da coluna `ploomes_deals.unit_option_name`, usada para BI e KPIs. Para a hierarquia operacional que define `events.unit_id` (unidade da festa no CacholaOS), ver seção **"Hierarquia canônica de UNIDADE para events.unit_id"** logo abaixo.

Existem **DOIS** campos customizados parecidos no Ploomes para representar unidade. Eles têm semânticas **diferentes** e usar o errado é um bug histórico (descoberto em mai/2026 durante investigação de KPIs incorretos).

| FieldKey | Nome no Ploomes | Quando é preenchido | Uso correto |
|---|---|---|---|
| `deal_BD9C4B07-20E5-458A-8273-6BA271A6DEBD` | "Unidade da festa pretendida" | **Obrigatório** ao criar lead (ponta do funil) | ✅ Use este para qualquer KPI/métrica de unidade |
| `deal_A583075F-D19C-4034-A479-36625C621660` | "Unidade Escolhida da Festa" | Apenas em estágios avançados (após contrato) | ⚠️ Use apenas se especificamente quiser saber a unidade já fechada |

Valores possíveis no campo "Pretendida" (string **exata** armazenada pelo Ploomes):

- `Cachola PINHEIROS`
- `Cachola MOEMA`
- `Cliente ainda não sabe` (com acento em "não", exatamente assim — sem "ainda" vai 0 matches)

### Implementação no código

A constante `FIELD_KEY_UNIT` em `src/lib/ploomes/sync-deals.ts` **deve** ser o FieldKey da "Pretendida". Validar antes de qualquer alteração.

### Histórico

Até v1.6.5 o sync lia o FieldKey "Escolhida" em vez de "Pretendida", causando ~78% de NULLs em `unit_option_name`. Corrigido em PR #12 (v1.6.6, mai/2026). Aprendizado: quando há dois campos parecidos no Ploomes, sempre conferir documentação com Bruno antes de assumir qual usar.

---

## Hierarquia canônica de UNIDADE para `events.unit_id` (operacional)

> **Nota:** Esta seção trata de `events.unit_id` — a unidade da festa no CacholaOS. É diferente de `ploomes_deals.unit_option_name` (BI), que tem regra própria na seção acima. As duas regras coexistem e não se substituem.

A unidade de uma festa (`events.unit_id`) é definida por três fontes em cascata. A prioridade é rígida e ordenada:

| Nível | Fonte no Ploomes | FieldKey | Coluna no banco | Quando se aplica |
|-------|-----------------|----------|-----------------|-----------------|
| **1 — DEFINITIVO** | OtherProperty do **Order** | `order_EDD14E93-ECEB-4EEE-A362-80416A78E61D` | `ploomes_orders.chosen_unit_id` | Sempre que existir um Order para o Deal |
| **2 — Fallback** | OtherProperty do **Deal** | `deal_A583075F-D19C-4034-A479-36625C621660` | lido via `parseDeal().unitName` | Quando não há Order, ou Order sem unidade preenchida |
| **3 — Último recurso** | OtherProperty do **Deal** | `deal_BD9C4B07-20E5-458A-8273-6BA271A6DEBD` | lido via `resolveUnitId()` fallback | Quando nenhum dos dois acima está disponível |

### Regra absoluta

**O Order vence o Deal sem exceção.** Se o campo `order_EDD14E93` do Order diz "Cachola MOEMA" e ambos os campos do Deal dizem "Cachola PINHEIROS", o evento ficará em Moema. Isso é comportamento correto, não bug.

### Como corrigir a unidade de uma festa

**Nunca** edite `events.unit_id` diretamente no banco do CacholaOS. O procedimento correto:

1. Abrir o Order no Ploomes (`https://app10.ploomes.com/order/{id}`)
2. Corrigir o campo "Unidade Escolhida" (`order_EDD14E93`) para o valor correto
3. O próximo webhook de Update propagará a correção automaticamente em segundos

### Ponte FieldKey → banco → código

```
order_EDD14E93-ECEB-4EEE-A362-80416A78E61D  (Ploomes — OtherProperty do Order)
  → ploomes_orders.chosen_unit_id            (Supabase — populado por sync-orders.ts linhas 77-88)
    → src/lib/ploomes/sync.ts linhas 270-280  (lido no sync de eventos, define events.unit_id)
        const unitId = orderUnit?.chosen_unit_id ?? dealUnitId
```

### Implementação no código

`src/lib/ploomes/sync.ts` linhas 270–280 implementa essa hierarquia:

```typescript
// Preferir unidade do Order (fonte definitiva) quando disponível
const { data: orderUnit } = await supabase
  .from('ploomes_orders')
  .select('chosen_unit_id')
  .eq('deal_id', deal.Id!)
  .not('chosen_unit_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const unitId = orderUnit?.chosen_unit_id ?? dealUnitId  // Order > Deal
```

`src/lib/ploomes/sync-orders.ts` linhas 77–88 popula `chosen_unit_id`:

```typescript
const ORDER_FIELD_KEY_CHOSEN_UNIT = 'order_EDD14E93-ECEB-4EEE-A362-80416A78E61D'

function extractChosenUnitName(order: PloomesOrder): string | undefined {
  return order.OtherProperties?.find(
    (p) => p.FieldKey === ORDER_FIELD_KEY_CHOSEN_UNIT,
  )?.ObjectValueName ?? undefined
}
```

### Caso prático documentado

**Festa ISABELA 1 ANO — deal 605036102 — mai/2026:**
- `deal_A583075F` (Escolhida do Deal) = "Cachola PINHEIROS"
- `deal_BD9C4B07` (Pretendida do Deal) = "Cachola PINHEIROS"
- `order_EDD14E93` (Escolhida do Order 601718795) = "Cachola MOEMA"
- Resultado: `events.unit_id = Moema` ← Order venceu, comportamento correto
- Diagnóstico: o campo do Order foi preenchido como Moema no Ploomes. Correção = editar o Order no Ploomes, não o banco.

---

## FieldKeys conhecidas no Cachola

> Mantenha esta tabela atualizada. Toda nova FieldKey custom descoberta entra aqui.

### Deal (EntityId = 2)

| FieldKey | Nome (label) | Tipo | Cobertura | Origem |
|----------|--------------|------|-----------|--------|
| `deal_title` | Título | string | 100% | padrão |
| `deal_amount` | Valor | decimal | ~95% | padrão |
| `deal_status` | Status (1/2/3) | int | 100% | padrão |
| `deal_BD9C4B07-20E5-458A-8273-6BA271A6DEBD` | Unidade da festa **pretendida** | ObjectValueName | ~100% | custom — **nível 1** para `ploomes_deals.unit_option_name` (BI); **nível 3** (último recurso) para `events.unit_id` |
| `deal_A583075F-D19C-4034-A479-36625C621660` | Unidade **escolhida** da festa | ObjectValueName | ~22% (só pós-contrato) | custom — **nível 2** para `events.unit_id`; fallback quando não há Order com unidade preenchida |
| `deal_13506031-C53E-48A0-A92B-686F76AC77ED` | Aniversariante (data) | DateTimeValue | ~70% | custom — usado em Recompra Fase D |

> 🔄 Quando achar nova FieldKey custom, descobrir o nome via `GET /Fields?$filter=Key eq 'deal_<UUID>'` e adicionar aqui.

### Contact (EntityId = 1)

| FieldKey | Nome | Tipo | Notas |
|----------|------|------|-------|
| `contact_name` | Nome | string | padrão |
| `contact_email` | Email | string | padrão |
| `contact_cpf` | CPF | string | padrão |
| `contact_cnpj` | CNPJ | string | padrão |
| `contact_birthday` | Aniversário do contato | date | padrão (não confundir com aniversariante do deal) |

### Order (EntityId = 4)

| FieldKey | Nome | Tipo | Notas |
|----------|------|------|-------|
| `order_number` | Número | int | padrão |
| `order_amount` | Valor total | decimal | padrão |
| `order_date` | Data | date | padrão |
| `order_description` | Descrição | string | padrão |
| `order_EDD14E93-ECEB-4EEE-A362-80416A78E61D` | Unidade Escolhida (Order) | ObjectValueName | **Nível 1** hierarquia `events.unit_id` — vence o Deal sem exceção. Persistido em `ploomes_orders.chosen_unit_id` via `sync-orders.ts` |

## Armadilha clássica: filtrar por OtherProperties

❌ **Não funciona:**
```
GET /Deals?$filter=OtherProperties/any(p: p/FieldKey eq 'deal_xxx')
```
Retorna **403 Forbidden** no Ploomes (já confirmado no projeto — issue do Upsell, comentário na memória).

✅ **Solução real:** trazer OtherProperties no `$expand` e filtrar no código TypeScript depois:
```typescript
const dealsComAniversario = allDeals.filter(d =>
  readField(d.OtherProperties, 'deal_13506031-...', 'date') !== null
)
```

Custo: você baixa mais dados que precisaria. Em troca, funciona.

## Boas práticas

1. **Salve as FieldKeys customizadas no banco** (`ploomes_field_mapping` ou similar) ao invés de hardcodar no código. Se o Ploomes recriar o campo, é só atualizar a linha.

2. **Sempre `$expand=OtherProperties`** em syncs de Deal/Contact/Order — sem isso, custom não vem.

3. **Logar `FieldId` desconhecidos** durante sync — facilita descobrir campos novos criados no Ploomes que ainda não foram mapeados.

4. **Não confiar em `Name` para identificar campo** — admins podem renomear no painel. `FieldKey` é o ID estável.
