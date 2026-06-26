# Proteção de login — abordagem de baixa fricção (OWASP A07)

> **Status:** proposta aprovada (sem código ainda). Item do bloco Segurança/LGPD do `docs/DIVIDAS_TECNICAS.md`.
> **Decisão do Bruno (26/06/2026):** a equipe é resistente a MFA; **não** será obrigatório. Diretores pediriam para
> remover se fosse imposto. Adotamos um caminho **faseado e de baixa fricção**: priorizar proteções *invisíveis*
> (que não exigem nada do usuário), oferecer MFA como *opcional*, e — se um dia quiserem mais — usar redutores de
> fricção (lembrar aparelho / código por e-mail) que praticamente eliminam a chatice do "código toda vez".
> Contexto: Cachola OS trata PII de **menores** (LGPD); hoje a autenticação tem só o rate limit padrão do GoTrue.

---

## A ideia em uma frase

Não brigar para impor MFA. Elevar a segurança **sem depender da adesão das pessoas** — e deixar o MFA disponível
para quem quiser, sem forçar ninguém.

---

## Camada 1 — Proteção invisível (não exige nada do usuário) — **prioridade**

São as que dão mais segurança por menos fricção. Ninguém precisa se cadastrar nem mudar a rotina.

### 1.1 Limite de tentativas de login (rate limit por IP)
**Problema:** o GoTrue limita por e-mail/token, mas não há limite por **IP** na borda → um atacante pode chutar
senhas em massa (brute force / credential stuffing) contra `/auth/v1/token`.

**Como (Nginx `limit_req`, infra-only):** a VPS de produção já faz proxy para o Kong (Supabase). Adicionar uma
zona e aplicar `limit_req` **só** nas rotas de auth:
```nginx
# http {}
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

# dentro do server de api.cachola.cloud, na rota de auth do Kong:
location /auth/v1/token {
    limit_req zone=auth_limit burst=20 nodelay;
    proxy_pass http://kong_upstream;
    # ...headers existentes...
}
```
- Cobre `/auth/v1/token`, `/auth/v1/signup`, `/auth/v1/recover`.
- **Fricção zero** para o usuário legítimo — só morde um atacante automático. O app já mostra "Muitas tentativas"
  no 429 (`over_request_rate_limit`).
- **Esforço baixo**, **reversível** (remover o `location`/`limit_req`). Handoff de infra para o Bruno aplicar na VPS.
- **Cuidados:** aplicar **só** nas rotas de auth (global quebraria a API); tunar `rate`/`burst` para não barrar uso
  legítimo (PWA reabrindo sessão, vários funcionários atrás do mesmo IP NAT do buffet — começar generoso e observar);
  snapshot Hostinger antes (regra de ouro `cachola-vps-ops`).
- **É o passo que dá para fazer já, isolado, antes de qualquer coisa de MFA.**

### 1.2 Aviso de login novo por e-mail
Quando alguém entra de um **aparelho/local novo**, mandar um e-mail "Entrou na sua conta de um dispositivo novo —
foi você?". Não impede o acesso, mas a pessoa (ou o Bruno) **reage rápido** se for invasão. Fricção zero (é só um
e-mail informativo). Reusa a infra de e-mail (SMTP Hostinger) já existente.

---

## Camada 2 — MFA **opcional** (opt-in, nunca obrigatório)

Implantar o MFA no sistema, **disponível mas não exigido**. Quem quiser (provavelmente T.I./super_admin) liga nas
próprias configurações; os demais simplesmente não usam. Como não é imposto, ninguém pede para "tirar".

**Mecânica (Supabase self-hosted GoTrue + @supabase/ssr):** GoTrue tem MFA TOTP nativo — `auth.mfa.enroll()`
(gera QR), `challenge()` + `verify()` no login, `getAuthenticatorAssuranceLevel()` (AAL1 vs AAL2). Precisa de:
- Tela de cadastro (ex.: `/perfil/seguranca`) onde o usuário **opta** por ligar e escaneia o QR.
- No login, **só para quem ligou**, pedir o código depois da senha.
- Config GoTrue (`GOTRUE_MFA_*`) habilitada via `docker-compose`/env (`--force-recreate` para reler — ver
  `cachola-supabase-ops`).
- **Plano B de recuperação** (códigos de recuperação guardados, e super_admin podendo resetar o fator de alguém via
  admin API) — mesmo sendo opcional, quem liga precisa de saída se perder o celular.

**Nota:** sem obrigatoriedade, **não** há tela bloqueante de "configure o MFA para continuar" nem enforcement por
cargo — o que tira a maior parte do risco e do atrito da implementação.

---

## Camada 3 — Redutores de fricção (se um dia quiserem MFA "valendo" para mais gente)

A resistência real não é o MFA — é achar que pede código **toda vez**. Estes recursos derrubam essa objeção:

- **"Lembrar deste aparelho" (30 dias):** confirma **uma vez** no computador do trabalho e não pede mais naquele
  aparelho por ~30 dias. Só volta a pedir em aparelho diferente. É o que banco/Google fazem.
- **Código por e-mail em vez de app autenticador:** se o que afasta é "instalar app + escanear QR", mandar o código
  no **e-mail** (familiar, sem instalar nada). Combinado com o item acima, aparece raramente.
- **Step-up só em login suspeito:** pedir o segundo fator **apenas** quando algo foge do padrão (aparelho/local novo).
  No dia a dia (mesma máquina, mesmo escritório) segue só com senha.

Estes três transformam o MFA de "chato todo dia" em "quase nunca aparece" — é o caminho para, no futuro, ampliar a
adoção sem guerra.

---

## Sequência adotada

1. **Agora, indolor:** rate limit por IP (1.1) — fecha o vetor de brute force sem pedir nada a ninguém. Pode ser feito
   isolado, é infra/handoff.
2. **Em seguida, indolor:** aviso de login novo por e-mail (1.2).
3. **Depois, opcional:** MFA opt-in (Camada 2) — disponível, não obrigatório.
4. **Só se quiserem ampliar:** ligar os redutores de fricção (Camada 3) antes de pensar em qualquer obrigatoriedade
   (que hoje está **descartada**).

---

## Itens correlatos (já resolvidos, fora desta proposta)
- **Enumeração de e-mail no login (A07):** resolvido (v1.70.0 — `classifyError` colapsou "e-mail não confirmado" na
  mensagem genérica).
- **Anti self-escalation de cargo (A01):** resolvido (v1.70.0 — trigger na `public.users`, mig 171).

---

_Documento de planejamento; nenhuma mudança de código associada. Atualizar quando a implementação começar._
