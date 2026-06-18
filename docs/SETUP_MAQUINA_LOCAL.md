# Setup da Maquina Local — Cachola OS

Guia para preparar uma maquina Windows nova como copia local de leitura do repositorio.

---

## 1. Papel da copia local

A copia local e um **espelho read-only do GitHub** — usada pelo advisor (Claude Code) para
leitura e navegacao no codigo via VS Code. Ela **nunca recebe commits**: todo o trabalho de
desenvolvimento acontece na VPS de dev, e a fonte de verdade e sempre o GitHub
(`origin/develop` para trabalho em andamento, `origin/main` para producao).

Se o disco local divergir do GitHub (arquivos editados manualmente, pull nao feito), qualquer
diagnostico feito sobre o codigo local estara errado. O script de sincronizacao resolve isso.

---

## 2. Pre-requisitos

- Git para Windows instalado e no PATH (`git --version` funciona no PowerShell)
- Repositorio clonado em `C:\Users\bruno\Documents\Projetos\cacholaos`
  ```powershell
  git clone https://github.com/suportedrk/cacholaapp.git C:\Users\bruno\Documents\Projetos\cacholaos
  cd C:\Users\bruno\Documents\Projetos\cacholaos
  git checkout develop
  ```

---

## 3. Sincronizacao manual

Para sincronizar a qualquer momento, abra o PowerShell e execute:

```powershell
cd C:\Users\bruno\Documents\Projetos\cacholaos
.\scripts\sync-local.ps1
```

O script faz `git fetch --all --prune` seguido de `git pull --ff-only` no branch develop,
imprime a versao atual (package.json) de cada ponta e avisa se houver drift entre
develop e main.

---

## 4. Sincronizacao automatica ao ligar o PC (sem privilegios de admin)

Cria um atalho na pasta de Inicializacao do Windows. O atalho abre o PowerShell em
segundo plano e executa o script ao fazer login, sem janela visivel.

Cole o bloco abaixo **num unico PowerShell** (pode ser usuario comum, sem admin):

```powershell
$RepoPath  = "C:\Users\bruno\Documents\Projetos\cacholaos"
$ScriptPath = "$RepoPath\scripts\sync-local.ps1"
$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = "$StartupDir\CacholaSync.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = "powershell.exe"
$Shortcut.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$Shortcut.WorkingDirectory = $RepoPath
$Shortcut.Description      = "Sincroniza o repositorio Cachola OS com o GitHub ao iniciar o Windows"
$Shortcut.Save()

Write-Host "Atalho criado em: $ShortcutPath"
```

Para verificar: abra `shell:startup` no Explorador — o atalho `CacholaSync.lnk` deve aparecer.

Para remover o atalho:
```powershell
Remove-Item "$([Environment]::GetFolderPath('Startup'))\CacholaSync.lnk"
```

---

## 5. Sincronizacao periodica a cada 60 min (requer admin — opcional)

Se quiser que a sincronizacao aconteca automaticamente a cada hora durante o uso do PC,
registre uma tarefa no Agendador do Windows. **Requer PowerShell aberto como administrador.**

```powershell
# Rodar como ADMINISTRADOR
$RepoPath   = "C:\Users\bruno\Documents\Projetos\cacholaos"
$ScriptPath = "$RepoPath\scripts\sync-local.ps1"

$Action = New-ScheduledTaskAction `
    -Execute  "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" `
    -WorkingDirectory $RepoPath

$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

$RepeatInterval  = New-TimeSpan -Minutes 60
$RepeatDuration  = New-TimeSpan -Days 1
$TriggerLogon.RepetitionInterval = $RepeatInterval
$TriggerLogon.RepetitionDuration = $RepeatDuration

$Principal = New-ScheduledTaskPrincipalHelper -UserId $env:USERNAME `
    -LogonType Interactive -RunLevel Limited 2>$null
if (-not $Principal) {
    $Principal = New-ScheduledTaskPrincipal `
        -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
}

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName "CacholaOSSync" `
    -Action   $Action `
    -Trigger  $TriggerLogon `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Sincroniza o repositorio Cachola OS com o GitHub a cada 60 min" `
    -Force

Write-Host "Tarefa registrada: CacholaOSSync"
```

**Apos criar a tarefa agendada, remova o atalho de Inicializacao** (secao 4) para nao
duplicar a sincronizacao no logon:

```powershell
Remove-Item "$([Environment]::GetFolderPath('Startup'))\CacholaSync.lnk" -ErrorAction SilentlyContinue
```

Para remover a tarefa agendada no futuro:
```powershell
Unregister-ScheduledTask -TaskName "CacholaOSSync" -Confirm:$false
```

---

## 6. Resumo: qual opcao usar

| Situacao | Opcao recomendada |
|---|---|
| Uso normal do dia a dia | Secao 4 (logon) + sync manual no inicio de cada sessao (secao 3) |
| Trabalho intenso ao longo do dia, quer atualizacao automatica | Secao 5 (tarefa agendada, requer admin) |

O logon automatico (secao 4) mais a sincronizacao feita no inicio de cada sessao de
trabalho ja cobre o uso normal sem nenhuma configuracao adicional.
