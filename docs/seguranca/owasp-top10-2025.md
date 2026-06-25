# OWASP Top 10:2025 — A régua

O **OWASP Top 10** é o documento de referência mais usado para priorizar riscos em aplicações web. A edição **2025** foi anunciada em novembro de 2025 e finalizada em janeiro de 2026, baseada na análise de mais de 175 mil CVEs (vulnerabilidades catalogadas). Use esta lista para priorizar: ela ordena os riscos por relevância real observada na indústria.

> ⚠️ A ordem no ranking ≠ gravidade de um caso específico. Injection caiu para #5 mas continua entre os ataques mais perigosos e que mais aparecem em vazamentos. A posição reflete frequência + impacto agregados, não o risco do seu projeto.

## A lista 2025

| # | Categoria | O que é, em uma linha | Reference detalhado |
|---|-----------|----------------------|---------------------|
| **A01** | **Broken Access Control** | Usuário acessa o que não devia (IDOR, falta de checagem de dono, escalada de privilégio). SSRF foi absorvido aqui. | `controle-acesso-idor.md` |
| **A02** | **Security Misconfiguration** | Configuração insegura: padrões fracos, segredos expostos, RLS desligado, headers ausentes, CORS aberto. | `configuracao-segura.md` |
| **A03** | **Software Supply Chain Failures** | *(nova)* Risco em dependências, pacotes, build e CI/CD. Pacote npm comprometido, dependency confusion. | `configuracao-segura.md` |
| **A04** | **Cryptographic Failures** | Cripto ausente ou fraca: senha sem hash forte, MD5/SHA1, TLS mal configurado, segredo em texto plano. | `autenticacao-sessao.md` |
| **A05** | **Injection** | Entrada não confiável vira comando. Inclui **SQL Injection** e **XSS**. | `sql-injection.md`, `xss-csrf.md` |
| **A06** | **Insecure Design** | Falha na arquitetura/lógica, não na implementação: fluxo de reset fraco, falta de threat modeling, regra de negócio explorável. | — (princípio transversal) |
| **A07** | **Authentication Failures** | Falha em autenticação/identidade: senha fraca, sem MFA, sessão mal gerida, login sem limite de tentativa. | `autenticacao-sessao.md` |
| **A08** | **Software/Data Integrity Failures** | Falta de verificação de integridade: update sem assinatura, deserialização insegura, plugin não verificado. | `configuracao-segura.md` |
| **A09** | **Security Logging & Alerting Failures** | Sem log, sem alerta, sem monitoração — ataque passa despercebido e a forense fica cega. | `configuracao-segura.md` |
| **A10** | **Mishandling of Exceptional Conditions** | *(nova)* App falha de forma insegura: erro vaza stack trace/segredo, lógica "fail open", crash explorável. | `configuracao-segura.md` |

## O que mudou de 2021 para 2025

- **Duas categorias novas:** A03 (Software Supply Chain Failures) e A10 (Mishandling of Exceptional Conditions).
- **Security Misconfiguration subiu de #5 para #2** — reflete o peso de erro de configuração em nuvem e padrões fracos nos vazamentos reais.
- **Cryptographic Failures caiu de #2 para #4** — adoção melhor de TLS e cifras padrão mais fortes.
- **Injection caiu de #3 para #5** — caiu no ranking, não em perigo.
- **SSRF** (Server-Side Request Forgery) foi absorvido em A01.
- **XSS** continua dentro de A05 (Injection).

## Como usar esta régua na prática

1. **Priorização de revisão:** comece pelos vetores mais prováveis no seu stack. Para Next.js + Supabase, a ordem prática de atenção costuma ser: A01 (controle de acesso/RLS) → A07 (autenticação) → A05/SQLi → A02 (segredos e config) → A05/XSS.

2. **Não é framework completo.** O Top 10 é conscientização e baseline. Cobrir os 10 não garante segurança total — é o mínimo, não o teto.

3. **Mapeamento de conformidade.** Várias normas referenciam o OWASP Top 10 como evidência de desenvolvimento seguro (ex.: PCI DSS 4.0, SOC 2). Útil se algum cliente/parceiro exigir.

## Ranking prático para roubo de dados (o pedido original)

Se o objetivo é especificamente **proteger dados em banco contra roubo**, a ordem de ameaça concreta hoje:

1. 🔴 **Credenciais roubadas / credential stuffing** (A07) — vetor nº 1 em invasões reais (88% das invasões por hacking em 2024 envolveram credencial roubada/força bruta, segundo Verizon DBIR 2025).
2. 🔴 **Broken Access Control / IDOR** (A01) — o nº 1 do OWASP, fácil de explorar, leva direto a dados de outros usuários.
3. 🔴 **SQL Injection** (A05) — o roubo direto do banco, ainda muito vivo (usado em incidentes de 2025 que chegaram a órgãos de governo).
4. 🟡 **XSS** (A05) — sequestro de sessão/token, especialmente grave com JWT/OAuth.
5. 🟡 **Security Misconfiguration** (A02) — o erro silencioso: RLS desligado, `service_role` exposta, bucket aberto.
