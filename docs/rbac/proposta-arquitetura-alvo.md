# Proposta — Arquitetura-alvo de Permissões do Cachola OS

> Status: **proposta para aval do dono do produto**. Nenhuma migration, schema ou
> código de aplicação alterado. As decisões pendentes estão no Item 7.

## Resumo executivo

Hoje convivem dois grãos de decisão de acesso no Cachola OS:

- **Cargo** (`hasRole`, `requireRoleServer`, `role IN (...)` inline em RLS/RPC).
- **Permissão configurável** (`user_permissions` + `check_permission()`),
  efetivamente respeitada por apenas ~8 dos 21 módulos canônicos, e por uma única
  tela do app (`/admin/logs`).

A decisão de produto já tomada é **unificar tudo num único modelo configurável**,
no formato grupo (cargo) → módulos → permissões, com **duas espessuras** dentro
do mesmo modelo:

- **Grossa** — `(módulo, ação)` com ações canônicas `view/create/edit/delete/export`.
  Cobre todos os módulos.
- **Fina** — controles nomeados explícitos, curados, no espírito BuffetMax
  (`Anexos — Excluir`, `Botão anfitrião`). Ligados a um módulo, configuráveis
  por cargo e por usuário do mesmo jeito que as grossas.

Esta proposta desenha a arquitetura-alvo, define o "molde de ouro", documenta a
receita ponta-a-ponta para um controle fino, expande o guard-rail automático e
descreve um roteiro de migração faseado. As decisões de produto pendentes estão
isoladas no Item 7 como perguntas binárias.

---

## Item 1 — Modelo do catálogo

### O problema

`user_permissions.action` tem hoje um CHECK constraint estreito:
`action IN ('view','create','edit','delete','export')`. O type TS `Action` é
union literal das mesmas cinco strings. Isso é confortável enquanto o sistema
só pensa por (módulo, ação) — e impeditivo para representar controles finos
como `anexos_excluir`, `valor_festa_ver`, `botao_anfitriao` sem proliferar
módulos artificiais.

A pergunta de design: **onde encaixar a espessura fina sem fragmentar o motor
de autorização nem duplicar as telas de admin?**

### Opções avaliadas

#### Opção A (recomendada) — Catálogo único `permission_controls`, motor inalterado

Manter `user_permissions` e `role_permissions` **como tabelas de armazenamento
inalteradas**. Introduzir um catálogo novo:

```
public.permission_controls (
  module_code  TEXT NOT NULL REFERENCES public.modules(code) ON DELETE CASCADE,
  code         TEXT NOT NULL,         -- 'view'/'create'/... ou 'anexos_excluir'
  label        TEXT NOT NULL,
  description  TEXT,
  kind         TEXT NOT NULL CHECK (kind IN ('action','control')),
  sort_order   INT  NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (module_code, code)
)
```

- Cinco ações canônicas entram **seedadas** como `kind='action'` para os 20
  módulos do catálogo `modules` (100 linhas). Controles finos entram como
  `kind='control'` por curadoria.
- Substituir os CHECK constraints atuais de `user_permissions(module, action)`
  e `role_permissions(module_code, action)` por **FK composta** apontando para
  `permission_controls(module_code, code)`. O drift do CHECK constraint some;
  a tabela `permission_controls` vira a única fonte de verdade.
- **`check_permission(uid, module, action_or_control_code)` não muda de
  assinatura.** Recebe `'edit'` ou `'anexos_excluir'` indistintamente. Toda a
  camada de autorização (RLS, RPCs, API guards) reaproveita a função tal qual.
- A coluna `kind` é apenas para a UI separar visualmente "ações padrão" de
  "controles específicos" — não muda comportamento de autorização.

#### Opção B (descartada) — Tabelas paralelas para controles finos

Criar `user_control_permissions` e `role_control_permissions` espelhando
`user_permissions`/`role_permissions` mas só para controles finos. Função nova
`check_control(uid, module, control_code)`. **Rejeitada:** duplica motor,
duplica seeds, duplica UI de admin, duplica risco de drift, e contraria
"configurar do mesmo jeito que as grossas" da decisão de produto.

### 🟢 Recomendação: Opção A

Minimiza mudança estrutural, reaproveita `user_permissions` + `role_permissions`
+ `check_permission()` sem tocar no motor. Os dois grãos passam a viver no mesmo
catálogo e a mesma função decide os dois.

### Sub-decisões cravadas pela Opção A

#### Convenção de nomes para controles finos

- **Idioma:** PT-BR. Codes em PT-BR são o padrão do projeto desde a migration 073.
- **Forma:** verb-noun consistente — `anexos_excluir`, `valor_festa_ver`,
  `botao_anfitriao_usar`, `aba_financeiro_ver`. Snake_case.
