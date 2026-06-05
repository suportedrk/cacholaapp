# Endpoints Ploomes Usados no Cachola

Esta referência cobre **só os endpoints que aparecem no código do Cachola**. A API do Ploomes tem dezenas de outros (Tasks, Quotes, BusinessRules, Automations, etc.) que **não usamos** — se eventualmente forem necessários, abra a doc oficial.

## 1. Deals — coração do sistema

**Quem usa:** `sync-deals.ts` (cron 15min), webhook `deal-update`, módulo Vendas, módulo Eventos, BI.

### Listar (com paginação)

```http
GET /Deals
  ?$top=300
  &$skip={N}
  &$expand=Owner($select=Id,Name),Contact($select=Id,Name),OtherProperties
  &$orderby=LastUpdateDate desc
  &$filter=LastUpdateDate gt 2026-04-30T00:00:00-03:00
```

### Buscar 1 deal completo

```http
GET /Deals(100864460)
  ?$expand=Owner,Contact,Pipeline,Stage,OtherProperties,Products
```

### Atualizar campos

```http
PATCH /Deals(100864460)
{
  "Title": "Novo título",
  "Amount": 5000,
  "OtherProperties": [
    { "FieldKey": "deal_xxx", "StringValue": "valor" }
  ]
}
```

### Ações especiais

```http
POST /Deals(100864460)/Win        # marcar como ganho
POST /Deals(100864460)/Lose       # marcar como perdido (pode incluir LossReasonId no body)
POST /Deals(100864460)/Reopen     # reabrir
```

### Campos importantes do retorno

| Campo | Tipo | Notas |
|-------|------|-------|
| `Id` | int | chave |
| `Title` | string | nome do negócio |
| `Amount` | decimal | valor |
| `StatusId` | int | **1=Aberto, 2=Ganho, 3=Perdido** (invertido vs doc!) |
| `OwnerId` | int | precisa `$expand=Owner` para vir nome |
| `ContactId` | int | idem |
| `PipelineId` | int | funil |
| `StageId` | int | etapa |
| `LastUpdateDate` | datetime | use para sync incremental |
| `OtherProperties` | array | campos custom (ver `fieldkeys-customs.md`) |

### Link público para um deal

```
https://app10.ploomes.com/deal/{Id}
```

(Use no botão "Abrir no Ploomes" das telas do Cachola.)

## 2. Orders — vendas concluídas

**Quem usa:** `sync-orders.ts` (cron 30min), BI Categoria, módulo Vendas Fase 2 (planejado).

### Listar com produtos

```http
GET /Orders
  ?$top=300
  &$skip={N}
  &$select=Id,OrderNumber,ContactName,Amount,Date,OwnerId
  &$expand=Owner($select=Id,Name),OtherProperties,Products($expand=Product($select=Id,Name,Code))
  &$filter=Date gt 2024-01-01T00:00:00-03:00
  &$orderby=Date desc
```

### Estrutura de Products dentro de Order

```json
{
  "Id": 12345,
  "Products": [
    {
      "ProductId": 414,
      "Quantity": 2,
      "UnitPrice": 100.00,
      "Total": 200.00,
      "Discount": 0,
      "Product": {
        "Id": 414,
        "Name": "Pacote Festa 50 convidados",
        "Code": "PCT-50"
      }
    }
  ]
}
```

### Filtrar Orders ganhas

A "venda" no Ploomes é a `Order` que veio de um `Deal` ganho. Para filtrar só ganhas:

```http
GET /Orders?$filter=Deal/StatusId eq 2&$expand=Deal($select=StatusId)
```

### Reconciliação por deal (OBRIGATÓRIA no sync) — remover Orders excluídas

O sync de Orders é **upsert-only**: ele só conhece o que a API retorna na janela de data. Orders **excluídas no Ploomes deixam de ser retornadas** e ficam **órfãs** no nosso banco, inflando o BI (ver `gotchas-cachola.md` §18). Por isso, **após o upsert da rodada**, reconcilie **por deal tocado** (`reconcileDealOrders` em `sync-orders.ts`):

