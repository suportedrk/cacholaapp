# Proposta — MFA + rate limit no login (OWASP A07)

> **Status:** proposta (sem código). Item do bloco Segurança/LGPD do `docs/DIVIDAS_TECNICAS.md`.
> Decisão do Bruno (26/06/2026): adiar a implementação; entregar primeiro esta análise. MFA vira sessão dedicada.
> Contexto que eleva a prioridade: Cachola OS trata PII de **menores** (LGPD). Hoje a autenticação tem
> apenas o rate limit padrão do GoTrue, sem MFA e sem rate limit por IP/dispositivo.

---

## 1. Rate limit por IP na rota de auth (ganho rápido, infra-only)

**Problema:** o GoTrue tem um rate limit interno por e-mail/token, mas não há limite por **IP** na borda. Um atacante pode tentar credential stuffing / brute force distribuído contra `/auth/v1/token` via Kong.

**Opção A — Nginx `limit_req` (recomendada, menor esforço):**
- Na VPS de produção, o Nginx já faz proxy para o Kong (Supabase). Adicionar uma `limit_req_zone` e aplicar `limit_req` **apenas** na rota de auth do Kong (`/auth/v1/token`, `/auth/v1/signup`, `/auth/v1/recover`).
- Exemplo (a validar com o `nginx.conf` real — ver skill `cachola-vps-ops` / `cachola-supabase-ops`):
  ```nginx
  # http {}
  limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

  # location da rota de auth (dentro do server do api.cachola.cloud)
  location /auth/v1/token {
      limit_req zone=auth_limit burst=20 nodelay;
      proxy_pass http://kong_upstream;
      # ...headers existentes...
  }
  ```
- **Trade-offs:** `rate`/`burst` precisam de tuning para não bloquear uso legítimo (PWA reabrindo sessão, vários funcionários atrás do mesmo IP NAT do buffet). Começar generoso (ex.: 10r/m, burst 20) e observar. Retornar 429 (o app já classifica `over_request_rate_limit` → mensagem "Muitas tentativas").
- **Esforço:** baixo (config de infra, handoff para o Bruno aplicar na VPS; sem deploy de código). **Reversível** (remover o `location`/`limit_req`).
- **Cuidado:** aplicar **só** nas rotas de auth — `limit_req` global quebraria a API toda. Snapshot Hostinger antes (regra de ouro vps-ops).

**Opção B — CAPTCHA adaptativo (hCaptcha/Turnstile):** o GoTrue suporta `GOTRUE_SECURITY_CAPTCHA_ENABLED` + provider. Mais fricção de UX e exige mudança no front (widget no login). Deixar para depois do rate limit por IP, se necessário.

**Recomendação:** começar pela **Opção A** (Nginx `limit_req`), que é barata, reversível e cobre o vetor principal. Pode ser feita isolada, antes do MFA.

---

## 2. MFA (TOTP) — decisão arquitetural

**Escopo recomendado (fase 1):** MFA **TOTP obrigatório** apenas para os cargos de maior privilégio — `super_admin` e `diretor` (acesso a BI, gestão de usuários/cargos, dados financeiros). Os demais cargos ficam fora nesta fase (menor fricção; reavaliar depois).

**Mecânica no stack atual (Supabase self-hosted GoTrue + @supabase/ssr):**
- GoTrue suporta MFA TOTP nativo: `supabase.auth.mfa.enroll()` (gera secret + QR), `challenge()` + `verify()` no login, e `getAuthenticatorAssuranceLevel()` (AAL1 vs AAL2).
- **Enrollment UI:** nova tela (ex.: `/perfil/seguranca`) onde o usuário escaneia o QR (app autenticador) e confirma um código. Guardar o `factorId`.
- **Gate no login:** após senha (AAL1), se o usuário tem fator TOTP e a sessão ainda é AAL1, exigir o desafio TOTP antes de liberar (AAL2). O `proxy.ts`/`AppReadyGate` precisa checar o AAL para cargos obrigatórios e redirecionar para a tela de desafio se faltar.
- **Enforcement por cargo:** para `super_admin`/`diretor` sem fator inscrito, forçar o enrollment no primeiro login (tela bloqueante "Configure o MFA para continuar").
- **Config GoTrue:** habilitar MFA no `docker-compose`/env do GoTrue (`GOTRUE_MFA_*`), `--force-recreate` para reler env (ver `cachola-supabase-ops`).

**Trade-offs / riscos:**
- **Recuperação:** usuário que perde o autenticador precisa de um caminho de reset (super_admin reseta o fator de outro via admin API; recovery codes). Definir antes de tornar obrigatório, senão trava o acesso.
- **Regressão de auth:** mexe no caminho crítico de login (o mesmo que já teve o gotcha do `storageKey` e o redirect loop). Exige validação visual cuidadosa em prod (janela anônima) por cargo.
- **PWA:** o desafio TOTP precisa funcionar offline-first/instalado.
- **Esforço:** médio-alto (tela de enrollment + tela de desafio + gate de AAL no proxy + config GoTrue + fluxo de recovery). É uma frente própria, não um fix de uma linha — daí o adiamento.

**Recomendação:** implementar em sessão dedicada, **depois** do rate limit por IP. Sequência sugerida:
1. Rate limit Nginx (infra, rápido) — fecha o vetor de brute force imediatamente.
2. MFA TOTP opt-in (enrollment + desafio) para todos.
3. Tornar **obrigatório** para `super_admin`/`diretor` com fluxo de recovery testado.

---

## 3. Itens correlatos (já no DIVIDAS, fora desta proposta)
- **Enumeração de e-mail no login (A07):** resolvido na frente atual (PR1 — colapsou "e-mail não confirmado" na mensagem genérica).
- **Anti self-escalation de cargo (A01):** resolvido na frente atual (PR5 — trigger na `public.users`).

---

_Documento de planejamento; nenhuma mudança de código associada. Atualizar quando a implementação começar._
