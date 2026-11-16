import { createWasi } from './wasi-host.mjs';
import { MAX_OUTPUT_BYTES } from './config.mjs';
export class OutputLimitError extends Error {
  constructor() { super('输出超过 1 MiB，程序已停止。'); }
}
export async function instantiateProgram(binary, stdin, write) {
  let outputBytes = 0;
  const encoder = new TextEncoder();
  const wasi = createWasi({
    args: ['main'], stdin: encoder.encode(stdin),
    write: (fd, text) => {
      outputBytes += encoder.encode(text).length;
      if (outputBytes > MAX_OUTPUT_BYTES) throw new OutputLimitError();
      write(fd, text);
    },
  });
  const module = await WebAssembly.compile(binary);
  const instance = await WebAssembly.instantiate(module, wasi.imports);
  return { instance, start: () => wasi.start(instance) };
}
