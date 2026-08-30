import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const c=await connectCapitalAudit(Number(process.env.CAPITAL_AUDIT_PORT??9356));
const [command,...args]=process.argv.slice(2);
try {
  if(command==='goto') console.log(await c.send('Page.navigate',{url:args[0]}));
  else if(command==='size') console.log(await c.send('Emulation.setDeviceMetricsOverride',{width:Number(args[0]),height:Number(args[1]),deviceScaleFactor:Number(args[2]??1),mobile:false}));
  else if(command==='inspect') console.log(await c.evaluate(`JSON.stringify({title:document.title,text:document.body.innerText.slice(0,11000),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText,aria:b.getAttribute('aria-label'),disabled:b.disabled})),overflow:document.documentElement.scrollWidth>innerWidth,canvases:document.querySelectorAll('canvas').length})`));
  else if(command==='click'||command==='click-prefix') console.log(await c.evaluate(`(()=>{const name=${JSON.stringify(args.join(' '))};const matches=[...document.querySelectorAll('button')].filter(b=>${command==='click-prefix'?'(b.getAttribute("aria-label")||b.innerText).trim().startsWith(name)':'(b.getAttribute("aria-label")||b.innerText).trim()===name'});if(matches.length!==1)throw new Error('Expected one button, found '+matches.length);if(matches[0].disabled)throw new Error('Button disabled');matches[0].click();return name})()`));
  else if(command==='shot') {
    const r=await c.send('Page.captureScreenshot',{format:'png'});const path=resolve(args[0]);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(r.data,'base64'));console.log(path);
  } else if(command==='record') {
    const data=await c.evaluate(`(async()=>{
      const a=window.capitalAudit;if(!a)throw new Error('Open fixture first');
      const canvas=a.canvas;canvas.width=1190;canvas.height=276;
      const options={sprites:a.sprites,cssSize:{width:1190,height:276},devicePixelRatio:1,frameRate:30};
      const stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2500000});
      const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
      const done=new Promise(ok=>recorder.onstop=async()=>{const b=new Blob(chunks,{type:'video/webm'}),r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});
      const make=(before,after,p)=>{const cols=a.getCapitalColumnHeights(before),target=a.getCapitalColumnHeights(after);const side={amount:after,marketPrice:2000,previewFrame:{visibleUnits:before,columnHeights:cols,settledAfterColumnHeights:target,activeColumnIndices:cols.flatMap((v,i)=>target[i]>v?[i]:[]),packetSeed:42}};const s=a.createBattleCapitalCanvasScene({player:side,enemy:{...side,previewFrame:{...side.previewFrame,packetSeed:79}},ownershipPercent:50});s.player.frame.packetProgress=p;s.enemy.frame.packetProgress=p;return s};
      const start=performance.now();recorder.start();
      await new Promise(ok=>{const tick=now=>{const elapsed=now-start;const step=Math.min(29,Math.floor(elapsed/220));const before=Math.round(18+step*140),after=Math.round(18+(step+1)*140),p=Math.min(1,(elapsed%220)/165);a.paintBattleCapitalCanvas(canvas,make(before,after,p),options);if(elapsed<6600)requestAnimationFrame(tick);else ok()};requestAnimationFrame(tick)});
      recorder.stop();const result=await done;stream.getTracks().forEach(t=>t.stop());return result;
    })()`);
    const path=resolve(args[0]);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(data.split(',')[1],'base64'));console.log(path);
  } else throw new Error('Use goto, size, inspect, click, shot or record.');
}finally{c.close()}
