# Wrapper PowerShell para scripts/docker-timing.mjs
# Uso: powershell -File scripts/docker-timing.ps1 <log> [--top=12] [--segments]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Log,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)
node (Join-Path $PSScriptRoot 'docker-timing.mjs') $Log @Rest
