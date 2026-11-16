#!/usr/bin/env python3
"""Replace the upstream teaching iostream stub with LLVM 22.1.8's real header.
No paths are extracted to disk. The remaining archive is preserved.
"""
import io
import sys
import tarfile
from pathlib import Path
source, destination, header = sys.argv[1:]
canonical = Path(header).read_bytes()
target = 'include/wasm32-wasip1/noeh/c++/v1/iostream'
replaced = 0
with tarfile.open(source, 'r:') as original, tarfile.open(destination, 'w', format=tarfile.GNU_FORMAT) as patched:
    for entry in original:
        if entry.name == target:
            entry.size = len(canonical)
            patched.addfile(entry, io.BytesIO(canonical))
            replaced += 1
        elif entry.isfile():
            patched.addfile(entry, original.extractfile(entry))
        else:
            patched.addfile(entry)
if replaced != 1:
    raise SystemExit(f'Expected exactly one iostream header; found {replaced}')
