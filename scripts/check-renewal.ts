import assert from 'node:assert/strict';
import {TradeEngine} from '../src/renewal/engine';
import {freshCompany,chapter,settleCompany,unlockedRaid,income,accrue} from '../src/renewal/campaign';
import {businesses,contracts,cities,raids,finals,skills} from '../src/renewal/content';
const full={...freshCompany(),cash:50e9,owned:businesses.map(p=>p.id),cleared:raids.map(r=>r.id),equipped:skills.map(s=>s.id),patron:'garland_ironworks'};
const run=(engine:TradeEngine,policy:'active'|'idle'='active',max=240)=>{
  for(let i=0;i<max*100&&!engine.winner;i++){
    if(policy==='active'&&engine.ready){
      const warning=engine.warning?.kind;
      if(warning==='liquidation'&&!engine.usedSkills.has('skill_demoralize'))engine.act({kind:'skill',id:'skill_demoralize'});
      else if(warning==='reckoning'&&engine.cash>=engine.encounter.price*.1)engine.act({kind:'cash',ratio:.1});
      else if(warning==='copy'&&engine.warning?.copyKind==='cash'&&engine.supportUses<engine.supportLimit)engine.act({kind:'network'});
      else if(engine.lb>=100&&engine.lbTier>0&&!(engine.encounter.mode==='ultimate'&&engine.lbUses>=1))engine.act({kind:'limit'});
      else if(engine.cash>=engine.encounter.price*.35)engine.act({kind:'cash',ratio:.35});
      else if(engine.company.owned.length&&engine.supportUses<engine.supportLimit)engine.act({kind:'network'});
      else if(engine.company.patron&&!engine.allianceUsed)engine.act({kind:'alliance'});
      else if(!engine.usedSkills.has('skill_capital_boost')&&engine.company.equipped.includes('skill_capital_boost'))engine.act({kind:'skill',id:'skill_capital_boost'});
    }
    engine.step(.02,2);
    assert.ok(Number.isFinite(engine.ownership));assert.ok(engine.cash>=0&&engine.reserve>=0);assert.ok(engine.pours.length<=32);
  }
  return engine.winner;
};
const normal=contracts.filter(e=>businesses.find(p=>p.id===e.id)?.countsTowardCityConquest!==false).sort((a,b)=>cities.indexOf(a.city as never)-cities.indexOf(b.city as never)||a.price-b.price);
let company=freshCompany();const route=[];
for(const target of normal){
  assert.ok(unlockedRaid(company,target));
  const waiting=company.cash<target.price?Math.ceil((target.price-company.cash)/income(company)):0;
  assert.ok(Number.isFinite(waiting)&&waiting<=1800,`${target.name}: progression cannot require more than the offline-income cap`);
  if(waiting)company=accrue(company,company.savedAt+waiting*1000);
  const engine=new TradeEngine(target,company);const result=run(engine);
  route.push({name:target.name,result,time:engine.time,waiting,actions:engine.direct});
  assert.equal(result,'player',target.name+' must be attainable from earned cash and prior contacts');
  company=settleCompany(company,target,{id:engine.receipt,won:true,direct:engine.direct,drain:engine.drain,risk:engine.risk,allocation:1,lbCarry:engine.lb});
}
assert.equal(chapter(company),10);assert.ok(unlockedRaid(company,raids[0]));
let won=0,lost=0,unfinished=0;
for(let i=0;i<500;i++){
  const target=[...contracts,...raids,...finals][i%(contracts.length+raids.length+finals.length)];
  const e=new TradeEngine(target,full);const result=run(e,i%5===0?'idle':'active');
  if(result==='player')won++;else if(result==='opponent')lost++;else unfinished++;
}
console.log(JSON.stringify({route,simulations:{count:500,won,lost,unfinished}},null,2));
assert.ok(won>0&&lost>0);
assert.equal(unfinished,0,'all policy fixtures must reach a decision within bounded simulation');
