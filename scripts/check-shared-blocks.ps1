<#
  check-shared-blocks.ps1

  Le site n'a pas de build/templating : le header (nav), le footer et le bloc
  CSP sont dupliques a l'identique dans les 7 pages HTML. Ce script verifie
  que les 3 restent coherents entre toutes les pages avant qu'une derive
  parte en production :
    - Nav et footer : chaque lien est resolu en chemin absolu (via la classe
      Uri, pas du bricolage regex) puis compare a travers les 7 pages. Le
      lien "vers soi-meme" (ecrit "./" sur chaque page) est donc correctement
      reconnu comme identique partout, au lieu d'etre signale a tort.
    - CSP : compare telle quelle (aucune variation de chemin n'est attendue).

  Usage : powershell -File scripts\check-shared-blocks.ps1
#>

$root = Split-Path -Parent $PSScriptRoot
$baseUri = [Uri]"https://example.invalid/"

$pages = @(
  @{ File = "index.html";                                     Path = "" },
  @{ File = "parcours\index.html";                             Path = "parcours/" },
  @{ File = "projets\index.html";                              Path = "projets/" },
  @{ File = "projets\crm-erp-mipihsib\index.html";             Path = "projets/crm-erp-mipihsib/" },
  @{ File = "projets\e-invoicing-saint-maclou\index.html";     Path = "projets/e-invoicing-saint-maclou/" },
  @{ File = "projets\lockers-mondial-relay\index.html";        Path = "projets/lockers-mondial-relay/" },
  @{ File = "projets\outil-commercial-advcom\index.html";      Path = "projets/outil-commercial-advcom/" }
)

function Get-Block {
  param($Content, $StartPattern, $EndPattern)
  if ($Content -match "(?s)$StartPattern(.*?)$EndPattern") { return $matches[1] }
  return $null
}

function Get-ResolvedLinks {
  param($Block, $PageUri)
  if ($null -eq $Block) { return @() }
  $linkMatches = [regex]::Matches($Block, '<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)</a>')
  $list = @()
  foreach ($m in $linkMatches) {
    $href = $m.Groups[1].Value
    $label = $m.Groups[2].Value.Trim()
    $resolved = [Uri]::new($PageUri, $href)
    $list += "$label => $($resolved.AbsolutePath)$($resolved.Fragment)"
  }
  return $list
}

$results = @{}
foreach ($p in $pages) {
  $fullPath = Join-Path $root $p.File
  if (-not (Test-Path $fullPath)) { Write-Output "MANQUANT: $($p.File)"; continue }
  $content = Get-Content -Raw $fullPath
  $pageUri = [Uri]::new($baseUri, $p.Path)

  $results[$p.File] = [PSCustomObject]@{
    Nav    = (Get-ResolvedLinks (Get-Block $content '<ul class="nav__menu"[^>]*>' '</ul>') $pageUri) -join " | "
    Footer = (Get-ResolvedLinks (Get-Block $content '<div class="site-footer__links">' '</div>') $pageUri) -join " | "
    Csp    = ((Get-Block $content 'Content-Security-Policy" content="' '">') -replace '\s+', ' ').Trim()
  }
}

$refFile = $pages[0].File
$ref = $results[$refFile]
$driftFound = $false

foreach ($p in $pages) {
  $r = $results[$p.File]
  if ($null -eq $r) { continue }

  if ($r.Nav -ne $ref.Nav) {
    Write-Output "DERIVE nav : $($p.File)"
    Write-Output "  attendu : $($ref.Nav)"
    Write-Output "  trouve  : $($r.Nav)"
    $driftFound = $true
  }
  if ($r.Footer -ne $ref.Footer) {
    Write-Output "DERIVE footer : $($p.File)"
    Write-Output "  attendu : $($ref.Footer)"
    Write-Output "  trouve  : $($r.Footer)"
    $driftFound = $true
  }
  if ($r.Csp -ne $ref.Csp) {
    Write-Output "DERIVE CSP : $($p.File) (different de $refFile)"
    $driftFound = $true
  }
}

if (-not $driftFound) {
  Write-Output "OK : nav / footer / CSP coherents sur les $($pages.Count) pages"
}
