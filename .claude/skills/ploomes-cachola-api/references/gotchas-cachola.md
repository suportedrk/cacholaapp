# Gotchas Ploomes — Cachola OS

Este arquivo é a **memória de cicatrizes** do projeto. Cada item aqui é uma armadilha que o time já caiu — ou que está documentada na collection Postman como "comportamento que diverge da doc oficial". Em caso de comportamento estranho, leia este arquivo PRIMEIRO antes de assumir bug no seu código.

## ⚠️ CRÍTICO — Decorar

### 1. `StatusId` é invertido em relação à doc oficial
Em `Deal.StatusId`:
- `1` = **Em aberto** (a doc às vezes diz "Won")
- `2` = **Ganho** (a doc às vezes diz algo diferente)
- `3` = **Perdido**

**Como sangramos:** queries iniciais filtravam `StatusId eq 1` esperando "Ganho" e vinha tudo em aberto. Confie nesta tabela — está validada em produção com 7.214 deals.

### 2. `$top` sozinho silenciosamente trunca
Acima de ~300 registros, `$top=1000` retorna 1000 e simplesmente **não diz** que tem mais. Sem `$skip` em loop, dados se perdem.

**Como sangramos:** sync inicial de Orders com `$top=2000` retornava ~1.500 (o que parecia ok) — descobrimos meses depois que tinham 1.533. Padrão definitivo: `$skip + $top=300` em loop até `value: []`.

### 3. Filtrar por `OtherProperties` no `$filter` retorna 403
```
GET /Deals?$filter=OtherProperties/any(p: p/FieldKey eq 'deal_xxx')
→ 403 Forbidden
```

**Como sangramos:** primeira tentativa do módulo Upsell. Pivotamos para baixar todas as 703 contatos com `$expand=OtherProperties` e filtrar em JavaScript depois. Funciona — só consome mais banda.

### 4. Webhook `Entity` vem em plural OU singular
Em alguns eventos, `Entity: "Deals"`. Em outros, `Entity: "Deal"`. Depende da configuração que o admin fez no painel.

**Solução padrão:** sempre normalizar:
```typescript
const entityNorm = body.Entity.replace(/s$/, '')
```

## ⚠️ Importante — Saber

### 5. `OwnerId` sem `$expand=Owner` vem só como número
```
GET /Deals(123)
→ { "OwnerId": 10018838, ... }   // sem nome
```

```
GET /Deals(123)?$expand=Owner($select=Id,Name)
→ { "OwnerId": 10018838, "Owner": { "Id": 10018838, "Name": "Bruno Casaletti" }, ... }
```

Sem `$expand`, o sync grava `owner_name = null` e BI fica com vendedor "desconhecido". **Sempre expandir.**

### 6. `User-Key` mora no banco, não em `.env`
Cada unidade tem sua própria User-Key (porque podem ser contas Ploomes diferentes ou perfis diferentes).

```typescript
// ❌ Errado:
const userKey = process.env.PLOOMES_USER_KEY

// ✅ Certo:
const { data: config } = await supabase
  .from('ploomes_config')
  .select('user_key')
  .eq('unit_id', unitId)
  .single()
```

### 7. Endpoints não suportam `PUT`
A maioria das entidades aceita `POST` (criar) e `PATCH` (atualizar parcial). `PUT` (substituir totalmente) **não funciona** — retorna 405 ou 400 dependendo do endpoint.

Use `PATCH` mesmo quando quiser "substituir tudo" — só envie todos os campos no body.

### 8. Datas em filtros precisam de timezone explícito
```
❌ $filter=LastUpdateDate gt 2026-04-30                    # timezone implícito UTC, dá problema
❌ $filter=LastUpdateDate gt '2026-04-30T00:00:00'         # sem timezone
✅ $filter=LastUpdateDate gt 2026-04-30T00:00:00-03:00     # ISO 8601 com offset BRT
```

