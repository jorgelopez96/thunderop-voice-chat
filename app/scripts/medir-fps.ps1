# Mide los fps de un proceso con PresentMon: promedio y 1 % bajo.
# Uso: .\medir-fps.ps1 -Proceso VALORANT-Win64-Shipping.exe -Segundos 60
# PresentMon necesita permisos de administrador (ETW): si la consola no está elevada, pide UAC.
param(
  [Parameter(Mandatory)] [string] $Proceso,
  [int] $Segundos = 60,
  [string] $PresentMon = 'D:\Herramientas\PresentMon\PresentMon.exe'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $PresentMon)) {
  Write-Host "No encuentro PresentMon en $PresentMon."
  Write-Host 'Bajá el binario de consola x64 (PresentMon-<versión>-x64.exe) de la release oficial:'
  Write-Host '  https://github.com/GameTechDev/PresentMon/releases/latest'
  Write-Host "y guardalo como $PresentMon (o pasá otra ruta con -PresentMon)."
  exit 1
}

$csv = Join-Path $env:TEMP "medir-fps-$([guid]::NewGuid()).csv"
# --v1_metrics: garantiza la columna MsBetweenPresents (en 2.x no siempre está entre las de por defecto).
$args_ = @('--process_name', $Proceso, '--output_file', $csv, '--timed', $Segundos, '--terminate_after_timed',
  '--no_console_stats', '--stop_existing_session', '--session_name', 'medir-fps', '--v1_metrics')

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "Midiendo $Proceso durante $Segundos s..."
if ($admin) { & $PresentMon @args_ | Out-Null }
else {
  # Start-Process junta los argumentos con espacios: hay que entrecomillar los que los tienen.
  $citados = $args_ | ForEach-Object { if ("$_" -match '\s') { "`"$_`"" } else { "$_" } }
  Start-Process $PresentMon -ArgumentList $citados -Verb RunAs -Wait -WindowStyle Hidden
}

if (-not (Test-Path $csv)) { Write-Host "PresentMon no generó datos (¿el proceso $Proceso estaba corriendo y presentando cuadros?)."; exit 1 }
$filas = Import-Csv $csv
Remove-Item $csv
if (-not $filas) { Write-Host "Sin cuadros de $Proceso en $Segundos s."; exit 1 }

# Si el proceso tiene varias swap chains (p. ej. un WebView), se mide la que más cuadros presentó.
$cadena = $filas | Group-Object SwapChainAddress | Sort-Object Count -Descending | Select-Object -First 1
$ms = $cadena.Group | ForEach-Object { [double]::Parse($_.MsBetweenPresents, [Globalization.CultureInfo]::InvariantCulture) } |
  Where-Object { $_ -gt 0 } | Sort-Object
$promedio = 1000 * $ms.Count / ($ms | Measure-Object -Sum).Sum
# 1 % bajo = fps del cuadro en el percentil 99 de tiempo entre presentaciones.
$p99 = $ms[[math]::Max(0, [math]::Ceiling(0.99 * $ms.Count) - 1)]
'{0}: {1} cuadros en {2} s  |  FPS promedio {3:N1}  |  1 % bajo {4:N1}' -f $Proceso, $ms.Count, $Segundos, $promedio, (1000 / $p99)
