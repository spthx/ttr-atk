import assert from 'node:assert/strict';

// Run from the connected browser session with a tab on the isolated full-company
// fixture. This checks rendered geometry, not CSS source strings or game state.
export async function checkRenewalDock(tab) {
  const samples=[];
  for(const name of ['自社資金','資金を集める','かけひき']) {
    await tab.playwright.getByRole('button',{name:new RegExp('^'+name)}).click();
    const sample=await tab.playwright.evaluate(()=>{
      const arena=document.querySelector('.r-arena').getBoundingClientRect();
      const sheet=document.querySelector('.r-action-sheet').getBoundingClientRect();
      const actors=Array.from(document.querySelectorAll('.r-actor')).map(actor=>actor.getBoundingClientRect().bottom);
      return {arenaBottom:arena.bottom,sheetTop:sheet.top,sheetBottom:sheet.bottom,actors};
    });
    assert.ok(sample.sheetTop>=sample.arenaBottom,`${name}: choices cover the battle`);
    assert.ok(sample.actors.every(bottom=>bottom<=sample.sheetTop),`${name}: choices cover a character`);
    if(samples.length)assert.ok(Math.abs(samples[0].arenaBottom-sample.arenaBottom)<1,'Switching choices resized the battle');
    samples.push({...sample,panel:name});
  }
  return samples;
}
