# Webhooks Ploomes — Cachola OS

Webhook é o mecanismo que o Ploomes oferece para **avisar em tempo real** quando algo muda lá (deal criado, contato atualizado, deal ganho/perdido, etc.). No Cachola já existem 3 webhooks ativos.

## Webhooks ativos no Cachola (estado atual)

| ID | Nome | Entity | Action | Quando dispara |
|----|------|--------|--------|----------------|
| 60005910 | Deal Update | 2 (Deal) | 2 (Update) | Sempre que um negócio é editado |
| 60005911 | Deal Win | 2 (Deal) | 5 (Win) | Negócio marcado como ganho |
| 60005912 | Deal Lose | 2 (Deal) | 6 (Lose) | Negócio marcado como perdido |

Todos com `ValidationKey` definido no `ploomes_config.webhook_validation_key`.

## Anatomia de um webhook

### Cadastro (POST /Webhooks)

```http
POST https://api2.ploomes.com/Webhooks
User-Key: <chave>
Content-Type: application/json

{
  "EntityId": 2,
  "ActionId": 2,
  "CallbackUrl": "https://api.cachola.cloud/api/ploomes/webhook/deal-update",
  "ValidationKey": "<string-secreta-aleatoria>"
}
```

### Tabela de IDs

**EntityId** (qual entidade dispara):
| ID | Entidade |
|----|----------|
| 1  | Contact (cliente/contato) |
| 2  | Deal (negócio) |
| 4  | Order (venda) |
| 7  | Product |
| 8  | Quote (proposta) |
| 12 | Task (tarefa) |

**ActionId** (qual ação dispara):
| ID | Ação |
|----|------|
| 1  | Create |
| 2  | Update |
| 3  | Delete |
| 5  | Win (só Deals/Orders) |
| 6  | Lose (só Deals) |
| 7  | Reopen (só Deals) |

### Payload que o Ploomes envia

Quando o evento dispara, o Ploomes faz `POST` no `CallbackUrl` com este corpo:

```json
{
  "ResourceId": 100864460,
  "Entity": "Deals",
  "Action": "Update",
  "ValidationKey": "<a mesma chave cadastrada>",
  "UserId": 10018838
}
```

Note: `Entity` vem em **plural** aqui. Em outras configurações vem em **singular** (`Deal`). O handler precisa normalizar.

## Padrão do handler (Next.js App Router)

```typescript
// src/app/api/ploomes/webhook/[type]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const body = await req.json()
  const { ResourceId, Entity, Action, ValidationKey } = body

  // 1. Normalizar Entity (plural → singular)
  const entityNorm = Entity.replace(/s$/, '')  // Deals → Deal

  // 2. Buscar config da unidade pelo ValidationKey
  const supabase = createAdminClient()
  const { data: config } = await supabase
    .from('ploomes_config')
    .select('unit_id, user_key')
    .eq('webhook_validation_key', ValidationKey)
    .single()

  if (!config) {
    // ValidationKey desconhecido — DESCARTA silenciosamente
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 3. Logar (sempre, antes de processar)
  await supabase.from('ploomes_webhook_log').insert({
    unit_id: config.unit_id,
    entity: entityNorm,
    action: Action,
    resource_id: ResourceId,
    payload: body,
  })

  // 4. Despachar para o handler específico
  if (entityNorm === 'Deal' && Action === 'Update') {
    await syncSingleDeal(ResourceId, config.unit_id, config.user_key)
  } else if (entityNorm === 'Deal' && Action === 'Win') {
    await handleDealWin(ResourceId, config.unit_id, config.user_key)
  }
  // ...

  // 5. SEMPRE retornar 200 rápido — Ploomes não faz retry inteligente
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

## Pontos sensíveis

1. **`ValidationKey` é a única autenticação.** Sem ele = qualquer pessoa que descobrir a URL pode disparar. Trate como senha.

2. **Sempre retornar 200 rápido.** Se o handler demorar > 10s, o Ploomes considera falha e remove o webhook depois de N tentativas. Faça o trabalho em background (queue, RPC, ou apenas dispare o sync sem aguardar).

3. **`Entity` plural vs singular.** `Deals` no payload de update mas `Deal` em outras situações. Normalize sempre.

4. **Webhooks NÃO trazem o objeto completo.** Só o `ResourceId`. Para ver o que mudou, faça `GET /Deals(ResourceId)?$expand=...`.

5. **Idempotência.** O Ploomes pode mandar o mesmo evento 2x. Use `(unit_id, entity, resource_id, action, received_at)` com janela de 5s para deduplicar.

6. **Ordem não garantida.** Update pode chegar antes de Create se a rede for lenta. Sempre validar estado atual no Ploomes antes de aplicar.

## Operações de gestão de webhooks

```http
# Listar webhooks ativos
GET https://api2.ploomes.com/Webhooks
User-Key: <chave>

# Atualizar URL (ex: troca de domínio)
PATCH https://api2.ploomes.com/Webhooks(60005910)
User-Key: <chave>
{ "CallbackUrl": "https://nova-url.cachola.cloud/api/ploomes/webhook/deal-update" }

# Desativar
DELETE https://api2.ploomes.com/Webhooks(60005910)
User-Key: <chave>
```

## Testar localmente

Em dev, o Ploomes não consegue alcançar `localhost`. Opções:

1. **ngrok** (mais simples): `ngrok http 3000` — gera URL pública. Cadastre essa URL temporariamente como webhook em ambiente de homologação Ploomes (ou teste via `curl` simulando o payload).

2. **Webhook re-player**: salvar payloads reais em `ploomes_webhook_log` e ter um endpoint `/api/dev/replay/:logId` que reenvia para o handler local. Bom para depurar regressões.

3. **Direto via curl** (mais rápido para teste pontual):
```bash
curl -X POST http://localhost:3000/api/ploomes/webhook/deal-update \
  -H "Content-Type: application/json" \
  -d '{"ResourceId": 100864460, "Entity": "Deals", "Action": "Update", "ValidationKey": "sua-chave-local"}'
```
