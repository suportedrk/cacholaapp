# Incidentes e Lições — VPS de Produção

Registro cronológico de incidentes em produção relacionados à VPS do Cachola OS. Cada entrada tem causa raiz documentada, fix aplicado, e a lição permanente extraída. Ler este arquivo antes de qualquer intervenção de emergência.

---

## Formato de cada incidente

Cada incidente segue a estrutura:

- **Data e versão:** quando aconteceu e qual versão estava em prod
- **Sintoma:** o que o usuário (ou o time) observou
- **Causa raiz:** o que realmente causou o problema
- **Fix aplicado:** o que foi feito para resolver
- **Lição permanente:** o que mudou no processo para evitar repetição

---

## INC-001 — Arquivos deletados na VPS fora do git (24/abr/2026)

**Versão afetada:** v1.5.2 (commit `883a956`)
**Duração:** ~30 minutos de HTTP 500 em toda a produção

### Sintoma

Deploy da v1.5.2 concluiu o `git pull` e `npm run build`, mas o build falhou com `Module not found` para 4 arquivos do módulo de Automações do Checklist Comercial. PM2 continuou servindo a versão anterior, mas `.next/static/` havia sido parcialmente sobrescrito — resultado: HTTP 500 em todas as rotas.

### Causa raiz

Durante sessão de debugging entre 19–23/abr, 4 arquivos foram deletados diretamente do disco da VPS:

- `automation-card.tsx`
- `automation-form.tsx`
- `use-commercial-automations.ts`
- `use-ploomes-stages.ts`

Os arquivos existiam no git (em `main`), mas não no disco da VPS. O `git pull` não os restaurou porque eles não estavam modificados no git — estavam ausentes apenas localmente. O build tentou importá-los, falhou, e `set -e` abortou o deploy antes do `pm2 restart`, deixando o servidor num estado parcial.

### Fix aplicado

```bash
# Na VPS, restaurar os arquivos a partir do git
git checkout HEAD -- src/app/(auth)/vendas/checklist/automacoes/components/automation-card.tsx
git checkout HEAD -- src/app/(auth)/vendas/checklist/automacoes/components/automation-form.tsx
git checkout HEAD -- src/hooks/commercial-checklist/use-commercial-automations.ts
git checkout HEAD -- src/hooks/commercial-checklist/use-ploomes-stages.ts

# Rebuild e restart
NODE_OPTIONS=--max-old-space-size=4096 npm run build
pm2 restart cacholaos --update-env
```

### Mudanças de processo (v1.5.3)

1. **Gate de working tree no `deploy.yml`:** antes do `git pull`, o workflow executa `git status --porcelain | grep -v '^??'`. Se houver qualquer arquivo tracked modificado ou deletado na VPS, o deploy aborta com mensagem clara. Ignora untracked (`??`) legítimos.
2. **`pm2 restart --update-env`** tornado obrigatório no workflow — sem a flag, PM2 mantém silenciosamente o ambiente da última inicialização a frio.

### Lição permanente

> **Nunca editar ou deletar arquivos rastreados pelo git diretamente na VPS.** Todo o código vai pelo fluxo: editar em dev local → commit em develop → merge em main → deploy automático. O gate de working tree no deploy.yml é a rede de segurança — se o deploy abortar por esse motivo, investigar antes de forçar. Diagnóstico: `git status` na VPS mostra o que está divergente.

---

## INC-002 — apt reiniciou pm2-root.service durante upgrade de Node (04/mai/2026)

**Versão afetada:** durante janela de manutenção Node 20.20.2 → 22.22.2
**Duração do risco:** ~5 segundos de app rodando com `node_modules` incompatíveis
**Impacto real:** nenhum (detectado a tempo, sem crash ou erro de usuário)

### Sintoma

Durante o `apt-get install -y nodejs` (P4 do procedimento), o output incluiu:

```
Restarting services...
 systemctl restart pm2-root.service
```

O PM2 voltou ao ar automaticamente com 2 instâncias `online` — mas com os `node_modules` compilados para Node 20 ABI rodando sobre o recém-instalado Node 22. O estado durou ~5 segundos até ser detectado e o PM2 ser parado novamente via `pm2 stop`.

### Causa raiz

O Ubuntu aplica automaticamente `needrestart` ou hooks de pós-instalação de pacotes que reiniciam serviços systemd dependentes do binário atualizado. Como o `pm2-root.service` chama `/usr/bin/node` diretamente, o apt identificou a dependência e reiniciou o serviço.

No upgrade de hoje, o PM2 foi parado apenas com `pm2 stop cacholaos` (pausa das instâncias, mas o serviço systemd continuou ativo). Isso deixou o `pm2-root.service` vulnerável ao restart automático do apt.

### Fix aplicado na hora

```bash
# Parar instâncias novamente após o apt as religar
ssh cacholaos-vps "pm2 stop cacholaos"

# Continuar o procedimento normalmente (P5: rm -rf node_modules && npm ci)
```

### Procedimento corrigido para próximas vezes

**Antes do `apt-get install nodejs`**, parar o serviço via systemd (não apenas as instâncias PM2):

```bash
# Parar o serviço systemd inteiro — o apt não consegue reiniciar o que já está parado
ssh cacholaos-vps "systemctl stop pm2-root.service"

# Confirmar que parou
ssh cacholaos-vps "systemctl is-active pm2-root.service"
# Esperado: inactive

# Só então fazer o upgrade
ssh cacholaos-vps "apt-get install -y nodejs"
```

Após o upgrade, religar manualmente com `pm2 start ecosystem.config.js --update-env` (P7 do procedimento), não via `systemctl start pm2-root.service` — o `pm2 start` com `ecosystem.config.js` garante que as instâncias são iniciadas com o ambiente correto.

### Lição permanente

> **`apt-get install nodejs` reinicia `pm2-root.service` automaticamente** via hooks de pós-instalação do Ubuntu. Em qualquer upgrade de Node, parar o serviço via `systemctl stop pm2-root.service` *antes* do apt — não apenas `pm2 stop`. O `pm2 stop` pausa as instâncias mas mantém o daemon PM2 e o serviço systemd ativos, o que é suficiente para o apt os reativar. Ver procedimento atualizado em `nodejs-upgrade.md` (P2).

---

## Padrão recorrente identificado

Os dois incidentes registrados têm a mesma raiz estrutural: **estado implícito não declarado que o deploy ou o upgrade não controlava**.

| Incidente | Estado implícito | Consequência |
|---|---|---|
| INC-001 | Arquivos ausentes no disco, presentes no git | Build falhou com Module not found |
| INC-002 | Serviço systemd ativo enquanto só as instâncias PM2 foram paradas | apt religou o app com ABI incompatível |

**Princípio derivado:** antes de qualquer operação de upgrade ou deploy manual, tornar o estado do servidor explícito e verificável. Para o deploy: `git status` na VPS. Para upgrade de Node: `systemctl is-active pm2-root.service`. Nunca assumir que "parar o app" e "parar o serviço" são a mesma coisa.
