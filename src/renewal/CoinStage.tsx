import {useEffect,useRef} from 'react';
import type {TradeEngine,Pour} from './engine';
import coinUrl from '../assets/battle/capital-coin-sfc.png';
import pedestalUrl from '../assets/battle/capital-pedestal-sfc.png';
import backdropUrl from '../assets/battle/battlefield-casino-wide.webp';
const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
const art=Promise.all([load(coinUrl),load(pedestalUrl),load(backdropUrl)]);
const order=[15,16,14,17,11,10,12,9,13,6,5,7,4,8,1,2,0,3];
export const pileUnits=(money:number,price:number)=>Math.max(0,Math.min(9216,Math.round(18*(6+Math.max(0,Math.log10(Math.max(1000,price))-3)*4)*Math.sqrt(Math.max(0,money)/price))));
const columns=(units:number)=>{const h=Array(18).fill(Math.floor(units/18));for(let i=0;i<units%18;i++)h[order[i]]++;return h as number[];};
/** Independent renderer. It observes money events; it never advances the game. */
export function CoinStage({engine}:{engine:TradeEngine}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
    let live=true,raf=0,width=1,height=1,dpr=1,assets:HTMLImageElement[]|null=null;
    let lastKey='';const stacks=new Map<string,HTMLCanvasElement>();
    const resize=()=>{const bounds=canvas.getBoundingClientRect();width=Math.round(bounds.width);height=Math.round(bounds.height);dpr=Math.min(1.5,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));stacks.clear();lastKey='';};
    const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
    art.then(images=>{if(live){assets=images;lastKey='';}}).catch(()=>{canvas.dataset.error='素材の読込に失敗';});
    const stack=(layers:number,cw:number,ch:number,step:number)=>{
      const visible=layers?layers+7:0;const key=`${visible}:${cw}:${ch}:${step}`;let image=stacks.get(key);if(image)return image;
      image=document.createElement('canvas');image.width=Math.ceil(cw*dpr)+2;image.height=Math.ceil((ch+Math.max(0,visible-1)*step)*dpr)+2;
      const c=image.getContext('2d')!;c.scale(dpr,dpr);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      for(let i=0;i<visible;i++)c.drawImage(assets![0],135,167,1837,397,0,image.height/dpr-ch-i*step,cw,ch);
      if(stacks.size>=64)stacks.delete(stacks.keys().next().value!);stacks.set(key,image);return image;
    };
    const paintSide=(side:0|1,pour:Pour|undefined)=>{
      const final=side?engine.enemy:engine.player;
      const active=!!pour&&engine.visual<pour.start+pour.duration;
      const start=columns(pileUnits(active?pour!.from:final,engine.encounter.price));
      const end=columns(pileUnits(active?pour!.to:final,engine.encounter.price));
      const p=active?Math.min(1,(engine.visual-pour!.start)/pour!.duration):1;
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const progress=reduced?1:p;
      const cw=Math.min(width*.062,height*.17),ch=cw/4.627,step=Math.max(.8,cw*.043);
      const pw=cw*6.5,ph=pw*.25,cx=width*(side?.755:.245),base=height*.83;
      const beforeTop=base-(Math.max(...start)+7)*step-ch;
      const afterTop=base-(Math.max(...end)+7)*step-ch;
      const scrollTo=(top:number)=>top<height*.22?Math.ceil((height*.22-top)/(height*.32))*height*.32:0;
      const offset=scrollTo(beforeTop)+(scrollTo(afterTop)-scrollTo(beforeTop))*progress;
      const drawStack=(x:number,y:number,layers:number)=>{if(layers<=0)return;const bitmap=stack(layers,cw,ch,step);ctx.drawImage(bitmap,Math.round(x-cw/2),Math.round(y-bitmap.height/dpr),bitmap.width/dpr,bitmap.height/dpr);};
      ctx.save();ctx.translate(0,offset);
      ctx.drawImage(assets![1],362,78,1444,579,cx-pw/2,base-ph*.6,pw,ph);
      let index=0;
      for(let row=0;row<4;row++){
        const count=[4,5,5,4][row];
        for(let column=0;column<count;column++,index++){
          const x=cx+(column-(count-1)/2)*cw*1.04*(side?-1:1);
          const y=base-ph*.1+(row-3)*ch*1.45;
          const delta=end[index]-start[index];
          if(!active||delta<=0||progress>=1){drawStack(x,y,end[index]);continue;}
          const rank=order.indexOf(index),chunks=Math.ceil(delta/6),waveTotal=9*chunks+2;
          let landed=0;
          for(let chunk=0;chunk<chunks;chunk++){
            const t=(progress*waveTotal-(Math.floor(rank/2)+chunk*9))/2;
            const layers=Math.min(6,delta-chunk*6);
            if(t>=1)landed+=layers;
          }
          drawStack(x,y,start[index]+landed);
          // At most two short packets per lane; completed money is one bitmap.
          for(let chunk=0;chunk<chunks;chunk++){
            const t=(progress*waveTotal-(Math.floor(rank/2)+chunk*9))/2;if(t<=0||t>=1)continue;
            const layers=Math.min(6,delta-chunk*6);
            const landing=y-(start[index]+chunk*6)*step;
            const top=Math.min(landing-height*.32,-offset-height*.06);
            drawStack(x,top+(landing-top)*t*t,layers);
          }
        }
      }
      // Pedestal front masks roots so a minimum pile visibly rests on its base.
      ctx.drawImage(assets![1],362,78+579*.66,1444,579*.34,cx-pw/2,base-ph*.6+ph*.66,pw,ph*.34);
      ctx.restore();
    };
    const frame=()=>{
      if(!live)return;
      if(assets&&!document.hidden){
        const a=engine.pours.findLast(p=>p.side===0),b=engine.pours.findLast(p=>p.side===1);
        const key=[canvas.width,canvas.height,engine.player,engine.enemy,Math.round(engine.ownership*10),engine.motion?Math.floor(engine.visual/16):'idle'].join(':');
        if(key!==lastKey){lastKey=key;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#100e19';ctx.fillRect(0,0,width,height);
          const bg=assets[2],scale=Math.max(width/bg.width,height/bg.height);ctx.drawImage(bg,(width-bg.width*scale)/2,(height-bg.height*scale)/2,bg.width*scale,bg.height*scale);
          ctx.fillStyle='#14132144';ctx.fillRect(0,0,width,height);
          const front=width*engine.ownership/100;const light=ctx.createLinearGradient(front-70,0,front+70,0);light.addColorStop(0,'#42c7d200');light.addColorStop(.49,'#4ad8ea40');light.addColorStop(.51,'#ef879d40');light.addColorStop(1,'#ff557700');ctx.fillStyle=light;ctx.fillRect(0,height*.2,width,height*.52);
          paintSide(0,a);paintSide(1,b);canvas.dataset.frames=String(Number(canvas.dataset.frames??0)+1);
        }
      }
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>{live=false;cancelAnimationFrame(raf);ro.disconnect();stacks.clear();};
  },[engine]);
  return <canvas ref={ref} className="renewal-coins" aria-label="両陣営に積み上がる金貨" role="img"/>;
}
