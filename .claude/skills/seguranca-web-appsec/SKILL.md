---
name: seguranca-web-appsec
description: Segurança de aplicações web (AppSec) com foco em ataques reais e blindagem. Use SEMPRE que o trabalho envolver autenticação, login, sessão, tokens/JWT, queries ao banco, endpoints/APIs, Server Actions, formulários, upload de arquivos, integrações externas, variáveis de ambiente/segredos, políticas de RLS, ou qualquer ponto onde entrada do usuário chega no servidor ou no banco. Use também para revisar código/PR sob a ótica de segurança, gerar checklists de hardening, ou explicar como um ataque funciona e como se proteger. Dispare mesmo sem o usuário citar "segurança" — basta o trabalho tocar superfície de ataque. O stack-base assumido é Next.js (App Router) + TypeScript + Supabase (Postgres); partes genéricas valem para qualquer web app. Carregue os arquivos em `references/` conforme a área do pedido. Para obrigações legais sobre dados pessoais (LGPD/Marco Civil), remeta à skill `lgpd-marco-civil-br` — esta skill cuida do técnico, não do jurídico.
---

# Segurança de Aplicações Web — AppSec para Next.js + Supabase

Esta skill apoia a construção e revisão de aplicações web seguras, com base no **OWASP Top 10:2025** e em vetores de ataque observados em incidentes reais. O foco é duplo: entender **como o ataque funciona** (o suficiente para defender) e aplicar a **blindagem concreta** — código, queries, políticas de RLS e configuração.

O stack-base é **Next.js (App Router) + TypeScript + Supabase (Postgres)**. As partes de SQLi, controle de acesso, autenticação e XSS valem para qualquer aplicação web; as seções de RLS, segredos e hardening assumem esse stack.

## Quando esta skill deve ser usada

Acione em qualquer destes contextos, mesmo sem o usuário citar "segurança":

- Implementação ou revisão de login, cadastro, recuperação de senha, MFA
- Gestão de sessão, cookies, tokens JWT, refresh tokens
- Criação de endpoints, Route Handlers, Server Actions, APIs
- Queries ao banco — especialmente `.rpc()`, SQL cru, ou queries dinâmicas
- Modelagem de schema e definição de políticas de RLS no Supabase
- Upload, download e manipulação de arquivos (Storage)
- Integrações com terceiros (webhooks, chaves de API, callbacks)
- Variáveis de ambiente, segredos, chaves (`anon`, `service_role`)
- Renderização de conteúdo gerado por usuário (comentários, nomes, descrições)
- Revisão de código ou PR sob ótica de segurança
- Configuração de deploy, headers HTTP, CORS, CSP

## Princípios de atuação

1. **Defesa, não ataque.** Explique o mecanismo do ataque apenas no nível necessário para defender. O entregável é sempre a blindagem: a correção, a política, a configuração.

2. **Distinga severidade com clareza.** Use marcadores visuais:
   - 🔴 **CRÍTICO** — exploração leva a vazamento, takeover ou RCE; corrigir antes de subir
   - 🟡 **ATENÇÃO** — risco real, mas exige condições ou reduz exposição; corrigir em breve
   - ✅ **OK** — prática correta confirmada

3. **Defesa em profundidade.** Nunca confie em uma camada só. Validação no cliente NÃO é segurança. Middleware NÃO substitui checagem no servidor. WAF é camada secundária, nunca a principal. Cada controle assume que o anterior pode falhar.

4. **Menor privilégio sempre.** Conta de banco, chave de API, escopo de token, permissão de RLS — tudo no mínimo necessário. A pergunta-guia é: "se isso vazar, o que o atacante consegue fazer?"

5. **Cite a categoria OWASP.** Ao apontar um risco, referencie (ex.: "A01:2025 — Broken Access Control"). Ajuda a priorizar e a justificar internamente.

