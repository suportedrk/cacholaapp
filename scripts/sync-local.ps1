# sync-local.ps1
# Sincroniza a copia local (Windows) do repositorio Cachola OS com o GitHub.
# Uso: .\scripts\sync-local.ps1
# Executar no inicio de cada sessao de trabalho antes de abrir o VS Code.
#
# Compativel com Windows PowerShell 5.1 e PowerShell 7+.
# Usa apenas caracteres ASCII nas mensagens (evita bugs de encoding do PS 5.1).

$RepoPath = "C:\Users\bruno\Documents\Projetos\cacholaos"

if (-not (Test-Path $RepoPath)) {
    Write-Host "ERRO: diretorio nao encontrado: $RepoPath" -ForegroundColor Red
    exit 1
}

Set-Location $RepoPath

Write-Host ""
Write-Host "=== Cachola OS - Sincronizando copia local ===" -ForegroundColor Cyan
Write-Host "    Repositorio: $RepoPath"
Write-Host ""

# 1. Buscar todas as refs remotas e remover branches deletadas
Write-Host "1/4  Buscando refs remotas..." -ForegroundColor Yellow
git fetch --all --prune
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: git fetch falhou. Verificar conexao com a internet." -ForegroundColor Red
    exit 1
}
Write-Host "     OK" -ForegroundColor Green

# 2. Garantir que estamos no develop
$CurrentBranch = git branch --show-current
if ($CurrentBranch -ne "develop") {
    Write-Host "2/4  Trocando para develop (estava em: $CurrentBranch)..." -ForegroundColor Yellow
    git checkout develop
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: nao foi possivel trocar para develop." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "2/4  Ja em develop." -ForegroundColor Green
}

# 3. Atualizar via fast-forward (seguro pois a copia local nao tem commits proprios)
Write-Host "3/4  Atualizando develop (fast-forward)..." -ForegroundColor Yellow
git pull --ff-only
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "AVISO: git pull --ff-only falhou." -ForegroundColor Red
    Write-Host "       Isso indica commits locais nao esperados." -ForegroundColor Red
    Write-Host "       Diagnose com: git log --oneline origin/develop..HEAD" -ForegroundColor Red
    Write-Host "       Nenhuma alteracao foi forcada. Resolva manualmente antes de continuar." -ForegroundColor Red
    exit 1
}
Write-Host "     OK" -ForegroundColor Green

# 4. Mostrar estado atual
Write-Host "4/4  Estado atual:" -ForegroundColor Yellow
Write-Host ""

# Versao local lida diretamente do arquivo (parser JSON nativo)
$VersaoLocal = (Get-Content -Raw "$RepoPath\package.json" | ConvertFrom-Json).version

# Versao de origin/main e origin/develop sem trocar de branch (git show + ConvertFrom-Json)
$VersaoMain    = (git show origin/main:package.json    | ConvertFrom-Json).version
$VersaoDevelop = (git show origin/develop:package.json | ConvertFrom-Json).version

Write-Host "    Versao local (package.json) : $VersaoLocal" -ForegroundColor White
Write-Host "    Versao origin/main          : $VersaoMain" -ForegroundColor White
Write-Host "    Versao origin/develop       : $VersaoDevelop" -ForegroundColor White

Write-Host ""

# Relacao develop x main
[int]$DevAheadMain  = git rev-list --count "origin/main..origin/develop"
[int]$DevBehindMain = git rev-list --count "origin/develop..origin/main"

if ($DevBehindMain -gt 0) {
    Write-Host "    ATENCAO: develop esta $DevBehindMain commit(s) ATRAS de main - drift problematico." -ForegroundColor Red
    Write-Host "             Corrigir: git merge origin/main --no-edit && git push origin develop" -ForegroundColor Red
} elseif ($DevAheadMain -gt 0) {
    Write-Host "    develop esta $DevAheadMain commit(s) a frente de main (trabalho em andamento - normal)." -ForegroundColor Green
} else {
    Write-Host "    develop e main estao identicos." -ForegroundColor Green
}

Write-Host ""

# Status do working tree
Write-Host "    Status do repositorio:" -ForegroundColor White
git status -sb

Write-Host ""
Write-Host "=== Sincronizacao concluida ===================" -ForegroundColor Cyan
Write-Host ""
