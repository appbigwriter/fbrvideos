param([ValidateSet('start','stop','diagnose')][string]$Action='diagnose', [switch]$StartDatabase)
$ErrorActionPreference='Stop'
$workspace=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stateDirectory=Join-Path $workspace 'var/local-operations'
$stateFile=Join-Path $stateDirectory 'managed-processes.json'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
function Test-LocalPort([int]$Port) {
 $socket=New-Object System.Net.Sockets.TcpClient
 try { $attempt=$socket.ConnectAsync('127.0.0.1',$Port); return ($attempt.Wait(500) -and $socket.Connected) } catch { return $false } finally { $socket.Dispose() }
}
function Read-Managed { if(Test-Path -LiteralPath $stateFile){return @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)};return @() }
$services=@(
 @{name='database';port=55432;args=@('--import','tsx','packages/infra/src/dev-database.ts')},
 @{name='api';port=3001;args=@('--env-file-if-exists=.env','--import','tsx','apps/api/src/server.ts')},
 @{name='worker';port=0;args=@('--env-file-if-exists=.env','--import','tsx','apps/worker/src/server.ts')},
 @{name='web';port=5173;args=@('node_modules/vite/bin/vite.js','apps/web','--host','127.0.0.1')}
)
if($Action -eq 'start') {
 $nodePath=(Get-Command node).Source
 $managed=@(Read-Managed)
 foreach($service in $services){
  if($service.name -eq 'database' -and -not $StartDatabase){continue}
  if($service.port -ne 0 -and (Test-LocalPort $service.port)){Write-Output "$($service.name): porta já ativa; processo existente preservado.";continue}
  if($service.name -eq 'worker'){
   $externalWorker=Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -match 'apps[\\/]worker[\\/]src[\\/]server\.ts'} | Select-Object -First 1
   if($externalWorker){Write-Output 'worker: instância já ativa preservada; não iniciar duplicata.';continue}
  }
  $record=$managed | Where-Object {$_.name -eq $service.name} | Select-Object -Last 1
  if($record){$existing=Get-Process -Id $record.process_id -ErrorAction SilentlyContinue;if($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $record.started_at){continue}}
  if($service.name -ne 'database' -and -not (Test-LocalPort 55432)){throw 'Banco local indisponível. Inicie dev:db ou use -StartDatabase.'}
  if($service.name -eq 'worker'){$priorMode=$env:FBR_GENERATION_MODE;$env:FBR_GENERATION_MODE='simulated'}
  try{$process=Start-Process -FilePath $nodePath -ArgumentList $service.args -WorkingDirectory $workspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDirectory "$($service.name).stdout.log") -RedirectStandardError (Join-Path $stateDirectory "$($service.name).stderr.log")}
  finally{if($service.name -eq 'worker'){$env:FBR_GENERATION_MODE=$priorMode}}
  $managed=@($managed | Where-Object {$_.name -ne $service.name})+@(@{name=$service.name;process_id=$process.Id;started_at=$process.StartTime.ToUniversalTime().ToString('o');executable=$nodePath;workspace=$workspace})
  $managed | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile
  if($service.port -ne 0){$deadline=[DateTime]::UtcNow.AddSeconds(30);while(-not (Test-LocalPort $service.port)) {if($process.HasExited){throw "$($service.name) encerrou; consulte logs em var/local-operations."};if([DateTime]::UtcNow -gt $deadline){throw "$($service.name) não ficou pronto em 30 segundos."};Start-Sleep -Milliseconds 250}}
 }
}
if($Action -eq 'stop'){
 $remaining=@()
 foreach($record in @(Read-Managed)){
  # PostgreSQL persistente é mantido: não matar o wrapper/cluster por força.
  if($record.name -eq 'database'){$remaining+= $record;continue}
  $process=Get-Process -Id $record.process_id -ErrorAction SilentlyContinue
  if(-not $process){continue}
  $details=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.process_id)"
  if($record.workspace -ne $workspace -or $process.StartTime.ToUniversalTime().ToString('o') -ne $record.started_at -or $details.ExecutablePath -ne $record.executable){throw 'Identidade do processo mudou; parada recusada.'}
  Stop-Process -Id $record.process_id
 }
 ConvertTo-Json -InputObject $remaining -Depth 4 | Set-Content -LiteralPath $stateFile
}
foreach($service in $services){if($service.port -ne 0){Write-Output "$($service.name): $(if(Test-LocalPort $service.port){'porta ativa'}else{'indisponível'})"}}
try{$health=Invoke-RestMethod 'http://127.0.0.1:3001/health' -TimeoutSec 5;Write-Output ('API liveness: '+($health | ConvertTo-Json -Compress))}catch{Write-Output 'API liveness indisponível; consulte logs, migrações e acesso privado.'}
Write-Output 'Diagnóstico não imprime .env, credenciais nem comandos de terceiros. Logs em var/local-operations.'
