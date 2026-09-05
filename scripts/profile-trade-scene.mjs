import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const output=resolve(process.argv[2]??'tmp/coin-polish-20260905/profile');
await mkdir(output,{recursive:true});
const c=await connectCapitalAudit();
try {
 await c.send('Page.navigate',{url:'http://127.0.0.1:3130/capital-contact-audit.html'});
 for(let i=0;i<100&&!await c.evaluate('Boolean(window.capitalAudit)');i++)await new Promise(ok=>setTimeout(ok,100));
 const result=await c.evaluate(`(async()=>{
  const a=window.capitalAudit;
  const {buildCapitalStackTimeline}=await import('/src/utils/battlePresentation.ts');
  const results=[];
  for(const [name,capital,price] of [['opening',700,2000],['late',3e9,6e9],['overflow',4e12,6e9]]){
   const event={id:'profile',side:'player',source:'direct',previousCapital:0,nextCapital:capital,marketPrice:price,intensity:'heavy',seed:42};
   const started=performance.now();let timeline;
   for(let i=0;i<200;i++)timeline=buildCapitalStackTimeline(event);
   const timelineMs=(performance.now()-started)/200;
   let draws=0;const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){draws++;return original.apply(this,args)};
   const calls=[],cpu=[];let metrics;
   try{for(let run=0;run<5;run++)for(let ms=0;ms<timeline.totalMs;ms+=1000/60){
    const f=timeline.frames.findLast(f=>ms>=f.atMs);
    const side={amount:capital,marketPrice:price,previewFrame:{...f,beatDurationMs:f.durationMs}};
    const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
    s.player.frame.packetProgress=s.enemy.frame.packetProgress=Math.min(1,(ms-f.atMs)/f.durationMs);
    const b=draws,t=performance.now();metrics=a.paintBattleCapitalCanvas(a.canvas,s,{sprites:a.sprites,cssSize:{width:1190,height:276},devicePixelRatio:2,frameRate:60});cpu.push(performance.now()-t);calls.push(draws-b);
   }}finally{CanvasRenderingContext2D.prototype.drawImage=original}
   cpu.sort((a,b)=>a-b);results.push({name,timelineMs,drawCalls:draws,samples:calls.length,zeroDrawFrames:calls.filter(x=>x===0).length,p95CpuMs:cpu[Math.floor(cpu.length*.95)],metrics});
  }
  return {note:'Local Edge headless CPU submission, 5 real authored timelines at 60Hz; not GPU duration or device FPS',results};
 })()`);
 await writeFile(resolve(output,'timeline-profile.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{c.close()}
