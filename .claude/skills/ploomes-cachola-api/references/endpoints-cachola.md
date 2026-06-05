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

O sync de Orders é **upsert-only**: ele só conhece o que a API retorna na janela de data. Orders **excluídas no Ploomes deixam de ser retornadas** e ficam **órfãs** no nosso banco, inflando o BI (ver `gotchas-cachola.md` §18). Por isso, **após o upsert da rodada**, reconcilie **por deal tocado**:

```http
GET /Orders?$filter=DealId eq {dealId}&$select=Id
```

Monte o conjunto de `Id` vivos e **remova** do nosso banco as Orders daquele deal ausentes nesse conjunto (os produtos saem por `ON DELETE CASCADE`).

**Guardrails obrigatórios (é remoção automática de dado):**
1. **Erro/timeout/resposta inválida** da consulta do deal → **NÃO remover nada** daquele deal nesta rodada; logar aviso.
2. **Nunca remover 100%** das Orders locais de um deal (provável falha de API; exclusão real de todas é rara) → pular e logar para revisão manual.
3. **Só deals efetivamente sincronizados na rodada** — nunca varrer/remover Orders de deals fora do escopo da chamada. **Não** fazer job periódico global sem aprovação.
4. **Auditoria:** logar cada Order removida (`OrderId`, `DealId`, timestamp, motivo).
5. **Rate limit:** a consulta por deal adiciona 1 GET por deal — sequenciar com respiração (~600ms) conforme o padrão de rate limit da skill.

> Padrão para listar o universo vivo de uma vez (diagnóstico/varredura, fora do sync): `GET /Orders?$filter=Deal/PipelineId eq 60000636&$select=Id,DealId,Amount&$top=300&$skip=N` paginado — traz só as Orders do funil CACHOLA.

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
