[CmdletBinding()]
param([string]$ManifestPath = (Join-Path $PSScriptRoot 'entrada-piloto.json'))

# Offline readiness check. Never reads secrets, performs HTTP, or starts generation.
$ErrorActionPreference = 'Stop'
$issues = [System.Collections.Generic.List[string]]::new()
try {
    $manifestFile = Get-Item -LiteralPath $ManifestPath
    $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
    $manifestDirectory = $manifestFile.DirectoryName
} catch {
    Write-Output 'PENDENTE: ficha ausente ou JSON invalido.'
    exit 2
}

$requiredFiles = @('article', 'character_bible', 'character_reference')
foreach ($name in $requiredFiles) {
    $value = if ($null -ne $manifest.files) { $manifest.files.$name } else { $null }
    if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value)) {
        $issues.Add("Arquivo necessario: $name")
        continue
    }
    try {
        $localPath = if ([IO.Path]::IsPathRooted($value)) { $value } else { Join-Path $manifestDirectory $value }
        if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) { $issues.Add("Arquivo nao localizado: $name") }
        elseif ((Get-Item -LiteralPath $localPath).Length -eq 0) { $issues.Add("Arquivo vazio: $name") }
    } catch { $issues.Add("Caminho invalido: $name") }
}

$requiredText = @('access_verification_record', 'voice_reference_id', 'budget_currency', 'budget_authorization_record')
foreach ($name in $requiredText) {
    $value = if ($null -ne $manifest.decisions) { $manifest.decisions.$name } else { $null }
    if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value)) { $issues.Add("Decisao necessaria: $name") }
}

$requiredPositive = @('budget_ceiling')
foreach ($name in $requiredPositive) {
    $value = if ($null -ne $manifest.decisions) { $manifest.decisions.$name } else { $null }
    $number = 0.0
    if ($null -eq $value -or -not [double]::TryParse([string]$value, [ref]$number) -or $number -le 0 -or [double]::IsNaN($number) -or [double]::IsInfinity($number)) {
        $issues.Add("Numero positivo necessario: $name")
    }
}
foreach ($toolName in @('ffmpeg', 'ffprobe')) {
    if ($null -eq (Get-Command $toolName -ErrorAction SilentlyContinue)) { $issues.Add("Ferramenta ausente: $toolName") }
}

Write-Output 'Preflight local: nenhuma chamada externa ou geracao foi executada.'
Write-Output 'Referencias extras e amostra vocal sao opcionais conforme receita; ID de voz disponivel pode substituir amostra.'
Write-Output 'Defaults tecnicos sao propostas da equipe para calibracao, nao campos obrigatorios para o usuario.'
if ($issues.Count -gt 0) {
    foreach ($issue in $issues) { Write-Output "PENDENTE: $issue" }
    Write-Output "Resultado: $($issues.Count) pendencias. Gate audiovisual continua pendente."
    exit 2
}
Write-Output 'Minimos locais informados. Conferir evidencias, autenticacao, permissoes de uso e orcamento antes de executar.'
Write-Output 'Este resultado nao valida o piloto nem autoriza despesas.'
exit 0