```http
GET /Orders?$filter=DealId eq {dealId}&$select=Id&$top=300
```

Monte o conjunto de `Id` vivos e **remova** do nosso banco as Orders daquele deal ausentes nesse conjunto (os produtos saem por `ON DELETE CASCADE`).

**Guardrails obrigatórios (é remoção automática de dado):**
1. **Erro/timeout/resposta inválida** da consulta do deal → **NÃO remover nada** daquele deal nesta rodada; logar aviso (`skipped='api_error'`). **Nunca** confundir erro de API com "0 vivas confirmado".
2. **`$top=300` com guarda de truncamento:** se a resposta vier com ≥300 itens, pode estar truncada → pular por segurança (não fabricar órfãs falsas).
3. **Caso 100% das Orders locais órfãs — decidir pelo conjunto vivo (refinado):**
   - **Tem Orders vivas de IDs diferentes** (substituição em massa atípica) → **NÃO remover**; revisão manual (`skipped='all_orphan'`).
   - **0 Orders vivas CONFIRMADO** (API ok, lista vazia) **E deal NÃO ganho** (`is_festa_ganha` falso) → **REMOVER** as órfãs (lixo inócuo: exclusão pura sem substituição).
   - **0 Orders vivas CONFIRMADO E deal É ganho** → **NÃO remover**; emitir **SINAL** `festa ganha sem venda viva — revisar no Ploomes` com `DealId` + título (`skipped='won_no_order'`). É anomalia de negócio (festa ganha sem documento de venda) que **não se resolve apagando** — corrige-se no Ploomes (recriar a Order ou rever o ganho).
   - **Deal não encontrado em `ploomes_deals`** (não classificável) → conservador, não remove.
4. **Auditoria:** logar cada Order removida (`OrderId`, `DealId`, timestamp, motivo) e cada SINAL emitido.
5. **Rate limit:** a consulta por deal adiciona 1 GET por deal — sequenciar com respiração (~600ms).

### Varredura periódica de segurança (global) — `reconcileAllOrders`

A reconciliação por-deal só alcança deals **tocados na rodada** (com Order na janela de data). Um deal cuja **única venda foi excluída** no Ploomes nunca mais aparece em nenhuma rodada → jamais é reconciliado. Para cobrir esse caso há a **varredura periódica** (`reconcileAllOrders` + cron `GET /api/cron/orders-reconcile`):

```http
GET /Orders?$filter=Deal/PipelineId eq 60000636&$select=Id&$top=300&$skip=N&$orderby=Id
```

Pagina o **universo vivo CACHOLA** inteiro, compara com o banco e, para **cada deal com órfã**, delega ao mesmo `reconcileDealOrders` (mesma lógica refinada do item 3: remove não-ganho, sinaliza ganho, pula em erro).

**Guardrails reforçados (age GLOBAL — mais defensiva que o sync):**
- **Listagem completa e plausível:** a paginação precisa concluir sem erro **e** vir com contagem sã (piso `SWEEP_LIVE_MIN_PLAUSIBLE=1000`; universo real ~1.800). Qualquer sinal de incompletude → **ABORTA, nada é removido**, e loga erro p/ alerta.
- **Sanity de volume:** se as órfãs candidatas excederem `SWEEP_VOLUME_CAP=100` numa execução → **ABORTA** (provável listagem incompleta inflando falsas órfãs) em vez de remover.
- **Auditoria** por Order removida e por SINAL emitido.
- **`?dryRun=1`** calcula e loga tudo sem remover — usar para validar em produção **antes** de ativar o agendamento.

**Frequência:** 1x/dia, ~30min **após** o sync de Orders (evita competir por rate limit). O passivo histórico já foi limpo manualmente; em regime normal a varredura encontra ~0 órfã nova e só re-sinaliza os deals ganhos-sem-venda já conhecidos.

