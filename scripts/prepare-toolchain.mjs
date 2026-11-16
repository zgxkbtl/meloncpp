import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=new URL('../',import.meta.url);
const lock=JSON.parse(await readFile(new URL('scripts/toolchain.lock.json',root),'utf8'));
const output=new URL(`public/toolchain/clang-${lock.version}/`,root);
const cache=new URL('.cache/toolchain/',root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const memfs=await readFile(new URL('vendor/memfs/memfs.wasm',root));
const canonicalHeader=await readFile(new URL('vendor/llvm/iostream',root));
if(hash(canonicalHeader)!==lock.iostream_patch.sha256)throw new Error('Canonical iostream header checksum mismatch');
const fingerprint=hash(JSON.stringify(lock)+hash(memfs));
try{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',output),'utf8'));
 if(manifest.fingerprint===fingerprint&&(await Promise.all(manifest.files.map(f=>stat(new URL(f.file,output)).then(s=>s.size===f.bytes).catch(()=>false)))).every(Boolean)){
  console.log('Clang 22 assets are up to date.');process.exit(0);
 }
}catch{/* First build. */}
await mkdir(output,{recursive:true});await mkdir(cache,{recursive:true});
const files=[];
async function emit(name,raw){
 const data=gzipSync(raw,{level:9});
 if(data.length>25*1024*1024)throw new Error(`${name} exceeds the 25 MiB Cloudflare limit`);
 await writeFile(new URL(name+'.gz',output),data);
 files.push({name,file:name+'.gz',bytes:data.length,rawBytes:raw.length,sha256:hash(data)});
 console.log(`${name}.gz: ${(data.length/1024/1024).toFixed(2)} MiB`);
}
for(const asset of lock.assets){
 let raw;
 try{raw=await readFile(new URL(asset.name,cache));if(hash(raw)!==asset.sha256)raw=null;}catch{}
 if(!raw){
  console.log(`Downloading pinned ${asset.name}…`);
  const temp=new URL(asset.name+'.part',cache);
  // curl respects the user's proxy settings and streams downloads to disk.
  execFileSync('curl',['--fail','--location','--retry','2','--connect-timeout','20','--output',fileURLToPath(temp),asset.url],{stdio:'inherit'});
  raw=await readFile(temp);
  if(hash(raw)!==asset.sha256)throw new Error(`${asset.name} checksum mismatch; refusing to use it`);
  await rename(temp,new URL(asset.name,cache));
 }
 if(asset.name==='sysroot22.tar'){
  const patched=new URL('sysroot22-patched.tar',cache);
  execFileSync('python3',[fileURLToPath(new URL('scripts/patch-sysroot.py',root)),fileURLToPath(new URL(asset.name,cache)),fileURLToPath(patched),fileURLToPath(new URL('vendor/llvm/iostream',root))]);
  raw=await readFile(patched);
 }
 await emit(asset.name,raw);
}
await emit('memfs.wasm',memfs);
await writeFile(new URL('manifest.json',output),JSON.stringify({version:lock.version,fingerprint,files},null,2)+'\n');
console.log(`First download: ${(files.reduce((sum,f)=>sum+f.bytes,0)/1024/1024).toFixed(2)} MiB; no PCH download, no SharedArrayBuffer.`);
