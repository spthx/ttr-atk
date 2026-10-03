// Isolated, real controls: first battle through a GPU failure and a fresh 2D fallback.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectCapitalAudit} from './capital-cdp-client.mjs';

const port=Number(process.argv[2]??9357);
const output=resolve(process.argv[3]??'tmp/remake-20261003/runtime');
await mkdir(output,{recursive:true});
const c=await connectCapitalAudit(port),results=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const button=prefix=>c.evaluate(`(()=>{
 const b=[...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.getAttribute('aria-label')||b.innerText).trim().startsWith(${JSON.stringify(prefix)}));
 if(!b)return false;b.click();return true;
})()`);
const until=async(fn,label)=>{for(let i=0;i<180;i++){if(await fn())return;await delay(150)}throw new Error(label);};
const state=()=>c.evaluate(`({renderer:document.querySelector('.battle-capital-canvas')?.dataset.renderer,
 capital:document.querySelector('.ownership-capital-readout')?.getAttribute('aria-label'),
 overflow:document.documentElement.scrollWidth>innerWidth,
 canvases:document.querySelectorAll('.battle-capital-canvas').length})`);
try {
 for(const mode of ['context-loss','unavailable']) {
  await c.send('Page.navigate',{url:'about:blank'});
  await c.send('Storage.clearDataForOrigin',{origin:'http://127.0.0.1:4140',storageTypes:'local_storage'});
  let injected;
  if(mode==='unavailable') injected=await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)};
  }`});
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1.5,mobile:false});
  await c.send('Page.navigate',{url:'http://127.0.0.1:4140/'});
  await until(()=>c.evaluate('document.querySelectorAll("button").length>0'),'game did not load');
  for(let i=0;i<4;i++){await button('次へ');await button('この名で開店する');await button('わかった！');await delay(400)}
  await until(()=>button('グリダニア'),'city unavailable');
  await until(()=>button('商戦へ挑戦'),'battle unavailable');
  await until(()=>button('この条件で争奪戦開始'),'briefing unavailable');
  await until(()=>c.evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.getAttribute('aria-label')||'').startsWith('投資実行。')))`),'command did not unlock');
  const before=await state();
  assert.equal(before.renderer,mode==='context-loss'?'webgl2':'canvas2d');
  await button('投資実行。');
  await delay(450);
  if(mode==='context-loss') {
    assert.equal(await c.evaluate(`(()=>{
      const canvas=document.querySelector('.battle-capital-canvas');window.runtimeOldCanvas=canvas;
      const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      if(!ext)return false;ext.loseContext();return true;
    })()`),true,'context loss extension unavailable');
    await until(async()=> (await state()).renderer==='canvas2d','GPU loss did not mount 2D fallback');
    assert.equal(await c.evaluate('window.runtimeOldCanvas!==document.querySelector(".battle-capital-canvas")'),true);
  }
  await until(()=>c.evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.getAttribute('aria-label')||'').startsWith('投資実行。')))`),'fallback left command locked');
  const after=await state();
  assert.equal(after.renderer,'canvas2d');assert.equal(after.canvases,1);assert.equal(after.overflow,false);
  assert.match(after.capital,/自社700/,'fallback must commit exactly one 700-gil investment');
  for(const [width,height,dpr] of [[844,390,1.25],[1440,900,2],[390,844,1.5]]) {
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    await delay(200);assert.equal((await state()).overflow,false);
  }
  const screenshot=await c.send('Page.captureScreenshot',{format:'png'});
  await writeFile(resolve(output,`${mode}.png`),Buffer.from(screenshot.data,'base64'));
  let analyzed=false;
  for(let i=0;i<100;i++){if(await button('分析へ')){analyzed=true;break;}await button('投資実行。');await delay(600)}
  assert.equal(analyzed,true,'battle did not reach result analysis');
  await until(async()=>{await button('五分の祝儀');return button('買収結果を確定');},'result did not settle');
  await delay(300);await button('わかった！');
  assert.equal((await state()).canvases,0,'battle renderer remained after settlement');
  results.push({mode,before,after,rotation:true,settled:true});
  if(injected)await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 }
 await writeFile(resolve(output,'results.json'),JSON.stringify({passed:true,results},null,2));
 console.log(JSON.stringify({passed:true,results}));
}finally{c.close()}