6. **Seja concreto.** Sugira o código corrigido, a policy de RLS, o header, a config. Não pare em princípio abstrato. Mostre o "antes" vulnerável e o "depois" seguro quando ajudar.

7. **Não invente CVE nem número.** Se não tiver certeza de uma versão vulnerável específica ou de uma estatística, diga que precisa verificar. Segurança errada é pior que segurança ausente porque dá falsa confiança.

## Workflow

### Passo 1 — Identifique o tipo de pedido

| Tipo | Exemplos | Formato de saída |
|------|----------|------------------|
| **Revisão** | "Revisa esse endpoint", "Tem furo nesse código?", "Esse fluxo de login está seguro?" | Achados classificados 🔴/🟡/✅ + correção em código |
| **Hardening/Planejamento** | "Vou criar a API de pedidos, o que blindar?", "Como deixar o login resistente a credential stuffing?" | Checklist preventivo + decisões de arquitetura |
| **Explicação** | "Como funciona SQL injection?", "O que é IDOR?", "Por que não posso usar a service_role no front?" | Explicação do ataque + a defesa correspondente |
| **Geração de artefato** | "Gera o checklist de segurança do projeto", "Monta as policies de RLS dessa tabela" | Artefato pronto para usar/commitar |

### Passo 2 — Carregue os references relevantes

Leia apenas o que o pedido exigir — não carregue tudo de uma vez:

- **`references/owasp-top10-2025.md`** — o ranking 2025 e o que é cada categoria. Carregue para visão geral, priorização, ou quando o pedido for amplo ("revisa a segurança do projeto").
- **`references/sql-injection.md`** — tipos de SQLi e blindagem em Postgres/Supabase. Carregue se o pedido tocar queries, `.rpc()`, SQL cru, ou entrada que chega no banco.
- **`references/controle-acesso-idor.md`** — Broken Access Control (A01), IDOR e padrões de RLS. Carregue se tocar autorização, acesso a recursos por ID, multi-tenant, ou modelagem de RLS.
- **`references/autenticacao-sessao.md`** — credential stuffing, força bruta, MFA, sessão, JWT. Carregue se tocar login, cadastro, sessão, tokens.
- **`references/xss-csrf.md`** — XSS, roubo de sessão/token no cliente, CSRF. Carregue se tocar renderização de conteúdo do usuário, formulários, `dangerouslySetInnerHTML`.
- **`references/configuracao-segura.md`** — misconfiguration (A02), segredos, hardening Next.js + Supabase, headers, CORS, CSP. Carregue para deploy, env vars, configuração, ou revisão de infra de app.
- **`references/checklists.md`** — checklists prontos por feature. Carregue em revisões e planejamento.

### Passo 3 — Aplique o formato de saída

Veja a tabela do Passo 1. Em revisões, sempre liste os achados do mais grave para o menos grave. Em pedidos mistos, separe por seções.

### Passo 4 — Encerre com próximos passos acionáveis

Termine com 1–3 ações concretas e imediatas. Exemplos: "Ative RLS na tabela `contratos` com a policy abaixo", "Mova `SUPABASE_SERVICE_ROLE_KEY` para variável sem prefixo `NEXT_PUBLIC_`", "Adicione rate limit no endpoint `/api/login`".

## Anti-padrões frequentes — sinalize sempre que aparecerem

Erros de altíssima frequência. Aponte explicitamente quando vir:

1. **Confiar na validação do cliente.** Checagem em JavaScript no navegador é UX, não segurança. Tudo que importa precisa ser revalidado no servidor. O atacante não usa seu formulário — usa `curl`.

2. **`service_role` key no frontend ou em `NEXT_PUBLIC_*`.** A chave `service_role` ignora RLS e dá acesso total ao banco. Só pode existir no servidor, em variável sem prefixo `NEXT_PUBLIC_`. Se vazou para o cliente, é 🔴 crítico — rotacione imediatamente.

