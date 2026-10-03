// Dedicated local fixture audit. Run only after the parent announces API readiness.
// node scripts/verify-casino-visuals.mjs 9360 --smoke | --full | --stamps | --backgrounds | --override-src
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectCapitalAudit} from './capital-cdp-client.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.argv[2]??9360),mode=process.argv[3]??'--smoke';
if(port!==9360||!['--smoke','--full','--stamps','--backgrounds','--override-src'].includes(mode))throw new Error('Only dedicated port 9360 and --smoke/--full/--stamps/--backgrounds/--override-src are supported.');
const startedAt=new Date().toISOString();
const output=resolve(root,'tmp/casino-polish-20261003/sol',`${startedAt.replace(/[:.]/g,'-')}-${mode.slice(2)}`);
await mkdir(output,{recursive:true});
const sourcePaths=['src/utils/capitalSpriteRaster.ts','src/utils/capitalCachedStack.ts','src/utils/capitalGpuBatch.ts','src/utils/capitalCasinoBackdrop.ts','src/components/BattleCapitalCanvas.tsx','src/components/BattleCapitalCanvas.css','src/utils/battlePresentation.ts','src/capitalContactAudit.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')])));
const report={startedAt,mode:mode.slice(2),port,output,sourceBefore:await hashes(),checks:[],renderer:[],errors:[],
  definitions:{
    rgba:'Raw top-left RGBA; max-channel delta >20 is reported per backing pixel.',
    rendererGate:'No pixel may exceed color delta 20. Exact count and maximum delta are always reported separately.',
    strictGate:'GPU landing/boundaries and resize require exact RGBA equality.',
    backgroundGate:'親による8bit合成丸め許容: changed.over20Pixels >0 and freshMatch.maxDelta <=1. Raw differing pixels remain recorded.',
    shapeGate:'Alpha>=128 bbox edges must exactly match the independent native-pixel nearest reference.',
    edgeBand:'Common mask: union of alpha>=128 silhouette boundaries from both stamps, dilated one pixel to include the inner/outer two-pixel transition. Original zero-neighbor counts remain reported.',
    areaAlpha:'Independent 8x8 stratified native-alpha samples per destination pixel, averaged as Float64 without rounding. Whole image and reference-defined silhouette band are compared by MAE/RMSE on 0..255 alpha.',
    stampGate:'Parent assistant acceptance design: for every sample size, whole-image and reference-edge alpha RMSE must both decrease, with unchanged bbox. All MAE results and count diagnostics remain recorded.',
    foregroundWitness:'Actual transparent Canvas foreground composited by the production painter; not a recreated tray.'}};
