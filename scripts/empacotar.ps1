# Gera dist/assimilacao.zip com os arquivos do sistema na raiz (formato do instalador do Foundry).
# Usa barras normais nos caminhos internos para o zip funcionar também em servidores Linux.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$raiz = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $raiz "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$destino = Join-Path $dist "assimilacao.zip"
if (Test-Path $destino) { Remove-Item $destino }
$zip = [System.IO.Compression.ZipFile]::Open($destino, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $itens = @("system.json", "README.md", "module", "templates", "styles", "lang", "assets", "packs")
  foreach ($i in $itens) {
    $caminho = Join-Path $raiz $i
    if (-not (Test-Path $caminho)) { continue }
    $arquivos = if ((Get-Item $caminho).PSIsContainer) { Get-ChildItem $caminho -Recurse -File } else { @(Get-Item $caminho) }
    foreach ($a in $arquivos) {
      $nome = $a.FullName.Substring($raiz.Length + 1) -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $a.FullName, $nome) | Out-Null
    }
  }
} finally { $zip.Dispose() }
Write-Host "Gerado: $destino"
