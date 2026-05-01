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

## FieldKeys conhecidas no Cachola

> Mantenha esta tabela atualizada. Toda nova FieldKey custom descoberta entra aqui.

### Deal (EntityId = 2)

| FieldKey | Nome (label) | Tipo | Cobertura | Origem |
|----------|--------------|------|-----------|--------|
| `deal_title` | Título | string | 100% | padrão |
| `deal_amount` | Valor | decimal | ~95% | padrão |
| `deal_status` | Status (1/2/3) | int | 100% | padrão |
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

| FieldKey | Nome | Tipo |
|----------|------|------|
| `order_number` | Número | int |
| `order_amount` | Valor total | decimal |
| `order_date` | Data | date |
| `order_description` | Descrição | string |

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
