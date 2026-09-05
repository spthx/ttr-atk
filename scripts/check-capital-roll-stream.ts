import assert from 'node:assert/strict';
import {buildCapitalStackTimeline,getBattleCapitalVisibleUnits,getCapitalColumnHeights,getCapitalCommandRechargeWorkMs,getMechanicalCapitalColumnFrames,getCapitalOverflowPassCount,CAPITAL_OVERFLOW_RESTACK_BEATS,CAPITAL_STACK_BEAT_MS} from '../src/utils/battlePresentation';
import {BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS} from '../src/utils/battleCapitalCanvasLayout';
import {resolveCapitalRollProgress} from '../src/utils/capitalRollMotion';
import {resolveCapitalCommandRechargeScale} from '../src/utils/battlePresentation';
import {readFileSync} from 'node:fs';

for(const price of [2000,8e5,6e9])for(const ratio of [0.02,0.35,2,100,600])for(const previousRatio of [0,0.2,2]){
 const event={id:'stream',side:'player' as const,source:'direct' as const,previousCapital:price*previousRatio,nextCapital:price*(previousRatio+ratio),marketPrice:price,intensity:'heavy' as const,seed:42};
 const t=buildCapitalStackTimeline(event);
 const pours=t.frames.filter(f=>f.phase==='pour');
 const end=getCapitalColumnHeights(getBattleCapitalVisibleUnits(event.nextCapital,price));
 const visited=new Set<number>();let overlap=false;
 for(let index=0;index<pours.length;index++){
  const f=pours[index];
  assert.ok(f.activeColumnIndices.length<=6,'normal stream must be at most three airborne pairs');
  for(const flight of f.incomingLaneTimings??[])if(flight.startMs>=0)visited.add(flight.columnIndex);
  for(const p of [0,.25,.5,.75,1]){
   const moving=f.activeColumnIndices.filter(col=>{
    const progress=resolveCapitalRollProgress({...f,packetProgress:p,beatDurationMs:f.durationMs},col);
    return progress>0&&progress<1;
   });
   if(moving.length>2)overlap=true;
  }
  const next=pours[index+1];if(!next)continue;
  for(let col=0;col<18;col++){
   const currentTarget=f.activeColumnIndices.includes(col)?f.settledAfterColumnHeights![col]:f.columnHeights[col];
   const currentP=f.activeColumnIndices.includes(col)?resolveCapitalRollProgress({...f,packetProgress:1,beatDurationMs:f.durationMs},col):1;
   const nextP=next.activeColumnIndices.includes(col)?resolveCapitalRollProgress({...next,packetProgress:0,beatDurationMs:next.durationMs},col):1;
   if(currentP>=1)assert.equal(next.columnHeights[col],currentTarget,'completed roll must remain in the next beat');
   else if(currentP>0)assert.ok(Math.abs(currentP-nextP)<1e-7,'airborne flight must keep its progress across beat boundary');
  }
  assert.deepEqual(f.viewportAfterColumnHeights,next.viewportBeforeColumnHeights,'scroll planning must not jump between beats');
 }
 const initial=t.frames[0].columnHeights;
 for(let col=0;col<18;col++)if(end[col]>initial[col])assert.ok(visited.has(col),'each changed column must receive a launched roll');
 assert.deepEqual(t.frames.at(-1)!.columnHeights,end);
 for(const col of pours.at(-1)?.activeColumnIndices??[])
   assert.equal(resolveCapitalRollProgress({...pours.at(-1)!,packetProgress:1,beatDurationMs:165},col),1,'all final rolls must land, including fractional launch gaps');
 const actualRecharge=pours.reduce((sum,f)=>sum+f.durationMs*resolveCapitalCommandRechargeScale([f,null,undefined]),0);
 assert.ok(Math.abs(actualRecharge-getCapitalCommandRechargeWorkMs(event))<1e-7 || pours.length===0,
   'live receiver must preserve total recharge work even below multiplier 1');
 if(visited.size===18)assert.ok(overlap,'full trays need overlapping pairs, not isolated turns');
}
assert.equal(resolveCapitalCommandRechargeScale([null,undefined]),1);
assert.equal(resolveCapitalCommandRechargeScale([{commandRechargeScale:.25},null,undefined]),.25);
assert.equal(resolveCapitalCommandRechargeScale([{commandRechargeScale:2},{commandRechargeScale:.25}]),2);
assert.match(readFileSync(new URL('../src/components/BattleModal.tsx',import.meta.url),'utf8'),
 /capitalPresentationCommandRechargeScale = resolveCapitalCommandRechargeScale\(\[\s*capitalPreviewStage,\s*playerCapitalPilePreviewStage,\s*enemyCapitalPilePreviewStage,/,
 'the tested scale selector must be wired to the live command recovery clock');

// Closed-form column allocation must exactly preserve the old one-unit walk.
const order=[15,16,14,17,11,10,12,9,13,6,5,7,4,8,1,2,0,3];
const expected=Array(18).fill(0);
assert.deepEqual(getCapitalColumnHeights(NaN),expected);
assert.deepEqual(getCapitalColumnHeights(-Infinity),expected);
assert.deepEqual(getCapitalColumnHeights(Infinity),Array(18).fill(512));
for(let units=0;units<=9216;units++){
 assert.deepEqual(getCapitalColumnHeights(units),expected);
 expected[order[units%18]]++;
}
for(const intensity of ['compact','standard','heavy'] as const)for(const side of ['player','enemy'] as const)
for(const price of [2000,6e9])for(const fromRatio of [0,0.25,2,800])for(const toRatio of [0,0.02,0.35,1,4,1200]){
 const event={id:'clock',side,source:'direct' as const,previousCapital:price*fromRatio,nextCapital:price*toRatio,marketPrice:price,intensity,seed:42};
 const from=getBattleCapitalVisibleUnits(event.previousCapital,price),to=getBattleCapitalVisibleUnits(event.nextCapital,price);
 const compact=intensity==='compact',heavy=intensity==='heavy';
 const requested=getCapitalOverflowPassCount(event.previousCapital,event.nextCapital,price,heavy);
 const reload=Math.min(3,from===to&&event.nextCapital>event.previousCapital?Math.max(1,requested):requested);
 const frames=getMechanicalCapitalColumnFrames(from,to,compact?4:heavy?24:22,compact?6:heavy?5:4,reload,CAPITAL_OVERFLOW_RESTACK_BEATS[intensity],heavy,side);
 const reference=frames.reduce((sum,f)=>sum+((f.overflowPass??0)>0&&(f.stackBeat??0)===0?BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS:CAPITAL_STACK_BEAT_MS[intensity]),0);
 assert.equal(getCapitalCommandRechargeWorkMs(event),reference,'closed-form work must preserve the legacy command clock');
}
console.log('Roll stream passed: overlapping pairs, continuous boundaries, exact final mass and 9,217 allocation states.');
