import { instantiateProgram, OutputLimitError } from './runner.mjs';
self.onmessage = async ({ data }) => {
  const id = data.id;
  let exitCode = 0;
  let reason = 'ok';
  let started = 0;
  let memoryBytes = 0;
  const pending = { 1: '', 2: '' };
  let hasFlushed = false;
  const flush = () => {
    hasFlushed = true;
    for (const fd of [1, 2]) {
      if (pending[fd]) { self.postMessage({ type: 'output', id, stream: fd === 1 ? 'stdout' : 'stderr', text: pending[fd] }); pending[fd] = ''; }
    }
  };
  try {
    const program = await instantiateProgram(data.binary, data.stdin, (fd, text) => {
      pending[fd] += text;
      if (pending[fd].length >= 8192 || !hasFlushed) flush();
    });
    self.postMessage({ type: 'running', id });
    started = performance.now();
    exitCode = program.start();
    memoryBytes = program.instance.exports.memory.buffer.byteLength;
    if (exitCode !== 0) reason = 'runtime-error';
  } catch (error) {
    reason = error instanceof OutputLimitError ? 'output-limit' : 'runtime-error';
    exitCode = error instanceof WebAssembly.RuntimeError ? (error.message.includes('unreachable') ? 134 : 139) : 1;
    pending[2] += (error instanceof OutputLimitError ? error.message : `运行错误：${error.message || String(error)}`) + '\n';
  }
  flush();
  self.postMessage({ type: 'done', id, exitCode, reason, runMs: started ? performance.now() - started : 0, memoryBytes });
};