- **Escopo no nome:** o code é único por módulo (PK composta com `module_code`).
  `eventos.anexos_excluir` e `vendas.anexos_excluir` coexistem sem ambiguidade.
- **Label** (PT-BR) é o que a UI exibe; **code** é o que o servidor consulta.

#### Tipo `Action` em TypeScript

Hoje:
```ts
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
```

Com controles finos crescendo, manter union literal vira ônus (centenas de
strings, regen manual a cada controle novo). Recomendação:

- **Manter `Action` como union literal apenas para as 5 ações canônicas.** Ela
  segue útil para checagens das colunas fixas da matriz de admin.
- **Introduzir tipo `ControlCode = string` para controles finos** (validado em
  runtime contra o catálogo, não em compile-time). O TypeScript deixa de ser
  fonte de verdade para o vocabulário fino — o catálogo é.
- Helpers como `useUserPermissions()` retornam `Record<string, boolean>` por
  módulo, e a UI consulta `permMap?.eventos?.anexos_excluir`. O code é texto
  livre validado pela FK no banco.

#### Forma da UI em `/admin/cargos/[code]` e `/admin/usuarios/[id]/permissoes`

A matriz fixa 20×5 vira **por módulo, duas seções empilhadas:**

```
┌─ Eventos ──────────────────────────────────────────────────────┐
│  Ações                                                          │
│  ┌──────────┬─────┬─────┬──────┬──────┬────────┐               │
│  │          │ Ver │ Cri │ Edit │ Excl │ Export │               │
│  │ Eventos  │  ◉  │  ◉  │  ◉   │  ○   │   ○    │               │
│  └──────────┴─────┴─────┴──────┴──────┴────────┘               │
│                                                                 │
│  Controles específicos                                          │
│  ┌─────────────────────────────────────┬───────┐               │
│  │ Anexos — Excluir                    │   ◉   │               │
│  │ Valor da festa — Ver                │   ○   │               │
│  │ Botão "Reabrir evento"              │   ◉   │               │
│  └─────────────────────────────────────┴───────┘               │
└─────────────────────────────────────────────────────────────────┘
```

Cada módulo é um bloco. A seção "Ações" sempre tem as 5 colunas. A seção
"Controles específicos" só aparece se há entradas em `permission_controls`
com `kind='control'` para aquele módulo. Renderizada dinamicamente a partir
do catálogo — adicionar controle novo é só adicionar linha; a UI atualiza
sem código novo.

---

## Item 2 — Molde de ouro (referência canônica)

**Módulo de referência: `eventos`.** Hoje é o módulo mais completo no eixo
"respeita permissão configurável", e o que mais se aproxima do alvo. Documentar
ele como **template canônico** ponta-a-ponta.

### 2.1 — Catálogo (`modules` + `role_permissions` + `permission_controls`)

