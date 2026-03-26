# Matriz de Permissões — Cachola OS

> Documento gerado para referência. Fonte de verdade: tabela `role_default_perms` no banco.

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Permissão concedida por padrão |
| ❌ | Permissão negada por padrão |
| 🔧 | Pode ser sobrescrita pelo admin por usuário |

---

## Módulos × Ações × Roles

### events (Eventos)

| Role | view | create | edit | delete | export |
|------|------|--------|------|--------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| diretor | ✅ | ❌ | ❌ | ❌ | ✅ |
| gerente | ✅ | ✅ | ✅ | ❌ | ✅ |
| vendedora | ✅ | ✅ | ✅ | ❌ | ❌ |
| decoracao | ✅ | ❌ | ❌ | ❌ | ❌ |
| manutencao | ❌ | ❌ | ❌ | ❌ | ❌ |
| financeiro | ✅ | ❌ | ❌ | ❌ | ✅ |
| rh | ✅ | ❌ | ❌ | ❌ | ❌ |
| freelancer | ✅ | ❌ | ❌ | ❌ | ❌ |
| entregador | ✅ | ❌ | ❌ | ❌ | ❌ |

> Nota: Para freelancer e entregador, "view" é restrito ao RLS — só veem eventos aos quais foram escalados.

---

### maintenance (Manutenção)

| Role | view | create | edit | delete | export |
|------|------|--------|------|--------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| diretor | ✅ | ❌ | ❌ | ❌ | ✅ |
| gerente | ✅ | ✅ | ✅ | ❌ | ❌ |
| vendedora | ❌ | ❌ | ❌ | ❌ | ❌ |
| decoracao | ❌ | ❌ | ❌ | ❌ | ❌ |
| manutencao | ✅ | ✅ | ✅ | ❌ | ❌ |
| financeiro | ❌ | ❌ | ❌ | ❌ | ❌ |
| rh | ❌ | ❌ | ❌ | ❌ | ❌ |
| freelancer | ❌ | ❌ | ❌ | ❌ | ❌ |
| entregador | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### checklists

| Role | view | create | edit | delete | export |
|------|------|--------|------|--------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| diretor | ✅ | ❌ | ❌ | ❌ | ❌ |
| gerente | ✅ | ✅ | ✅ | ❌ | ❌ |
| vendedora | ✅ | ❌ | ✅ | ❌ | ❌ |
| decoracao | ✅ | ❌ | ✅ | ❌ | ❌ |
| manutencao | ✅ | ❌ | ✅ | ❌ | ❌ |
| financeiro | ❌ | ❌ | ❌ | ❌ | ❌ |
| rh | ❌ | ❌ | ❌ | ❌ | ❌ |
| freelancer | ✅ | ❌ | ✅ | ❌ | ❌ |
| entregador | ✅ | ❌ | ✅ | ❌ | ❌ |

---

### users (Usuários)

| Role | view | create | edit | delete | export |
|------|------|--------|------|--------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| diretor | ✅ | ❌ | ❌ | ❌ | ❌ |
| gerente | ✅ | ❌ | ❌ | ❌ | ❌ |
| vendedora | ❌ | ❌ | ❌ | ❌ | ❌ |
| decoracao | ❌ | ❌ | ❌ | ❌ | ❌ |
| manutencao | ❌ | ❌ | ❌ | ❌ | ❌ |
| financeiro | ❌ | ❌ | ❌ | ❌ | ❌ |
| rh | ✅ | ✅ | ✅ | ❌ | ❌ |
| freelancer | ❌ | ❌ | ❌ | ❌ | ❌ |
| entregador | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### reports (Relatórios)

| Role | view | export |
|------|------|--------|
| super_admin | ✅ | ✅ |
| diretor | ✅ | ✅ |
| gerente | ✅ | ❌ |
| financeiro | ✅ | ✅ |
| outros | ❌ | ❌ |

---

### audit_logs

| Role | view | export |
|------|------|--------|
| super_admin | ✅ | ✅ |
| diretor | ✅ | ❌ |
| outros | ❌ | ❌ |

---

### settings (Configurações do sistema)

| Role | view | create | edit | delete |
|------|------|--------|------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ |
| outros | ❌ | ❌ | ❌ | ❌ |

---

## Como funciona o modelo de permissões

1. **Ao criar usuário** → sistema copia `role_default_perms` para `user_permissions` do usuário
2. **Admin pode sobrescrever** qualquer permissão individualmente na tela de permissões
3. **Middleware** verifica `user_permissions` (não o role) em toda requisição
4. **super_admin** sempre tem acesso total (bypass via `check_permission()`)
5. **RLS no banco** usa `check_permission(auth.uid(), module, action)` para filtrar dados

## Criando usuário super_admin (primeira vez)

```bash
# Via Supabase Studio (http://localhost:3001)
# Authentication > Users > Invite user
# Email: admin@cacholaos.com.br
# Metadata: {"role": "super_admin", "name": "Bruno Admin"}

# OU via psql direto:
# 1. Crie o usuário pelo endpoint /auth/v1/signup
# 2. UPDATE public.users SET role = 'super_admin' WHERE email = 'admin@cacholaos.com.br';
# 3. SELECT reload_user_permissions(id) FROM public.users WHERE email = 'admin@cacholaos.com.br';
```
