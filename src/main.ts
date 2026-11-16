import './style.css';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, foldGutter } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { cpp } from '@codemirror/lang-cpp';
import { tags } from '@lezer/highlight';
import { samples } from './samples';
import { compareOutput } from './compare.mjs';

const icons: Record<string,string> = {
 play: '<path d="m8 5 11 7-11 7V5Z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3 1 2h4l1-2 3 2-1 2 2 3h2v4h-2l-2 3 1 2-3 2-1-2h-4l-1 2-3-2 1-2-2-3H3v-4h2l2-3-1-2 3-2Z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>', upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
 copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 terminal:'<path d="m5 7 5 5-5 5m8 0h6"/>',check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
};
const icon = (name:string) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.terminal}</svg>`;
const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
interface TestCase { name:string; input:string; expected:string; stdout:string; stderr:string; diagnostics:string; result:string; detail:string; compileMs:number; runMs:number; memoryBytes:number; }
interface Options { standard:string; optimization:string; timeLimit:number; memoryMb:number; compare:string; }
const freshCase = (name='样例 01',input='',expected=''):TestCase => ({name,input,expected,stdout:'',stderr:'',diagnostics:'',result:'',detail:'',compileMs:0,runMs:0,memoryBytes:0});
const smallScreen = matchMedia('(max-width: 700px)');
let cases = [freshCase('样例 01',samples[0].input,samples[0].expected)];
let activeCase = 0;
let initialCode = samples[0].code;
const options:Options = {standard:'gnu++17',optimization:'2',timeLimit:2,memoryMb:128,compare:'tokens'};
try {
 const saved = JSON.parse(localStorage.getItem('melon-cpp-workspace-v1') || 'null');
 if(saved && typeof saved.code === 'string' && saved.code.length < 524288) {
  initialCode=saved.code;
  if(Array.isArray(saved.cases) && saved.cases.length) cases=saved.cases.slice(0,8).map((c:TestCase,i:number)=>freshCase(`样例 ${String(i+1).padStart(2,'0')}`,typeof c.input==='string'?c.input.slice(0,1048576):'',typeof c.expected==='string'?c.expected.slice(0,1048576):''));
  if(saved.options) {
   options.standard=saved.options.standard==='gnu++20'?'gnu++20':'gnu++17';
   options.optimization=saved.options.optimization==='0'?'0':'2';
   if([1,2,5,10].includes(saved.options.timeLimit))options.timeLimit=saved.options.timeLimit;
   if([64,128,256].includes(saved.options.memoryMb))options.memoryMb=saved.options.memoryMb;
   options.compare=saved.options.compare==='strict'?'strict':'tokens';
  }
 }
} catch { /* Storage may be unavailable in private mode. */ }

$('#app').innerHTML = `<div class="shell">
 <header class="topbar">
  <a class="brand" href="/" aria-label="Melon C++ 首页"><img src="/icon.svg" alt=""/><div><div class="brand-title">melon<span> / C++</span></div><div class="brand-small">A LITTLE SPACE TO SOLVE</div></div></a>
  <div class="top-actions"><div class="privacy">${icon('shield')}代码留在你的设备</div><div class="run-actions"><button class="run-all" id="run-all">${icon('layers')}运行全部样例</button><button class="run-button" id="run">${icon('play')}编译运行<kbd>⌘ ↵</kbd></button><button class="stop-button hide" id="stop">${icon('stop')}停止运行</button></div><button id="settings-button" title="运行设置">${icon('settings')}<span class="btn-text">运行设置</span></button><button id="help-button" title="使用说明">${icon('help')}<span class="btn-text">使用说明</span></button></div>
 </header>
 <nav class="mobile-tabs" role="tablist" aria-label="工作区"><button role="tab" data-pane="code" aria-selected="true"><span class="tab-no">01</span>代码</button><button role="tab" data-pane="input" aria-selected="false"><span class="tab-no">02</span>测试输入</button><button role="tab" data-pane="output" aria-selected="false"><span class="tab-no">03</span>运行结果</button></nav>
 <main class="workspace" aria-label="C++ 在线编译工作区">
  <section class="panel code-panel mobile-active" data-panel="code" aria-label="C++ 代码编辑器">
   <div class="panel-head"><div class="panel-title file-label"><span class="cpp-badge">C++</span>main.cpp</div><div class="tools"><label for="sample-select">加载模板</label><select id="sample-select" aria-label="加载代码模板"><option value="">选择模板</option>${samples.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('')}</select><button class="icon-button" id="import" title="导入 C++ 文件" aria-label="导入 C++ 文件">${icon('upload')}</button><button class="icon-button" id="export" title="下载 main.cpp" aria-label="下载 main.cpp">${icon('download')}</button></div></div>
   <div class="editor" id="editor"></div><div class="code-foot"><span id="position">Ln 1, Col 1</span><span><span id="code-standard">GNU++17</span> &nbsp;·&nbsp; UTF-8 &nbsp;·&nbsp; <span id="save-state">已自动保存</span></span></div>
  </section>
  <section class="panel input-panel" data-panel="input" aria-label="测试输入与期望输出">
   <div class="panel-head"><div class="panel-title"><span class="number">01</span>测试数据</div><span class="hint">运行前一次性提供输入</span></div><div class="case-bar" id="case-bar"></div>
   <div class="test-fields"><div class="field"><label for="stdin">STANDARD INPUT <span class="hint">stdin</span></label><textarea id="stdin" aria-label="标准输入" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div><div class="field"><label for="expected">EXPECTED OUTPUT <span class="hint">可选，用于对拍</span></label><textarea id="expected" aria-label="期望输出" spellcheck="false" autocapitalize="off" placeholder="填入期望输出，运行后自动比较"></textarea></div></div>
  </section>
  <section class="panel output-panel" data-panel="output" aria-label="运行结果">
   <div class="panel-head"><div class="output-tabs" role="tablist" aria-label="输出流"><button class="output-tab active" role="tab" aria-selected="true" data-stream="stdout">标准输出</button><button class="output-tab" role="tab" aria-selected="false" data-stream="stderr">标准错误</button><button class="output-tab" role="tab" aria-selected="false" data-stream="diagnostics">编译诊断</button></div><button id="copy" class="icon-button" title="复制当前输出" aria-label="复制当前输出">${icon('copy')}</button></div>
   <div class="download-progress hide" id="progress"><span></span></div><div class="output-body"><div class="empty" id="output-empty"><span class="empty-symbol">${icon('terminal')}</span><span>准备好了，就运行一下。</span></div><pre id="output-text" class="hide" aria-label="输出内容"></pre></div><div class="result" id="result" role="status" aria-live="polite"><strong>READY</strong><span>你的下一次尝试，从这里开始。</span></div>
  </section>
 </main>
 <footer class="footer"><div class="footer-left"><span class="dot" id="engine-dot"></span><span id="engine-state">Clang 22 · WebAssembly</span></div><div class="footer-right"><span>浏览器本地编译与运行</span><span id="limits-summary">2s / 128 MiB</span><span>MADE FOR CURIOUS MINDS</span></div></footer>
 </div><div class="toast" role="status" id="toast"></div><input id="file" class="hide" type="file" accept=".cpp,.cc,.cxx,.c,.txt"/>
 <dialog id="settings-dialog" aria-labelledby="settings-heading"><div class="dialog-head"><h2 id="settings-heading">运行设置</h2><button class="icon-button dialog-close" aria-label="关闭运行设置">${icon('close')}</button></div><div class="dialog-body"><div class="settings-grid">
 <div class="settings-field"><label for="standard">语言标准</label><select id="standard"><option value="gnu++17">GNU++17</option><option value="gnu++20">GNU++20</option></select></div>
 <div class="settings-field"><label for="optimization">优化等级</label><select id="optimization"><option value="2">-O2 · 常用</option><option value="0">-O0 · 调试</option></select></div>
 <div class="settings-field"><label for="timeLimit">程序运行时限</label><select id="timeLimit"><option value="1">1 秒</option><option value="2">2 秒</option><option value="5">5 秒</option><option value="10">10 秒</option></select></div>
 <div class="settings-field"><label for="memoryMb">程序内存上限</label><select id="memoryMb"><option value="64">64 MiB</option><option value="128">128 MiB</option><option value="256">256 MiB</option></select></div>
 <div class="settings-field"><label for="compare">对拍方式</label><select id="compare"><option value="tokens">忽略空白，比较每一项</option><option value="strict">严格比较字符</option></select></div></div><p class="small-note">时限只计算程序运行。内存上限约束程序的 WASM 线性内存，编译器本身需要额外内存。浏览器测速受设备性能影响。</p></div></dialog>
 <dialog id="help-dialog" aria-labelledby="help-heading"><div class="dialog-head"><h2 id="help-heading">在这里，专注解决问题。</h2><button class="icon-button dialog-close" aria-label="关闭使用说明">${icon('close')}</button></div><div class="dialog-body help">
 <h3>怎么使用</h3><p>写入完整的 C++ 程序，在“测试输入”中填写 stdin，点击编译运行。桌面端可按 <code>⌘ / Ctrl + Enter</code>。最多添加 8 组样例，选择“运行全部样例”可复用同一次编译。</p>
 <h3>支持的竞赛用法</h3><p>GNU++17 / GNU++20、常用 STL、<code>&lt;bits/stdc++.h&gt;</code> 兼容头，以及 <code>cin / cout</code>、<code>scanf / printf</code>。<code>__int128</code> 见项目实测记录。</p>
 <h3>使用边界</h3><ul><li>使用 Clang 与 libc++；GNU PBDS、<code>bits/extc++.h</code> 等扩展不在支持范围。</li><li>程序为 wasm32：指针、long、size_t 通常是 32 位，long long 是 64 位。与 Linux GCC 的数据模型不同。</li><li>输入需预先填完，暂不支持交互题、文件系统、网络、线程或异常捕获。</li><li>程序输出最多 1 MiB；编译可手动停止。低内存手机可能无法加载完整编译器。</li></ul>
 <h3>下载与隐私</h3><p>首次运行会下载编译工具链，浏览器会缓存它。源代码和输入仅在设备内处理，草稿自动保存于当前浏览器；清除网站数据会删除草稿。请用“下载 main.cpp”保存重要代码。</p><p>适合日常算法练习；提交比赛前，请在正式评测环境中验证。</p><p><a href="https://github.com/cppstudio-io/wasm-clang-runtime" target="_blank" rel="noopener noreferrer">编译器开源项目 ↗</a></p></div></dialog>`;

const theme = EditorView.theme({
 '&':{height:'100%',backgroundColor:'#1c2421',color:'#c9d7c1'},
 '.cm-scroller':{overflow:'auto'},'.cm-gutters':{backgroundColor:'#1c2421',color:'#5d6d5d',border:'none'},
 '.cm-activeLine':{backgroundColor:'#26302755'},'.cm-activeLineGutter':{backgroundColor:'#26302755',color:'#9fb58f'},
 '.cm-cursor':{borderLeftColor:'#d0ed9c'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#40513e!important'},
 '.cm-matchingBracket':{backgroundColor:'#45593b',color:'#d5f0b3'},'.cm-tooltip':{backgroundColor:'#2b382b',border:'1px solid #4a5943',color:'#c8d8bd'},
 '.cm-panels':{backgroundColor:'#2b382b',color:'#c8d8bd'},'.cm-searchMatch':{backgroundColor:'#6a6b3c'},
}, {dark:true});
const highlighting=HighlightStyle.define([
 {tag:tags.keyword,color:'#cbb3d6'},{tag:[tags.string,tags.character],color:'#bcd992'},
 {tag:tags.comment,color:'#6e826a',fontStyle:'italic'},{tag:[tags.number,tags.bool],color:'#dfbd88'},
 {tag:[tags.typeName,tags.className],color:'#a0c9be'},{tag:tags.function(tags.variableName),color:'#d6dfb5'},
 {tag:tags.meta,color:'#c3bc8d'},{tag:tags.operator,color:'#a8b9a0'},{tag:tags.punctuation,color:'#93a38b'},
]);
let saveTimer:ReturnType<typeof setTimeout>;
let storageWarning=false;
function save() {
 try {localStorage.setItem('melon-cpp-workspace-v1',JSON.stringify({code:editor.state.doc.toString(),cases:cases.map(({input,expected})=>({input,expected})),options}));$('#save-state').textContent='已自动保存';}
 catch {$('#save-state').textContent='未能保存';if(!storageWarning){storageWarning=true;toast('浏览器存储不可用，请下载代码保留草稿。');}}
}
const scheduleSave = ()=>{clearTimeout(saveTimer);$('#save-state').textContent='保存中…';saveTimer=setTimeout(save,400);};
const editor = new EditorView({parent:$('#editor'),state:EditorState.create({doc:initialCode,extensions:[
 lineNumbers(),foldGutter(),highlightActiveLine(),highlightActiveLineGutter(),history(),drawSelection(),indentOnInput(),bracketMatching(),closeBrackets(),autocompletion(),highlightSelectionMatches(),cpp(),theme,syntaxHighlighting(highlighting),
 EditorState.tabSize.of(4),EditorView.contentAttributes.of({'aria-label':'C++ 源代码','autocapitalize':'off','autocorrect':'off','spellcheck':'false'}),
 keymap.of([{key:'Mod-Enter',run:()=>{void run(false);return true;}},...closeBracketsKeymap,...defaultKeymap,...historyKeymap,...searchKeymap,indentWithTab]),
 EditorView.updateListener.of(update=>{if(update.docChanged)scheduleSave();if(update.selectionSet||update.docChanged){const pos=update.state.selection.main.head;const line=update.state.doc.lineAt(pos);$('#position').textContent=`Ln ${line.number}, Col ${pos-line.from+1}`;}}),
]})});
let stream='stdout', busy=false, compiler:Worker|null=null, runner:Worker|null=null;
let sequence=0, compileId=0, runId=0, runningCase=0, currentBinary:Uint8Array;
let queue:number[]=[], compileMs=0;
let compileTimer:ReturnType<typeof setTimeout>, runTimer:ReturnType<typeof setTimeout>, idleTimer:ReturnType<typeof setTimeout>,toastTimer:ReturnType<typeof setTimeout>;
let currentCode='', currentOptions:Options, paintFrame=0;
function toast(text:string){$('#toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',3500);}
function setPane(name:string){document.querySelectorAll('[data-pane]').forEach(el=>el.setAttribute('aria-selected',String((el as HTMLElement).dataset.pane===name)));document.querySelectorAll('[data-panel]').forEach(el=>el.classList.toggle('mobile-active',(el as HTMLElement).dataset.panel===name));if(name==='code')editor.requestMeasure();}
function status(title:string,detail:string,state=''){const el=$('#result');el.dataset.state=state;el.querySelector('strong')!.textContent=title;el.querySelector('span')!.textContent=detail;}
function engine(text:string){$('#engine-state').textContent=text;$('#engine-dot').classList.toggle('busy-dot',busy);}
function paintOutput(){paintFrame=0;const item=cases[activeCase];const content=stream==='stdout'?item.stdout:stream==='stderr'?item.stderr:item.diagnostics;$('#output-text').textContent=content;$('#output-text').dataset.stream=stream;$('#output-text').classList.toggle('hide',!content);$('#output-empty').classList.toggle('hide',!!content);$('#output-empty span:last-child')!.textContent=busy?'正在运行，稍等片刻。':stream==='stdout'?'准备好了，就运行一下。':stream==='stderr'?'没有标准错误输出。':'没有编译诊断。';}
function schedulePaint(){if(!paintFrame)paintFrame=requestAnimationFrame(paintOutput);}
function selectStream(value:string){stream=value;document.querySelectorAll<HTMLButtonElement>('[data-stream]').forEach(el=>{el.classList.toggle('active',el.dataset.stream===value);el.setAttribute('aria-selected',String(el.dataset.stream===value));});paintOutput();}
function renderCases(){const bar=$('#case-bar');bar.replaceChildren();cases.forEach((item,i)=>{const btn=document.createElement('button');btn.className=`case-tab ${i===activeCase?'selected':''}`;btn.textContent=`${item.result==='pass'?'✓ ':item.result==='fail'?'× ':''}${item.name}`;btn.dataset.result=item.result;btn.onclick=()=>selectCase(i);bar.append(btn);});const add=document.createElement('button');add.className='case-add';add.textContent='+';add.title='添加测试样例';add.setAttribute('aria-label','添加测试样例');add.disabled=busy||cases.length>=8;add.onclick=()=>{cases.push(freshCase(`样例 ${String(cases.length+1).padStart(2,'0')}`));selectCase(cases.length-1);scheduleSave();};bar.append(add);if(cases.length>1){const remove=document.createElement('button');remove.className='case-remove';remove.textContent='移除';remove.disabled=busy;remove.onclick=()=>{cases.splice(activeCase,1);cases.forEach((c,i)=>c.name=`样例 ${String(i+1).padStart(2,'0')}`);selectCase(Math.min(activeCase,cases.length-1));scheduleSave();};bar.append(remove);}}
function selectCase(i:number){activeCase=i;const stdin=$<HTMLTextAreaElement>('#stdin');stdin.value=cases[i].input;$<HTMLTextAreaElement>('#expected').value=cases[i].expected;renderCases();paintOutput();if(!busy&&cases[i].result)status(cases[i].result==='pass'?'PASS':'完成',cases[i].detail,cases[i].result);}
function setBusy(value:boolean){busy=value;$('#run').classList.toggle('hide',value);$('#stop').classList.toggle('hide',!value);$<HTMLButtonElement>('#run-all').disabled=value;$<HTMLSelectElement>('#sample-select').disabled=value;$<HTMLButtonElement>('#import').disabled=value;renderCases();}
function endRun(){clearTimeout(compileTimer);clearTimeout(runTimer);runner?.terminate();runner=null;queue=[];setBusy(false);$('#progress').classList.add('hide');engine('Clang 22 · WebAssembly');clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(!busy){compiler?.terminate();compiler=null;engine('Clang 22 · 资源已释放');}},60000);schedulePaint();}
function stop(reason='stopped') {
 if(!busy)return;
 // A running program has its own worker, so stopping it keeps the compiler warm.
 if(!runner){compiler?.terminate();compiler=null;}
 runner?.terminate();
 const compileTimeout=reason==='compile-timeout';
 const loadTimeout=reason==='load-timeout';
 cases[runningCase].result='fail';
 cases[runningCase].detail=loadTimeout?'工具链加载超时，请检查网络后重试。':compileTimeout?'编译超时，请简化程序或释放设备内存。':reason==='timeout'?'运行超时，程序已停止。':'已手动停止。';
 status(loadTimeout?'LOAD TIMEOUT':compileTimeout?'COMPILE LIMIT':reason==='timeout'?'TIME LIMIT':'STOPPED',cases[runningCase].detail,'fail');
 endRun();
}
function armCompilerTimeout(loading:boolean){
 clearTimeout(compileTimer);
 compileTimer=setTimeout(()=>{
  cases[runningCase].diagnostics+=loading?'工具链加载超过 10 分钟。请检查网络后重试。\n':'编译超过 120 秒。请简化程序或在性能更好的设备上重试。\n';
  selectStream('diagnostics');stop(loading?'load-timeout':'compile-timeout');
 },loading?600000:120000);
}
function createCompiler(){compiler=new Worker(new URL('./engine/compiler.worker.mjs',import.meta.url),{type:'module'});compiler.onerror=event=>{if(!busy)return;cases[runningCase].diagnostics+=`编译器加载失败：${event.message||'浏览器未提供错误详情，请检查网络后重试。'}\n`;selectStream('diagnostics');status('ERROR','请重试，并检查网络或浏览器可用内存。','fail');compiler?.terminate();compiler=null;endRun();};compiler.onmessage=({data})=>{
 if(data.id!==compileId||!busy)return;
 if(data.type==='status'){if(data.phase==='compiling')armCompilerTimeout(false);engine(data.phase==='loading'?'正在加载编译器…':'正在编译 main.cpp…');status(data.phase==='loading'?'LOADING':'COMPILING',data.phase==='loading'?'首次使用需要下载工具链，请稍等。':'正在编译你的程序…','busy');}
 if(data.type==='progress'){const amount=Number(data.percent)||0;$('#progress').classList.remove('hide');$('#progress span').style.width=`${amount}%`;engine(`正在加载工具链 · ${amount}%`);}
 if(data.type==='diagnostics'){for(const i of [runningCase,...queue])cases[i].diagnostics+=data.text;schedulePaint();}
 if(data.type==='compile-error'||data.type==='error'){
  clearTimeout(compileTimer);if(data.message)cases[runningCase].diagnostics+=data.message+'\n';cases[runningCase].result='fail';cases[runningCase].detail='编译失败，请查看编译诊断。';selectStream('diagnostics');status('COMPILE ERROR',cases[runningCase].detail,'fail');endRun();
 }
 if(data.type==='compiled'){clearTimeout(compileTimer);$('#progress').classList.add('hide');currentBinary=data.binary;compileMs=data.compileMs;startCase();}
 };}
async function run(all:boolean){if(busy)return;const code=editor.state.doc.toString();if(!code.trim()){toast('先写一点 C++ 代码吧。');return;}if(new TextEncoder().encode(code).length>524288){toast('源代码最大支持 512 KiB。');return;}const indices=all?cases.map((_,i)=>i):[activeCase];if(indices.some(i=>new TextEncoder().encode(cases[i].input).length>1048576)){toast('每组标准输入最多 1 MiB。');return;}if(!('WebAssembly'in window)||!('Worker'in window)||!('DecompressionStream'in window)){toast('当前浏览器缺少所需功能，请更新浏览器后重试。');return;}
 clearTimeout(idleTimer);currentCode=code;currentOptions={...options};queue=[...indices];runningCase=queue.shift()!;selectCase(runningCase);for(const i of indices){Object.assign(cases[i],{stdout:'',stderr:'',diagnostics:'',result:'',detail:''});}setBusy(true);selectStream('stdout');if(smallScreen.matches)setPane('output');save();status('LOADING','正在准备编译器…','busy');if(!compiler)createCompiler();compileId=++sequence;armCompilerTimeout(true);compiler!.postMessage({type:'compile',id:compileId,code:currentCode,options:currentOptions});
}
function startCase(){runId=++sequence;const id=runId;const item=cases[runningCase];selectCase(runningCase);runner=new Worker(new URL('./engine/runtime.worker.mjs',import.meta.url),{type:'module'});status('STARTING',`${item.name} · 正在准备运行…`,'busy');runTimer=setTimeout(()=>{status('ERROR','程序初始化超时。','fail');endRun();},15000);
 runner.onerror=event=>{item.stderr+=event.message+'\n';item.result='fail';item.detail='运行失败。';selectStream('stderr');status('RUNTIME ERROR',item.detail,'fail');endRun();};runner.onmessage=({data})=>{
  if(!busy||data.id!==runId)return;
  if(data.type==='running'){clearTimeout(runTimer);runTimer=setTimeout(()=>stop('timeout'),currentOptions.timeLimit*1000);status('RUNNING',`${item.name} · 时限 ${currentOptions.timeLimit} 秒`,'busy');engine('程序正在本地运行…');}
  if(data.type==='output'){if(data.stream==='stderr')item.stderr+=data.text;else item.stdout+=data.text;schedulePaint();}
  if(data.type==='done'){clearTimeout(runTimer);runner?.terminate();runner=null;item.compileMs=compileMs;item.runMs=data.runMs;item.memoryBytes=data.memoryBytes;let title='FINISHED';let result='';let detail=`运行 ${data.runMs.toFixed(1)} ms · 编译 ${compileMs.toFixed(0)} ms · 退出码 ${data.exitCode}`;
   if(data.exitCode!==0||data.reason!=='ok'){title=data.reason==='output-limit'?'OUTPUT LIMIT':'RUNTIME ERROR';result='fail';if(item.stderr)selectStream('stderr');}
   else if(item.expected.length){const comparison=compareOutput(item.stdout,item.expected,currentOptions.compare);title=comparison.pass?'PASS':'WRONG ANSWER';result=comparison.pass?'pass':'fail';detail=`${comparison.detail} · ${data.runMs.toFixed(1)} ms`;}
   item.result=result||'done';item.detail=detail;status(title,detail,result);renderCases();paintOutput();
   if(queue.length){runningCase=queue.shift()!;startCase();}else{endRun();}
  }
 };runner.postMessage({id,binary:currentBinary,stdin:item.input});
}
function updateSettings(){for(const key of ['standard','optimization','timeLimit','memoryMb','compare'] as const)$<HTMLSelectElement>(`#${key}`).value=String(options[key]);$('#code-standard').textContent=options.standard.toUpperCase();$('#limits-summary').textContent=`${options.timeLimit}s / ${options.memoryMb} MiB`;}
$('#run').onclick=()=>void run(false);$('#run-all').onclick=()=>void run(true);$('#stop').onclick=()=>stop();
for(const key of ['standard','optimization','timeLimit','memoryMb','compare'] as const)$('#'+key).onchange=()=>{const value=$<HTMLSelectElement>('#'+key).value;if(key==='timeLimit'||key==='memoryMb')options[key]=Number(value);else options[key]=value;updateSettings();scheduleSave();};
$('#settings-button').onclick=()=>{$<HTMLDialogElement>('#settings-dialog').showModal();};$('#help-button').onclick=()=>{$<HTMLDialogElement>('#help-dialog').showModal();};
document.querySelectorAll<HTMLButtonElement>('.dialog-close').forEach(btn=>btn.onclick=()=>btn.closest('dialog')!.close());
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
document.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach(btn=>btn.onclick=()=>setPane(btn.dataset.pane!));
document.querySelectorAll<HTMLButtonElement>('[data-stream]').forEach(btn=>btn.onclick=()=>selectStream(btn.dataset.stream!));
for(const field of ['stdin','expected'])$('#'+field).addEventListener('input',()=>{cases[activeCase][field==='stdin'?'input':'expected']=$<HTMLTextAreaElement>('#'+field).value;scheduleSave();});
$('#sample-select').onchange=()=>{const value=$<HTMLSelectElement>('#sample-select').value;if(value==='')return;const s=samples[Number(value)];editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:s.code}});cases=[freshCase('样例 01',s.input,s.expected)];selectCase(0);selectStream('stdout');status('READY',s.tag);$<HTMLSelectElement>('#sample-select').value='';scheduleSave();toast(`已加载 ${s.name} 模板`);};
$('#import').onclick=()=>$<HTMLInputElement>('#file').click();$('#file').onchange=async()=>{const file=$<HTMLInputElement>('#file').files?.[0];if(!file)return;if(file.size>524288){toast('文件最大支持 512 KiB。');return;}editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:await file.text()}});$<HTMLInputElement>('#file').value='';toast('代码已导入。');};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([editor.state.doc.toString()],{type:'text/x-c++src;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='main.cpp';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#copy').onclick=async()=>{const c=cases[activeCase];const value=stream==='stdout'?c.stdout:stream==='stderr'?c.stderr:c.diagnostics;try{await navigator.clipboard.writeText(value);toast('已复制。');}catch{toast('未能访问剪贴板，请选中输出后复制。');}};
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void run(false);}if(event.key==='Escape'&&busy)stop();});
window.addEventListener('pagehide',save);smallScreen.addEventListener('change',()=>editor.requestMeasure());updateSettings();selectCase(0);
