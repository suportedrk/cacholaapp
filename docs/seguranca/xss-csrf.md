# XSS & CSRF — injeção no cliente — A05:2025

## XSS — Cross-Site Scripting

XSS não ataca seu servidor direto — ataca o **navegador de quem usa** a aplicação. Acontece quando a aplicação inclui entrada não confiável no HTML sem validação/codificação, e o navegador executa o script injetado como se fosse seu.

O objetivo mais comum é **roubo de sessão/token**: o script copia cookies ou tokens e envia para o atacante, que assume a conta.

### Tipos
- **Estocado (stored/persistente):** o payload é salvo no banco (comentário, nome, descrição) e executa quando outro usuário vê a página. O mais perigoso — atinge todo mundo que abre a página, inclusive admins.
- **Refletido (reflected):** o payload vem na URL/parâmetro e volta na resposta. Exige enganar a vítima a clicar num link (phishing).
- **Baseado em DOM:** o JS do cliente insere dado não confiável no DOM de forma insegura, sem o servidor nem participar.

### Por que é grave em apps modernos (SPA, JWT, OAuth)
Em apps com SSO/token, XSS pode vazar **bearer token / escopo OAuth**. O atacante burla o roubo tradicional de senha coletando JWTs válidos e usando direto na API. Em SaaS multi-tenant, XSS em um tenant pode expor dados de outro.

A cadeia típica de ataque hoje: **XSS → rouba token → usa o token na API → IDOR para vazar dados de outros**. Uma falha "pequena" no cliente vira porta de entrada para vazamento amplo.

### Blindagem em React / Next.js

A boa notícia: **React escapa por padrão.** `{userInput}` em JSX é seguro — o React trata como texto, não HTML. O risco aparece quando você sai dessa proteção:

- 🔴 **`dangerouslySetInnerHTML` com conteúdo do usuário** = XSS estocado.
```tsx
// 🔴 VULNERÁVEL
<div dangerouslySetInnerHTML={{ __html: comentarioDoUsuario }} />

// ✅ SEGURO — sanitize antes (DOMPurify)
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentarioDoUsuario) }} />

// ✅ MELHOR AINDA — se não precisa de HTML, renderize como texto
<div>{comentarioDoUsuario}</div>
```
- 🟡 **URLs de usuário em `href`/`src`:** bloqueie `javascript:` e outros esquemas perigosos. Valide que é `http(s):`.
- 🟡 **Injeção via `<script>` dinâmico, `eval`, `Function()`** com dado do usuário — evite.
- ✅ **Content Security Policy (CSP):** header que limita de onde scripts podem carregar e bloqueia inline script. Camada forte contra XSS (ver `configuracao-segura.md`).
- ✅ **Cookie de sessão `HttpOnly`:** mesmo com XSS, o JS não lê o cookie — limita o estrago (ver `autenticacao-sessao.md`).

### XSS estocado no fluxo de dados
Sanitize na **saída** (ao renderizar), não só na entrada. Sanitizar só na entrada falha quando o mesmo dado é consumido por outro canal (API, e-mail, relatório). Regra: dado não confiável é tratado conforme o contexto de saída (HTML, atributo, JS, URL).

## CSRF — Cross-Site Request Forgery

O atacante faz o **navegador da vítima** disparar uma ação autenticada sem ela querer (ex.: um site malicioso submete um POST para seu app usando o cookie de sessão que o navegador anexa automaticamente).

### Blindagem
- ✅ **`SameSite=Lax` ou `Strict`** nos cookies de sessão — o navegador não envia o cookie em requisição cross-site. Mitiga a maior parte do CSRF moderno.
- ✅ **Server Actions do Next.js** têm proteção contra CSRF embutida (checagem de origin), mas confirme que ações sensíveis não estão expostas como GET simples.
- ✅ **Token anti-CSRF** para formulários/endpoints sensíveis tradicionais (double-submit cookie ou token sincronizado).
- 🟡 **Não use GET para ação que muda estado.** GET deve ser idempotente/leitura. Mudança de estado → POST/PUT/DELETE.

## Checklist XSS/CSRF

- [ ] Nenhum `dangerouslySetInnerHTML` com conteúdo de usuário sem DOMPurify?
- [ ] Conteúdo de usuário renderizado como texto (`{var}`) onde possível?
- [ ] URLs de usuário validadas (sem `javascript:`)?
- [ ] CSP configurada (bloqueia inline script e fontes externas não autorizadas)?
- [ ] Cookies de sessão `HttpOnly` + `SameSite`?
- [ ] Ações que mudam estado usam POST/PUT/DELETE, nunca GET?
- [ ] Server Actions com proteção CSRF confirmada para operações sensíveis?
