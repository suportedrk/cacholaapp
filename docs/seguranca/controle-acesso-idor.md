# Broken Access Control & IDOR — A01:2025

É o **nº 1 do OWASP** porque é comum, fácil de explorar e leva direto a dados de outros usuários. Acontece quando a aplicação não verifica corretamente se o usuário **pode** acessar/modificar um recurso.

## IDOR — Insecure Direct Object Reference

O caso mais frequente. O atacante manipula um identificador (na URL, parâmetro ou body) para acessar objeto que não é dele.

```
GET /api/pedido/1001   → meu pedido (ok)
GET /api/pedido/1002   → pedido de outro cliente (IDOR!)
```

A causa é sempre a mesma: **falta de checagem de dono**. A aplicação busca pelo ID mas não verifica se o recurso pertence a quem pediu. Leva a vazamento de dados, perda de privacidade, dano de reputação e multa de LGPD.

### 🔴 Vulnerável
```ts
// Route Handler — busca por ID sem checar dono
export async function GET(req, { params }) {
  const { data } = await supabaseAdmin   // 🔴 usa service_role, ignora RLS
    .from('pedidos')
    .select('*')
    .eq('id', params.id)
    .single()
  return Response.json(data)   // retorna pedido de qualquer um
}
```

### ✅ Corrigido
```ts
// Filtra pelo dono explicitamente (e idealmente confia na RLS)
export async function GET(req, { params }) {
  const supabase = createServerClient(...)   // ✅ client com sessão do usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', params.id)
    .eq('cliente_id', user.id)   // ✅ só retorna se for dono
    .single()

  if (!data) return new Response('Not found', { status: 404 })
  return Response.json(data)
}
```

> Devolva **404, não 403**, para recurso que não é do usuário. 403 confirma que o recurso existe — vaza informação. 404 não diz nada.

## Outras formas de Broken Access Control

- **Escalada de privilégio:** usuário comum acessa rota/ação de admin por falta de checagem de papel.
- **Manipulação de parâmetro de papel:** body com `{"role": "admin"}` aceito sem validação (mass assignment).
- **Force browsing:** acessar `/admin` direto porque a proteção estava só no menu (frontend).
- **SSRF** (agora dentro de A01): forçar o servidor a fazer requisições para alvos internos manipulando uma URL que ele consome.

## ⚠️ Autorização no middleware NÃO basta

O middleware do Next.js é conveniente para checagem de borda, mas **não pode ser a única camada**. Houve falha conhecida (CVE-2025-29927, divulgada em março/2025) em que um header forjado contornava o middleware do Next.js, pulando a checagem de autorização. Independente de versão específica:

> A checagem "esse usuário pode fazer isso?" tem que existir **também** na Server Action, no Route Handler e/ou na policy de RLS — onde a ação realmente acontece. Middleware é otimização de UX/redirecionamento, não fronteira de segurança.

Mantenha o Next.js atualizado, mas trate a autorização como responsabilidade da camada que executa a ação.

## RLS no Supabase — a defesa estrutural

Row Level Security (segurança em nível de linha) faz o **próprio banco** decidir quais linhas cada usuário vê. É a forma mais robusta de matar IDOR: mesmo que a aplicação esqueça a checagem, o banco recusa.

### Regra base
1. **Habilite RLS em toda tabela exposta à API.** Sem RLS + chave `anon` pública = tabela aberta para qualquer um.
```sql
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
```

2. **Crie policies explícitas por operação.** Sem policy, ninguém acessa (fail closed — bom).
```sql
-- Cada usuário só lê os próprios pedidos
CREATE POLICY "pedidos_select_proprio"
ON pedidos FOR SELECT
USING (auth.uid() = cliente_id);

-- Só insere pedido como ele mesmo
CREATE POLICY "pedidos_insert_proprio"
ON pedidos FOR INSERT
WITH CHECK (auth.uid() = cliente_id);

-- Só atualiza os próprios
CREATE POLICY "pedidos_update_proprio"
ON pedidos FOR UPDATE
USING (auth.uid() = cliente_id)
WITH CHECK (auth.uid() = cliente_id);
```

3. **`USING` vs `WITH CHECK`:** `USING` filtra o que pode ser **lido/afetado**; `WITH CHECK` valida o que pode ser **escrito**. Em UPDATE, use os dois para impedir que o usuário "transfira" o registro para outro dono.

### Multi-tenant / hierarquia de permissões
Para modelos como o do DRK OS (Módulo → Recurso → Permissão, vínculo por unidade), a RLS consulta a tabela de permissões:
```sql
-- Exemplo: acesso a um recurso depende de vínculo ativo na unidade
CREATE POLICY "recurso_por_vinculo"
ON documentos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuario_unidade uu
    WHERE uu.usuario_id = auth.uid()
      AND uu.unidade_id = documentos.unidade_id
      AND uu.ativo = true
  )
);
```
- Mantenha as policies **simples e auditáveis**. Lógica complexa em policy fica difícil de revisar — extraia para função `SECURITY DEFINER` bem testada se necessário (cuidado com SQLi dentro dela, ver `sql-injection.md`).
- **Teste cada policy** com usuários diferentes. RLS mal escrita dá falsa sensação de segurança.

### ⚠️ Impersonate / audit trail
Feature de impersonate (assumir identidade de outro usuário) é poderosa e perigosa. Garanta:
- Só papéis autorizados podem impersonar (checado no servidor + RLS).
- **Todo** acesso sob impersonate vai para o audit trail, com o operador real registrado.
- Para a parte legal (LGPD) do audit trail, ver skill `lgpd-marco-civil-br`.

## Checklist de controle de acesso

- [ ] RLS habilitado em **toda** tabela exposta?
- [ ] Policy explícita por operação (SELECT/INSERT/UPDATE/DELETE)?
- [ ] Toda busca por ID filtra pelo dono (ou confia em RLS testada)?
- [ ] Retorna 404 (não 403) para recurso de outro usuário?
- [ ] Checagem de papel/permissão na Server Action / Route Handler, não só no middleware?
- [ ] Next.js atualizado (correção do bypass de middleware)?
- [ ] Impersonate restrito + auditado integralmente?
- [ ] Sem mass assignment (campo `role`/`is_admin` não aceito direto do body)?
