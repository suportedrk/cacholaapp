---
name: cachola-visual-qa
description: Confirmacao visual de telas do Cachola OS via chrome-devtools-mcp. Use sempre que precisar validar visualmente uma rota ou UI em producao (cachola.cloud) ou dev (localhost:3000) — screenshots, checagem de carregamento, /403. Define o fluxo correto para NAO ficar pedindo flags de Chrome ao dono.
---

# Confirmacao visual — Cachola OS

## Regra de ouro
O chrome-devtools-mcp LANCA O PROPRIO Chrome dele, com perfil dedicado e persistente. NAO peca ao dono para abrir o Chrome com --remote-debugging-port, e NAO tente se conectar ao navegador normal dele. Basta chamar uma ferramenta do MCP (navigate_page / take_screenshot) que o navegador sobe sozinho.

## Como funciona
- Perfil persistente em ~/.cache/chrome-devtools-mcp/chrome-profile. Nao e limpo entre sessoes — os cookies de login PERSISTEM.
- O .mcp.json NAO deve conter --browser-url nem --isolated. Se contiver, o MCP entra em modo "attach" e exige flag manual. Remover.

## Ambiente headless (VPS de dev) — setup e armadilhas

Na VPS de dev o servidor NAO tem tela (headless) e o Claude Code roda como root. O Chrome do MCP roda na propria VPS, entao alcanca o app de dev em http://localhost:3000. Setup validado em jun/2026 (Chrome 149, chrome-devtools-mcp 1.2.0).

Instalacao (uma vez): google-chrome-stable via apt. O headless FUNCIONA SEM display — nao instalar Xvfb.

Registro do MCP (rodar em ~/cacholaos):
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --headless --executablePath=/usr/bin/google-chrome --logFile=/tmp/cdt-mcp.log --chrome-arg=--no-sandbox --chrome-arg=--disable-setuid-sandbox --chrome-arg=--disable-dev-shm-usage --chrome-arg=--disable-gpu

Quatro armadilhas (todas custaram horas — nao repetir):
1. Flags do Chrome vao DENTRO de --chrome-arg=... (uma por flag). Passar --no-sandbox solto NAO funciona: o MCP ignora a flag, o Chrome sobe sem sandbox e, como root, morre na hora.
2. Erro "Protocol error (Target.setDiscoverTargets): Target closed" rodando como root = falta --no-sandbox chegando no Chrome. NAO e falta de display; nao instalar Xvfb (o headless ja roda sem tela, provado com --dump-dom e com --remote-debugging-port + curl).
3. Mudou a config do MCP? "Reload Window" do VS Code NAO troca o processo — ele sobrevive com a config antiga. Para aplicar: pkill -f "chrome-devtools-mcp", depois "Developer: Restart Extension Host", e SEMPRE conferir com ps -eo pid,args | grep chrome-devtools-mcp que o processo rodando bate com a config (tem que ter --logFile e --chrome-arg).
4. Ruido cosmetico no log (ignorar): avisos de UPower/D-Bus e de GCM (PHONE_REGISTRATION_ERROR, wrong_secret, DEPRECATED_ENDPOINT). Sem relacao com o QA.

Perfil persistente na VPS: /root/.cache/chrome-devtools-mcp/chrome-profile. O login fica salvo ali entre sessoes.

Diagnostico: o MCP grava log em /tmp/cdt-mcp.log, mas so depois de uma ferramenta ser usada num teste real. Se o log nao existe apos um teste, o processo rodando nao e o da config nova (ver armadilha 3).

## Login (uma vez so)
- Ambiente com tela (desktop do dono): se cair em /login, PARE e peca ao dono para logar UMA vez na janela do MCP. Nunca preencha senha automaticamente.
- Ambiente headless (VPS de dev): NAO ha janela para o dono logar. Nesse caso e aprovado fazer login automatico UMA vez com a fixture de dev admin@cachola.local (excecao escopada: so essa conta, so na VPS de dev, app atras de firewall). A senha vem do cofre do dono — nunca hardcodar no codigo nem na skill. NUNCA usar credencial de producao nem conta de pessoa real, em nenhum ambiente.
- Depois do login (qualquer ambiente), a sessao fica salva no perfil; as proximas confirmacoes nao pedem login.

## Fluxo padrao
1. navigate_page para a URL (ex.: https://cachola.cloud/vendas ou http://localhost:3000/vendas).
2. Se cair em /login: pausar e pedir login uma vez.
3. take_screenshot da tela carregada.
4. Confirmar URL final, ausencia de /403 e elementos esperados.
5. Reportar com o screenshot.

## URLs
- Producao: https://cachola.cloud
- Dev: http://localhost:3000 (app de dev — roda na VPS de dev; do notebook, via túnel SSH / port-forward do VS Code)

## Lembrete (ambiente de dev)
Apos re-seed do banco de dev, test users nascem sem grants — re-aplicar a migration de backfill relevante antes de qualquer prova de toggle.

## Armadilha: viewport estreito da janela automatizada do MCP

A janela do Chrome controlada pelo MCP tem viewport próprio, tipicamente mais estreito/atípico que o de um navegador normal. Isso pode **esconder elementos que existem no produto** — ex.: botão no rodapé de um modal que sai da área visível no viewport do MCP.

**Antes de reportar um elemento "sumido" como bug**, confirme em navegador normal ou redimensione a janela com `mcp__chrome-devtools__resize_page`.

**Caso real (v1.46.1, Agenda de Contatos):** o botão "Salvar" do formulário de contato não aparecia na janela do MCP, gerando um falso diagnóstico de "não salva". No navegador normal do Bruno o botão estava presente e funcionava corretamente — o bug não existia.

**Consequência:** nunca declarar "o produto não tem esse elemento/funcionalidade" baseado apenas na janela do MCP sem antes verificar com viewport padrão.
