# Autenticação, Sessão e Credenciais — A07:2025 + A04:2025

Autenticação roubada é o **vetor nº 1 de invasões reais**. Segundo o Verizon DBIR 2025, **88% das invasões por hacking em 2024** envolveram credencial roubada ou obtida por força bruta. Credenciais roubadas motivam ~22% de todos os incidentes — o vetor isolado mais comum.

## Credential Stuffing — o ataque que parece login legítimo

Não é "adivinhar senha". O atacante **compra listas reais** de usuário+senha vazadas em incidentes anteriores e automatiza o teste dessas combinações em vários serviços. Funciona porque as pessoas reutilizam senha.

A escala é absurda: em junho/2025 foi encontrado um conjunto agregado com ~16 bilhões de credenciais livremente acessível.

### Por que o "bloqueio por 5 tentativas" NÃO pega
Credential stuffing faz **uma tentativa por conta**, cada uma de um IP diferente, com assinatura de navegador que parece legítima. A detecção tradicional de força bruta (muitas tentativas falhas na mesma conta) não dispara. Cada conta vê só uma falha — não gera alerta.

### Defesa contra credential stuffing
- ✅ **MFA / 2FA** — a defesa mais eficaz. Mesmo com senha correta, o atacante não passa. No Supabase Auth, habilite MFA (TOTP).
- ✅ **Passkeys / WebAuthn** — elimina a senha reutilizável. Onde der, é o melhor caminho.
- 🟡 **Rate limit por IP + device fingerprint**, não só por conta.
- 🟡 **Detecção de bot** (CAPTCHA adaptativo, análise de comportamento) no login.
- 🟡 **Checagem de senha vazada** — rejeitar no cadastro senhas que aparecem em dumps conhecidos (ex.: API do Have I Been Pwned por k-anonymity).
- ✅ **Não revele se o e-mail existe** — mensagem de erro genérica ("credenciais inválidas"), nunca "esse e-mail não está cadastrado".

## Força bruta clássica

Tentar muitas senhas contra uma conta. Defesa: rate limit por conta, lockout temporário progressivo, MFA, e senha forte. Menos comum hoje que credential stuffing, mas ainda existe contra contas-alvo.

## Gestão de sessão

- ✅ **Cookies seguros:** `HttpOnly` (JS não lê — protege contra XSS roubar a sessão), `Secure` (só HTTPS), `SameSite=Lax` ou `Strict` (mitiga CSRF).
- ✅ **Invalidação no logout** — a sessão tem que morrer de verdade no servidor, não só sumir do cliente.
- ✅ **Timeout / expiração** — sessão não dura para sempre. Refresh token com rotação.
- ✅ **Regenerar ID de sessão** após login (evita session fixation).
- 🟡 **Revogação** — poder matar sessões de um usuário (em caso de comprometimento). O Supabase Auth permite revogar refresh tokens.

## JWT — cuidados específicos

JWT é alvo direto: se vaza, o atacante usa em chamadas de API como se fosse o usuário.

- 🔴 **Nunca guarde JWT/access token em `localStorage`** se houver qualquer risco de XSS — JS malicioso lê e exfiltra. Prefira cookie `HttpOnly`.
- ✅ **Valide assinatura e expiração** no servidor sempre. Não confie no payload sem verificar.
- ✅ **Access token de vida curta** + refresh token rotacionado. Vazou o access token? Expira rápido.
- 🟡 **Cuidado com escopo amplo** — token com mais permissão que o necessário aumenta o estrago se vazar.
- O Supabase gerencia isso por padrão; o risco aparece quando você customiza o fluxo ou armazena o token no lugar errado.

## Cryptographic Failures (A04) na autenticação

- 🔴 **Senha em hash fraco ou texto plano.** Se você gerencia senha fora do Supabase Auth: use **bcrypt, argon2 ou scrypt** com salt. Nunca MD5/SHA1. (O Supabase Auth já faz isso corretamente — prefira usá-lo a rolar autenticação própria.)
- 🔴 **Senha/token em log.** Logar credencial é vazamento. Filtre antes de logar.
- ✅ **TLS 1.2+ em tudo.** Sem HTTPS, credencial trafega em claro.
- ✅ **Segredos fora do código** (ver `configuracao-segura.md`).

## Anti-padrões de autenticação

1. Rolar autenticação própria quando o Supabase Auth resolve — mais superfície de erro. Use a biblioteca robusta.
2. Mensagem de erro que distingue "e-mail não existe" de "senha errada" — entrega lista de e-mails válidos.
3. Reset de senha com token previsível, sem expiração, ou que não invalida sessões antigas.
4. MFA opcional para ações sensíveis (mudar e-mail, exportar dados, ação de admin) — torne obrigatório nesses pontos.
5. JWT em `localStorage` + app com XSS = takeover.

## Checklist de autenticação

- [ ] MFA disponível e obrigatório para ações sensíveis?
- [ ] Senha gerida pelo Supabase Auth (ou bcrypt/argon2 se própria)?
- [ ] Mensagem de erro de login genérica (não revela existência do e-mail)?
- [ ] Cookies `HttpOnly` + `Secure` + `SameSite`?
- [ ] Sessão invalidada de verdade no logout? Timeout configurado?
- [ ] Access token de vida curta + refresh com rotação?
- [ ] JWT fora de `localStorage` (em cookie HttpOnly)?
- [ ] Rate limit / detecção de bot no login?
- [ ] Reset de senha com token expirável e uso único?

## Fronteira com LGPD
A parte **legal** sobre credenciais e dados de autenticação (base legal, retenção, comunicação de vazamento de senhas) está na skill `lgpd-marco-civil-br`. Aqui é só o técnico.
