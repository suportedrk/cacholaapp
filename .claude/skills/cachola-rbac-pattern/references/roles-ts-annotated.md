# roles-ts-annotated — Constantes exportadas de src/config/roles.ts

> Arquivo gerado com base no estado real de `src/config/roles.ts` (27 constantes).
> Padrão canônico: `as const satisfies readonly Role[]`

## Tabela de constantes

| Constante | Roles incluídas | Rota / Contexto de uso |
|-----------|----------------|------------------------|
| `BI_ACCESS_ROLES` | super_admin, diretor | `/bi`, `/relatorios` — layout guard |
| `BI_ATENDIMENTO_ROLES` | super_admin, diretor | Aba "Atendimento (Deals)" em `/bi` |
| `BI_VENDAS_ROLES` | super_admin, diretor, gerente, financeiro | Aba "Vendas Realizadas (Orders)" em `/bi` |
| `SELLERS_MANAGE_ROLES` | super_admin, diretor | `/configuracoes/vendedoras` — layout guard + API |
| `VENDEDORA_ROLES` | vendedora | Checks de vinculação `seller_id` em `/admin/usuarios/novo` |
| `VENDAS_MODULE_ROLES` | super_admin, diretor, vendedora, pos_vendas | `/vendas` — layout guard + RPCs de vendas |
| `VENDAS_MANAGE_ROLES` | super_admin, diretor, gerente | `SellerSelector` em `/vendas` (vê dados de todas as vendedoras) |
| `COMMERCIAL_CHECKLIST_MANAGE_ROLES` | super_admin, diretor | `/vendas/checklist/equipe`, `/templates`, `/automacoes` |
| `COMMERCIAL_CHECKLIST_ACCESS_ROLES` | super_admin, diretor, vendedora, pos_vendas | `/vendas/checklist` — layout guard |
| `COMMERCIAL_CHECKLIST_ARCHIVE_ROLES` | super_admin, diretor | Arquivar/reativar templates do checklist comercial |
| `GLOBAL_VIEWER_ROLES` | super_admin, diretor, pos_vendas | `UnitSwitcher` (`activeUnitId = null`) + `is_global_viewer()` SQL |
| `ADMIN_ACCESS_ROLES` | super_admin, diretor | `/admin/**` — layout guard pai |
| `ADMIN_USERS_MANAGE_ROLES` | super_admin, diretor | `/admin/usuarios` — layout guard + API |
| `ADMIN_UNITS_MANAGE_ROLES` | super_admin, diretor | `/admin/unidades` — layout guard |
| `ADMIN_LOGS_VIEW_ROLES` | super_admin, diretor | `/admin/logs` — layout guard |
| `BACKUP_VIEW_ROLES` | super_admin, diretor | `/admin/backups` — layout guard |
| `MAINTENANCE_MODULE_ROLES` | super_admin, diretor, gerente, manutencao | `/manutencao`, `/equipamentos` — layout guards |
| `MAINTENANCE_ADMIN_ROLES` | super_admin, diretor, gerente | `/manutencao/dashboard`, `/manutencao/configuracoes` |
| `PRESTADORES_ACCESS_ROLES` | super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao | `/prestadores` — layout guard |
| `OPERATIONAL_CHECKLIST_ROLES` | super_admin, diretor, gerente, decoracao, freelancer, entregador | `/checklists/**` — layout guard |
| `TEAM_TASKS_ROLES` | super_admin, diretor, gerente | "Tarefas da Equipe" no Checklist Operacional |
| `EVENTOS_ACCESS_ROLES` | super_admin, diretor, gerente, financeiro, vendedora, pos_vendas, decoracao, rh | `/eventos` — layout guard |
| `ATAS_ACCESS_ROLES` | super_admin, diretor, gerente, financeiro, vendedora, pos_vendas, decoracao, rh | `/atas` — layout guard |
| `ATAS_MANAGE_ROLES` | super_admin, diretor, gerente | `/atas/nova`, `/atas/[id]/editar` — gate client-side de criação/edição/exclusão |
| `DASHBOARD_ACCESS_ROLES` | super_admin, diretor, gerente, financeiro, manutencao, vendedora, pos_vendas, decoracao, rh | `/dashboard` — layout guard |
| `SETTINGS_ROLES` | super_admin, diretor | `/configuracoes` — layout guard |
| `TEMPLATE_MANAGE_ROLES` | super_admin | `/admin/cargos` — layout guard + API `role-permissions` |

## Helper hasRole

```typescript
export function hasRole<T extends readonly Role[]>(
  role: Role | null | undefined,
  allowed: T,
): role is T[number]
```

- Aceita `null` e `undefined` (retorna `false`) — sem guard manual `if (role)`
- Type predicate `role is T[number]` — TypeScript restringe o tipo após o `if`
- Importar de `@/config/roles`, não reimplementar local

## Notas de manutenção

- **Adicionar nova role ao sistema:** atualizar o tipo `Role` em `src/types/permissions.ts`
  e o tipo `UserRole` em `src/types/database.types.ts`; depois adicionar às constantes relevantes.
- **Criar nova constante:** adicionar em `roles.ts` com padrão `as const satisfies readonly Role[]`;
  não criar array local no arquivo de uso.
- **Constantes ainda fora de `roles.ts` (dívida técnica em aberto):** atas, manutenção/chamados, onboarding e
  cron routes ainda têm arrays inline — ver seção de dívida em `rbac-reference.md`.
