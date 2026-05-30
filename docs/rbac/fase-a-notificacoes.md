# FASE A — Levantamento Notificações (RBAC Fase 3)

**Data:** 2026-05-30
**Branch:** develop
**Objetivo:** Confirmar ou refutar a hipótese de que o módulo `notificacoes` é DECORATIVO por
design (sub-caso PROPRIETÁRIO da Skill, Aprendizado 6) e encerrar sem FASE B.

---

## 1. Rota dedicada

**`src/app/(auth)/notificacoes/` → NÃO EXISTE.**

A UI de notificações vive exclusivamente em:

- **Componente:** `src/components/layout/notification-bell.tsx` — sininho no header (slide-over)
- **Hook:** `src/hooks/use-notifications.ts` — busca, realtime, markRead, markAllRead, delete
- **Montagem no navbar:** `src/components/layout/navbar.tsx:141-143`

```tsx
{clientReady && (
  <span data-tour="notifications">
    <NotificationBell />  {/* sem guard de cargo */}
  </span>
)}
```

`NotificationBell` é montado condicionalmente apenas em `clientReady` (hidratação SSR),
**sem nenhuma condicional de cargo** (`hasRole`, `role IN`, `requireRoleServer` ou similar).
Varredura completa do arquivo confirma: as únicas ocorrências de `role=` são atributos
HTML WAI-ARIA (`role="button"`, `role="dialog"`).

---

## 2. Tabela e RLS

**Tabela:** `public.notifications`

Schema (migration 001):
```sql
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ...
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);
```

Sem coluna `unit_id`. Sem coluna relacionada a cargo.

**Políticas RLS ativas** (migration 002 + supersedida por migration 008):

| Policy | Op | USING / WITH CHECK |
|--------|----|--------------------|
| `notifications_select_own` | SELECT | `auth_user_id() = user_id` |
| `notifications_update_own` | UPDATE | `auth_user_id() = user_id` (USING + WITH CHECK) |
| `notifications_delete_own` | DELETE | `auth_user_id() = user_id` |
| `"notifications: service insert"` (002) | INSERT | `WITH CHECK (TRUE)` — service_role para inserção pelo backend |

**Padrão:** 100% owner-scoped (`user_id = auth.uid()`). Sem `check_permission`, sem
`unit_id`, sem `role IN`. RLS é o cadeado; é a identidade do dono, não a permissão de módulo.

---

## 3. RPCs e APIs de notificação

### Funções SQL

| Função | Segurança | Guard de cargo |
|--------|-----------|----------------|
| `create_notification(p_user_id, p_type, p_title, p_body, p_link)` | SECURITY DEFINER | Nenhum — chamada pelo backend (service_role ou autenticado via GRANT EXECUTE TO authenticated) |
| `mark_all_notifications_read(p_user_id UUID)` | SECURITY DEFINER | Nenhum — UPDATE WHERE `user_id = p_user_id`; chamador passa seu próprio `userId` do hook |
| `cleanup_old_notifications(p_days)` | (a confirmar) | Nenhum — chamado pelo cron via service_role |

**Nenhuma função SQL de notificação tem guard de cargo** (`role IN`, `check_permission`, `check_permission_or_raise`).

### API routes que criam notificações

Todas as chamadas a `create_notification` e às helpers de `src/lib/notifications.ts`
ocorrem a partir de:

| Superfície | Guard | Padrão de entrega |
|------------|-------|-------------------|
| `POST /api/cron/check-alerts` | `CRON_SECRET` no header Authorization (não é cargo) | Entrega para `assigned_to` / staff do evento — owner-scoped na recepção |
| `POST /api/cron/check-provider-alerts` | `CRON_SECRET` | Idem |
| Hooks de mutation (client-side via `src/lib/notifications.ts`) | Autenticado; sem guard de cargo | Entrega para `user_id` passado explicitamente |

**Resposta à pergunta central:** nenhuma superfície de notificação tem trava **POR CARGO**
que seja candidata a conversão para `check_permission`. Há guards de **identidade** (quem
lê/atualiza é o dono da linha) e de **secret de cron** (quem cria via cron está autenticado
via CRON_SECRET), mas nenhum `role IN` que precisaria ser substituído por `check_permission_or_raise`.

---

## 4. Catálogo — estado de `notificacoes`

### `modules` (migration 071)
```sql
('notificacoes', 'Notificações', 'Notificações in-app geradas pelo sistema', 'Bell', 180, true)
```
Módulo presente, `is_active = true`.