3. **Tabela sem RLS habilitado.** No Supabase, RLS desativado + chave `anon` pública = qualquer pessoa lê/escreve a tabela inteira. Habilite RLS em **toda** tabela exposta à API.

4. **Autorização só no middleware.** Middleware do Next.js pode ser contornado (ver `references/controle-acesso-idor.md`). A checagem de "esse usuário pode ver esse recurso?" tem que estar também na Server Action / Route Handler / policy de RLS.

5. **Acesso a recurso por ID sem checar dono.** `GET /api/pedido/[id]` que retorna o pedido sem verificar se pertence ao usuário logado = IDOR. Toda busca por ID precisa filtrar pelo dono (idealmente via RLS).

6. **SQL cru concatenando entrada do usuário.** Mesmo via `.rpc()` ou query builder, montar SQL com template string + input = SQLi. Use queries parametrizadas / o client do Supabase, sempre.

7. **Senha em hash fraco ou em log.** Se você gerencia senha fora do Supabase Auth, use bcrypt/argon2 — nunca MD5/SHA1. Senha (ou token) em log também é vazamento.

8. **Login sem proteção contra credential stuffing.** Limite de tentativas por conta NÃO pega credential stuffing (uma tentativa por conta, vários IPs). Exige MFA, detecção de bot e/ou rate limit por IP+device.

9. **`dangerouslySetInnerHTML` com conteúdo do usuário.** Renderizar HTML de input do usuário sem sanitização = XSS estocado. Sanitize (DOMPurify) ou não use.

10. **Mensagem de erro vazando stack trace / detalhe interno.** Em produção, erro detalhado para o cliente entrega estrutura do banco, caminhos, versões. Logue o detalhe internamente, devolva mensagem genérica (A10:2025).

11. **Segredo commitado no repositório.** Chave, token, senha em `.env` versionado ou hardcoded. Use `.gitignore`, secrets do provedor, e rotacione qualquer segredo que já entrou no histórico do git.

12. **Dependência desatualizada / não auditada.** Pacote npm com CVE conhecido ou pacote malicioso é vetor real (A03:2025). Rode auditoria de dependências e fixe versões.

## Fronteira com a skill `lgpd-marco-civil-br`

As duas skills se complementam e há sobreposição em autenticação, criptografia e logs. A divisão:

- **Esta skill (segurança):** como o ataque funciona e como blindar tecnicamente. "Use bcrypt", "ative RLS", "valide no servidor", "rotacione a chave".
- **Skill LGPD:** a obrigação legal sobre dado pessoal. "Qual base legal", "prazo de retenção", "direito do titular", "comunicação de incidente à ANPD".

Quando um pedido tocar dado pessoal **e** segurança (ex.: vazamento de dados de clientes), trate o técnico aqui e remeta o jurídico à skill LGPD — sem repetir o conteúdo. As duas se citam, não se duplicam.

## Comunicação ao usuário

- Use Português do Brasil (PT-BR)
- Cite categorias OWASP no formato "A01:2025 — Broken Access Control"
- Classifique achados com 🔴 **CRÍTICO** / 🟡 **ATENÇÃO** / ✅ **OK**
- Mostre código vulnerável vs. corrigido quando ajudar a entender
- Explique termos técnicos na primeira ocorrência quando não forem óbvios (o usuário tem background de redes/infra, não de programação)

## Limites desta skill

Esta skill apoia desenvolvimento e revisão, mas **não substitui**:
- Pentest profissional / auditoria de segurança formal
- Resposta a incidente em andamento (vazamento ativo exige plano de resposta e, possivelmente, comunicação à ANPD — ver skill LGPD)
- Análise de ameaças avançadas/persistentes (APT) ou forense pós-invasão

Em vazamento confirmado ou suspeita de invasão em produção, recomende explicitamente acionar resposta a incidente e, se houver dado pessoal, a skill LGPD para a parte de notificação.
