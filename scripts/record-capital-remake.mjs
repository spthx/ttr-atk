// Evidence of the production painter and authored timelines; not a full playthrough.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const output=resolve(process.argv[2]??'tmp/remake-20261003/coin-remake.webm');
const c=await connectCapitalAudit();
try {
 await c.send('Page.navigate',{url:'http://127.0.0.1:3130/capital-contact-audit.html'});
 for(let i=0;i<100&&!await c.evaluate('Boolean(window.capitalAudit?.paintBattleCapitalGpuCanvas)');i++)await new Promise(ok=>setTimeout(ok,100));
 const data=await c.evaluate(`(async()=>{
  const a=window.capitalAudit,{buildCapitalStackTimeline}=await import('/src/utils/battlePresentation.ts');
  const canvas=document.createElement('canvas');canvas.style.cssText='width:1190px;height:276px';a.canvas.replaceWith(canvas);
  const options={sprites:a.sprites,cssSize:{width:1190,height:276},devicePixelRatio:1,frameRate:60};
  const timelines=[[0,700,2000],[0,3e9,6e9],[0,4e12,6e9],[21399511,21400211,2000]].map(([before,after,price])=>buildCapitalStackTimeline({id:'remake-record',side:'player',source:'direct',previousCapital:before,nextCapital:after,marketPrice:price,intensity:'heavy',seed:42}));
  const paint=(t,ms)=>{
   const f=t.frames.findLast(f=>ms>=f.atMs)??t.frames[0];
   const side={amount:t.event.nextCapital,marketPrice:t.event.marketPrice,previewFrame:{...f,beatDurationMs:f.durationMs}};
   const scene=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
   scene.player.frame.packetProgress=scene.enemy.frame.packetProgress=Math.min(1,Math.max(0,(ms-f.atMs)/f.durationMs));
   a.paintBattleCapitalGpuCanvas(canvas,scene,options);
  };
  paint(timelines[0],0);
  const stream=canvas.captureStream(0),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000});
  recorder.ondataavailable=e=>chunks.push(e.data);
  const done=new Promise(ok=>recorder.onstop=()=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
  recorder.start();
  try {
   for(const [slot,t] of timelines.entries()) {
    const duration=slot===2?6200:2400;
    for(let elapsed=0;elapsed<duration;elapsed+=1000/30){
     paint(t,Math.min(t.totalMs,elapsed));stream.getVideoTracks()[0].requestFrame();
     await new Promise(ok=>setTimeout(ok,1000/30));
    }
   }
  } finally {recorder.stop();stream.getTracks().forEach(track=>track.stop());}
  const result=await done;a.disposeBattleCapitalGpuCanvas(canvas);return result;
 })()`);
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,Buffer.from(data.split(',')[1],'base64'));
 console.log(JSON.stringify({output,kind:'authored renderer fixture',audio:false}));
}finally{c.close()}