## 3. Contacts — clientes

**Quem usa:** `sync-contacts.ts`, módulo Pré-venda, módulo Vendas (Upsell, Recompra).

### Listar

```http
GET /Contacts
  ?$top=300
  &$skip={N}
  &$select=Id,Name,Email,CPF,CNPJ,Birthday,OwnerId,LastUpdateDate
  &$expand=Owner($select=Id,Name),OtherProperties
  &$orderby=LastUpdateDate desc
```

### Buscar por email/CPF

```http
GET /Contacts?$filter=Email eq 'cliente@email.com'
GET /Contacts?$filter=CPF eq '12345678901'
```

### Atualizar

```http
PATCH /Contacts(102804380)
{
  "Email": "novo@email.com",
  "OtherProperties": [
    { "FieldKey": "contact_observacao", "StringValue": "Cliente VIP" }
  ]
}
```

### Upload de arquivo/avatar

```http
POST /Contacts(2720)/UploadFile?$expand=Attachments
Content-Type: multipart/form-data
[arquivo]
```

## 4. Pipelines & Stages — funil de vendas

**Quem usa:** carregamento inicial de dropdowns, mapeamento de etapas no BI.

### Listar todos os pipelines com etapas

```http
GET /Deals@Pipelines?$expand=Stages
```

> Note a sintaxe `@` — é um endpoint **navigation** do OData. `Pipelines` "anexado" a `Deals`.

### Estrutura

```json
{
  "value": [
    {
      "Id": 5040123,
      "Name": "Funil Comercial",
      "Stages": [
        { "Id": 10056270, "Name": "Lead", "Ordination": 1 },
        { "Id": 10056271, "Name": "Visita agendada", "Ordination": 2 }
      ]
    }
  ]
}
```

## 5. Webhooks (gestão)

Já coberto em `webhooks.md`. Resumo dos endpoints:

```http
GET    /Webhooks                  # listar
POST   /Webhooks                  # criar
PATCH  /Webhooks(60005910)        # atualizar
DELETE /Webhooks(60005910)        # remover
GET    /Webhooks@Actions          # listar ActionIds disponíveis
```

## 6. Account — dados da conta

Útil para diagnosticar configuração:

```http
GET /Account
```

Retorna nome da empresa, plano, limite de usuários, etc. Use só para debug ou onboarding de nova unidade.

## 7. Users — vendedores e operadores

```http
GET /Users?$top=100&$select=Id,Name,Email,Active,ProfileId
```

**Use para:**
- Popular tabela `sellers` no Cachola.
- Mapear `OwnerId` retornado em deals/orders/contacts → nome real do vendedor.
- Detectar usuário inativo no Ploomes (`Active = false`) — caso conhecido: Bruno Motta inativo desde X.

## Endpoints que **NÃO** usamos no Cachola (não cobertos)

- `Tasks` — tarefas/atividades.
- `Quotes` — propostas comerciais.
- `Automations` — automações nativas do Ploomes.
- `BusinessRules` — regras de aprovação.
- `Documents` — documentos anexados a deals.
- `Forms` — formulários públicos.
- `ImportationTemplates` — modelos de importação CSV.

Se um dia precisar, consulte direto na collection oficial ou na doc.

## Pattern: novo endpoint no projeto

Quando precisar adicionar um novo endpoint Ploomes ao código:

1. **Tipar a resposta** em `src/types/ploomes.ts` — só os campos usados, não copiar o objeto inteiro.
2. **Helper centralizado** em `src/lib/ploomes/client.ts` — não espalhar `fetch('https://api2.ploomes.com/...')` pelo código.
3. **Sempre buscar `User-Key` por `unit_id`** — multi-unidade depende disso.
4. **Logar erros 4xx/5xx** em tabela `ploomes_api_errors` com payload + status — facilita debug retrospectivo.
5. **Respeitar rate limit** — 500-700ms entre requests sequenciais.
