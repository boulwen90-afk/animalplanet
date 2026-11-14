#!/usr/bin/env bash
# Builds the sprites of every figure from the config files.
# Sets up Blender (the bpy Python module) in a virtual environment the first time.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
venv="$here/.venv"
if [ ! -x "$venv/bin/python" ]; then
  python3.13 -m venv "$venv"
  "$venv/bin/pip" install --quiet -r "$here/requirements.txt"
fi
exec "$venv/bin/python" "$here/build.py" --all "$@"