- `eventos` está em `public.modules` ([071_rbac_catalogs.sql:122](supabase/migrations/071_rbac_catalogs.sql#L122)).
- Seed de `role_permissions` em [071:258-268](supabase/migrations/071_rbac_catalogs.sql#L258-L268)
  cobre `eventos.view` para 7 cargos. As ações `create/edit/delete` são
  semeadas por `super_admin` via CROSS JOIN (acesso total).
- Controles finos: nenhum hoje. Quando entrar (ex.: `valor_festa_ver`),
  vai como linha em `permission_controls (module_code='eventos', code='valor_festa_ver', kind='control', …)`
  e como linha em `role_permissions` por cargo elegível.

### 2.2 — RLS na tabela (`public.events`)

Padrão a copiar — [077:240-260](supabase/migrations/077_rls_policies_module_codes_pt_br.sql#L240-L260):

```sql
-- INSERT
CREATE POLICY "events: create" ON public.events FOR INSERT
  WITH CHECK (
    check_permission(auth.uid(), 'eventos', 'create')
    AND unit_id = ANY(get_user_unit_ids())
  );

-- DELETE
CREATE POLICY "events: delete" ON public.events FOR DELETE
  USING (
    check_permission(auth.uid(), 'eventos', 'delete')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- UPDATE
CREATE POLICY "events: update" ON public.events FOR UPDATE
  USING (
    check_permission(auth.uid(), 'eventos', 'edit')
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );

-- SELECT — combina permissão de módulo com exceções (criador, staff)
CREATE POLICY "events: view" ON public.events FOR SELECT
  USING (
    (check_permission(auth.uid(), 'eventos', 'view')
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM event_staff WHERE event_id = events.id AND user_id = auth.uid()))
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  );
```

**Características do padrão:**

- `check_permission(uid, 'modulo', 'acao')` **sempre presente** (decide o grão
  por módulo+ação) — NÃO `role IN (...)` inline.
- `unit_id = ANY(get_user_unit_ids())` como filtro multi-unidade.
- `is_global_viewer()` como bypass de escopo de unidade para super_admin /
  diretor / pos_vendas.
- Exceções de regra de negócio (ex.: criador sempre vê) somadas com `OR`.

### 2.3 — Guard de layout (`requireRoleServer`)

[src/app/(auth)/eventos/layout.tsx](src/app/(auth)/eventos/layout.tsx):

```ts
await requireRoleServer(EVENTOS_ACCESS_ROLES)
```

**No alvo:** este guard continua existindo como **filtro grosseiro de cargo
para ergonomia** (redirecionar cedo para `/403` antes da página renderizar).
Mas **a fonte de verdade é a RLS** — quem entrar pelo cargo mas não tiver
permissão correspondente em `user_permissions` simplesmente não vê dado.
Ver Item 7 pergunta 6 sobre o futuro do `hasRole`.

### 2.4 — Guard de API (`requireRoleApi`)

Quando há rota de API (eventos hoje fala direto com Supabase, mas o padrão
para módulos que têm API é):

```ts
const guard = await requireRoleApi(EVENTOS_ACCESS_ROLES)
if (!guard.ok) return guard.response
// + checagem de permissão se a operação é mais restritiva
```

### 2.5 — Leitura da permissão na UI

Hoje só `/admin/logs` faz isso. Padrão a generalizar:

```ts
const { profile } = useAuth()
const { data: permMap } = useUserPermissions(profile?.id)

const canDelete    = permMap?.eventos?.delete === true
const canSeeValues = permMap?.eventos?.valor_festa_ver === true  // controle fino
```

A UI **esconde** o botão quando `granted=false`. Mas — regra dura — a tela
não é o que protege; a tela só evita confusão. Ver Item 3.

### 2.6 — Presença nas telas de admin

- Em `/admin/cargos/[code]`: bloco "Eventos" mostra 5 toggles de ação +
  controles finos do módulo (se houver).
- Em `/admin/usuarios/[id]/permissoes`: mesmo bloco. Override individual
  sobrescreve template do cargo via `applyRoleTemplate`.

### 2.7 — Checklist visual do molde de ouro

```
Módulo X está conforme se:
  □ Existe linha em public.modules (code=X)
  □ Existe seed em role_permissions para cada (cargo, ação) intencional
  □ Cada tabela do módulo tem RLS com check_permission(uid, X, ação)
    em VIEW/CREATE/EDIT/DELETE — não role IN inline
  □ Layout guard requireRoleServer(X_ACCESS_ROLES) presente
  □ APIs do módulo (se existirem) usam requireRoleApi
  □ UI lê useUserPermissions e esconde controles negados
  □ Bloco do módulo aparece em /admin/cargos/[code] e funciona
  □ rbac:check passa
```

---

## Item 3 — Receita para adicionar um controle fino

Exemplo trabalhado: `eventos.valor_festa_ver` (esconder valores monetários
da tela de detalhe do evento para cargos sem permissão).

> ⚠️ **Regra dura:** **esconder botão na tela não é segurança.** Todo
> controle fino tem que travar no servidor (RLS, RPC, API) ANTES de
> esconder na UI. Se você só escondeu o botão, qualquer usuário com
> DevTools acessa o dado. A tela é cosmética.

### Sequência obrigatória — 4 passos, nesta ordem

#### Passo 1 — Declarar no catálogo

Migration que faz INSERT em `permission_controls`:

```
INSERT INTO public.permission_controls
  (module_code, code, label, description, kind, sort_order)
VALUES
  ('eventos', 'valor_festa_ver', 'Ver valores monetários da festa',
   'Permite visualizar deal_amount, payment_method e campos derivados.',
   'control', 100);
```

#### Passo 2 — Seed em `role_permissions`

Na mesma migration, definir o default por cargo:

```
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('super_admin', 'eventos', 'valor_festa_ver', true),
  ('diretor',     'eventos', 'valor_festa_ver', true),
  ('gerente',     'eventos', 'valor_festa_ver', true),
  ('vendedora',   'eventos', 'valor_festa_ver', true),
  ('pos_vendas',  'eventos', 'valor_festa_ver', true),
  ('decoracao',   'eventos', 'valor_festa_ver', true),
  ('financeiro',  'eventos', 'valor_festa_ver', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;
-- cargos não listados ficam com granted=false (default da tabela)
```

#### Passo 3 — Enforcement no servidor (OBRIGATÓRIO)

Onde o dado é servido, travar **antes** de retornar. Três caminhos possíveis,
dependendo da arquitetura:

**3a — Coluna sensível em tabela com RLS:** se a granularidade está em
"esconder coluna", usar a função `can_view_festa_values()` existente
([migration 093](supabase/migrations/093…)) reescrita para chamar
`check_permission(auth.uid(), 'eventos', 'valor_festa_ver')`. Views da tabela
exibem a coluna como NULL para quem não tem.

**3b — RPC que retorna o dado:** acrescentar guard no topo do corpo:
```sql
IF NOT check_permission(auth.uid(), 'eventos', 'valor_festa_ver') THEN
  -- ou retornar JSON com campos zerados, ou RAISE EXCEPTION dependendo da UX
END IF;
```

**3c — API route que monta a resposta:** checar permissão e zerar o campo na
resposta JSON. Padrão em `src/app/api/...`:
```ts
const canSeeValues = await checkPermission(supabase, 'eventos', 'valor_festa_ver')
return NextResponse.json({
  ...event,
  deal_amount: canSeeValues ? event.deal_amount : null,
})
```

**Sem o Passo 3, o controle fino é decorativo.**

#### Passo 4 — Leitura na UI

Esconder ou desabilitar o controle quando negado, com mensagem clara se for o caso:

```ts
const { data: permMap } = useUserPermissions(profile?.id)
const canSeeValues = permMap?.eventos?.valor_festa_ver === true

return (
  <>
    {canSeeValues ? (
      <p>Valor: R$ {event.deal_amount}</p>
    ) : (
      <p className="text-muted">Valor: ••••••</p>
    )}
  </>
)
```

A UI **complementa** o enforcement do servidor — não substitui.

### Fluxograma

```
┌──────────────────────────────────────────────────────────────┐
│  Catálogo (Passo 1)                                          │
│  └─→ permission_controls insere ('eventos','valor_festa_ver')│
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Template do cargo (Passo 2)                                 │
│  └─→ role_permissions seed por cargo                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Enforcement servidor (Passo 3 — OBRIGATÓRIO)                │
│  └─→ RLS / RPC / API route chama check_permission()          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Leitura na UI (Passo 4 — cosmético)                         │
│  └─→ useUserPermissions + condicional no JSX                 │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  /admin/cargos/[code] e /admin/usuarios/[id]/permissoes      │
│  └─→ aparecem automaticamente (UI lê do catálogo)            │
└──────────────────────────────────────────────────────────────┘
```

---

## Item 4 — Checklist de pronto (Definition of Done)

Esta seção é o conteúdo que deve ser refletido na skill `cachola-rbac-pattern`.

### Para um módulo NOVO

```
Catálogo
  □ Módulo entra em public.modules (code PT-BR, label, icon, sort_order)
  □ Type Module em src/types/permissions.ts atualizado
  □ As 5 ações canônicas viram entradas em permission_controls (kind='action')

Templates
  □ role_permissions seed por cargo (decisão de produto: quem vê/cria/edita)
  □ super_admin coberto via CROSS JOIN (já existe na 071 — confirmar)

Constantes
  □ Constante NOVA em src/config/roles.ts (X_ACCESS_ROLES)
  □ Padrão canônico: `as const satisfies readonly Role[]`
  □ Sem array inline em código de produção

Servidor (enforcement)
  □ Toda tabela do módulo: ENABLE ROW LEVEL SECURITY + policies
    nas 4 actions (view/create/edit/delete) usando check_permission(...)
  □ Combinar com filtro de unidade quando aplicável:
    AND (is_global_viewer() OR unit_id = ANY(get_user_unit_ids()))
  □ RPCs do módulo: guard com check_permission no topo
  □ API routes do módulo: requireRoleApi(X_ACCESS_ROLES) no início

Cliente (UI)
  □ Layout guard requireRoleServer(X_ACCESS_ROLES)
  □ Item de sidebar em nav-items.ts com allowedRoles
  □ Telas usam useUserPermissions para esconder controles negados
  □ Estados loading/empty/error completos (regra geral do projeto)

Validação
  □ npm run rbac:check passa sem violação
  □ npm run lint passa sem warning novo
  □ npx tsc --noEmit limpo
  □ Smoke test com pelo menos 2 cargos (super_admin + cargo real do módulo)
  □ Página /admin/cargos/[code] exibe o novo módulo corretamente
```

### Para um CONTROLE FINO novo

```
Catálogo
  □ Entry em permission_controls (kind='control', code snake_case PT-BR)
  □ Label legível para a UI de admin
  □ Description explica o que o controle libera

Templates
  □ role_permissions seed por cargo (default OFF — ver Item 7 Q4)

Enforcement (OBRIGATÓRIO — regra dura)
  □ Trava no servidor: RLS OR RPC OR API route
  □ NÃO é suficiente esconder o botão na UI
  □ Se for "esconder coluna sensível", reescrever a função existente
    para chamar check_permission()

UI
  □ useUserPermissions consultado
  □ Botão/aba/campo escondido ou desabilitado quando granted=false
  □ Mensagem clara se houver tentativa de uso (opcional)

Validação
  □ Smoke test com cargo que TEM e cargo que NÃO TEM o controle
  □ Tentativa de bypass via DevTools/curl confirmada como bloqueada
  □ /admin/cargos/[code] renderiza o controle na seção "Controles específicos"
```

---

## Item 5 — Guard-rail automático estendido

Hoje `npm run rbac:check` ([scripts/check-rbac-drift.ts](scripts/check-rbac-drift.ts))
detecta apenas **literais de role inline** (3 padrões A/B/C). Cobre drift de
cargo, não cobre drift de catálogo nem ausência de enforcement.

### Verificações novas a adicionar

#### V1 — Cobertura de rota (P1)

Para cada pasta de módulo em `src/app/(auth)/<modulo>/`:

- Deve existir `layout.tsx` no nível raiz OU em todas as sub-rotas;
- Cada `layout.tsx` deve chamar `requireRoleServer(...)` OU ler permissão
  via `useUserPermissions`;
- Permitir exceção via allowlist (mesma estrutura JSON do allowlist atual).

**Falha do CI:** módulo sem nenhum guard.

#### V2 — Cobertura de RLS (P1)

Indexar todas as `CREATE POLICY ... ON public.<tabela>` nas migrations:

- Para cada tabela com `ENABLE ROW LEVEL SECURITY`, conferir que existem
  policies para `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- Cada policy deve usar `check_permission(...)` OU estar em allowlist
  (ex.: tabelas de notificação que filtram por `auth.uid()` fazem sentido
  fora do catálogo);
- Detectar `role IN (...)` inline em policies como warning.

**Falha do CI:** tabela com RLS habilitado mas sem policy em ação obrigatória,
ou policy usando `role IN` inline em módulo já migrado.

#### V3 — Cobertura de catálogo (P1)

Cross-check entre 4 fontes:

- `Module` type literal em `src/types/permissions.ts`;
- Seed de `public.modules` na migration 071 (+ futuras);
- `role_permissions.module_code` distinct;
- `user_permissions.module` distinct.

Para cada code, ele deve aparecer nas 4 fontes ou ser explicitamente
ignorado via allowlist. Sem isso o `decoracao` órfão repete.

**Falha do CI:** `Module` type tem code que não está em `modules` (ou vice-versa);
`role_permissions` referencia `module_code` ausente em `modules`.

#### V4 — Cobertura de enforcement de controle fino (P2 — mais complexo)

Para cada entry em `permission_controls` com `kind='control'`:

- Existe pelo menos uma referência a `check_permission(..., '<module>', '<code>')`
  em algum lugar do código? Procurar em:
  - SQL das migrations (RLS + RPCs);
  - `src/app/api/**/*.ts`;
  - `supabase/functions/**` (se vier a existir).

Se um controle fino existe no catálogo mas nenhum lugar do servidor o
consulta, é teatro — controle decorativo. Sinalizar como falha.

**Falha do CI:** controle fino registrado sem enforcement servidor detectável.

> P2 é o mais difícil porque exige indexar SQL além de TS. Pode começar
> como warning (não falha CI) até maturar.

### Configuração de CI

Adicionar ao workflow `.github/workflows/` um step:

```
- name: RBAC drift + coverage
  run: npm run rbac:check && npm run rbac:check:coverage
```

`rbac:check` (existe) + `rbac:check:coverage` (novo, agrega V1–V4) ambos
exitam com 1 em violação. Allowlist única em `scripts/rbac-drift-allowlist.json`
estendida com novos tipos.

---

## Item 6 — Roteiro de migração faseado

### Fase 0 — Preparação (1 PR, baixo risco, sem efeito comportamental)

Objetivo: corrigir drift de catálogo antes de qualquer reescrita de RLS.

1. **Reconciliar `Module` type ↔ tabela `modules`:** acrescentar `decoracao`
   ao seed de `public.modules`, ou tirar `decoracao` do type — decidir por
   convergência (recomendado: acrescentar ao seed).
2. **Seed de `role_permissions` para `decoracao`:** popular por cargo
   conforme `DECORACAO_MANAGE_ROLES` e `DECORACAO_DELETE_ROLES`.
3. **Criar `permission_controls` catálogo** (Opção A do Item 1) sem ativar
   nada ainda — só estrutura + seed das 5 ações canônicas por módulo.
4. **Substituir CHECK constraint por FK** em `user_permissions(module, action)`
   e `role_permissions(module_code, action)` apontando para
   `permission_controls(module_code, code)`. Compatível com dados existentes.
5. Atualizar guard-rail (Item 5 — V1, V2, V3 ligados; V4 ainda warning).

**Critério de saída:** `rbac:check:coverage` verde, `/admin/cargos/decoracao`
funciona pela primeira vez, nenhuma regressão em produção.

### Fase 1 — Trazer os 12 módulos cargo-puros ao molde de ouro

Lista (do Passo 4 do diagnóstico anterior):
`vendas, bi, bi_atendimento, bi_vendas, checklist_comercial, equipamentos,
vendedoras, backups, unidades, dashboard, relatorios, notificacoes`.

Abordagem: **um PR por módulo**, no padrão Eventos (Item 2). Cada PR contém:

- Reescrever RLS das tabelas do módulo trocando `role IN (...)` por
  `check_permission(auth.uid(), '<modulo>', '<ação>')`, mantendo o filtro
  de unidade.
- Reescrever RPCs do módulo trocando guards `IF v_role NOT IN (...)` por
  `IF NOT check_permission(...)`.
- Conferir seed de `role_permissions` (provavelmente já está, mas validar
  cobertura).
- Smoke test em ambiente local com pelo menos 3 cargos.

**Ordem sugerida** (do mais isolado para o mais entrelaçado):

1. `notificacoes` (RLS já é `user_id = auth.uid()` — só formalizar).
2. `vendedoras` (1 tabela: `sellers`).
3. `equipamentos` (1 tabela: `equipment`).
4. `backups` + `unidades` (admin, baixo tráfego).
5. `dashboard` + `relatorios` (sem tabelas próprias — formalizar guards).
6. `checklist_comercial` (4 tabelas).
7. `bi`, `bi_atendimento`, `bi_vendas` — **aguarda Q1 do Item 7** (afeta
   tabelas ploomes_*).
8. `vendas` — **aguarda Q1 do Item 7** pelo mesmo motivo.

**Critério de saída por módulo:** matriz do Passo 3 do diagnóstico passa de
"C" para "P" na coluna RLS, smoke test confirma toggle em `/admin/cargos`
mudando comportamento.

### Fase 2 — Pilotar controles finos em 1–2 módulos

Escolher 1 ou 2 módulos para introduzir o primeiro lote de controles finos,
provando o fluxo do Item 3 ponta-a-ponta:

- `eventos.valor_festa_ver` — generalização do `canViewFestaValues` atual
  via catálogo (deixa de ser código hardcoded).
- `vendas.botao_recompra_acionar` ou similar — primeiro controle fino real
  baseado em demanda do produto.

Validar UX em `/admin/cargos` com seção "Controles específicos" funcionando.

### Fase 3 — UI consome permissão em vez de cargo

Generalizar o padrão de `/admin/logs` (que lê `permMap?.logs?.view`) para o
resto do app. Prioridade baixa porque a RLS já protege; isto é **alinhamento
de UX** (esconder controles negados).

- Hooks por módulo (ex.: `useEventoPermissions()`) que retornam o subset
  do `permMap` relevante.
- Substituir `hasRole(...)` por `permMap?.<modulo>?.<acao>` em call sites
  de UI quando o `hasRole` está controlando visibilidade (não roteamento).
- `requireRoleServer` em layouts **continua** — é o filtro grosseiro.

### Fase 4 — Decidir destino de `unit_id` em `check_permission`

Conforme Q2 do Item 7. Se a decisão for "passar a respeitar `unit_id`",
fazer migration nova que reescreve `check_permission` com 4 args
(retrocompat manter `check_permission/3` chamando `check_permission/4`
com `NULL`), e atualizar policies cujas tabelas têm `unit_id`.

---

## Item 7 — Decisões para o dono do produto

Cada pergunta tem contexto suficiente para resposta clara. Resposta marca
direção de fase subsequente.

> ### ✅ Decisões aprovadas pelo dono (registro 2026-05-26)
>
> Estas respostas valem como ordem para futuras sessões — agir sem reperguntar.
>
> **Q1 — Tabelas `ploomes_deals` / `ploomes_orders` / `ploomes_order_products`:**
> aprovada a **Opção C**. As tabelas permanecem protegidas só por unidade na RLS
> (`is_global_viewer() OR unit_id = ANY(get_user_unit_ids())`). O controle de
> acesso por módulo (Vendas vs BI) é feito na **camada de rota** (layouts) e nas
> **RPCs** de cada módulo, não na RLS dessas tabelas.
>
> **Q2 — `check_permission` ignora `unit_id`:** **adiar**. Por ora o recorte
> por unidade continua vindo do vínculo `user_units` + `get_user_unit_ids()`,
> não de permissão por unidade. NÃO adicionar a dimensão de unidade ao motor
> (`check_permission`) agora. A coluna `unit_id` em `user_permissions`
> permanece como está (status quo ambíguo aceito conscientemente).
>
> **Q3 — Futuro de `hasRole` / `requireRoleServer`:** aprovada a **Opção A** —
> cargo permanece como molde (template de permissões em `role_permissions`).
> Travas hard-coded por cargo continuam **apenas para coisas estruturais de
> segurança** (ex.: `super_admin` bypass, `IMPERSONATION_ROLES`,
> `SYSTEM_ONLY_ROLES`). As decisões configuráveis migram para leitura de
> permissão. NÃO remover `hasRole` / `requireRoleServer` em massa.
>
> **Q4 — Default de controle fino novo:** aprovada a **Opção A** — default
> OFF + seed obrigatório no mesmo PR.
>
> **Q5 — Bypass de `super_admin` em `check_permission`:** aprovada a
> **Opção A** — manter o bypass como hoje.
>
> **Q6:** consolidada por Q3 — `hasRole` e `requireRoleServer` ficam.

### Q1 — RLS das tabelas `ploomes_deals`, `ploomes_orders`, `ploomes_order_products`

**Contexto:** essas tabelas alimentam tanto o módulo **Vendas** quanto o
módulo **BI**. Hoje a RLS é só `is_global_viewer() OR unit_id = ANY(get_user_unit_ids())`
([migrations 040, 052](supabase/migrations/040_ploomes_deals.sql)) — não
consulta permissão.

Quando essas tabelas forem migradas para o molde de ouro, qual permissão
elas devem checar?

- **Opção A:** policies separadas para Vendas e BI — Vendas vê linha se
  `check_permission(uid,'vendas','view')`; BI vê linha se
  `check_permission(uid,'bi','view') OR check_permission(uid,'vendas','view')`.
  Mesma tabela, duas portas.
- **Opção B:** uma só permissão `ploomes.view` que cobre os dois módulos.
  Mais simples, mas mistura conceitos.
- **Opção C:** manter RLS atual (só unidade) e travar nas RPCs de cada
  módulo separadamente.

**❓ Qual opção é a desejada?**

### Q2 — `check_permission` ignora `unit_id`

**Contexto:** a tabela `user_permissions` tem coluna `unit_id` e a UNIQUE
inclui ela — sugere que permissão por unidade é suportada. **Mas a função
`check_permission(uid, module, action)` não recebe `unit_id` e ignora a
coluna no SELECT** ([migration 076](supabase/migrations/076_fix_check_permission_module_codes.sql#L43-L47)).
A UI `/admin/usuarios/[id]/permissoes` só grava `unit_id=null` (global).

Permissão por unidade existe na estrutura mas não funciona em runtime.

- **Opção A:** **assumir que permissão por unidade NÃO é necessária.**
  Dropar coluna `unit_id` de `user_permissions` (UNIQUE volta a ser
  `user_id, module, action`). Simplifica modelo. Funcionalidade
  multi-unidade fica 100% via `user_units` + `get_user_unit_ids()`.
- **Opção B:** **fazer permissão por unidade funcionar.** Reescrever
  `check_permission` para receber `unit_id` opcional, mudar UI de admin
  para permitir override por unidade, ajustar todas as RLS que chamam
  `check_permission`. Trabalho substantivo.
- **Opção C:** **manter como está** (ambíguo). Coluna existe, UI ignora,
  função ignora. Risco de alguém escrever na coluna achando que vai ter
  efeito.

**❓ Qual opção é a desejada?**

### Q3 — Cargo continua como conceito ao lado do catálogo configurável?

**Contexto:** hoje `hasRole` aparece em ~30 arquivos de UI controlando
visibilidade de botões/abas/campos. `requireRoleServer` em ~22 layouts
controla roteamento. `role IN (...)` inline em RLS e RPC controla
servidor.

- **Opção A:** cargo permanece como **atalho para "permissão padrão do
  cargo"**. `hasRole(profile.role, EVENTOS_ACCESS_ROLES)` continua
  válido em UI; `requireRoleServer` continua em layouts; mas RLS e RPC
  só leem `check_permission`. Cargo é açúcar sintático para a UI; banco
  é fonte de verdade.
- **Opção B:** cargo é **deprecado nas decisões de visibilidade**.
  Substituir todo `hasRole` por `useUserPermissions` na UI. `requireRoleServer`
  vira `requirePermissionServer(modulo, acao)`. Trabalho grande de
  rewrite, mas remove a duplicidade conceitual completamente.
- **Opção C:** **caminho intermediário** — manter `requireRoleServer`
  (roteamento) e `hasRole` apenas para checks de cargo "semânticos"
  (ex.: `isVendedora` para vincular `seller_id`), e substituir todo
  `hasRole` que controla visibilidade de feature por leitura de permissão.

**❓ Qual opção é a desejada?**

### Q4 — Default de novos controles finos: ON ou OFF?

**Contexto:** quando uma migration adiciona um controle fino novo
(ex.: `eventos.valor_festa_ver`), o que acontece com os usuários
existentes que ainda não foram seedados explicitamente?

- **Opção A (default OFF):** `granted=false` é o default da coluna.
  Controle novo aparece como **negado** para todos os cargos não
  explicitamente seedados. Mais seguro; risco de quebrar feature até
  alguém rodar o "Aplicar a todos" em cada cargo.
- **Opção B (default ON para cargos que tinham acesso ao módulo):**
  na mesma migration que cria o controle, popular `role_permissions`
  como `granted=true` para todos os cargos que já têm `<modulo>.view`.
  Menos seguro (presume que controle fino é restrição, não nova feature)
  mas evita quebra silenciosa.

**Recomendação técnica:** **A com seed obrigatório no mesmo PR.** O
checklist do Item 4 já força isso. **❓ Aprovado?**

### Q5 — `super_admin` continua com bypass em `check_permission`?

**Contexto:** [migração 076](supabase/migrations/076_fix_check_permission_module_codes.sql#L23-L27)
faz early-return `TRUE` quando `users.role = 'super_admin'` antes de
consultar `user_permissions`. Útil contra gaps de seed (nunca trava
o super_admin); ruim para auditoria (auditor não consegue testar
"sem permissão X").

- **Opção A:** manter bypass. super_admin segue como "conta de TI" sem
  refletir o catálogo. Status quo.
- **Opção B:** remover bypass. super_admin precisa do seed completo em
  `role_permissions` (já existe via CROSS JOIN em 071). Toda permissão
  fica auditável.

**Recomendação técnica:** **A**, simplicidade > pureza, mas vale
explicitar a decisão. **❓ Aprovado?**

### Q6 — `hasRole` e `requireRoleServer` desaparecem ou ficam como atalho?

Esta é a versão consolidada de Q3 com escopo mais estreito:

- Se **Q3=A**: `hasRole` e `requireRoleServer` ficam, mas RLS/RPC só
  leem `check_permission`. Status quo de UI + alvo de servidor.
- Se **Q3=B**: tudo morre. Trabalho grande de rewrite.
- Se **Q3=C**: `requireRoleServer` fica para roteamento; `hasRole`
  morre em chamadas de visibilidade mas sobrevive em checks
  semânticos (`isVendedora`, `isManager`).

**❓ A resposta de Q3 já fecha esta — repetida só para checagem.**

---

## Apêndice — Referências cruzadas no código

- `src/config/roles.ts` — 27 constantes, padrão canônico `as const satisfies readonly Role[]`.
- `src/types/permissions.ts` — Type literals `Role`, `Module`, `Action`.
- `src/lib/auth/require-role.ts` — `requireRoleServer`, `requireRoleApi`.
- `src/lib/rbac/apply-template.ts` — `applyRoleTemplate(supabase, userId, role, unitId)`.
- `src/hooks/use-permissions.ts` — `useUserPermissions`, `useUpdatePermission`, `useRoleTemplateDiff`, `useApplyRoleTemplate`.
- `src/hooks/use-rbac-catalogs.ts` — `useModules`, `useRoles`, `useRolePermissions`, `useUpdateRolePermission`, `useApplyTemplateToAllUsers`.
- `src/app/(auth)/admin/cargos/[code]/page.tsx` — Matrix de template do cargo.
- `src/app/(auth)/admin/usuarios/[id]/permissoes/page.tsx` — Matrix de override individual.
- `scripts/check-rbac-drift.ts` — Guard-rail atual; será estendido conforme Item 5.
- `supabase/migrations/071_rbac_catalogs.sql` — Tabelas `modules`, `roles`, `role_permissions` + seed.
- `supabase/migrations/077_rls_policies_module_codes_pt_br.sql` — 49 policies em PT-BR; molde de ouro de eventos linha 240-260.
- `supabase/migrations/076_fix_check_permission_module_codes.sql` — Função `check_permission` atual (3 args).
- `supabase/migrations/094_maintenance_rls_alignment.sql` — Caso mais recente de migração de módulo cargo-puro para o molde de ouro.

📚 Skills consultadas: cachola-rbac-pattern (`SKILL.md`, `references/roles-ts-annotated.md`), cachola-supabase-ops (`references/rbac-reference.md`), cachola-stack (`SKILL.md`).
