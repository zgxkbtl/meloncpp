import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { Clang22 } from '../src/engine/clang22.mjs';
import { instantiateProgram, OutputLimitError } from '../src/engine/runner.mjs';
import { compareOutput } from '../src/compare.mjs';
import { gunzipSync } from 'node:zlib';
const assets = new URL('../public/toolchain/clang-22.1.8-v1/', import.meta.url);
const engine = new Clang22({
 readBuffer:async name=>new Uint8Array(gunzipSync(await readFile(new URL(name+'.gz',assets)))).buffer,
 compileModule:async name=>WebAssembly.compile(gunzipSync(await readFile(new URL(name+'.gz',assets)))),
});
const options={standard:'gnu++17',optimization:'2',memoryMb:128};
async function compile(code,settings={}) { return engine.compile(code,{...options,...settings}); }
async function execute(binary, stdin = '') {
  let stdout = '', stderr = '';
  const program = await instantiateProgram(binary, stdin, (fd, text) => { if (fd === 1) stdout += text; else stderr += text; });
  const exitCode = program.start();
  return { stdout, stderr, exitCode, memory: program.instance.exports.memory.buffer.byteLength };
}
async function verify(code, input, expected, settings) {
  const result = await compile(code, settings);
  assert.ok(result.binary, result.diagnostics);
  const run = await execute(result.binary, input);
  assert.equal(run.exitCode, 0);
  assert.equal(run.stdout, expected);
  return result;
}

test('bits/stdc++.h, STL containers, sorting, gcd, bitset, long long and stdin/EOF (GNU++17)', async () => {
  await verify(`#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> a; int x; while(cin >> x) a.push_back(x);
 sort(a.begin(),a.end());
 priority_queue<int> q(a.begin(),a.end());
 unordered_map<int,int> counts; for(int y:a) counts[y]++;
 set<int> unique(a.begin(),a.end());
 bitset<8> b(15);
 cout << accumulate(a.begin(),a.end(),0LL) << ' ' << q.top() << ' ' << unique.size() << ' ' << counts[3] << ' ' << gcd(12,18) << ' ' << b.count() << '\\n';
 cout << 1000000000LL*1000000000LL << '\\n';
}`, '3 1 3 8\n', '15 8 3 2 6 4\n1000000000000000000\n');
});
test('GNU++20 ranges, concepts, popcount, span and numbers through bits header', async () => {
 await verify(`#include <bits/stdc++.h>
using namespace std;
template<integral T> T twice(T x) { return 2*x; }
int main(){ vector<int> a={3,1,2}; ranges::sort(a); span<int> s(a); cout<<s[0]<<' '<<twice(3)<<' '<<popcount(7u)<<' '<<(numbers::pi>3)<<'\\n'; }`, '', '1 6 3 1\n', {standard:'gnu++20'});
});
test('O0 works; scanf/printf and stderr remain separate', async () => {
 await verify('#include <bits/stdc++.h>\nint main(){long long x; scanf("%lld", &x); fprintf(stderr,"diagnostic\\n"); printf("%lld\\n",x+1);}', '41', '42\n', {optimization:'0'});
});
test('UTF-8, CRLF and EOF input are preserved', async () => {
 await verify('#include <bits/stdc++.h>\nint main(){std::string s; while(std::getline(std::cin,s)) std::cout<<s<<"\\n";}', '你好\r\nworld', '你好\r\nworld\n');
});
test('syntax errors return diagnostics and no executable', async () => {
 const result = await compile('#include <bits/stdc++.h>\nint main(){ cout << ; }');
 assert.equal(result.binary, null); assert.match(result.diagnostics, /error:/);
});
test('GNU __int128 support is explicitly probed', async () => {
 const r = await compile('#include <bits/stdc++.h>\nint main(){__int128 a=1000000000000000000LL; a*=100; std::cout << (long long)(a/100) << "\\n";}');
 assert.ok(r.binary,r.diagnostics);
 assert.equal((await execute(r.binary)).stdout,'1000000000000000000\n');
});
test('GNU PBDS is explicitly probed and unsupported headers give a clear compiler error', async () => {
 const r = await compile('#include <ext/pb_ds/assoc_container.hpp>\nint main(){}');
 assert.equal(r.binary,null); assert.match(r.diagnostics,/not found/);
 console.log('PBDS: not in the stock libc++ sysroot');
});
test('output flood stops at 1 MiB', async () => {
 const r = await compile('#include <cstdio>\nint main(){while(true) puts("123456789012345678901234567890");}');
 assert.ok(r.binary,r.diagnostics);
 const program = await instantiateProgram(r.binary,'',()=>{});
 assert.throws(()=>program.start(),OutputLimitError);
});
test('linked memory maximum rejects growth beyond the selected cap', async () => {
 await verify('#include <cstdio>\nint main(){int p=__builtin_wasm_memory_grow(0,4096); printf("%d\\n",p);}', '', '-1\n', {memoryMb:64});
});
test('infinite loop runs in a worker that can be terminated', async () => {
 const r = await compile('int main(){for(;;){asm volatile("" ::: "memory");}}');
 assert.ok(r.binary,r.diagnostics);
 const worker = new Worker(new URL('./runtime-node-worker.mjs',import.meta.url),{workerData:r.binary});
 await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
 const exit = new Promise(resolve=>worker.once('exit',resolve));
 await new Promise(resolve=>setTimeout(resolve,100));
 await worker.terminate();
 assert.equal(await exit,1);
});
test('comparison distinguishes token and strict modes', () => {
 assert.equal(compareOutput('1  2\n','1\n2\n').pass,true);
 assert.equal(compareOutput('1  2\n','1\n2\n','strict').pass,false);
 assert.equal(compareOutput('1\n','1 2').pass,false);
 assert.equal(compareOutput('','').pass,true);
});

test('real libc++ stream formatting, boolean defaults, ties and long long input', async () => {
 await verify('#include <bits/stdc++.h>\nint main(){std::ios::sync_with_stdio(false);std::cin.tie(nullptr);long long n;std::cin>>n;std::cout<<true<<" "<<std::boolalpha<<true<<" "<<std::fixed<<std::setprecision(3)<<1.25<<" "<<n<<"\\n";}', '1000000000000000000', '1 true 1.250 1000000000000000000\n');
});
test('a nonzero program exit is preserved', async () => {
 const r=await compile('int main(){return 7;}');
 assert.ok(r.binary,r.diagnostics);
 assert.equal((await execute(r.binary)).exitCode,7);
});
