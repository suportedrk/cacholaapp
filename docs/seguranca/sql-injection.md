# SQL Injection (SQLi) — A05:2025 Injection

## O que é

SQL Injection acontece quando entrada do usuário é inserida numa query SQL sem separação entre **código** e **dado**. O atacante injeta SQL que a aplicação executa como se fosse comando legítimo. Resultado: ler, modificar ou apagar dados do banco, burlar autenticação, e em casos graves executar comandos no sistema.

A regra de ouro existe desde os anos 1990 e nunca mudou: **separe código de dado**. Toda defesa abaixo é variação disso.

## Tipos principais

### Union-based — o roubo em massa
O atacante injeta um `UNION SELECT` que cola a query dele na sua, retornando dados de outras tabelas (senhas, dados de clientes, cartões). É o mais direto para exfiltrar dados em volume.

### Boolean-based blind (cega) — burlar login
Injeta condições que forçam a query a sempre dar verdadeiro, tipo `' OR '1'='1' --`. O `--` comenta o resto da query. Usado para entrar sem senha. Exemplo clássico em login mal feito:
```
SELECT * FROM users WHERE email = '[input]' AND password = '[input]'
```
Com input `' OR '1'='1' --` no email, a query vira sempre verdadeira e autentica sem senha.

### Time-based blind — extração às cegas
Quando não há retorno visível, o atacante usa funções de atraso (`pg_sleep()` no Postgres) para deduzir dados bit a bit pelo tempo de resposta. Lento, mas funciona.

## O que mudou: não é só o formulário de login

Em 2025, a injeção básica de 25 anos atrás **ainda funciona** em muitos sistemas em produção. Mas o vetor expandiu para além de formulários:

- **Cabeçalhos HTTP:** `User-Agent`, `Referer` gravados no banco sem sanitização. Um header tipo `Mozilla' OR '1'='1' --` já deu acesso total a banco em casos reais.
- **JSON / APIs:** WAFs frequentemente não pegam SQLi dentro de payload JSON.
- **Campos que viram log:** qualquer dado do usuário que é persistido (logs de auditoria, analytics) é superfície de SQLi se concatenado em query.

> Incidente real (2025): uma falha de SQLi no PostgreSQL (CVE-2025-1094) foi usada para invadir a plataforma da BeyondTrust, numa cadeia que chegou ao Departamento do Tesouro dos EUA. SQLi continua causando vazamentos de alto perfil.

## Blindagem em Postgres / Supabase

### ✅ Use o client do Supabase (parametrizado por padrão)
O `supabase-js` parametriza as queries automaticamente. Isto é seguro:
```ts
// ✅ SEGURO — input vai como parâmetro, nunca como SQL
const { data } = await supabase
  .from('contratos')
  .select('*')
  .eq('cliente_id', clienteId)   // clienteId é tratado como dado
```

### 🔴 Cuidado com `.rpc()` e SQL cru
Funções `SECURITY DEFINER` e SQL dinâmico dentro de funções Postgres são onde o SQLi volta. Nunca monte SQL com concatenação de string:
```sql
-- 🔴 VULNERÁVEL — concatenação de input em SQL dinâmico
CREATE FUNCTION busca_cliente(termo text) RETURNS SETOF clientes AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT * FROM clientes WHERE nome = ''' || termo || '''';
END;
$$ LANGUAGE plpgsql;
```
```sql
-- ✅ SEGURO — parâmetro via USING, ou format() com %L
CREATE FUNCTION busca_cliente(termo text) RETURNS SETOF clientes AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT * FROM clientes WHERE nome = $1' USING termo;
END;
$$ LANGUAGE plpgsql;
```
- Use `EXECUTE ... USING $1` para passar parâmetros.
- Se precisar interpolar identificadores, use `format()` com `%I` (identificador) e `%L` (literal), nunca `||`.

### ✅ Menor privilégio no banco
A conta que a aplicação usa não precisa ser superuser. No Supabase, a chave `anon` opera sob RLS e privilégios limitados — use ela no cliente. A `service_role` ignora tudo: só no servidor, nunca exposta (ver `configuracao-segura.md`).

### ✅ Validação de entrada (camada extra, não a principal)
Valide tipo e formato no servidor (ex.: `clienteId` é UUID? então rejeite qualquer coisa que não seja UUID). Isso reduz superfície, mas **não substitui** parametrização — é defesa em profundidade.

### 🟡 WAF como camada secundária
Web Application Firewall bloqueia padrões conhecidos de SQLi no edge. Útil, mas evadível (especialmente em JSON). Nunca confie só nele.

## Checklist rápido de SQLi

- [ ] Todas as queries via client do Supabase ou parametrizadas?
- [ ] Nenhum SQL montado com concatenação de string (`||`, template literal)?
- [ ] Funções `.rpc()` usam `USING $1` ou `format()` com `%I`/`%L`?
- [ ] Conta de banco da aplicação com menor privilégio (não superuser)?
- [ ] Entrada validada por tipo/formato no servidor (UUID, int, enum)?
- [ ] Headers HTTP e campos persistidos também tratados como entrada não confiável?

## Resumo da defesa
Queries parametrizadas em tudo + conta de banco com menor privilégio + RLS ligado + WAF como camada secundária. O ORM/client reduz o risco mas não elimina — as "saídas de emergência" para SQL cru continuam sendo o ponto fraco.
