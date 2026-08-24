#!/bin/bash
# ————— THE ONLY WAY CODE LEAVES THE MACHINE —————
# Push is physically downstream of a green build. Usage:
#   GH_TOKEN=<token> bash ship.sh "commit message"
set -e
cd "$(dirname "$0")/hub"
echo "— typecheck —" && npx tsc --noEmit
echo "— lint+build —"
BUILD_OUT=$(NEXT_TELEMETRY_DISABLED=1 npm run build 2>&1)
echo "$BUILD_OUT" | grep -E "✓ Compiled|✓ Generating|Failed to compile" | head -2
if echo "$BUILD_OUT" | grep -q "Failed to compile"; then echo "🔴 RED — NOT SHIPPING"; exit 1; fi
cd .. && git add -A && git commit -m "$1"
git push "https://x-access-token:${GH_TOKEN}@github.com/Seshsure/seshsure.git" main
echo "🟢 SHIPPED"