### `role_permissions` (migration 071)
Todos os 10 cargos (exceto `super_admin`, que bypassa) recebem `(notificacoes, view, true)`:

```
diretor, gerente, financeiro, manutencao, vendedora, pos_vendas,
decoracao, rh, freelancer, entregador
```

Nenhuma ação além de `view` está no template.

### `permission_controls` (migration 107 — CROSS JOIN sobre `modules`)
As 5 ações canônicas existem para `notificacoes`:
`view, create, edit, delete, export` — geradas automaticamente pelo CROSS JOIN.
**Porém, nada no codebase consulta `check_permission(uid, 'notificacoes', *)` em runtime.**
As linhas em `permission_controls` existem apenas para completude do catálogo.

### `user_permissions`
Populado pelo `apply-template` quando usuários são convidados ou têm cargo alterado.
Linha `(user_id, null, 'notificacoes', 'view', true)` provavelmente existe para a maioria
dos usuários ativos. Mas como nenhum guard a consulta, essas linhas são decorativas.

---

## 5. Conclusão — CASO (A): NADA A CONVERTER

**Evidência:**

1. **Sem rota dedicada.** Não existe `src/app/(auth)/notificacoes/`, portanto não há
   `layout.tsx` para converter — o ponto de entrada é o `NotificationBell` no navbar.

2. **NotificationBell é universal.** Montado no navbar sem condicional de cargo.
   Qualquer usuário autenticado vê o sininho e recebe notificações. Isso é comportamento
   correto por design: um freelancer designado a uma tarefa deve ver a notificação de
   "tarefa atribuída" tanto quanto um diretor.

3. **RLS é owner-pattern puro.** Todas as policies usam `user_id = auth.uid()`.
   O controle de quem vê o quê é: *você vê apenas as suas notificações*. Não existe
   conceito de "cargo que tem acesso ao módulo" — o módulo é sua caixa de entrada pessoal.

4. **Funções SQL sem guard de cargo.** `create_notification` e `mark_all_notifications_read`
   são SECURITY DEFINER sem `role IN` ou `check_permission`. Nenhuma candidata a conversão.

5. **toggle `notificacoes.view` em `/admin/cargos` não afeta nada em runtime.**
   O grant existe em `user_permissions` e `role_permissions`, mas nenhuma lógica de
   runtime o consulta. É decorativo por design.

**Classificação:** sub-caso PROPRIETÁRIO (Aprendizado 6 da Skill `cachola-rbac-pattern`).

---

## 6. Recomendação — documentar o caráter decorativo; não converter

### Por que NÃO converter

Tentar converter `notificacoes` para `check_permission` quebraria o sininho para qualquer
usuário cujo `view` não estivesse em `user_permissions`. Como notificações são mensagens
pessoais (tarefas atribuídas, ordens de manutenção, etc.), **remover o acesso não protege
dado sensível — apenas silencia o usuário**. Seria regressão de UX sem ganho de segurança.

### Ação recomendada: hardening de documentação

**No `/admin/cargos`:** o toggle `notificacoes | view` deve aparecer como **desabilitado**
ou marcado com nota "Módulo de sistema — acesso universal, não configurável".
(Fica para o backlog de UX do `/admin/cargos` — sem urgência.)

**Na skill `cachola-rbac-pattern`:** o sub-caso PROPRIETÁRIO já está documentado no
Aprendizado 6. A menção explícita de `notificacoes` como exemplo canônico é suficiente.

**No handoff `proposta-arquitetura-alvo.md`:** atualizar "Onde estamos" para v1.32.0
(Dashboard + Relatórios completos) e registrar Notificações como **Encerrado sem FASE B**
com a justificativa do sub-caso PROPRIETÁRIO.

---

## Gates para o dono

| Gate | Decisão requerida |
|------|-------------------|
| Encerrar sem FASE B? | ✅ Recomendado — evidência clara de sub-caso PROPRIETÁRIO |
| Desabilitar toggle na UI de cargos? | Opcional — backlog de UX, sem urgência |
| Alguma superfície com guard de cargo? | ❌ Nenhuma encontrada |

---

## Resumo executivo

`notificacoes` é o módulo mais simples da Fase 3: sem rota, sem RLS por cargo, sem
função SQL com `role IN`. O sininho do navbar é universal e protegido apenas pela
identidade do dono (`user_id = auth.uid()`). O toggle `notificacoes.view` no catálogo
RBAC é decorativo por design. **FASE B não existe para este módulo — encerrado.**
