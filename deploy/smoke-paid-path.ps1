# Smoke the Phase 3 paid-customer path against a running local stack.
# Prerequisites:
#   - docker compose -f docker-compose.prod.yml --env-file backend/.env.prod up -d
#   - Real Stripe test keys in backend/.env.prod (not bare sk_test_ / price_ prefixes)
#   - Optional: stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/
#
# Usage (repo root):
#   powershell -ExecutionPolicy Bypass -File deploy/smoke-paid-path.ps1

$ErrorActionPreference = 'Stop'
$api = if ($env:SWM_API_URL) { $env:SWM_API_URL.TrimEnd('/') } else { 'http://localhost:8000/api/v1' }
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$email = "smoke+$stamp@example.com"
$password = 'SmokeTest123!@#'
$org = "Smoke Org $stamp"

Write-Host "API: $api"
Write-Host "1) Health…"
$health = Invoke-RestMethod -Uri "$api/health/" -Method Get
if ($health.status -ne 'ok') { throw "Health not ok: $($health | ConvertTo-Json -Compress)" }
Write-Host "   OK status=$($health.status)"

Write-Host "2) Register $email…"
$regBody = @{
  email = $email
  password = $password
  password_confirm = $password
  first_name = 'Smoke'
  last_name = 'Tester'
  organization_name = $org
} | ConvertTo-Json
$reg = Invoke-RestMethod -Uri "$api/auth/register/organization/" -Method Post -Body $regBody -ContentType 'application/json'
$token = $reg.tokens.access
if (-not $token) { $token = $reg.access }
if (-not $token) { throw "Register response missing access token: $($reg | ConvertTo-Json -Compress)" }
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   OK user registered"

Write-Host "3) Billing status…"
$billing = Invoke-RestMethod -Uri "$api/auth/billing/" -Headers $headers -Method Get
Write-Host "   plan=$($billing.plan) trial=$($billing.is_on_trial) stripe_configured=$($billing.stripe_configured)"

Write-Host "4) Create Pro Checkout session…"
try {
  $checkout = Invoke-RestMethod -Uri "$api/auth/billing/checkout/" -Headers $headers -Method Post -Body (@{ plan = 'pro' } | ConvertTo-Json) -ContentType 'application/json'
  if (-not $checkout.checkout_url) { throw "No checkout_url in response" }
  Write-Host "   OK checkout_url=$($checkout.checkout_url)"
  Write-Host ""
  Write-Host "Next (manual):"
  Write-Host "  - Open checkout_url, pay with test card 4242 4242 4242 4242"
  Write-Host "  - Ensure stripe listen is forwarding webhooks"
  Write-Host "  - Re-check billing: plan should become pro"
  Write-Host "  - GET $api/auth/billing/  (Authorization: Bearer <token>)"
} catch {
  Write-Host "   FAIL checkout: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "   Fill STRIPE_SECRET_KEY + STRIPE_PRICE_PRO in backend/.env.prod, recreate backend, retry."
  exit 2
}

Write-Host ""
Write-Host "Smoke register+checkout URL step passed for $email"
Write-Host "Save token if continuing manually: $token"
