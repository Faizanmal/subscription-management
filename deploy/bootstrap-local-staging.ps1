# Local smoke setup only. Preserves existing credentials and encryption keys.
$ErrorActionPreference = 'Stop'
python (Join-Path $PSScriptRoot 'bootstrap_env.py')
if ($LASTEXITCODE -ne 0) { throw 'Local environment bootstrap failed.' }
