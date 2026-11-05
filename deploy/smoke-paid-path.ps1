# Smoke the Phase 3 paid-customer path against a running local stack.
# Prerequisites:
#   - docker compose -f docker-compose.prod.yml --env-file backend/.env.prod up -d
#   - Real Stripe test keys in backend/.env.prod (not bare sk_test_ / price_ prefixes)
#   - Optional: stripe listen --forward-to localhost:8000/api/v1/auth/billing/webhook/
#
# Usage (repo root):
#   powershell -ExecutionPolicy Bypass -File deploy/smoke-paid-path.ps1

param(
  [switch]$WaitForPaidUpgrade,
  [switch]$WaitForCancellation,
  [ValidateRange(10, 1800)][int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
if ($WaitForCancellation -and -not $WaitForPaidUpgrade) { throw 'Use -WaitForPaidUpgrade with -WaitForCancellation.' }
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
$policies = Invoke-RestMethod -Uri "$api/auth/policies/" -Method Get
$regBody = @{
  accept_terms = $true
  acknowledge_privacy = $true
  terms_version = $policies.terms_version
  privacy_version = $policies.privacy_version
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
  if (-not $token) { throw 'Register response missing access token.' }
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   OK user registered"
Write-Host 'Verify the new account using the email link before billing checks can continue.'
$verificationDeadline = [DateTime]::UtcNow.AddMinutes(10)
do {
  $verificationProfile = Invoke-RestMethod -Uri "$api/auth/me/" -Headers $headers -Method Get
  if (-not $verificationProfile.email_verification_required) { break }
  if ([DateTime]::UtcNow -gt $verificationDeadline) { throw 'Email verification is still pending. Verify the address, then rerun with a fresh smoke account.' }
  Start-Sleep -Seconds 5
} while ($true)


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
Write-Host "Registration and Checkout URL creation passed for $email."
if (-not $WaitForPaidUpgrade) {
  Write-Host 'Payment, signed webhook upgrade, and cancellation have NOT been verified.'
  Write-Host 'Run with -WaitForPaidUpgrade (and optionally -WaitForCancellation) to verify billing state.'
  exit 0
}

function Wait-ForPlan([string]$ExpectedPlan) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $currentBilling = Invoke-RestMethod -Uri "$api/auth/billing/" -Headers $headers -Method Get
    if ($currentBilling.plan -eq $ExpectedPlan) { return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for the webhook to set plan=$ExpectedPlan."
}

Write-Host 'Complete the test payment in the Checkout URL above; waiting for signed webhook upgrade...'
Wait-ForPlan 'pro'
Write-Host 'PASS: signed webhook upgraded the organization to Pro.'
if ($WaitForCancellation) {
  $portal = Invoke-RestMethod -Uri "$api/auth/billing/portal/" -Headers $headers -Method Post
  Write-Host "Cancel in the test customer portal: $($portal.portal_url)"
  Write-Host 'Choose immediate cancellation for this smoke check, or use a Stripe test clock for end-of-term cancellation.'
  Wait-ForPlan 'starter'
  Write-Host 'PASS: cancellation downgraded the organization to Starter.'
} else {
  Write-Host 'Cancellation has NOT been verified.'
}
