// Local-only, read-only fixture audit. Usage: node scripts/verify-capital-gpu.mjs [9360]
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {connectCapitalAudit} from './capital-cdp-client.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'tmp/sol-remake-audit-20261003/gpu');
const port=Number(process.argv[2]??9360);
const smoke=process.argv[3]==='--smoke';
if(process.argv[3]&&!smoke)throw new Error('Only optional flag is --smoke (worst case + lifecycle).');
if(!Number.isInteger(port)||port<1024||port>65535||port===9356)
  throw new Error('Use the dedicated audit port (default 9360); 9356 is forbidden.');
await mkdir(output,{recursive:true});
try {
  const previous=JSON.parse(await readFile(resolve(output,'results.json'),'utf8'));
  await copyFile(resolve(output,'results.json'),resolve(output,`results-${previous.startedAt.replace(/[:.]/g,'-')}.json`));
}catch(error){if(error.code!=='ENOENT')throw error;}
const report={startedAt:new Date().toISOString(),mode:smoke?'worst-and-lifecycle':'full',port,fixture:'http://127.0.0.1:3130/capital-contact-audit.html',
  limits:{gpuDrawCallsPerPaint:256,textureBytes:64*1024*1024,bufferBytes:16*1024},
  limitMeaning:'Independent generous audit ceilings, not renderer contracts. Metrics missing from the painter are reported as unverified.',
  comparisonMeaning:'Color delta = max absolute RGBA channel delta; >20 ratio uses all backing pixels. Bboxes use top-left backing-pixel coordinates. No tolerance turns Canvas/GPU differences into exact matches.',
  cases:[],lifecycle:[],errors:[]};
