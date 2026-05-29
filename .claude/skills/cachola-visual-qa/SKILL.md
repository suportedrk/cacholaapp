---
name: cachola-visual-qa
description: Confirmacao visual de telas do Cachola OS via chrome-devtools-mcp. Use sempre que precisar validar visualmente uma rota ou UI em producao (cachola.cloud) ou local (localhost:3000) — screenshots, checagem de carregamento, /403. Define o fluxo correto para NAO ficar pedindo flags de Chrome ao dono.
---

# Confirmacao visual — Cachola OS

## Regra de ouro
O chrome-devtools-mcp LANCA O PROPRIO Chrome dele, com perfil dedicado e persistente. NAO peca ao dono para abrir o Chrome com --remote-debugging-port, e NAO tente se conectar ao navegador normal dele. Basta chamar uma ferramenta do MCP (navigate_page / take_screenshot) que o navegador sobe sozinho.

## Como funciona
- Perfil persistente em ~/.cache/chrome-devtools-mcp/chrome-profile-stable. Nao e limpo entre sessoes — os cookies de login PERSISTEM.
- O .mcp.json NAO deve conter --browser-url nem --isolated. Se contiver, o MCP entra em modo "attach" e exige flag manual. Remover.

## Login (uma vez so)
- Na PRIMEIRA vez (ou se a sessao expirou), navegue para a URL alvo. Se cair em /login, PARE e peca ao dono para logar UMA vez na janela do MCP (diretor ou vendedora). Nunca preencha senha automaticamente.
- Depois disso o login fica salvo no perfil; as proximas confirmacoes nao pedem login.

## Fluxo padrao
1. navigate_page para a URL (ex.: https://cachola.cloud/vendas ou http://localhost:3000/vendas).
2. Se cair em /login: pausar e pedir login uma vez.
3. take_screenshot da tela carregada.
4. Confirmar URL final, ausencia de /403 e elementos esperados.
5. Reportar com o screenshot.

## URLs
- Producao: https://cachola.cloud
- Local: http://localhost:3000

## Lembrete local
Apos re-seed do banco local, test users nascem sem grants — re-aplicar a migration de backfill relevante antes de qualquer prova de toggle.
