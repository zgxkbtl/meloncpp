import { Clang22, ENGINE_PATH } from './clang22.mjs';
let busy=false, engine, cached, activeId=0, manifest, downloaded={};
const emit=data=>self.postMessage({...data,id:activeId});
const moduleCache={};
async function readBuffer(name){
 manifest ??= await fetch(`${ENGINE_PATH}/manifest.json`).then(r=>{if(!r.ok)throw new Error('工具链清单下载失败');return r.json();});
 const file=manifest.files.find(f=>f.name===name);
 if(!file)throw new Error(`工具链缺少 ${name}`);
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(`${ENGINE_PATH}/${file.file}`);
   if(!response.ok||!response.body)throw new Error(`HTTP ${response.status}`);
   let lastPercent=-1;
   const counter=new TransformStream({transform(chunk,controller){
    const transported=response.headers.get('content-encoding')?.includes('gzip')?chunk.byteLength*file.bytes/file.rawBytes:chunk.byteLength;
    downloaded[name]=(downloaded[name]||0)+transported;
    const total=manifest.files.reduce((s,f)=>s+f.bytes,0);
    const got=Object.values(downloaded).reduce((a,b)=>a+b,0);
    const percent=Math.min(100,Math.floor(got/total*100));
    if(percent!==lastPercent){lastPercent=percent;emit({type:'progress',percent});}
    controller.enqueue(chunk);
   }});
   // Some static dev servers mark .gz as Content-Encoding:gzip. Fetch has
   // already decoded that response; ordinary .gz assets need explicit decoding.
   const counted=response.body.pipeThrough(counter);
   const stream=response.headers.get('content-encoding')?.includes('gzip')?counted:counted.pipeThrough(new DecompressionStream('gzip'));
   return await new Response(stream).arrayBuffer();
  }catch(error){lastError=error;downloaded[name]=0;}
 }
 throw new Error(`${name} 下载失败：${lastError.message}。请检查网络后重试。`);
}
self.onmessage=async({data})=>{
 if(data.type!=='compile'||busy)return;
 busy=true;activeId=data.id;
 try{
  const key=JSON.stringify([data.code,data.options.standard,data.options.optimization,data.options.memoryMb]);
  if(cached?.key===key){emit({type:'compiled',binary:cached.binary.slice(),compileMs:0,cached:true});return;}
  if(!engine){
   emit({type:'status',phase:'loading'});
   engine=new Clang22({readBuffer,compileModule:async name=>moduleCache[name]??=await WebAssembly.compile(await readBuffer(name)),progress:phase=>emit({type:'status',phase})});
  }
  const result=await engine.compile(data.code,data.options,text=>{if(text)emit({type:'diagnostics',text:text+'\n'});});
  if(!result.binary){emit({type:'compile-error',compileMs:result.compileMs});return;}
  cached={key,binary:result.binary};
  emit({type:'compiled',binary:result.binary.slice(),compileMs:result.compileMs});
 }catch(error){emit({type:'error',message:error.message||String(error)});}
 finally{busy=false;}
};
