import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';
const output=resolve(process.argv[3]??'tmp/capital-upgrade-verification');
await mkdir(output,{recursive:true});
const c=await connectCapitalAudit(Number(process.argv[2]??9356));
await c.send('Page.navigate',{url:'http://127.0.0.1:3130/capital-contact-audit.html'});
for(let i=0;i<100&&!await c.evaluate('Boolean(window.capitalAudit)');i++) await new Promise(ok=>setTimeout(ok,100));
const results=await c.evaluate(`(async()=>{
 const a=window.capitalAudit;
 const {resolveBattleCapitalSfcSideGeometry:gFor}=await import('/src/utils/battleCapitalCanvasLayout.ts');
 const {createBattleVisualTheme,DEFAULT_BATTLE_VISUAL_THEME_METADATA:m}=await import('/src/data/battleVisualTheme.ts');
 const {projectCapitalSceneAtTime,getCapitalPacketAnimationKey}=await import('/src/components/BattleCapitalCanvas.tsx');
 const result=[];
 const canvas=a.canvas,ctx=canvas.getContext('2d');
 const make=(before,after,p,settled=false)=>{
  const b=a.getCapitalColumnHeights(before),f=a.getCapitalColumnHeights(after);
  const side={amount:after,marketPrice:2000,previewFrame:{visibleUnits:before,columnHeights:b,settledAfterColumnHeights:f,activeColumnIndices:settled?[]:b.flatMap((v,i)=>f[i]>v?[i]:[]),packetSeed:42}};
  const s=a.createBattleCapitalCanvasScene({player:side,enemy:side,ownershipPercent:50});
  s.player.frame.packetProgress=p;s.enemy.frame.packetProgress=p;return s;
 };
 const clockScene=make(72,144,0);
 const clocks={player:{key:getCapitalPacketAnimationKey(clockScene.player),startedAt:100},enemy:{key:getCapitalPacketAnimationKey(clockScene.enemy),startedAt:100}};
 if(projectCapitalSceneAtTime(clockScene,clocks,400,false).player.frame.packetProgress!==1)throw new Error('resize/image projection restarted a completed packet');
 if(projectCapitalSceneAtTime(clockScene,clocks,100,true).player.frame.packetProgress!==1)throw new Error('reduced motion must remain settled on resize');
 for(const [width,height] of [[378,366],[824,159],[1190,276]])for(const dpr of [1,1.25,1.5,2]){
  const options={sprites:a.sprites,cssSize:{width,height},devicePixelRatio:dpr,frameRate:60};
  const paint=(b,f,p,settled=false)=>a.paintBattleCapitalCanvas(canvas,make(b,f,p,settled),options);
  const pixels=()=>ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const landing=[];
  for(const [b,f] of [[1,2],[2,5],[8,12],[18,19],[72,73],[648,720],[9000,9216]]){
    paint(b,f,1);const moving=pixels();paint(f,f,1,true);const stable=pixels();
    let differences=0;for(let i=0;i<moving.length;i+=4)if(moving[i]!==stable[i]||moving[i+1]!==stable[i+1]||moving[i+2]!==stable[i+2])differences++;
    landing.push({before:b,after:f,differences});
  }
  let first=18;while(first<9216&&paint(first,first,1).playerScrollPx===0)first+=18;
  const before=first-18;
  const initial=paint(before,first,0),image=pixels();
  const shifted=paint(before,first,0.2),next=pixels();
  const scale=canvas.height/height,dy=Math.round((shifted.playerScrollPx-initial.playerScrollPx)*scale);
  const g=gFor(width,height,'player');let checked=0,matched=0;
  for(let y=Math.ceil(g.pedestalTopY*scale);y<Math.min(canvas.height-dy,Math.floor(g.pedestalBottomY*scale));y++){
    for(let x=Math.floor((g.centerX-g.pedestalWidth*0.4)*canvas.width/width);x<Math.ceil((g.centerX+g.pedestalWidth*0.4)*canvas.width/width);x++){
      const i=(y*canvas.width+x)*4,j=((y+dy)*canvas.width+x)*4;
      if((image[i]>160&&image[i+1]>95&&image[i+2]<75)||(image[i+2]>image[i]+7&&image[i+2]>image[i+1]+7&&image[i]>120)){
        checked++;if(Math.max(Math.abs(image[i]-next[j]),Math.abs(image[i+1]-next[j+1]),Math.abs(image[i+2]-next[j+2]))<=15)matched++;
      }
    }
  }
  const huge=paint(9216,9216,1,true);
  const warm=[];for(let i=0;i<1000;i++)warm.push(paint(648,720,(i%20)/19));
  const startBuilds=warm[99].bitmapBuilds,endBuilds=warm[999].bitmapBuilds;
  const lowPower=a.paintBattleCapitalCanvas(canvas,make(648,720,0.65),{...options,frameRate:30});
  const serial=JSON.stringify(make(648,720,0.65));
  const themed={...a.sprites,theme:createBattleVisualTheme({coin:m.id,pedestal:m.id},{...m,id:'original-palette-proof',palette:{...m.palette,background:'#121828',stripeA:'#243040',stripeB:'#384858',player:'#338899',enemy:'#aa5533'}})};
  const s=make(648,720,0.65);
  a.paintBattleCapitalCanvas(canvas,s,{...options,sprites:themed});
  result.push({width,height,dpr,landing,scroll:{first,dy,checked,match:checked?matched/checked:0},huge,lowPowerCacheLimit:lowPower.bitmapCacheLimitBytes,warmCacheBuilds:endBuilds-startBuilds,sceneUnchanged:JSON.stringify(s)===serial});
 }
 window.capitalVerify={make};
 return result;
})()`);
await writeFile(resolve(output,'pixel-and-resource-checks.json'),JSON.stringify(results,null,2));
for(const r of results){
 assert.ok(r.landing.every(x=>x.differences===0),`landing discontinuity ${JSON.stringify(r)}`);
 assert.ok(r.scroll.dy>0&&r.scroll.checked>20&&r.scroll.match>0.92,`rigid descent pixel mismatch ${JSON.stringify(r.scroll)}`);
 assert.equal(r.warmCacheBuilds,0,'warm animation must not rerasterize settled columns');
 assert.ok(r.huge.playerScrollPx>0);assert.ok(r.huge.bitmapCacheBytes<=32*1024*1024);
 assert.equal(r.lowPowerCacheLimit,16*1024*1024,'60 to 30 FPS must lower cache budget even at unchanged DPR');
 assert.equal(r.sceneUnchanged,true,'visual theme must not mutate scene/logic');
}
console.log(JSON.stringify({passed:true,conditions:results.length,landings:results.length*7,minScrollPixelMatch:Math.min(...results.map(r=>r.scroll.match)),maxCacheBytes:Math.max(...results.map(r=>r.huge.bitmapCacheBytes))}));
c.close();
