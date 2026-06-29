#!/usr/bin/env bash
# aira theme rule check — the mechanical layer of the CLAUDE.md rules.
# Report-only by default. Set STRICT=1 to exit non-zero on hard violations
# (flip on once the audit cleanup has made the theme green).
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

echo "== include vs render (rule: always {% render %}) =="
hits=$(grep -rln "{%-* *include" sections snippets layout 2>/dev/null || true)
if [ -n "$hits" ]; then echo "VIOLATION:"; echo "$hits" | sed 's/^/  /'; fail=1; else echo "ok"; fi

echo "== banned / title-case CTAs =="
hits=$(grep -rnE "(Shop Now|Buy Now|Learn More|Add to Cart)" sections snippets templates 2>/dev/null | grep -vi "comment" || true)
if [ -n "$hits" ]; then echo "VIOLATION (use sentence case / approved labels):"; echo "$hits" | sed 's/^/  /'; fail=1; else echo "ok"; fi

echo "== off-palette hex in sections/snippets (drift) =="
allow='FF4000|0A1A34|F1EBE1|9BB7D4|28965A|087CA7|2A3142|5C6470|FFFFFF|FAFAFA|F2F2F2|F8F5F0'
hits=$(grep -rnoiE '#[0-9a-f]{6}' sections snippets 2>/dev/null | grep -viE "#($allow)" || true)
if [ -n "$hits" ]; then echo "WARN (colour not in token palette; tokenise or add to the set):"; echo "$hits" | sed 's/^/  /' | head -40; fi

echo "== any hardcoded hex in sections (rule: use tokens, not raw hex) =="
n=$(grep -rloiE '#[0-9a-f]{6}' sections snippets 2>/dev/null | wc -l | tr -d ' ')
echo "files with a hardcoded hex: $n (target 0; SVG logo fills aside)"

echo "== suspicious section filenames (forks / versions) =="
hits=$(ls sections 2>/dev/null | grep -iE 'v2|v3|v4|copy|old|-new|temp|test' || true)
if [ -n "$hits" ]; then echo "WARN:"; echo "$hits" | sed 's/^/  /'; fi

echo "----"
if [ "${STRICT:-0}" = "1" ] && [ "$fail" = "1" ]; then
  echo "Rule check FAILED (STRICT mode)."; exit 1
fi
echo "Rule check complete (report-only; set STRICT=1 to enforce)."