let client,hmrScript;
try {
  client=await connectCapitalAudit(port);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled',{cacheDisabled:true});
  hmrScript=await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const Native=window.WebSocket;
    window.WebSocket=new Proxy(Native,{construct(Target,args){
      if([args[1]].flat().includes('vite-hmr')){
        const s=new EventTarget();Object.assign(s,{readyState:1,url:String(args[0]),protocol:'vite-hmr',bufferedAmount:0,send(){},close(){this.readyState=3;}});
        setTimeout(()=>{s.dispatchEvent(new Event('open'));s.dispatchEvent(new MessageEvent('message',{data:'{"type":"connected"}'}));},0);return s;
      }return Reflect.construct(Target,args);
    }});
  }`});
  await client.send('Page.navigate',{url:'http://127.0.0.1:3130/capital-contact-audit.html'});
  const deadline=Date.now()+20000;let readiness;
  do {
    try {readiness=await client.evaluate(`(()=>{const a=window.capitalAudit;const images={coin:a?.sprites?.coin,pedestal:a?.sprites?.pedestal,wide:a?.sprites?.backgrounds?.wide,portrait:a?.sprites?.backgrounds?.portrait};return {api:!!(a?.paintBattleCapitalCanvas&&a?.paintBattleCapitalGpuCanvas&&a?.disposeBattleCapitalGpuCanvas),images:Object.fromEntries(Object.entries(images).map(([k,v])=>[k,{present:!!v,complete:!!v?.complete,width:v?.naturalWidth??0,height:v?.naturalHeight??0}]))};})()`);}catch(error){readiness={navigationError:error.message};}
    if(readiness?.api&&Object.values(readiness.images).every(i=>i.complete&&i.width>0&&i.height>0))break;
    await new Promise(ok=>setTimeout(ok,100));
  }while(Date.now()<deadline);
  report.readiness=readiness;
  if(!readiness?.api||!Object.values(readiness.images).every(i=>i.complete&&i.width>0&&i.height>0))throw new Error('Casino fixture API/resources not ready after bounded 20-second wait.');
  report.environment=await client.evaluate(`(${installCasinoAudit.toString()})()`);
  const sizes=['--stamps','--override-src'].includes(mode)?[]:mode==='--smoke'?[{width:378,height:366,dpr:1.5}]:
    [[378,366],[824,159],[1190,276]].flatMap(([width,height])=>[1,1.25,1.5,2].map(dpr=>({width,height,dpr})));
  if(mode==='--override-src')report.checks.push(await client.evaluate('window.casinoVisualAudit.overrideSourceSwap()'));
  else if(mode!=='--backgrounds')report.checks.push(await client.evaluate('window.casinoVisualAudit.stamps()'));
  for(const size of sizes) {
    if(mode==='--backgrounds') {
      report.checks.push(...await client.evaluate(`window.casinoVisualAudit.backgroundLoading(${JSON.stringify(size)})`));
      console.log(JSON.stringify({completed:size,checks:report.checks.length}));continue;
    }
    report.checks.push(...await client.evaluate(`window.casinoVisualAudit.structure(${JSON.stringify(size)})`));
    report.checks.push(...await client.evaluate(`window.casinoVisualAudit.backgroundLoading(${JSON.stringify(size)})`));
    report.checks.push(...await client.evaluate(`window.casinoVisualAudit.resize(${JSON.stringify(size)})`));
    if(mode==='--smoke') {
      await client.evaluate('window.casinoVisualAudit.timeline({price:6e9,amount:4e12})');
      report.renderer.push(...await client.evaluate(`window.casinoVisualAudit.timelineBatch(${JSON.stringify(size)},101,102,true)`));
    } else {
      report.renderer.push(...await client.evaluate(`window.casinoVisualAudit.statics(${JSON.stringify(size)})`));
      for(const event of [{price:2000,amount:700},{price:6e9,amount:3e9},{price:6e9,amount:4e12}]) {
        const count=await client.evaluate(`window.casinoVisualAudit.timeline(${JSON.stringify(event)})`);
        for(let from=1;from<count;from+=4)report.renderer.push(...await client.evaluate(`window.casinoVisualAudit.timelineBatch(${JSON.stringify(size)},${from},${Math.min(count,from+4)},false)`));
      }
    }
    console.log(JSON.stringify({completed:size,checks:report.checks.length,renderer:report.renderer.length}));
  }
  report.resources=await client.evaluate('window.casinoVisualAudit.resources()');
  report.summary={checks:report.checks.length,checkFailures:report.checks.filter(x=>x.passed===false).length,
    rendererComparisons:report.renderer.length,rendererExact:report.renderer.filter(x=>x.cross?.differingPixels===0).length,
    maxColorDelta:Math.max(0,...report.renderer.map(x=>x.cross?.maxDelta??0)),maxOver20Ratio:Math.max(0,...report.renderer.map(x=>x.cross?.over20Ratio??0)),
    rendererFailures:report.renderer.filter(x=>x.error||x.cross?.over20Pixels>0||x.strictGpu?.differingPixels>0).length,
    strictComparisons:report.renderer.filter(x=>x.strictGpu).length,strictFailures:report.renderer.filter(x=>x.strictGpu?.differingPixels>0).length};
  report.status=report.summary.checkFailures||report.summary.rendererFailures||report.resources.violations.length?'failed':'passed';
  const evidence=await client.evaluate('window.casinoVisualAudit.evidence()');
  report.evidence=[];
  for(const [name,png] of Object.entries(evidence)) {const file=`${name}.png`;await writeFile(resolve(output,file),Buffer.from(png.split(',')[1],'base64'));report.evidence.push(file);}
}catch(error){report.status='failed';report.errors.push(error.stack??String(error));}
finally {
  if(client){try{await client.evaluate('window.casinoVisualAudit?.cleanup()');if(hmrScript)await client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hmrScript.identifier});}catch(error){report.errors.push(`cleanup: ${error.message}`);}client.close();}
  report.sourceAfter=await hashes();report.sourceChanged=sourcePaths.filter(p=>report.sourceBefore[p]!==report.sourceAfter[p]);
  if(report.sourceChanged.length){report.status='source-changed';report.errors.push('Shared source changed during audit; see hashes.');}
  report.finishedAt=new Date().toISOString();
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
  await writeFile(resolve(root,'tmp/casino-polish-20261003/sol',`latest-${mode.slice(2)}.json`),JSON.stringify({status:report.status,summary:report.summary,output,errors:report.errors},null,2));
  console.log(JSON.stringify({status:report.status,summary:report.summary,output,errors:report.errors}));
  process.exitCode=report.status==='passed'?0:1;
}

async function installCasinoAudit() {
  const a=window.capitalAudit;
  const {getCapitalSpriteRaster}=await import('/src/utils/capitalSpriteRaster.ts');
  const {drawCachedCapitalStack}=await import('/src/utils/capitalCachedStack.ts');
  const {CapitalBitmapCache}=await import('/src/utils/capitalBitmapCache.ts');
  const {buildCapitalStackTimeline}=await import('/src/utils/battlePresentation.ts');
  const {DEFAULT_BATTLE_VISUAL_THEME_METADATA}=await import('/src/data/battleVisualTheme.ts');
  const {resolveBattleCapitalSfcSideGeometry:geometry,resolveBattleCapitalSfcRowBaseY:rowY}=await import('/src/utils/battleCapitalCanvasLayout.ts');
  const {resolveCapitalViewportScroll}=await import('/src/utils/capitalViewportScroll.ts');
  const crop=a.sprites.theme?.coin.crop??DEFAULT_BATTLE_VISUAL_THEME_METADATA.coin.crop;
  const decode=image=>Promise.race([image.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image decode timeout (10s)')),10000))]);
  for(const image of [a.sprites.coin,a.sprites.pedestal,a.sprites.backgrounds.wide,a.sprites.backgrounds.portrait]) {
    const url=new URL(image.currentSrc||image.src,location.href);
    if(url.origin!==location.origin)throw new Error(`Non-local image refused: ${url.origin}`);
    await decode(image);
  }
  const gpu=document.createElement('canvas'),cpu=document.createElement('canvas'),ownedGpu=new Set([gpu]);
  const saved={},observed=[];
  const imageFromCanvas=canvas=>({width:canvas.width,height:canvas.height,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data});
  const options=(size,sprites=a.sprites)=>({sprites,cssSize:{width:size.width,height:size.height},devicePixelRatio:size.dpr,frameRate:60});
  const readGpu=canvas=> {
    const gl=canvas.getContext('webgl2');if(!gl)throw new Error('WebGL2 unavailable');
    const raw=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
    const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(`WebGL read error ${error}`);
    const pixels=new Uint8Array(raw.length),stride=canvas.width*4;
    for(let y=0;y<canvas.height;y++)pixels.set(raw.subarray((canvas.height-1-y)*stride,(canvas.height-y)*stride),y*stride);
    return {width:canvas.width,height:canvas.height,pixels};
  };
  const paint=(kind,scene,size,sprites=a.sprites,canvas=kind==='gpu'?gpu:cpu,witness=false)=> {
    let foreground;const context=kind==='canvas'?canvas.getContext('2d',{alpha:false,desynchronized:true}):null;
    const draw=context?.drawImage;
    if(context&&witness)context.drawImage=function(source,...args){
      if(source instanceof HTMLCanvasElement&&source.width===canvas.width&&source.height===canvas.height)foreground=imageFromCanvas(source);
      return draw.call(this,source,...args);
    };
    try {
      const metrics=(kind==='gpu'?a.paintBattleCapitalGpuCanvas:a.paintBattleCapitalCanvas)(canvas,scene,options(size,sprites));
      if(metrics===null)throw new Error(`${kind} painter returned null`);
      // Synchronous read immediately after paint; no await/CDP round trip here.
      const image=kind==='gpu'?readGpu(canvas):imageFromCanvas(canvas);
      observed.push({kind,metrics});return {...image,metrics,foreground};
    }finally{if(context&&witness)context.drawImage=draw;}
  };
  const diff=(x,y)=> {
    if(x.width!==y.width||x.height!==y.height)return {dimensionMismatch:true,differingPixels:Infinity,over20Pixels:Infinity,over20Ratio:1,maxDelta:255};
    let differingPixels=0,over20Pixels=0,maxDelta=0,sum=0,minX=x.width,minY=x.height,maxX=-1,maxY=-1;
    for(let i=0;i<x.pixels.length;i+=4){let d=0;for(let c=0;c<4;c++){const v=Math.abs(x.pixels[i+c]-y.pixels[i+c]);d=Math.max(d,v);sum+=v;}if(d){differingPixels++;const n=i/4,px=n%x.width,py=Math.floor(n/x.width);minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);}if(d>20)over20Pixels++;maxDelta=Math.max(maxDelta,d);}
    return {differingPixels,over20Pixels,over20Ratio:over20Pixels/(x.width*x.height),maxDelta,meanAbsoluteDelta:sum/x.pixels.length,bbox:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}};
  };
  const alpha=(image,threshold=128)=> {
    let partial=0,edgePartial=0,opaque=0,mass=0,minX=image.width,minY=image.height,maxX=-1,maxY=-1;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++) {
      const v=image.pixels[(y*image.width+x)*4+3];mass+=v/255;if(v===255)opaque++;
      if(v>0&&v<255){partial++;let edge=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=image.width||yy<0||yy>=image.height||image.pixels[(yy*image.width+xx)*4+3]===0)edge=true;}if(edge)edgePartial++;}
      if(v>=threshold){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    }
    return {partial,edgePartial,opaque,alphaMass:mass,bbox:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}};
  };
  const edgeDrift=(a,b)=>!a||!b?Infinity:Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.x+a.width-b.x-b.width),Math.abs(a.y+a.height-b.y-b.height));
  const sharedEdgeBand=(left,right)=> {
    const {width:w,height:h}=left,mask=new Uint8Array(w*h);
    for(const frame of [left,right]) {
      const inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&frame.pixels[(y*w+x)*4+3]>=128;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
        let boundary=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(inside(x,y)!==inside(x+dx,y+dy))boundary=true;
        if(boundary)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)mask[yy*w+xx]=1;}
      }
    }
    const count=frame=>{let partial=0,midAlpha=0;for(let i=0;i<mask.length;i++)if(mask[i]){const a=frame.pixels[i*4+3];if(a>0&&a<255)partial++;if(a>=16&&a<=239)midAlpha++;}return {partial,midAlpha};};
    return {maskPixels:mask.reduce((sum,x)=>sum+x,0),nearest:count(left),smooth:count(right)};
  };
  const areaAlphaReference=(original,w,h)=> {
    const reference=new Float64Array(w*h),mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      let sum=0;
      for(let sy=0;sy<8;sy++)for(let sx=0;sx<8;sx++) {
        const px=Math.min(original.width-1,Math.max(0,Math.floor(crop.x+(x+(sx+.5)/8)*crop.width/w)));
        const py=Math.min(original.height-1,Math.max(0,Math.floor(crop.y+(y+(sy+.5)/8)*crop.height/h)));
        sum+=original.pixels[(py*original.width+px)*4+3];
      }
      reference[y*w+x]=sum/64;
    }
    // Define the boundary from the independent reference, never from either candidate.
    const inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&reference[y*w+x]>=128;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      let boundary=false;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(inside(x,y)!==inside(x+dx,y+dy))boundary=true;
      if(boundary)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h)mask[yy*w+xx]=1;
      }
    }
    return {reference,mask};
  };
  const alphaError=(nearest,smooth,reference,mask=null)=> {
    let count=0,nearestAbsSum=0,smoothAbsSum=0,nearestSquaredSum=0,smoothSquaredSum=0,nearestMax=0,smoothMax=0;
    for(let i=0;i<reference.length;i++)if(!mask||mask[i]) {
      const n=Math.abs(nearest.pixels[i*4+3]-reference[i]),s=Math.abs(smooth.pixels[i*4+3]-reference[i]);
      count++;nearestAbsSum+=n;smoothAbsSum+=s;nearestSquaredSum+=n*n;smoothSquaredSum+=s*s;nearestMax=Math.max(nearestMax,n);smoothMax=Math.max(smoothMax,s);
    }
    return {count,nearestAbsSum,smoothAbsSum,nearestSquaredSum,smoothSquaredSum,nearestMAE:nearestAbsSum/count,smoothMAE:smoothAbsSum/count,nearestRMSE:Math.sqrt(nearestSquaredSum/count),smoothRMSE:Math.sqrt(smoothSquaredSum/count),nearestMax,smoothMax,maeReductionPercent:nearestAbsSum>0?100*(1-smoothAbsSum/nearestAbsSum):null,maeImproved:count>0&&smoothAbsSum<nearestAbsSum,rmseImproved:count>0&&smoothSquaredSum<nearestSquaredSum};
  };
  const makeScene=(before,after=before,p=1,extra={})=> {
    const heights=a.getCapitalColumnHeights(before),target=a.getCapitalColumnHeights(after);
    const frame={visibleUnits:before,columnHeights:heights,settledAfterColumnHeights:target,activeColumnIndices:heights.flatMap((v,i)=>target[i]>v?[i]:[]),packetSeed:42,...extra};
    const side={amount:after,marketPrice:2000,previewFrame:frame};
    const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});s.player.frame.packetProgress=s.enemy.frame.packetProgress=p;return s;
  };
  const timelineScene=(frame,p,event)=> {
    const side={amount:event.amount,marketPrice:event.price,previewFrame:{...frame,beatDurationMs:frame.durationMs}};
    const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});s.player.frame.packetProgress=s.enemy.frame.packetProgress=p;return s;
  };
  const row=(label,scene,size,meta={})=> {
    const g=paint('gpu',scene,size),c=paint('canvas',scene,size),cross=diff(g,c);
    if(!saved.sampleGpu||cross.over20Ratio>(saved.worstRatio??-1)){saved.sampleGpu=g;saved.sampleCanvas=c;saved.worstRatio=cross.over20Ratio;}
    return {label,...size,...meta,cross,gpu:g.metrics,canvas:c.metrics};
  };
  let current;
  window.casinoVisualAudit={
    async overrideSourceSwap() {
      const size={width:378,height:366,dpr:1},scene=makeScene(72),sceneBefore=JSON.stringify(scene);
      const dataUrl=color=>{const c=document.createElement('canvas');c.width=c.height=2;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,2,2);return c.toDataURL('image/png');};
      const blueUrl=dataUrl('#1040c0'),redUrl=dataUrl('#c02030'),backgroundImage=new Image();
      const sameOptions={...options(size),backgroundImage};
      const canvases={canvas:document.createElement('canvas'),gpu:document.createElement('canvas')};ownedGpu.add(canvases.gpu);
      const capture=kind=> {
        const canvas=canvases[kind],metrics=(kind==='gpu'?a.paintBattleCapitalGpuCanvas:a.paintBattleCapitalCanvas)(canvas,scene,sameOptions);
        if(metrics===null)throw new Error(`${kind} override paint returned null`);
        const image=kind==='gpu'?readGpu(canvas):imageFromCanvas(canvas);
        observed.push({kind,metrics});return {...image,metrics};
      };
      const point=frame=>{const x=Math.floor(frame.width*.5),y=Math.floor(frame.height*.1);return {x,y,rgba:[...frame.pixels.subarray((y*frame.width+x)*4,(y*frame.width+x)*4+4)]};};
      try {
        backgroundImage.src=blueUrl;await decode(backgroundImage);
        const before={canvas:capture('canvas'),gpu:capture('gpu')};
        backgroundImage.src=redUrl;await decode(backgroundImage);
        const after={canvas:capture('canvas'),gpu:capture('gpu')};
        const cases=['canvas','gpu'].map(kind=>{const changed=diff(before[kind],after[kind]),blue=point(before[kind]),red=point(after[kind]);return {kind,changed,blue,red,passed:changed.over20Pixels>0&&blue.rgba[2]>blue.rgba[0]&&red.rgba[0]>red.rgba[2],before:before[kind].metrics,after:after[kind].metrics};});
        saved.overrideBlueGpu=before.gpu;saved.overrideRedGpu=after.gpu;
        const sceneUnchanged=JSON.stringify(scene)===sceneBefore;
        return {test:'same-image-data-url-background-override',...size,passed:sceneUnchanged&&cases.every(x=>x.passed),sceneUnchanged,sameOptionsAndImageReused:true,syntheticSourceSize:[2,2],cases};
      }finally{a.disposeBattleCapitalGpuCanvas(canvases.gpu);ownedGpu.delete(canvases.gpu);}
    },
    stamps() {
      const native=document.createElement('canvas');native.width=a.sprites.coin.naturalWidth;native.height=a.sprites.coin.naturalHeight;
      const ctx=native.getContext('2d',{willReadFrequently:true});ctx.drawImage(a.sprites.coin,0,0);const original=imageFromCanvas(native);
      const sizes=[[26,6],[33,8],[39,9],[52,12],[44,10],[55,13],[66,15],[88,20]],samples=[];
      for(const [w,h] of sizes) {
        const smooth=imageFromCanvas(getCapitalSpriteRaster(a.sprites.coin,crop,w,h)),pixels=new Uint8ClampedArray(w*h*4);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.floor(crop.x+(x+.5)*crop.width/w),sy=Math.floor(crop.y+(y+.5)*crop.height/h),from=(sy*original.width+sx)*4;pixels.set(original.pixels.subarray(from,from+4),(y*w+x)*4);}
        const nearest={width:w,height:h,pixels},n=alpha(nearest),s=alpha(smooth),drift=edgeDrift(n.bbox,s.bbox);
        const {reference,mask}=areaAlphaReference(original,w,h);
        const fullAlphaError=alphaError(nearest,smooth,reference),boundaryAlphaError=alphaError(nearest,smooth,reference,mask);
        samples.push({w,h,nearest:n,smooth:s,bboxEdgeDrift:drift,sharedEdgeBand:sharedEdgeBand(nearest,smooth),fullAlphaError,boundaryAlphaError,areaAlphaPassed:fullAlphaError.rmseImproved&&boundaryAlphaError.rmseImproved,diff:diff(nearest,smooth)});
        if(w===52){saved.stampNearest=nearest;saved.stampSmooth=smooth;const pixels=new Uint8ClampedArray(w*h*4);for(let i=0;i<reference.length;i++){pixels.set([255,255,255,Math.round(reference[i])],i*4);}saved.stampAreaAlpha={width:w,height:h,pixels};}
      }
      const oldEdges=samples.reduce((sum,s)=>sum+s.nearest.edgePartial,0),newEdges=samples.reduce((sum,s)=>sum+s.smooth.edgePartial,0);
      const oldBandPartials=samples.reduce((sum,s)=>sum+s.sharedEdgeBand.nearest.partial,0),newBandPartials=samples.reduce((sum,s)=>sum+s.sharedEdgeBand.smooth.partial,0);
      const aggregate=key=> {
        const sum=samples.reduce((a,s)=>{for(const k of ['count','nearestAbsSum','smoothAbsSum','nearestSquaredSum','smoothSquaredSum'])a[k]+=s[key][k];return a;},{count:0,nearestAbsSum:0,smoothAbsSum:0,nearestSquaredSum:0,smoothSquaredSum:0});
        return {...sum,nearestMAE:sum.nearestAbsSum/sum.count,smoothMAE:sum.smoothAbsSum/sum.count,nearestRMSE:Math.sqrt(sum.nearestSquaredSum/sum.count),smoothRMSE:Math.sqrt(sum.smoothSquaredSum/sum.count),maeReductionPercent:100*(1-sum.smoothAbsSum/sum.nearestAbsSum)};
      };
      return {test:'smooth-stamp-vs-independent-nearest',passed:samples.every(s=>s.areaAlphaPassed&&s.bboxEdgeDrift===0),oldEdges,newEdges,oldBandPartials,newBandPartials,countCriterionPassed:newBandPartials>oldBandPartials,alphaReference:{samplesPerPixel:64,full:aggregate('fullAlphaError'),boundary:aggregate('boundaryAlphaError')},samples};
    },
    structure(size) {
      const results=[],dpr=size.dpr;
      const actual=document.createElement('canvas');actual.width=Math.round(128*dpr);actual.height=Math.round(192*dpr);
      const c=actual.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=false;
      drawCachedCapitalStack(c,a.sprites.coin,{cache:new CapitalBitmapCache(2*1024*1024),scaleX:dpr,scaleY:dpr,crop},64,128,26,6,3,1);
      const actualPixels=imageFromCanvas(actual),expected=n=> {
        const canvas=document.createElement('canvas');canvas.width=actual.width;canvas.height=actual.height;
        const ctx=canvas.getContext('2d'),stamp=getCapitalSpriteRaster(a.sprites.coin,crop,Math.ceil(26*dpr),Math.round(6*dpr));
        // A resting bundle ends at the contact plane. At DPR1.25 separate
        // start/height rounding otherwise adds one reference-only row below it.
        ctx.beginPath();ctx.rect(0,0,canvas.width,Math.round(128*dpr));ctx.clip();
        for(let layer=0;layer<n;layer++)ctx.drawImage(stamp,Math.round(51*dpr),Math.round((122-layer*3)*dpr));
        return imageFromCanvas(canvas);
      };
      const eight=diff(actualPixels,expected(8)),seven=diff(actualPixels,expected(7));
      results.push({test:'minimum-eight-coins-pixels',...size,passed:eight.differingPixels===0&&seven.differingPixels>0,eight,seven,bbox:alpha(actualPixels).bbox});
      const g=geometry(size.width,size.height,'player'),rows=[4,5,5,4].flatMap((count,depth)=>Array(count).fill(rowY(g.pedestalTopY,g.pedestalHeight,depth))),before=a.getCapitalColumnHeights(72);
      let after,plan;for(let n=5;n<=512;n++){after=Array(18).fill(n);plan=resolveCapitalViewportScroll({height:size.height,coinHeight:g.coinHeight,layerStep:g.layerStep,rowBases:rows,before,after,progress:.25});if(plan.targetOffsetPx>plan.beforeOffsetPx)break;}
      const extra={viewportBeforeColumnHeights:before,viewportAfterColumnHeights:after};
      const p0=paint('canvas',makeScene(72,72,0,extra),size,a.sprites,cpu,true),p1=paint('canvas',makeScene(72,72,.25,extra),size,a.sprites,cpu,true);
      if(!p0.foreground||!p1.foreground)results.push({test:'synchronized-descent',...size,passed:false,error:'Production transparent foreground witness unavailable.'});
      else {
        const dy=Math.round((p1.metrics.playerScrollPx-p0.metrics.playerScrollPx)*(p1.height/size.height)),shifted=new Uint8ClampedArray(p0.foreground.pixels.length),stride=p0.width*4;
        if(dy>=0&&dy<p0.height)shifted.set(p0.foreground.pixels.subarray(0,(p0.height-dy)*stride),dy*stride);
        const movement=diff({width:p0.width,height:p0.height,pixels:shifted},p1.foreground);
        const changed=diff(p0.foreground,p1.foreground);
        results.push({test:'synchronized-descent',...size,passed:dy>0&&changed.differingPixels>0&&movement.over20Pixels===0&&p1.metrics.playerScrollPx===p1.metrics.enemyScrollPx,physicalShift:dy,shiftedForeground:movement,changed});
      }
      return results;
    },
    async backgroundLoading(size) {
      const results=[];
      for(const kind of ['canvas','gpu']) {
        const canvas=document.createElement('canvas'),fresh=document.createElement('canvas');if(kind==='gpu'){ownedGpu.add(canvas);ownedGpu.add(fresh);}
        const wide=new Image(),portrait=new Image(),sprites={...a.sprites,backgrounds:{wide,portrait}},scene=makeScene(0);
        try {
          const before=paint(kind,scene,size,sprites,canvas);
          wide.src=a.sprites.backgrounds.wide.currentSrc||a.sprites.backgrounds.wide.src;portrait.src=a.sprites.backgrounds.portrait.currentSrc||a.sprites.backgrounds.portrait.src;
          await Promise.all([decode(wide),decode(portrait)]);
          const after=paint(kind,scene,size,sprites,canvas),reference=paint(kind,scene,size,sprites,fresh),changed=diff(before,after),freshMatch=diff(after,reference);
          results.push({test:'same-image-background-ready-invalidation',kind,...size,passed:changed.over20Pixels>0&&freshMatch.maxDelta<=1,rawExact:freshMatch.differingPixels===0,changed,freshMatch,before:before.metrics,after:after.metrics});
          if(kind==='gpu'){saved.backgroundBefore=before;saved.backgroundAfter=after;}
          // Reuse the SAME Image/backgrounds/sprites/canvas identities; only src changes.
          const oldSources={wide:wide.currentSrc||wide.src,portrait:portrait.currentSrc||portrait.src};
          wide.src=oldSources.portrait;portrait.src=oldSources.wide;
          await Promise.all([decode(wide),decode(portrait)]);
          const swapped=paint(kind,scene,size,sprites,canvas);
          const freshSwap=document.createElement('canvas');if(kind==='gpu')ownedGpu.add(freshSwap);
          try {
            const referenceSwap=paint(kind,scene,size,sprites,freshSwap),srcChange=diff(after,swapped),srcFresh=diff(swapped,referenceSwap);
            results.push({test:'same-image-src-replacement',kind,...size,passed:srcChange.over20Pixels>0&&srcFresh.maxDelta<=1,rawExact:srcFresh.differingPixels===0,changed:srcChange,freshMatch:srcFresh,oldSources,newSources:{wide:wide.currentSrc||wide.src,portrait:portrait.currentSrc||portrait.src}});
          }finally{if(kind==='gpu'){a.disposeBattleCapitalGpuCanvas(freshSwap);ownedGpu.delete(freshSwap);}}
        }finally{if(kind==='gpu'){a.disposeBattleCapitalGpuCanvas(canvas);a.disposeBattleCapitalGpuCanvas(fresh);ownedGpu.delete(canvas);ownedGpu.delete(fresh);}}
      }
      return results;
    },
    resize(size) {
      const results=[],scene=makeScene(72);
      for(const kind of ['canvas','gpu']) {
        // A fresh canvas avoids a skipped preexisting frame after an awaited read.
        const canvas=document.createElement('canvas');if(kind==='gpu')ownedGpu.add(canvas);
        try {
          const before=paint(kind,scene,size,a.sprites,canvas);
          paint(kind,scene,{width:1190,height:276,dpr:size.width===1190?1:2},a.sprites,canvas);
          const after=paint(kind,scene,size,a.sprites,canvas),comparison=diff(before,after);
          results.push({test:'resize-round-trip',kind,...size,passed:comparison.differingPixels===0,comparison});
        }finally{if(kind==='gpu'){a.disposeBattleCapitalGpuCanvas(canvas);ownedGpu.delete(canvas);}}
      }
      return results;
    },
    statics(size) {
      const out=[];for(const units of [1,18,72,324,9216])out.push(row('static',makeScene(units),size,{units}));
      for(const progress of [0,.25,.5,.75,1]){const s=makeScene(72,270,progress),entry=row('landing',s,size,{progress});if(progress===1)entry.strictGpu=diff(paint('gpu',s,size),paint('gpu',makeScene(270),size));out.push(entry);}return out;
    },
    timeline(event) {current={event,t:buildCapitalStackTimeline({id:'casino-test',side:'player',source:'direct',previousCapital:0,nextCapital:event.amount,marketPrice:event.price,intensity:'heavy',seed:42})};return current.t.frames.length;},
    timelineBatch(size,from,to,smoke) {
      const {event,t}=current,out=[];
      const pours=t.frames.flatMap((f,i)=>f.phase==='pour'?[i]:[]),midpoints=new Set([pours[0],pours[Math.floor(pours.length/2)],pours.at(-1)]);
      for(let i=from;i<to;i++) {
        const before=timelineScene(t.frames[i-1],1,event),after=timelineScene(t.frames[i],0,event);
        out.push(row('boundary-before',before,size,{...event,boundary:i}));
        const entry=row('boundary-after',after,size,{...event,boundary:i});entry.strictGpu=diff(paint('gpu',before,size),paint('gpu',after,size));out.push(entry);
        if(smoke||midpoints.has(i))out.push(row('dynamic-midpoint',timelineScene(t.frames[i],.5,event),size,{...event,frame:i}));
      }return out;
    },
    resources() {
      const gpuRows=observed.filter(x=>x.kind==='gpu'),violations=[];
      for(const {metrics:m} of gpuRows)if(m.drawCalls>256||m.textureBytes>64*1024*1024||m.bufferBytes>16384)violations.push(m);
      return {gpuPaints:gpuRows.length,peak:Object.fromEntries(['drawCalls','textureBytes','bufferBytes'].map(k=>[k,Math.max(0,...gpuRows.map(x=>x.metrics[k]??0))])),violations};
    },
    evidence() {return Object.fromEntries(Object.entries(saved).filter(([,v])=>v?.pixels).map(([key,frame])=>{const c=document.createElement('canvas');c.width=frame.width;c.height=frame.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.pixels),frame.width,frame.height),0,0);return [key,c.toDataURL('image/png')];}));},
    cleanup(){for(const canvas of ownedGpu)a.disposeBattleCapitalGpuCanvas(canvas);ownedGpu.clear();},
  };
  return {userAgent:navigator.userAgent,images:Object.fromEntries(Object.entries({coin:a.sprites.coin,pedestal:a.sprites.pedestal,...a.sprites.backgrounds}).map(([k,i])=>[k,{url:i.currentSrc||i.src,width:i.naturalWidth,height:i.naturalHeight}])),crop};
}
