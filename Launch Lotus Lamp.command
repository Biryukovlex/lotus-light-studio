#!/bin/zsh
set -euo pipefail
cd -- "$(dirname -- "$0")"
export UV_CACHE_DIR="$PWD/.local/uv-cache"
trap 'print ""; print "The app stopped. Review the message above; press Return to close."; read -r' EXIT

lamp_uv="$(command -v uv || true)"
if [[ -z "$lamp_uv" && -x "$HOME/.local/bin/uv" ]]; then
  lamp_uv="$HOME/.local/bin/uv"
fi
if [[ -n "$lamp_uv" ]]; then
  if [[ ! -x .venv/bin/python ]]; then
    "$lamp_uv" venv --python 3.11 .venv
  fi
  "$lamp_uv" pip install --python .venv/bin/python --require-hashes -r requirements-app.lock
else
  if [[ ! -x .venv/bin/python ]]; then
    python3 -c 'import sys; assert sys.version_info >= (3,11), "Install Python 3.11 or later, or uv, then launch again."'
    python3 -m venv .venv
  fi
  .venv/bin/python -m pip install --require-hashes -r requirements-app.lock
fi
.venv/bin/python -m lotus_lamp.app "$@"
