# OData Cheatsheet — Ploomes API

A API do Ploomes implementa OData v4. Toda query GET aceita um conjunto de **system query options** (parâmetros que começam com `$`). Esta referência cobre só os que importam no Cachola — em ordem de uso.

## Query options (em ordem de frequência de uso)

### `$filter` — filtrar resultados

Sintaxe: `$filter=<Campo> <operador> <valor>`

Operadores aceitos: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `and`, `or`, `not`, `contains()`, `startswith()`, `endswith()`.

```
GET /Deals?$filter=StatusId eq 2
GET /Contacts?$filter=Id eq 102804199
GET /Deals?$filter=StatusId eq 1 and PipelineId eq 5040123
GET /Contacts?$filter=contains(Name, 'Cachola')
GET /Deals?$filter=LastUpdateDate gt 2026-04-01T00:00:00-03:00
```

**Cuidados:**
- Strings vão entre aspas simples: `Name eq 'Bruno'`.
- Datas em ISO 8601 com timezone: `2026-04-30T00:00:00-03:00`. Nunca date-only.
- Para campo aninhado: `Deal/StatusId eq 2`, `Contact/Name eq 'X'`.
- ❌ Não filtra por `OtherProperties` no `$filter` da query principal — retorna **403 Forbidden**. Filtre no resultado, no código.

### `$expand` — trazer entidades relacionadas

Sem `$expand`, campos como `Owner`, `Contact`, `Pipeline` vêm só como ID numérico. Para popular o nome no banco (ex: `owner_name`) é obrigatório expandir.

```
GET /Deals?$expand=Owner
GET /Deals?$expand=Owner($select=Id,Name)
GET /Deals?$expand=Owner,Contact,Pipeline,Stage
GET /Deals?$expand=Contact($select=Id,Name;$expand=City)
```

**Entidades relacionadas mais comuns no Cachola:**
- `Owner` (vendedor responsável)
- `Contact` (cliente)
- `Pipeline` + `Stage` (funil + etapa)
- `OtherProperties` (campos customizados — sempre expandir)
- `Products` (em Orders)

### `$select` — limitar campos retornados

Reduz payload e tempo de resposta. Use sempre que possível em syncs grandes.

```
GET /Deals?$select=Id,Title,Amount,StatusId,LastUpdateDate
GET /Contacts?$select=Id,Name,Email
```

Funciona dentro de `$expand` também: `$expand=Owner($select=Id,Name)`.

### `$top` e `$skip` — paginação

⚠️ **`$top` máximo na prática é 300 por página.** Acima disso, o Ploomes silenciosamente trunca sem aviso.

```
GET /Deals?$top=300                  # primeira página
GET /Deals?$top=300&$skip=300        # segunda
GET /Deals?$top=300&$skip=600        # terceira
```

**Padrão obrigatório de loop:**

```typescript
async function fetchAllDeals(userKey: string) {
  const all: PloomesDeal[] = []
  let skip = 0
  const top = 300

  while (true) {
    const res = await fetch(
      `https://api2.ploomes.com/Deals?$top=${top}&$skip=${skip}&$expand=Owner($select=Id,Name),OtherProperties`,
      { headers: { 'User-Key': userKey } }
    )
    const json = await res.json()
    const page: PloomesDeal[] = json.value ?? []

    if (page.length === 0) break
    all.push(...page)

    if (page.length < top) break  // última página
    skip += top

    // Respiração (rate limit ~120/min)
    await new Promise(r => setTimeout(r, 600))
  }

  return all
}
```

### `$orderby` — ordenação

```
GET /Deals?$orderby=LastUpdateDate desc
GET /Deals?$orderby=Amount asc, Title desc
```

Útil para sync incremental: pegar do mais recente para o mais antigo e parar quando bater no último já sincronizado.

### `$count` — contar total

```
GET /Deals?$count=true&$top=0
```

Retorna apenas o número total, sem registros. Útil para barra de progresso.

## Combinações reais usadas no Cachola

**Sync incremental de deals atualizados na última hora:**
```
GET /Deals?$filter=LastUpdateDate gt 2026-04-30T13:00:00-03:00
         &$expand=Owner($select=Id,Name),Contact($select=Id,Name),OtherProperties
         &$orderby=LastUpdateDate desc
         &$top=300
```

**Buscar 1 deal específico com tudo:**
```
GET /Deals?$filter=Id eq 100864460
         &$expand=Owner,Contact,Pipeline,Stage,OtherProperties,Products
```

**Listar pipelines com etapas (para popular dropdown):**
```
GET /Deals@Pipelines?$expand=Stages
```

**Orders ganhas (StatusId 2 do Deal pai):**
```
GET /Orders?$filter=Deal/StatusId eq 2
         &$select=Id,OrderNumber,ContactName,Amount
         &$expand=Deal($select=StatusId)
         &$top=100
```

## Encoding

Valores em URL precisam de encoding adequado. Caracteres reservados:
- Espaço → `%20` (ou `+` em alguns proxies)
- `'` literal dentro de string → `''` (escape duplo)
- `&`, `=`, `?` em valores → `encodeURIComponent()` no JS

A maioria das libs HTTP modernas (fetch, axios) faz isso automaticamente se você passar params como objeto.

## Limites e boas práticas

- **Rate limit**: ~120 req/min por `User-Key`. Em sync sequencial, espere 500-700ms entre páginas.
- **Timeout**: ~30s por request. Queries com muitos `$expand` aninhados podem estourar.
- **Tamanho de resposta**: ~10MB por request. `$top` muito alto + `$expand` em tudo = 413.
- **Cache**: Ploomes não retorna `Cache-Control` útil. Faça cache no seu lado por `Id` + `LastUpdateDate`.