### 9. `Birthday` em Contact ≠ "aniversariante" em Deal
Cuidado para não confundir:
- `contact_birthday` (campo padrão de Contact) — aniversário **do cliente** (geralmente o pai/mãe).
- `deal_<UUID>` "Aniversariante" (campo custom em Deal) — aniversário **da criança** que vai fazer a festa.

No módulo Recompra Fase D, é o **segundo** que importa. Não inverter.

### 10. Rate limit silencioso ~120 req/min por User-Key
Acima disso, requests retornam 429 com `Retry-After`. Mas alguns retornam 200 com `value: []` — pior, porque parece que "não tem nada novo".

**Padrão seguro:**
- Sequencial: 500-700ms entre requests.
- Paralelo: máximo 3 requests simultâneas por User-Key.
- Sempre logar contador de requests por minuto durante syncs grandes.

### 11. `$expand` aninhado tem profundidade máxima de 3 níveis
```
✅ $expand=Owner($select=Id,Name)                                  # 1 nível
✅ $expand=Contact($expand=City)                                   # 2 níveis
✅ $expand=Deal($expand=Pipeline($expand=Stages))                  # 3 níveis
❌ $expand=Deal($expand=Pipeline($expand=Stages($expand=Tags)))    # 4 — quebra
```

Acima disso, retorna 400 ou trunca silenciosamente o expand.

### 12. `OtherProperties` em payload de PATCH é **substitutivo**, não merge
Se você fizer:
```http
PATCH /Deals(123)
{ "OtherProperties": [{ "FieldKey": "deal_xxx", "StringValue": "novo" }] }
```

**Todos os outros OtherProperties que existiam são removidos.** O array é tratado como substituição completa.

**Solução:** sempre fazer `GET` antes para ler os existentes, mesclar com a alteração, e enviar o array completo no PATCH.

### 13. `LastUpdateDate` muda em qualquer alteração — inclusive interna
Não confunda "vendedor editou o deal" com "Ploomes mexeu por automação interna". `LastUpdateDate` é atualizado em **qualquer** mudança, inclusive automações nativas, anexar arquivo, etc.

Se quiser detectar só edições humanas, é preciso comparar com snapshot anterior — não dá para confiar só em `LastUpdateDate`.

## 🔧 Operacionais (já mitigados, mas conhecer)

### 14. Webhooks somem se a CallbackUrl falhar muito
Após N falhas consecutivas (5xx ou timeout), o Ploomes desativa o webhook silenciosamente. Há um cron de saúde no Cachola que verifica se os 3 webhooks (Update/Win/Lose) ainda estão ativos.

**Se sumirem:** recriar via `POST /Webhooks` (não tem endpoint de "reativar").

### 15. Bruno Motta = vendedor inativo importante
Vendedor com `Active = false` no Ploomes mas que ainda tem **322 contatos** atribuídos (deals históricos). Não filtre `Active = true` na hora de carregar `sellers` se a tela mostra histórico — vai sumir cliente.

### 16. `app10.ploomes.com` é o domínio da nossa instância
Para gerar links públicos para deals/contacts, é `https://app10.ploomes.com/deal/{id}` ou `/contact/{id}`. Outras instâncias do Ploomes usam outros números (`app1`, `app7`, etc.).

### 17. `GOTRUE_MAILER_EXTERNAL_HOSTS=api.cachola.cloud`
Não é gotcha do Ploomes em si, mas relacionado: o GoTrue (Supabase auth) emite warning não-crítico no boot por causa de hosts externos. Setar essa env var suprime o warning. **Não confundir com erro real.**

## Como adicionar um novo gotcha aqui

Quando descobrir comportamento divergente do Ploomes:

1. Reproduzir 2x para ter certeza que não é flutuação.
2. Testar em outra User-Key se possível (pode ser config de conta).
3. Adicionar entrada com:
   - **O que aconteceu** (sintoma)
   - **Como sangramos** (qual feature quebrou)
   - **Solução aplicada**
4. Linkar a migration/PR onde foi corrigido, se aplicável.
