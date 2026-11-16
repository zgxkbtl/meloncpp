import { parentPort, workerData } from 'node:worker_threads';
import { instantiateProgram } from '../src/engine/runner.mjs';
const program = await instantiateProgram(workerData,'',()=>{});
parentPort.postMessage('running');
program.start();
