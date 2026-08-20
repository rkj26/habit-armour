#!/usr/bin/env bash
# Fails if the JSX references a CSS custom property that no stylesheet defines.
#
# This exists because 78 such references accumulated silently: --accent-red was
# used 26 times and defined nowhere, so every "error" message rendered in the
# default body colour instead of red. CSS resolves an undefined var() to nothing
# and says nothing about it, so only a check like this catches the next one.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="client/src"

defined=$(grep -rhoE '^\s*--[a-z0-9-]+\s*:' "$SRC" --include='*.css' | tr -d ' :' | sort -u)
referenced=$(grep -rhoE 'var\(\s*--[a-z0-9-]+' "$SRC" | sed -E 's/var\(\s*//' | sort -u)

dead=""
for token in $referenced; do
    if ! printf '%s\n' "$defined" | grep -qx -- "$token"; then
        count=$(grep -ro "var(\s*$token" "$SRC" | wc -l | tr -d ' ')
        dead+="  $token  ($count references)"$'\n'
    fi
done

if [ -n "$dead" ]; then
    echo "Undefined CSS custom properties referenced in $SRC:"
    printf '%s' "$dead"
    echo "Define them in client/src/index.css or repoint them to an existing token."
    exit 1
fi

# Second guard: near-transparent white fills are leftovers from the pre-light-mode
# design. On a light background rgba(255,255,255,0.02) is an invisible card, and
# nothing about the rendered page tells you the style was ever applied.
invisible=$(grep -rnE "rgba\(255, ?255, ?255, ?0?\.0[0-9]\)" "$SRC" --include='*.jsx' --include='*.css' || true)
if [ -n "$invisible" ]; then
    echo "Near-transparent white fills found (invisible on the light theme):"
    printf '%s\n' "$invisible"
    echo "Use var(--bg-surface) / var(--border-color), or <Card> from components/ui."
    exit 1
fi

echo "CSS tokens OK: no undefined custom properties, no invisible fills."
