import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const output=resolve(process.argv[2]??'tmp/coin-polish-20260905/authored');
await mkdir(output,{recursive:true});
const c=await connectCapitalAudit();
try{
 await c.send('Page.navigate',{url:'http://127.0.0.1:3130/capital-contact-audit.html'});
 for(let i=0;i<100&&!await c.evaluate('Boolean(window.capitalAudit)');i++)await new Promise(ok=>setTimeout(ok,100));
 const results=await c.evaluate(`(async()=>{
  const a=window.capitalAudit,{buildCapitalStackTimeline}=await import('/src/utils/battlePresentation.ts');
  const entries=[];
  const scene=(frame,p,price,amount)=>{
   const side={amount,marketPrice:price,previewFrame:{...frame,beatDurationMs:frame.durationMs}};
   const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
   s.player.frame.packetProgress=s.enemy.frame.packetProgress=p;return s;
  };
  const make=(price,amount)=>buildCapitalStackTimeline({id:'record',side:'player',source:'direct',previousCapital:0,nextCapital:amount,marketPrice:price,intensity:'heavy',seed:42});
  for(const [w,h] of [[378,366],[824,159],[1190,276]])for(const dpr of [1,1.25,1.5,2])for(const [price,amount] of [[2000,700],[6e9,3e9],[6e9,4e12],...(w===1190?[[6e9,6e11]]:[])]){
    const timeline=make(price,amount),canvas=a.canvas,ctx=canvas.getContext('2d');
    const options={sprites:a.sprites,cssSize:{width:w,height:h},devicePixelRatio:dpr,frameRate:60};
    for(let i=1;i<timeline.frames.length;i++){
      a.paintBattleCapitalCanvas(canvas,scene(timeline.frames[i-1],1,price,amount),options);
      const before=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      a.paintBattleCapitalCanvas(canvas,scene(timeline.frames[i],0,price,amount),options);
      const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let count=0;for(let p=0;p<before.length;p++)if(before[p]!==after[p])count++;
      entries.push({w,h,dpr,price,boundary:i,differingChannels:count});
    }
  }
  window.authoredRolls={make,scene};return entries;
 })()`);
 await writeFile(resolve(output,'boundaries.json'),JSON.stringify(results,null,2));
 assert.ok(results.every(x=>x.differingChannels===0),JSON.stringify(results.filter(x=>x.differingChannels>0).slice(0,8)));
 console.log('Verified '+results.length+' exact beat boundaries; recording live timeline.');
 await c.send('Page.bringToFront');
 // Record the same live painter/timeline. No copied frames or imported game art.
 const video=await c.evaluate(`(async()=>{
  const a=window.capitalAudit,{make,scene}=window.authoredRolls,canvas=a.canvas;
  const options={sprites:a.sprites,cssSize:{width:1190,height:276},devicePixelRatio:1,frameRate:30};
  const timelines=[make(2000,700),make(6e9,3e9),make(6e9,4e12)];
  a.paintBattleCapitalCanvas(canvas,scene(timelines[0].frames[0],0,2000,700),options);
  const stream=canvas.captureStream(0),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2200000}),chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(ok=>rec.onstop=()=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});rec.start();
  for(let sample=0;sample<234;sample++){
    const elapsed=sample*1000/30,slot=Math.min(2,Math.floor(elapsed/2600));
    const t=timelines[slot],ms=Math.min(t.totalMs,elapsed%2600),f=t.frames.findLast(f=>ms>=f.atMs);
    a.paintBattleCapitalCanvas(canvas,scene(f,Math.min(1,(ms-f.atMs)/f.durationMs),t.event.marketPrice,t.event.nextCapital),options);
    stream.getVideoTracks()[0].requestFrame();await new Promise(ok=>setTimeout(ok,33));
  }
  rec.stop();const result=await done;stream.getTracks().forEach(t=>t.stop());return result;
 })()`);
 await writeFile(resolve(output,'authored-rolls.webm'),Buffer.from(video.split(',')[1],'base64'));
 console.log(JSON.stringify({passed:true,boundaries:results.length,output}));
}finally{c.close()}
