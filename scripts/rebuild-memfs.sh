#!/bin/sh
# Optional maintenance step. Uses an official WASI SDK installation.
set -eu
: "${WASI_SDK_PATH:?Set WASI_SDK_PATH to an installed official WASI SDK}"
project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
task_build=$(mktemp -d)
trap 'rmdir "$task_build" 2>/dev/null || true' EXIT
"$WASI_SDK_PATH/bin/clang" --target=wasm32-wasip1 -O2 -Wno-incompatible-library-redeclaration -c "$project_root/vendor/memfs/memfs.c" -o "$task_build/memfs.o"
"$WASI_SDK_PATH/bin/clang" --target=wasm32-wasip1 -O2 -DSTB_SPRINTF_IMPLEMENTATION -x c -c "$project_root/vendor/memfs/stb_sprintf.h" -o "$task_build/stb.o"
"$WASI_SDK_PATH/bin/wasm-ld" -L"$WASI_SDK_PATH/share/wasi-sysroot/lib/wasm32-wasip1" --no-entry --export-dynamic --allow-undefined --initial-memory=4194304 -o "$project_root/vendor/memfs/memfs.wasm" "$task_build/memfs.o" "$task_build/stb.o" -lc
printf '%s\n' 'Rebuilt vendor/memfs/memfs.wasm. Run npm test and npm run build.'