for(const path of ['src/components/BattleCapitalCanvas.tsx','src/utils/capitalGpuBatch.ts','src/utils/capitalSpriteRaster.ts','src/utils/capitalCachedStack.ts','src/utils/battlePresentation.ts','src/capitalContactAudit.ts']) {
  (report.sourceSha256??={})[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
}
let client;
try {
  client=await connectCapitalAudit(port);
  // Shared source may change during the audit. Freeze only this isolated tab's
  // Vite hot channel; the parent 9356 tab and source files are untouched.
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const Native=window.WebSocket;
    window.WebSocket=new Proxy(Native,{construct(Target,args){
      if([args[1]].flat().includes('vite-hmr')){
        const socket=new EventTarget();
        Object.assign(socket,{url:String(args[0]),protocol:'vite-hmr',readyState:1,bufferedAmount:0,send(){},close(){this.readyState=3;}});
        setTimeout(()=>{socket.dispatchEvent(new Event('open'));socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'connected'})}));},0);
        return socket;
      }
      return Reflect.construct(Target,args);
    }});
  }`});
  report.isolatedTabHmrSuppressed=true;
  await client.send('Page.navigate',{url:report.fixture});
  let ready=false;
  for(let i=0;i<50;i++) {
    ready=await client.evaluate('Boolean(window.capitalAudit?.sprites?.coin?.complete)');
    if(ready)break;
    await new Promise(ok=>setTimeout(ok,100));
  }
  if(!ready)throw new Error('Fixture did not expose capitalAudit within 5 seconds.');
  const api=await client.evaluate(`({paint:typeof window.capitalAudit.paintBattleCapitalGpuCanvas,dispose:typeof window.capitalAudit.disposeBattleCapitalGpuCanvas})`);
  report.api=api;
  if(api.paint!=='function'||api.dispose!=='function') {
    report.status='gpu-api-unavailable';
    report.errors.push('GPU painter/disposer not yet exposed; no indefinite wait or Canvas fallback.');
  } else {
    report.environment=await client.evaluate(`(${installBrowserAudit.toString()})(${JSON.stringify(report.limits)})`);
    if(smoke)report.cases.push(await client.evaluate('window.solGpuAudit.worstProbe()'));
    else {
    for(const [width,height] of [[378,366],[824,159],[1190,276]])for(const dpr of [1,1.25,1.5,2]) {
      const size={width,height,dpr};
      report.cases.push(...await client.evaluate(`window.solGpuAudit.statics(${JSON.stringify(size)})`));
      for(const event of [{price:2000,amount:700},{price:6e9,amount:3e9},{price:6e9,amount:4e12}]) {
        const count=await client.evaluate(`window.solGpuAudit.prepareTimeline(${JSON.stringify(event)})`);
        // Bound each synchronous CDP batch; full authored boundaries, not samples.
        for(let from=1;from<count;from+=6)
          report.cases.push(...await client.evaluate(`window.solGpuAudit.boundaries(${JSON.stringify(size)},${from},${Math.min(count,from+6)})`));
      }
      console.log(JSON.stringify({completed:size,cases:report.cases.length}));
    }
    }
    report.lifecycle=await client.evaluate('window.solGpuAudit.lifecycle()');
    const lifecycleEvidence=await client.evaluate('window.solGpuAudit.lifecycleEvidence()');
    report.lifecycleEvidence=[];
    for(const [name,png] of Object.entries(lifecycleEvidence)) {
      const file=`lifecycle-${name}.png`;
      await writeFile(resolve(output,file),Buffer.from(png.split(',')[1],'base64'));
      report.lifecycleEvidence.push(file);
    }
    report.resources=await client.evaluate('window.solGpuAudit.finish()');
    const cross=report.cases.filter(r=>r.canvasGpu);
    const strict=report.cases.filter(r=>r.strictGpu);
    report.summary={cases:report.cases.length,canvasGpuComparisons:cross.length,
      canvasGpuExact:cross.filter(r=>r.canvasGpu.differingPixels===0).length,
      maxColorDelta:Math.max(0,...cross.map(r=>r.canvasGpu.maxChannelDelta)),
      maxOver20Ratio:Math.max(0,...cross.map(r=>r.canvasGpu.over20Ratio)),
      strictGpuComparisons:strict.length,strictGpuFailures:strict.filter(r=>r.strictGpu.differingPixels!==0).length,
      metricViolations:report.cases.reduce((n,r)=>n+(r.resourceViolations?.length??0),0),
      renderFailures:report.cases.filter(r=>r.error).length,
      lifecycleFailures:report.lifecycle.filter(r=>r.passed===false).length};
    report.status=report.summary.strictGpuFailures||report.summary.metricViolations||report.summary.renderFailures||report.summary.lifecycleFailures?'failed':'measured';
  }
} catch(error) {
  report.status=report.api?.paint==='function'?'failed':'blocked';report.errors.push(error.stack??String(error));
} finally {
  if(client) {
    try {await client.evaluate('window.solGpuAudit?.cleanup()');}catch(error){report.errors.push(`cleanup: ${error.message}`);}
    client.close();
  }
  report.finishedAt=new Date().toISOString();
  report.sourceSha256After={};
  for(const path of Object.keys(report.sourceSha256))report.sourceSha256After[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
  report.sourceChanged=Object.keys(report.sourceSha256).filter(path=>report.sourceSha256[path]!==report.sourceSha256After[path]);
  if(!report.summary&&report.cases.length)report.partialSummary={cases:report.cases.length,strictGpuFailures:report.cases.filter(r=>r.strictGpu&&r.strictGpu.differingPixels!==0).length,renderFailures:report.cases.filter(r=>r.error).length};
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
  await writeFile(resolve(output,'summary.json'),JSON.stringify({status:report.status,summary:report.summary,api:report.api,resources:report.resources,lifecycle:report.lifecycle,errors:report.errors},null,2));
  console.log(JSON.stringify({status:report.status,summary:report.summary,errors:report.errors,output}));
  process.exitCode=['measured'].includes(report.status)?0:1;
}

async function installBrowserAudit(limits) {
  const a=window.capitalAudit;
  const {buildCapitalStackTimeline}=await import('/src/utils/battlePresentation.ts');
  const {DEFAULT_BATTLE_VISUAL_THEME,createBattleVisualTheme,DEFAULT_BATTLE_VISUAL_THEME_METADATA}=await import('/src/data/battleVisualTheme.ts');
  const defaultTheme=DEFAULT_BATTLE_VISUAL_THEME??createBattleVisualTheme({coin:a.sprites.coin.src,pedestal:a.sprites.pedestal.src},DEFAULT_BATTLE_VISUAL_THEME_METADATA);
  const gpu=document.createElement('canvas'),cpu=document.createElement('canvas');
  const canvases=[gpu];
  const tracked=new WeakMap();
  const snapshots=[];
  const lifecycleCaptures={};
  const violations=[];
  const instrument=canvas=> {
    const original=canvas.getContext.bind(canvas);
    canvas.getContext=(...args)=> {
      const gl=original(...args);
      if(gl&&String(args[0]).startsWith('webgl')&&!tracked.has(gl)) {
        const tracker={draws:0,textures:new Set(),buffers:new Set(),createdTextures:0,deletedTextures:0,createdBuffers:0,deletedBuffers:0};
        tracked.set(gl,tracker);
        for(const [create,remove,set,created,deleted] of [['createTexture','deleteTexture','textures','createdTextures','deletedTextures'],['createBuffer','deleteBuffer','buffers','createdBuffers','deletedBuffers']]) {
          const alloc=gl[create].bind(gl),free=gl[remove].bind(gl);
          gl[create]=(...xs)=>{const item=alloc(...xs);if(item){tracker[set].add(item);tracker[created]++;}return item;};
          gl[remove]=item=>{if(item&&tracker[set].delete(item))tracker[deleted]++;return free(item);};
        }
        for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])if(typeof gl[name]==='function') {
          const originalDraw=gl[name].bind(gl);gl[name]=(...xs)=>{tracker.draws++;return originalDraw(...xs);};
        }
      }
      return gl;
    };
  };
  instrument(gpu);
  const context=canvas=>canvas.getContext('webgl2')??canvas.getContext('webgl');
  const opts=size=>({sprites:a.sprites,cssSize:{width:size.width,height:size.height},devicePixelRatio:size.dpr,frameRate:60});
  const scene=(before,after=before,p=1)=> {
    const heights=a.getCapitalColumnHeights(before),target=a.getCapitalColumnHeights(after);
    const frame={visibleUnits:before,columnHeights:heights,settledAfterColumnHeights:target,activeColumnIndices:heights.flatMap((h,i)=>target[i]>h?[i]:[]),packetSeed:42};
    const side={amount:after,marketPrice:2000,previewFrame:frame};
    const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
    s.player.frame.packetProgress=s.enemy.frame.packetProgress=p;return s;
  };
  const timelineScene=(frame,p,event)=> {
    const side={amount:event.amount,marketPrice:event.price,previewFrame:{...frame,beatDurationMs:frame.durationMs}};
    const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
    s.player.frame.packetProgress=s.enemy.frame.packetProgress=p;return s;
  };
  const copyTracker=t=>t?{observedDrawCalls:t.draws,liveTextures:t.textures.size,liveBuffers:t.buffers.size,createdTextures:t.createdTextures,deletedTextures:t.deletedTextures,createdBuffers:t.createdBuffers,deletedBuffers:t.deletedBuffers}:null;
  const paintGpu=(s,options,canvas=gpu)=> {
    const existing=context(canvas); // First use in normal matrix is warmed below with painter-selected attributes.
    const t=existing&&tracked.get(existing),before=t?.draws??0;
    const result=a.paintBattleCapitalGpuCanvas(canvas,s,options);
    if(result===null)throw new Error('GPU painter returned null (initialization failure).');
    const gl=context(canvas);
    if(!gl)throw new Error('GPU painter exposed no WebGL context.');
    const width=canvas.width,height=canvas.height;
    const raw=new Uint8Array(width*height*4);
    // CRITICAL: no await, timer, promise or CDP round trip between paint and readPixels.
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
    const glError=gl.getError();
    if(glError!==gl.NO_ERROR)throw new Error(`WebGL error ${glError} after synchronous readPixels.`);
    const pixels=new Uint8Array(raw.length),stride=width*4;
    for(let y=0;y<height;y++)pixels.set(raw.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
    const metrics=JSON.parse(JSON.stringify(result??{}));
    if(metrics.gpuDrawCalls===undefined&&Number.isFinite(metrics.drawCalls))metrics.gpuDrawCalls=metrics.drawCalls;
    const tracker=tracked.get(gl),observedDrawCalls=(tracker?.draws??0)-before;
    const resourceViolations=[];
    for(const [key,cap] of [['gpuDrawCalls',limits.gpuDrawCallsPerPaint],['textureBytes',limits.textureBytes],['bufferBytes',limits.bufferBytes]]) {
      if(Number.isFinite(metrics[key])&&metrics[key]>cap)resourceViolations.push({key,value:metrics[key],cap});
    }
    const textureBound=8*1024*1024+(a.sprites.coin.naturalWidth*a.sprites.coin.naturalHeight+a.sprites.pedestal.naturalWidth*a.sprites.pedestal.naturalHeight+width*height)*4;
    if(Number.isFinite(metrics.textureBytes)&&metrics.textureBytes>textureBound)resourceViolations.push({key:'textureBytesDimensionBound',value:metrics.textureBytes,cap:textureBound});
    if(observedDrawCalls>limits.gpuDrawCallsPerPaint)resourceViolations.push({key:'observedDrawCalls',value:observedDrawCalls,cap:limits.gpuDrawCallsPerPaint});
    violations.push(...resourceViolations);
    snapshots.push({metrics,observedDrawCalls,tracker:copyTracker(tracker)});
    return {width,height,pixels,metrics,observedDrawCalls,resourceViolations};
  };
  const paintCpu=(s,options)=> {
    const metrics=a.paintBattleCapitalCanvas(cpu,s,options);
    return {width:cpu.width,height:cpu.height,pixels:cpu.getContext('2d').getImageData(0,0,cpu.width,cpu.height).data,metrics};
  };
  const diff=(left,right)=> {
    if(left.width!==right.width||left.height!==right.height)return {dimensionMismatch:true,left:[left.width,left.height],right:[right.width,right.height],differingPixels:Number.MAX_SAFE_INTEGER,over20Ratio:1,maxChannelDelta:255};
    let differingPixels=0,differingChannels=0,over20Pixels=0,maxChannelDelta=0,sum=0;
    let minX=left.width,minY=left.height,maxX=-1,maxY=-1;
    for(let i=0;i<left.pixels.length;i+=4) {
      let delta=0;
      for(let c=0;c<4;c++){const d=Math.abs(left.pixels[i+c]-right.pixels[i+c]);if(d)differingChannels++;sum+=d;delta=Math.max(delta,d);}
      maxChannelDelta=Math.max(maxChannelDelta,delta);
      if(delta){differingPixels++;const n=i/4,x=n%left.width,y=Math.floor(n/left.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      if(delta>20)over20Pixels++;
    }
    const pixels=left.width*left.height;
    return {differingPixels,differingChannels,differingRatio:differingPixels/pixels,over20Pixels,over20Ratio:over20Pixels/pixels,maxChannelDelta,meanAbsoluteChannelDelta:sum/(pixels*4),differenceBBox:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}};
  };
  const geometry=(image,empty)=> {
    const halves=[];
    for(const [x0,x1] of [[0,Math.floor(image.width/2)],[Math.floor(image.width/2),image.width]]) {
      let minX=x1,minY=image.height,maxX=-1,maxY=-1,count=0;
      for(let y=0;y<image.height;y++)for(let x=x0;x<x1;x++) {
        const p=(y*image.width+x)*4;let d=0;
        for(let c=0;c<4;c++)d=Math.max(d,Math.abs(image.pixels[p+c]-empty.pixels[p+c]));
        if(d>20){count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      }
      halves.push({over20Pixels:count,bbox:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}});
    }
    return {method:'Pixels changed >20 from same-renderer empty scene (includes pedestal occlusion/scroll)',player:halves[0],enemy:halves[1]};
  };
  const row=(label,s,options,extra={})=> {
    try {
      const g=paintGpu(s,options),c=paintCpu(s,options);
      return {label,...extra,backingSize:[g.width,g.height],canvasGpu:diff(c,g),gpuMetrics:g.metrics,observedDrawCalls:g.observedDrawCalls,resourceViolations:g.resourceViolations};
    }catch(error){return {label,...extra,error:String(error)};}
  };
  // Let painter request the actual context attributes before any getContext probe.
  const initialResult=a.paintBattleCapitalGpuCanvas(gpu,scene(1),opts({width:378,height:366,dpr:1}));
  if(initialResult===null)throw new Error('Initial GPU painter returned null.');
  const gl=context(gpu);
  const environment={userAgent:navigator.userAgent,contextAttributes:gl?.getContextAttributes(),webglVersion:gl?.getParameter(gl.VERSION),renderer:gl?.getParameter(gl.RENDERER),initialMetrics:initialResult};
  let currentTimeline;
  window.solGpuAudit={
    worstProbe() {
      const event={price:6e9,amount:4e12},size={width:378,height:366,dpr:1.5};
      const t=buildCapitalStackTimeline({id:'gpu-audit-worst',side:'player',source:'direct',previousCapital:0,nextCapital:event.amount,marketPrice:event.price,intensity:'heavy',seed:42});
      return row('worst-fresh',timelineScene(t.frames[101],0,event),opts(size),{...size,...event,boundary:101});
    },
    statics(size) {
      const options=opts(size),out=[];
      const emptyGpu=paintGpu(scene(0),options),emptyCpu=paintCpu(scene(0),options);
      for(const units of [1,18,72,324,9216]) {
        const s=scene(units),g=paintGpu(s,options),c=paintCpu(s,options);
        out.push({label:'static',...size,units,backingSize:[g.width,g.height],canvasGpu:diff(c,g),geometry:{gpu:geometry(g,emptyGpu),canvas:geometry(c,emptyCpu)},gpuMetrics:g.metrics,observedDrawCalls:g.observedDrawCalls,resourceViolations:g.resourceViolations});
      }
      for(const progress of [0,.25,.5,.75,1]) {
        const s=scene(72,270,progress),entry=row('landing',s,options,{...size,before:72,after:270,progress});
        if(progress===1&&!entry.error){const landing=paintGpu(s,options),settled=paintGpu(scene(270),options);entry.strictGpu=diff(landing,settled);}
        out.push(entry);
      }
      return out;
    },
    prepareTimeline(event) {
      const t=buildCapitalStackTimeline({id:'gpu-audit',side:'player',source:'direct',previousCapital:0,nextCapital:event.amount,marketPrice:event.price,intensity:'heavy',seed:42});
      currentTimeline={t,event};return t.frames.length;
    },
    boundaries(size,from,to) {
      const {t,event}=currentTimeline,options=opts(size),out=[];
      for(let i=from;i<to;i++) {
        const s0=timelineScene(t.frames[i-1],1,event),s1=timelineScene(t.frames[i],0,event);
        const before=row('timeline-before',s0,options,{...size,...event,boundary:i});
        const after=row('timeline-after',s1,options,{...size,...event,boundary:i});
        try{after.strictGpu=diff(paintGpu(s0,options),paintGpu(s1,options));}catch(error){after.error=String(error);}
        out.push(before,after);
      }
      return out;
    },
    async lifecycle() {
      const results=[],s=scene(72),size={width:378,height:366,dpr:1},options=opts(size);
      const base=paintGpu(s,options);
      lifecycleCaptures.base=base;
      results.push({test:'init',passed:true,metrics:base.metrics,attributes:context(gpu).getContextAttributes()});
      paintGpu(s,opts({width:1190,height:276,dpr:2}));
      const back=paintGpu(s,options),resizeDiff=diff(base,back);
      lifecycleCaptures.resizeBack=back;
      results.push({test:'resize-and-back',passed:resizeDiff.differingPixels===0,diff:resizeDiff,before:base.metrics,after:back.metrics});
      const theme={...defaultTheme,id:'sol-gpu-audit-palette',version:defaultTheme.version+1,palette:{...defaultTheme.palette,background:'#102030',player:'#33cc77',enemy:'#cc7733'}};
      const themedOptions={...options,sprites:{...a.sprites,theme}};
      const themedGpu=paintGpu(s,themedOptions),themedCpu=paintCpu(s,themedOptions),themeDelta=diff(base,themedGpu);
      const restored=paintGpu(s,options),restoredDelta=diff(base,restored);
      lifecycleCaptures.themeBack=restored;
      results.push({test:'theme-and-back',passed:themeDelta.differingPixels>0&&restoredDelta.differingPixels===0,themeChange:themeDelta,canvasGpu:diff(themedCpu,themedGpu),restored:restoredDelta,before:base.metrics,after:restored.metrics});
      const tracker=tracked.get(context(gpu)),beforeDispose=copyTracker(tracker);
      a.disposeBattleCapitalGpuCanvas(gpu);
      const afterDispose=copyTracker(tracker);
      results.push({test:'dispose',passed:afterDispose?.liveTextures===0&&afterDispose?.liveBuffers===0,before:beforeDispose,after:afterDispose});
      a.disposeBattleCapitalGpuCanvas(gpu);
      results.push({test:'dispose-idempotent',passed:true});
      const reinit=paintGpu(s,options),reinitDiff=diff(base,reinit);
      lifecycleCaptures.reinit=reinit;
      results.push({test:'reinit',passed:reinitDiff.differingPixels===0,diff:reinitDiff,metrics:reinit.metrics});
      const loss=context(gpu).getExtension('WEBGL_lose_context');
      if(!loss)results.push({test:'WEBGL_lose_context',passed:null,reason:'Extension unavailable.'});
      else {
        const eventWithin=(event,action)=>new Promise(resolve=> {
          const onEvent=e=>{if(event==='webglcontextlost')e.preventDefault();clearTimeout(timer);resolve(true);};
          const timer=setTimeout(()=>{gpu.removeEventListener(event,onEvent);resolve(false);},2000);
          gpu.addEventListener(event,onEvent,{once:true});action();
        });
        const lost=await eventWithin('webglcontextlost',()=>loss.loseContext());
        // Let the loss dispatch finish before testing/asking for restoration.
        await new Promise(ok=>setTimeout(ok,100));
        let lostResult,lossError;
        try{lostResult=a.paintBattleCapitalGpuCanvas(gpu,s,options);}catch(error){lossError=String(error);}
        results.push({test:'context-lost-paint',passed:lost&&lostResult===null,lost,lostResult,lossError});
        const restoredEvent=await eventWithin('webglcontextrestored',()=>loss.restoreContext());
        try {
          const recovered=paintGpu(s,options),recoveryDiff=diff(base,recovered);
          lifecycleCaptures.contextRestored=recovered;
          results.push({test:'context-restore',passed:restoredEvent&&recoveryDiff.differingPixels===0,restoredEvent,diff:recoveryDiff,metrics:recovered.metrics});
        }catch(error){results.push({test:'context-restore',passed:false,restoredEvent,error:String(error)});}
      }
      return results;
    },
    lifecycleEvidence() {
      return Object.fromEntries(Object.entries(lifecycleCaptures).map(([name,frame])=>{
        const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.pixels),frame.width,frame.height),0,0);
        return [name,canvas.toDataURL('image/png')];
      }));
    },
    finish() {
      const missing=['gpuDrawCalls','textureBytes','bufferBytes'].filter(key=>!snapshots.some(s=>Number.isFinite(s.metrics[key])));
      return {paints:snapshots.length,missingMetrics:missing,peak:Object.fromEntries(['gpuDrawCalls','textureBytes','bufferBytes'].map(key=>[key,Math.max(0,...snapshots.map(s=>Number(s.metrics[key])||0))])),peakObservedDrawCalls:Math.max(0,...snapshots.map(s=>s.observedDrawCalls)),violations,first:snapshots[0],last:snapshots.at(-1)};
    },
    cleanup(){for(const canvas of canvases){a.disposeBattleCapitalGpuCanvas(canvas);canvas.remove();}cpu.remove();},
  };
  return environment;
}
