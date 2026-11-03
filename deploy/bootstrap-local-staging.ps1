# Bootstrap gitignored env files for local staging smoke.
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File deploy/bootstrap-local-staging.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
Set-Location $backend

$key = python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
$secret = python -c "import secrets; print(secrets.token_urlsafe(48))"
$jwt = python -c "import secrets; print(secrets.token_urlsafe(48))"
$pgpass = python -c "import secrets; print(secrets.token_urlsafe(24))"

$envPath = Join-Path $backend '.env'
if (Test-Path $envPath) {
  $content = Get-Content $envPath -Raw
  if ($content -match '(?m)^ENCRYPTION_KEY=') {
    $content = [regex]::Replace($content, '(?m)^ENCRYPTION_KEY=.*$', "ENCRYPTION_KEY=$key")
  } else {
    $content = $content.TrimEnd() + "`r`nENCRYPTION_KEY=$key`r`n"
  }
  Set-Content -Path $envPath -Value $content -NoNewline
  Write-Host "Updated ENCRYPTION_KEY in backend/.env"
} else {
  Copy-Item (Join-Path $backend '.env.example') $envPath
  Write-Host "Created backend/.env from example — fill OAuth/Stripe keys"
}

$examplePath = Join-Path $backend '.env.prod.example'
$prodPath = Join-Path $backend '.env.prod'
$example = Get-Content $examplePath -Raw
$example = $example -replace 'DJANGO_SECRET_KEY=replace-with-long-random-string', "DJANGO_SECRET_KEY=$secret"
$example = $example -replace 'JWT_SECRET_KEY=replace-with-long-random-jwt-key', "JWT_SECRET_KEY=$jwt"
$example = $example -replace '(?m)^ENCRYPTION_KEY=\s*$', "ENCRYPTION_KEY=$key"
$example = $example -replace 'POSTGRES_PASSWORD=replace-strong-password', "POSTGRES_PASSWORD=$pgpass"
$example = $example -replace 'postgres://swm_user:replace-strong-password@db:5432/swm_db', "postgres://swm_user:${pgpass}@db:5432/swm_db"
$example = $example -replace 'FRONTEND_URL=https://app.example.com', 'FRONTEND_URL=http://localhost:3000'
$example = $example -replace 'CORS_ALLOWED_ORIGINS=https://app.example.com', 'CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000'
$example = $example -replace 'CSRF_TRUSTED_ORIGINS=https://app.example.com', 'CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000'
$example = $example -replace 'DJANGO_ALLOWED_HOSTS=api.example.com,localhost', 'DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,0.0.0.0'
$example = $example -replace 'NEXT_PUBLIC_API_URL=https://api.example.com/api/v1', 'NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1'
$example = $example -replace 'NEXT_PUBLIC_WS_URL=wss://api.example.com/ws', 'NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws'
# Local smoke: True. Real staging/prod hosts must set False.
$example = $example -replace 'DJANGO_DEBUG=False', 'DJANGO_DEBUG=True'
Set-Content -Path $prodPath -Value $example -NoNewline
Write-Host "Wrote backend/.env.prod (gitignored)"

Write-Host ""
Write-Host "Next:"
Write-Host "  1. Copy Stripe/OAuth keys into backend/.env.prod from your dashboard"
Write-Host "  2. docker compose -f docker-compose.prod.yml --env-file backend/.env.prod up -d --build"
Write-Host "  3. docker compose -f docker-compose.prod.yml exec backend python manage.py migrate"
Write-Host "  4. docker compose -f docker-compose.prod.yml exec backend python manage.py check_launch_ready"
Write-Host "  5. stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/"
