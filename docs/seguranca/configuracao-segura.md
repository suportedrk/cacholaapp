# Configuração Segura & Hardening — A02, A03, A08, A09, A10

Reúne os riscos de **configuração e operação**: o erro silencioso que abre o banco sem ninguém perceber. Security Misconfiguration subiu para **#2 no OWASP 2025** justamente por isso.

## A02:2025 — Security Misconfiguration

### Segredos e chaves (o erro mais caro)
- 🔴 **`SUPABASE_SERVICE_ROLE_KEY` no cliente.** A `service_role` **ignora RLS** e dá acesso total ao banco. Regras:
  - Só no servidor (Server Components, Route Handlers, Server Actions).
  - Em variável **sem** prefixo `NEXT_PUBLIC_`. Tudo com `NEXT_PUBLIC_` é embutido no bundle do navegador e visível para qualquer um.
  - Se já vazou para o cliente alguma vez → 🔴 **rotacione imediatamente** no painel do Supabase.
- ✅ **`anon` key é pública e ok no cliente** — desde que RLS esteja ligado em todas as tabelas. Sem RLS, a `anon` key abre a tabela inteira.
- 🔴 **Segredo no repositório.** Chave/token/senha hardcoded ou em `.env` versionado. Use `.gitignore`, secrets do provedor (Vercel/Hostinger/etc.), e **rotacione qualquer segredo que entrou no histórico do git** — apagar o arquivo não basta, o histórico guarda.

```bash
# .env.local (NUNCA versionar)
NEXT_PUBLIC_SUPABASE_URL=...          # público, ok
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # público, ok (com RLS ligado)
SUPABASE_SERVICE_ROLE_KEY=...         # 🔴 servidor only, sem NEXT_PUBLIC_
```

### Headers de segurança HTTP
Configure no `next.config.js` (ou no proxy/Nginx):
- **`Strict-Transport-Security`** (HSTS) — força HTTPS.
- **`Content-Security-Policy`** (CSP) — limita origem de scripts, mata boa parte de XSS.
- **`X-Content-Type-Options: nosniff`** — impede o navegador de "adivinhar" tipo de conteúdo.
- **`X-Frame-Options: DENY`** (ou CSP `frame-ancestors`) — anti-clickjacking.
- **`Referrer-Policy: strict-origin-when-cross-origin`**.

### CORS
- 🔴 **`Access-Control-Allow-Origin: *`** numa API autenticada = qualquer site chama sua API. Restrinja às origens conhecidas.
- Não reflita o header `Origin` de volta sem validar contra uma allowlist.

### Outros pontos de misconfiguration
- Painel/rota de admin acessível na rede sem proteção (caso do Webmin na porta 10000 — restrinja por firewall/IP).
- Bucket de Storage público sem policy (qualquer um lista/baixa). Configure RLS de Storage.
- Modo debug/verbose ligado em produção.
- Portas e serviços expostos além do necessário (princípio de superfície mínima).

## A03:2025 — Software Supply Chain Failures (nova)

Risco em dependências, build e CI/CD. Pacote npm comprometido com código que coleta dados é vetor real.
- ✅ **Auditoria de dependências:** `npm audit`, e ferramentas de SCA (Software Composition Analysis) no CI.
- ✅ **Fixe versões** (`package-lock.json` commitado) — evita pegar versão maliciosa nova automaticamente.
- 🟡 **Cuidado com dependency confusion** — pacote interno com nome que pode ser "sequestrado" por um público.
- 🟡 **Revise dependências novas** antes de adicionar — quantos downloads, manutenção ativa, é mesmo necessária?
- ✅ **Verifique integridade** de artefatos/atualizações (assinatura, checksum) quando aplicável (relaciona com A08).

## A08:2025 — Software/Data Integrity Failures
- Update sem assinatura, deserialização de dado não confiável, plugin não verificado.
- ✅ Não desserialize dado não confiável; use formatos/serializers seguros.
- ✅ Valide integridade de payloads de webhook (assinatura HMAC do remetente).

## A09:2025 — Security Logging & Alerting Failures
Log sem alerta = ataque passa despercebido e a forense fica cega.
- ✅ **Logue eventos de segurança:** login (sucesso/falha), mudança de senha/e-mail, escalada de privilégio, acesso negado, uso de impersonate.
- ✅ **Alerta** em padrões suspeitos (pico de falhas de login, acesso negado em massa = possível enumeração/IDOR sendo testado).
- 🔴 **Nunca logue** senha, token, dado sensível em claro. Log também é dado a proteger.
- 🟡 Centralize logs e proteja-os contra alteração (atacante apaga rastro).
- A parte de **retenção legal** de logs (Marco Civil art. 13/15, LGPD) está na skill `lgpd-marco-civil-br`.

## A10:2025 — Mishandling of Exceptional Conditions (nova)
App que falha de forma insegura.
- 🔴 **Stack trace / erro detalhado para o cliente** em produção entrega estrutura do banco, caminhos, versões. Logue o detalhe internamente, devolva mensagem genérica.
- 🔴 **Lógica "fail open":** se a checagem de permissão der erro, o padrão tem que ser **negar** (fail closed), nunca liberar.
```ts
// 🔴 fail open — erro na checagem libera acesso
let autorizado = true
try { autorizado = await checarPermissao(user) } catch {}  // se falhar, fica true!

// ✅ fail closed — erro nega
let autorizado = false
try { autorizado = await checarPermissao(user) } catch { autorizado = false }
```
- ✅ Trate timeouts, recursos esgotados e entradas inesperadas de forma previsível.

## Hardening específico Next.js + Supabase — resumo

| Camada | Controle |
|--------|----------|
| **Segredos** | `service_role` só no servidor, sem `NEXT_PUBLIC_`; `.env` no `.gitignore`; rotacionar vazados |
| **Banco** | RLS ligado em toda tabela; conta de menor privilégio; policies testadas |
| **Auth** | Supabase Auth + MFA; cookies HttpOnly/Secure/SameSite |
| **Headers** | HSTS, CSP, nosniff, X-Frame-Options no `next.config.js` |
| **CORS** | allowlist de origens, nunca `*` em API autenticada |
| **Camada de execução** | autorização na Server Action/Route Handler, não só middleware |
| **Dependências** | `npm audit` no CI, lockfile commitado, revisar pacotes novos |
| **Erros** | mensagem genérica ao cliente, detalhe no log interno, fail closed |
| **Storage** | policies de bucket, nada público por padrão |
| **Logs** | eventos de segurança logados, sem segredo, com alerta |

## Checklist de configuração

- [ ] `service_role` fora do cliente e sem `NEXT_PUBLIC_`?
- [ ] Nenhum segredo no git (nem no histórico)?
- [ ] RLS ligado em todas as tabelas?
- [ ] Headers de segurança configurados (HSTS, CSP, etc.)?
- [ ] CORS restrito a origens conhecidas?
- [ ] `npm audit` limpo / dependências auditadas no CI?
- [ ] Erro em produção devolve mensagem genérica (sem stack trace)?
- [ ] Lógica de permissão é fail closed?
- [ ] Eventos de segurança logados e alertados?
- [ ] Buckets de Storage com policy (nada aberto sem querer)?
