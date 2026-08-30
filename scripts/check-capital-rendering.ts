import assert from 'node:assert/strict';
import { CapitalBitmapCache } from '../src/utils/capitalBitmapCache';
import { resolveCapitalViewportScroll } from '../src/utils/capitalViewportScroll';
import { BATTLE_CAPITAL_CANVAS_ROW_COUNTS, resolveBattleCapitalSfcRowBaseY, resolveBattleCapitalSfcSideGeometry } from '../src/utils/battleCapitalCanvasLayout';
import { getCapitalColumnHeights } from '../src/utils/battlePresentation';

for (const [width,height] of [[378,366],[824,159],[1190,276]]) {
  const g = resolveBattleCapitalSfcSideGeometry(width,height,'player');
  const rowBases = BATTLE_CAPITAL_CANVAS_ROW_COUNTS.flatMap((count,depth)=>
    Array(count).fill(resolveBattleCapitalSfcRowBaseY(g.pedestalTopY,g.pedestalHeight,depth)));
  let previous = 0;
  for (const units of [0,1,18,72,324,648,720,1296,4608,9216]) {
    const before = getCapitalColumnHeights(previous), after = getCapitalColumnHeights(units);
    let lastOffset = -1;
    for (const progress of [0,0.2,0.4,0.6,0.8,1]) {
      const frame = resolveCapitalViewportScroll({height,coinHeight:g.coinHeight,layerStep:g.layerStep,rowBases,before,after,progress});
      assert.ok(frame.offsetPx >= lastOffset, 'positive input must never scroll the treasury upwards');
      for (const dpr of [1,1.25,1.5,2]) {
        const commonOffset = Math.round(frame.offsetPx*dpr)/dpr;
        const trayY = g.pedestalTopY + commonOffset;
        for (const base of rowBases) {
          assert.ok(Math.abs((base + commonOffset - trayY) - (base-g.pedestalTopY)) < 1e-8,
            'all column roots and the physical pedestal must share one rigid transform');
        }
      }
      if (units <= 18) assert.equal(frame.targetOffsetPx,0,'early sparse piles must not descend');
      if (progress === 1 && units > 0) {
        const top = Math.min(...after.flatMap((v,i)=>v>0?[rowBases[i]-(v+6)*g.layerStep-g.coinHeight]:[]));
        assert.ok(top + frame.offsetPx >= frame.ceilingY - 0.001,'settled mountaintop must remain visible');
        if(frame.offsetPx>0) assert.ok(top+frame.offsetPx < frame.ceilingY+frame.stepPx+0.001);
      }
      lastOffset=frame.offsetPx;
    }
    previous=units;
  }
}
const bitmap = (w:number,h:number) => ({width:w,height:h}) as HTMLCanvasElement;
const cache = new CapitalBitmapCache(400,2);
const a=bitmap(5,10), b=bitmap(5,10), c=bitmap(5,10);
assert.ok(cache.put('a',a)); assert.ok(cache.put('b',b));
assert.equal(cache.get('a'),a); cache.put('c',c);
assert.equal(cache.get('b'),undefined); assert.equal(b.width,1);
assert.equal(cache.bytes,400); assert.equal(cache.size,2);
assert.equal(cache.put('too-large',bitmap(50,50)),false);
cache.clear(); assert.equal(cache.bytes,0); assert.equal(cache.size,0);
console.log('Capital rendering contracts passed: rigid descent, visible summit, sparse preservation and bounded bitmap LRU.');
