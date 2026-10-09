# Copia o sistema para a pasta de dados do Foundry (Windows).
# Uso: no PowerShell, dentro da pasta do projeto:  .\scripts\instalar.ps1
$origem  = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $env:LOCALAPPDATA "FoundryVTT\Data\systems\assimilacao"
New-Item -ItemType Directory -Force -Path $destino | Out-Null
$itens = @("system.json", "README.md", "module", "templates", "styles", "lang", "assets", "packs")
foreach ($i in $itens) {
  $src = Join-Path $origem $i
  if (Test-Path $src) { Copy-Item -Path $src -Destination $destino -Recurse -Force }
}
Write-Host "Sistema copiado para $destino. Recarregue o mundo no Foundry (F5)."
