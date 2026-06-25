# Checklists de Segurança por Feature

Checklists prontos para colar em PR, issue ou revisão. Cada item referencia o arquivo detalhado quando precisar aprofundar. Use em revisão e planejamento.

## 🔐 Novo endpoint / Route Handler / API

- [ ] Autenticação verificada (`auth.getUser()`) antes de qualquer ação?
- [ ] Autorização verificada na própria handler, não só no middleware? (`controle-acesso-idor.md`)
- [ ] Busca por ID filtra pelo dono (ou confia em RLS testada)? (IDOR)
- [ ] Retorna 404, não 403, para recurso de outro usuário?
- [ ] Entrada validada por tipo/formato no servidor (não confia no cliente)?
- [ ] Queries parametrizadas / via client Supabase (sem SQL concatenado)? (`sql-injection.md`)
- [ ] Erro devolve mensagem genérica, sem stack trace? (`configuracao-segura.md`)
- [ ] Ação que muda estado usa POST/PUT/DELETE (não GET)?
- [ ] Evento relevante logado (sem dado sensível)?

## 🔑 Login / Cadastro / Autenticação

- [ ] Usa Supabase Auth (não autenticação caseira)? (`autenticacao-sessao.md`)
- [ ] MFA disponível e obrigatório em ações sensíveis?
- [ ] Mensagem de erro genérica (não revela se o e-mail existe)?
- [ ] Cookies `HttpOnly` + `Secure` + `SameSite`?
- [ ] Rate limit / detecção de bot no login (anti credential stuffing)?
- [ ] Reset de senha com token expirável e de uso único?
- [ ] Sessão invalidada no logout? Timeout configurado?
- [ ] JWT fora de `localStorage` (cookie HttpOnly)?
- [ ] Senha pelo Supabase Auth ou bcrypt/argon2 (nunca MD5/SHA1)?

## 🗄️ Nova tabela / Schema

- [ ] RLS habilitado (`ENABLE ROW LEVEL SECURITY`)? (`controle-acesso-idor.md`)
- [ ] Policy explícita por operação (SELECT/INSERT/UPDATE/DELETE)?
- [ ] `WITH CHECK` no INSERT/UPDATE para impedir troca de dono?
- [ ] Policies testadas com usuários diferentes?
- [ ] Coluna de dono/tenant indexada (ex.: `cliente_id`, `unidade_id`)?
- [ ] Dado sensível identificado? (para retenção/cripto — ver skill LGPD)
- [ ] Nenhum dado pessoal coletado além do necessário? (princípio da necessidade — skill LGPD)

## 💬 Renderização de conteúdo do usuário

- [ ] Renderizado como texto (`{var}`) sempre que possível? (`xss-csrf.md`)
- [ ] `dangerouslySetInnerHTML` só com DOMPurify?
- [ ] URLs de usuário validadas (sem `javascript:`)?
- [ ] CSP configurada?

## 📤 Upload de arquivo / Storage

- [ ] Tipo e tamanho de arquivo validados no servidor?
- [ ] Bucket com policy de RLS (nada público sem querer)? (`configuracao-segura.md`)
- [ ] Nome de arquivo sanitizado (sem path traversal `../`)?
- [ ] Arquivo servido com `Content-Type` correto e `Content-Disposition` quando aplicável?
- [ ] Sem execução de arquivo enviado (ex.: SVG com script, HTML)?

## 🔌 Integração externa / Webhook

- [ ] Chave de API da integração só no servidor (sem `NEXT_PUBLIC_`)?
- [ ] Webhook recebido valida assinatura (HMAC) do remetente? (`configuracao-segura.md`)
- [ ] Payload tratado como entrada não confiável (validação + parametrização)?
- [ ] Timeout e tratamento de falha (fail closed)?
- [ ] Dado pessoal trafegado mapeado? (skill LGPD)

## 🚀 Antes do deploy

- [ ] Nenhum segredo no git (nem no histórico)? (`configuracao-segura.md`)
- [ ] `service_role` só no servidor, sem `NEXT_PUBLIC_`?
- [ ] RLS ligado em todas as tabelas expostas?
- [ ] Headers de segurança no `next.config.js` (HSTS, CSP, nosniff, X-Frame-Options)?
- [ ] CORS restrito (sem `*` em API autenticada)?
- [ ] `npm audit` rodado / dependências auditadas?
- [ ] Next.js atualizado (correções de segurança, ex.: bypass de middleware)?
- [ ] Modo debug/verbose desligado em produção?
- [ ] Erros de produção sem stack trace para o cliente?
- [ ] Logs de eventos de segurança ativos?

## 🔴 Resposta rápida — "vazou um segredo"

1. **Rotacione o segredo imediatamente** no provedor (Supabase, etc.).
2. Verifique logs de acesso suspeito no período de exposição.
3. Remova do código e do histórico do git (rotacionar é o que conta — o histórico pode já ter sido clonado).
4. Se for dado pessoal envolvido → acione a skill `lgpd-marco-civil-br` para a parte de incidente/notificação.
5. Documente o incidente (o que vazou, quando, ação tomada).
