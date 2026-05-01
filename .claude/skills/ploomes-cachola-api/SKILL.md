---
name: ploomes-cachola-api
description: Padrões reais e armadilhas da integração Ploomes (CRM) no Cachola OS. Use SEMPRE que o trabalho envolver a API do Ploomes — sync de deals, contacts, orders, products, webhooks, OData ($filter/$expand/$skip/$top), descoberta de FieldKeys, campos customizados (OtherProperties), pipelines/stages, ou qualquer coisa apontando para `api2.ploomes.com`. Dispare também quando ver os arquivos `sync-deals.ts`, `sync-orders.ts`, `route.ts` de webhook Ploomes, ou tabelas `ploomes_*` no Supabase. NÃO leia o `ploomesapi.md` da raiz do projeto — ele é uma collection Postman crua, gigante e inutilizável; este conteúdo aqui já tem o que importa, destilado para o Cachola.
---

# Ploomes API — Integração Cachola OS

Esta skill é a fonte de verdade para tudo que toca a API do Ploomes no projeto. A documentação oficial (`developers.ploomes.com`, suporte) é boa para fundamentos, mas tem **divergências importantes** da realidade que o time já mapeou. Este arquivo prioriza a realidade.

## Filosofia

- A API do Ploomes é **OData v4** sobre HTTP. Toda chamada é `GET/POST/PATCH/DELETE` em `https://api2.ploomes.com/<Entidade>` com header `User-Key: <chave>`.
- A **`User-Key` mora no banco** (`ploomes_config.user_key`), não em `.env`. Cada unidade tem a sua. Sempre buscar via `unit_id`.
- **Paginação é obrigatória** acima de ~300 registros — `$top` sozinho silenciosamente trunca. Use sempre `$skip + $top` em loop.
- **Webhooks chegam pelo backend** com `ValidationKey` no body — sem isso, o pacote é descartado.
- O Ploomes tem **rate limit ~120 req/min** por User-Key. Sync em massa precisa de respiração entre páginas.

## Quando consultar cada referência

Não leia tudo de uma vez. Use a referência relevante ao que está na mesa:

| Tarefa | Leia |
|---|---|
| Montar query OData (filtro, expand, select) | `references/odata-cheatsheet.md` |
| Configurar/debugar webhook | `references/webhooks.md` |
| Trabalhar com campo customizado (deal/contact/order) | `references/fieldkeys-customs.md` |
| Sync de Deals, Orders, Contacts, Pipelines | `references/endpoints-cachola.md` |
| Algo está estranho/quebrado/contradizendo a doc | `references/gotchas-cachola.md` (LEIA PRIMEIRO em caso de dúvida) |

## Padrões críticos (decorar)

Estes são os 7 mandamentos do Ploomes no Cachola. Se um deles for violado, algo vai quebrar silenciosamente:

1. **`StatusId` é invertido em relação à doc oficial.** No Ploomes real: `1 = Em aberto`, `2 = Ganho`, `3 = Perdido`. A documentação às vezes diz outra coisa. Confie nestes valores.

2. **Paginação:** sempre `$skip` + `$top=300` em loop até receber `value: []`. Nunca confie em `$top` sozinho.

3. **`$expand` para `Owner`:** sem isso, vem só `OwnerId` numérico. Para popular `owner_name` no banco use `$expand=Owner($select=Id,Name)`.

4. **Campos custom (`OtherProperties`):** vêm em array, com `FieldKey` (string com prefixo `deal_`, `contact_`, `order_`) e UM dos campos de valor: `StringValue`, `DecimalValue`, `IntegerValue`, `DateTimeValue`, `BoolValue`, `ObjectValueName`. Saber qual é por tentativa/log.

5. **Webhook `Entity`:** o handler precisa normalizar plural → singular (`Contacts` → `Contact`, `Deals` → `Deal`). O Ploomes manda em ambos formatos dependendo da configuração.

6. **Filtros OData com data:** sempre ISO 8601 com timezone (`2026-04-30T00:00:00-03:00`), nunca data nua.

7. **Mutations:** Ploomes aceita `POST` (criar) e `PATCH` (atualizar parcial). `PUT` não é suportado para a maioria das entidades.

## Anti-padrões (NUNCA fazer)

- ❌ Hardcodar `User-Key` no código ou em variável de ambiente.
- ❌ Tentar filtrar `OtherProperties` no `$filter` da query principal — retorna 403. Filtre no resultado, em código.
- ❌ Esquecer `$expand` em campos relacionais (`Contact`, `Owner`, `Pipeline`, `Stage`) — vem só o ID.
- ❌ Fazer sync sem bloqueio (lock) — duas execuções simultâneas vão duplicar dados.
- ❌ Ler o arquivo `ploomesapi.md` da raiz — é uma collection Postman bruta, ilegível para LLM.
- ❌ Confiar em totais retornados pelo Ploomes na primeira página — sempre paginar até `[]`.

## Escopo desta skill

✅ **Cobre:** OData, webhooks, FieldKeys, sync, padrões reais, gotchas mapeadas.
❌ **NÃO cobre:** UI das telas que consomem dados Ploomes (isso é design system), regras de negócio do Cachola sobre quando rodar sync (isso é decisão de produto), credenciais (isso é `.env` + `ploomes_config`).
