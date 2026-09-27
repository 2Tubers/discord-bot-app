#!/bin/bash

# ─── Unhappy Path Test Suite ──────────────────────────────────────────
# Tests how the endpoint behaves under invalid/malicious conditions.
# Replace the URL below with your actual deployed URL.

BASE_URL="https://discord-bot-app-five.vercel.app/api/interactions"

echo "=== Discord Bot Security & Resilience Tests ==="
echo ""

# ── Test 1: No headers at all ────────────────────────────────────────
echo "Test 1: No signature headers"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"type": 1}')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 2: Fake signature ───────────────────────────────────────────
echo "Test 2: Forged signature"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -H "x-signature-timestamp: 1234567890" \
  -d '{"type": 1}')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 3: Missing timestamp header ─────────────────────────────────
echo "Test 3: Missing timestamp header"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: deadbeef" \
  -d '{"type": 1}')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 4: Missing signature header ─────────────────────────────────
echo "Test 4: Missing signature header"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-timestamp: 1234567890" \
  -d '{"type": 1}')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 5: Wrong HTTP method (GET) ──────────────────────────────────
echo "Test 5: GET request (wrong method)"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$RESPONSE" = "405" ]; then
  echo "  ✅ PASS — returned 405"
else
  echo "  ❌ FAIL — expected 405, got $RESPONSE"
fi
echo ""

# ── Test 6: Malformed body ───────────────────────────────────────────
echo "Test 6: Malformed JSON body"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -H "x-signature-timestamp: 1234567890" \
  -d 'this is not json')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401 (signature check blocked it before JSON parse)"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 7: Empty body ──────────────────────────────────────────────
echo "Test 7: Empty request body"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: deadbeef" \
  -H "x-signature-timestamp: 1234567890" \
  -d '')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

# ── Test 8: Replay with old timestamp ────────────────────────────────
echo "Test 8: Very old timestamp (replay attack)"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "x-signature-ed25519: deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -H "x-signature-timestamp: 1000000000" \
  -d '{"type": 2, "id": "replay-test"}')
if [ "$RESPONSE" = "401" ]; then
  echo "  ✅ PASS — returned 401"
else
  echo "  ❌ FAIL — expected 401, got $RESPONSE"
fi
echo ""

echo "=== All security tests complete ==="
echo ""
echo "Manual tests still needed:"
echo "  - Duplicate interaction: Run /status twice rapidly in Discord"
echo "  - Downstream failure: Set bad webhook URL in Supabase, run /report"
echo "  - AI failure: Set bad GROQ_API_KEY in Vercel, run /report"
echo "  - Slow work: All slow operations are handled inline (no defer timeout risk)"