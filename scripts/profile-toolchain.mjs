#!/usr/bin/env node
// Node-only diagnostic: keep memory references to report each tool separately.
// These sizes are linear memory capacities, not simultaneous peak RSS.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { Clang22 } from '../src/engine/clang22.mjs';

const assets = new URL('../public/toolchain/clang-22.1.8-v1/', import.meta.url);
const labels = new WeakMap();
const memories = [];
const instantiate = WebAssembly.instantiate.bind(WebAssembly);
WebAssembly.instantiate = async (...args) => {
  const result = await instantiate(...args);
  const instance = result.instance ?? result;
  if (instance.exports.memory) memories.push({ name: labels.get(args[0]), memory: instance.exports.memory });
  return result;
};
try {
  const engine = new Clang22({
    readBuffer: async name => new Uint8Array(gunzipSync(await readFile(new URL(name + '.gz', assets)))).buffer,
    compileModule: async name => {
      const module = await WebAssembly.compile(gunzipSync(await readFile(new URL(name + '.gz', assets))));
      labels.set(module, name);
      return module;
    },
  });
  const result = await engine.compile('#include <bits/stdc++.h>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b;}', { standard: 'gnu++17', optimization: '2', memoryMb: 64 });
  if (!result.binary) throw new Error(result.diagnostics);
  console.log(JSON.stringify(memories.map(({ name, memory }) => ({ name, linearMemoryMiB: memory.buffer.byteLength / 1048576 })), null, 2));
} finally {
  WebAssembly.instantiate = instantiate;
}
