# Third-party notices

- CppStudio `wasm-clang-runtime`, a community browser port of LLVM 22.1.8, with code derived from binji/wasm-clang and WebAssembly Community Group participants. Apache-2.0; LLVM portions Apache-2.0 WITH LLVM-exception. See docs/LICENSE-cppstudio, docs/LICENSE-llvm and docs/NOTICE-cppstudio. Source commit and release asset checksums are in scripts/toolchain.lock.json. The vendored JS has an ESM export and tracks filesystem sizes to avoid asserting on directories. The compiled programs run through a separate WASI host.
- Official LLVM libc++ iostream header: llvmorg-22.1.8/libcxx/include/iostream, Apache-2.0 WITH LLVM-exception. Vendored at vendor/llvm/iostream; replaces the upstream teaching stub during the reproducible sysroot packaging step.
- memfs.c and stb_sprintf.h: upstream files are retained in vendor/memfs with their notices. The small memfs.wasm was built from those sources with Clang 21/WASI as a bootstrap tool; this does not make YoWASP a runtime dependency. It can be rebuilt using an official WASI SDK with scripts/rebuild-memfs.sh. stb_sprintf offers MIT/public-domain licensing in its source.
- tiny-wasi-host / clang-in-browser by Devtoolry: MIT. The local src/engine/wasi-host.mjs is derived from their WASI host. See docs/LICENSE-devtoolry and source comments. No YoWASP compiler distribution is included in the final application.
- CodeMirror and Lezer packages: MIT, distributed via npm. Vite, TypeScript and Wrangler are development tools; consult their package licenses for their dependencies.
- C/C++ headers and libraries in the sysroot come from LLVM libc++, libc++abi, compiler-rt and wasi-libc. See their upstream source licenses and the LLVM license bundled with this project.

The generated dist/third-party-notices.txt provides bundled license texts alongside the browser distribution. No claim is made that the community browser port is an official LLVM browser distribution.
