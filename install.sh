#!/usr/bin/env bash
# Generuje karteczkę Übersicht z szablonu sticky.jsx dla podanej publicznej strony
# statusu UptimeRobot i wgrywa ją do Übersicht. Kilka stron = kilka wywołań
# (z różnymi tytułami). Po zmianie szablonu: wywołaj ponownie, potem ⌘R.
#
# Użycie: ./install.sh URL [TYTUŁ] [LEFT] [TOP] [AKCENT]
#   ./install.sh https://stats.uptimerobot.com/AbC123
#   ./install.sh https://status.example.com "Uptime" 1210 720 "#3bd671"
set -euo pipefail

if [ $# -lt 1 ]; then
  sed -n '6,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi
URL="$1"
TITLE="${2:-Uptime}"
LEFT="${3:-40}"
TOP="${4:-40}"
ACCENT="${5:-#3bd671}"
REFRESH=300000 # 5 min

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Übersicht/widgets"
PY="${PYTHON:-$(command -v python3)}"
SLUG="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
SLUG="${SLUG:-uptime}"

if [ ! -d "$DEST" ]; then
  echo "Nie znaleziono katalogu Übersicht: $DEST"
  exit 1
fi

# Sprawdź od razu, czy to strona statusu UptimeRobot (i zapamiętaj jej klucz w cache).
if ! "$PY" "$SRC/uptime_status.py" "$URL" >/dev/null; then
  echo "Nie udało się odczytać $URL — karteczki nie instaluję."
  exit 1
fi

# Wartości trafiają do sed jako zamienniki — uciekamy znaki specjalne (& | \).
esc() { printf '%s' "$1" | sed -e 's/[&|\\]/\\&/g'; }

OUT="$DEST/uptimerobot-$SLUG.jsx"
sed -e "s|__PROJECT_DIR__|$(esc "$SRC")|g" -e "s|__PYTHON__|$(esc "$PY")|g" \
    -e "s|__URL__|$(esc "$URL")|g" -e "s|__SLUG__|$SLUG|g" -e "s|__TITLE__|$(esc "$TITLE")|g" \
    -e "s|__REFRESH__|$REFRESH|g" -e "s|__LEFT__|$LEFT|g" -e "s|__TOP__|$TOP|g" \
    -e "s|__ACCENT__|$(esc "$ACCENT")|g" \
    "$SRC/sticky.jsx" > "$OUT"
echo "Zainstalowano $OUT ($TITLE). Odśwież Übersicht (⌘R)."
