import { API } from '../vendor/cppstudio-runtime.mjs';
import { BITS_HEADER } from './config.mjs';

export const ENGINE_PATH = '/toolchain/clang-22.1.8-v1';
export function compilerOptions(options = {}) {
 return {standard:options.standard==='gnu++20'?'gnu++20':'gnu++17',optimization:options.optimization==='0'?'0':'2',memoryMb:[64,128,256].includes(Number(options.memoryMb))?Number(options.memoryMb):128};
}
export class Clang22 {
 constructor({readBuffer,compileModule,progress=()=>{}}) {
  this.readBuffer=readBuffer;
  this.compileModule=compileModule;
  this.progress=progress;
  this.modules={};
 }
 async module(name){return this.modules[name] ??= await this.compileModule(name);}
 async compile(code,settings={},onDiagnostics=()=>{}) {
  const {standard,optimization,memoryMb}=compilerOptions(settings);
  const started=performance.now();
  let diagnostics='';
  // A fresh filesystem per compile prevents stale source/output and inode growth.
  // Only compiled tool modules and compressed HTTP assets are reused.
  const api=new API({
   readBuffer:this.readBuffer,
   compileStreaming:name=>this.module(name),
   hostWrite:text=>{diagnostics+=text;},
   clang:'clang22-noeh',lld:'lld22-noeh',memfs:'memfs.wasm',sysroot:'sysroot22.tar',
   clangResourceInclude:'/lib/clang/22/include',
   lldFlags:[],lldLibdir:'lib/wasm32-wasip1',
   clangExtraArgs:['-internal-isystem','/include/wasm32-wasip1/noeh/c++/v1','-internal-isystem','/include/wasm32-wasip1'],
   lldLibs:['-lc++','-lc++abi','-lc','-lclang_rt.builtins'],showTiming:false,
  });
  await api.ready;
  const [clang,lld]=await Promise.all([this.module('clang22-noeh'),this.module('lld22-noeh')]);
  api.memfs.addDirectory('contest');
  api.memfs.addDirectory('contest/bits');
  api.memfs.addFile('contest/bits/stdc++.h',BITS_HEADER);
  api.memfs.addFile('main.cpp',code);
  diagnostics='';
  try {
   this.progress('compiling');
   await api.run(clang,'clang','-cc1','-triple','wasm32-unknown-wasi','-emit-obj',
    '-disable-free','-isysroot','/',
    '-internal-isystem','/include/wasm32-wasip1/noeh/c++/v1',
    '-internal-isystem','/include/wasm32-wasip1','-internal-isystem','/include',
    '-internal-isystem','/lib/clang/22/include','-isystem','/contest',
    `-std=${standard}`,`-O${optimization}`,'-Wall','-Wextra','-Wno-sign-compare',
    '-ferror-limit','12','-o','main.o','-x','c++','main.cpp');
   this.progress('linking');
   await api.run(lld,'wasm-ld','-z','stack-size=8388608',`--max-memory=${memoryMb*1024*1024}`,
    '-Llib/wasm32-wasip1','lib/wasm32-wasip1/crt1.o','main.o','-lc++','-lc++abi','-lc','-lclang_rt.builtins','-o','main.wasm');
   const binary=api.memfs.getFileContents('main.wasm').slice();
   diagnostics=cleanDiagnostics(diagnostics);
   onDiagnostics(diagnostics);
   return {binary,diagnostics,compileMs:performance.now()-started};
  }catch(error){
   diagnostics=cleanDiagnostics(diagnostics);
   onDiagnostics(diagnostics);
   if(typeof error.code==='number')return {binary:null,diagnostics,compileMs:performance.now()-started};
   throw error;
  }
 }
}
function cleanDiagnostics(text){return text.replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(line=>!line.startsWith('> clang ')&&!line.startsWith('> wasm-ld ')).join('\n').trim();}
