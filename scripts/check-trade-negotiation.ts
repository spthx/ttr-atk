import assert from 'node:assert/strict';
import {calculateNegotiationSupport,resolveTradeOffer,type TradeNegotiationState,type TradeOffer} from '../src/utils/tradeNegotiation';
import {INITIAL_PROPERTIES} from '../src/data/initialData';
import {COMMUNITY_CAMPAIGN_ORDER} from '../src/data/worldData';
import {calculateEnemyBudget} from '../src/utils/gameBalance';
const make=(price:number,budget:number):TradeNegotiationState=>({cash:price,invested:0,support:0,rival:budget*.2,rivalReserve:budget*.8,round:0,ownership:50,rally:0,guard:false});
assert.throws(()=>resolveTradeOffer(make(2000,630),{kind:'cash',amount:2001},2000));
assert.throws(()=>resolveTradeOffer(make(2000,630),{kind:'support',amount:NaN},2000));
let tutorial=make(2000,630),result:'player'|'opponent'|null=null;
for(let i=0;i<18&&!result;i++){
 const r=resolveTradeOffer(tutorial,i<2?{kind:'cash',amount:700}:{kind:'hold'},2000);
 tutorial=r.state;result=r.winner;
}
assert.equal(result,'player','two well-funded opening offers can win the tutorial');
let wins=0,losses=0;
for(let seed=0;seed<500;seed++){
 const price=2000*10**(seed%7),budget=price*(.3+(seed%19)/10);
 let state=make(price,budget),winner:'player'|'opponent'|null=null;
 for(let round=0;round<18&&!winner;round++){
  const before=state;
  const offer:TradeOffer=round<3&&state.cash>=price*.2?{kind:'cash',amount:price*.2}:
    round<8&&seed%3!==0?{kind:'support',amount:price*.3}:
    round===8?{kind:'rally'}:{kind:'hold'};
  const resolution=resolveTradeOffer(state,offer,price);state=resolution.state;winner=resolution.winner;
  assert.ok(state.cash>=0&&state.rivalReserve>=0);
  assert.ok(Math.abs(state.rival+state.rivalReserve-budget)<price*1e-10);
  assert.equal(before.round,round,'resolver must not mutate the previous state');
  assert.ok(state.ownership>=0&&state.ownership<=100);
  assert.equal(state.invested+state.cash,price);
 }
 assert.ok(winner,'every negotiation terminates within its fixed round budget');
 if(winner==='player')wins++;else losses++;
}
assert.ok(wins>0&&losses>0,'funding and counter-budget must affect the result');
console.log(JSON.stringify({battles:500,wins,losses,ledgerChecks:'passed',tutorial:'passed'}));
const owned:typeof INITIAL_PROPERTIES=[];
const influence={owned:0,total:0,label:'audit',playerBonus:0,enemyBudgetDiscount:0};
for(const target of INITIAL_PROPERTIES.filter(p=>p.countsTowardCityConquest!==false).sort((a,b)=>COMMUNITY_CAMPAIGN_ORDER.indexOf(a.community)-COMMUNITY_CAMPAIGN_ORDER.indexOf(b.community)||a.marketPrice-b.marketPrice)){
 const price=target.marketPrice;
 const budget=calculateEnemyBudget({targetProperty:target,industryInfluence:influence,regionalInfluence:influence,isTutorial:owned.length===0});
 let state=make(price,budget),winner:'player'|'opponent'|null=null;
 const uses=new Map<string,number>();
 for(let round=0;round<18&&!winner;round++){
  const source=owned.filter(p=>(uses.get(p.id)??0)<3).sort((a,b)=>calculateNegotiationSupport(b,price,uses.get(b.id)??0,owned.length)-calculateNegotiationSupport(a,price,uses.get(a.id)??0,owned.length))[0];
  const support=source?calculateNegotiationSupport(source,price,uses.get(source.id)??0,owned.length):0;
  let action:TradeOffer;
  if(round===0)action={kind:'rally'};
  else if(support>Math.min(price*.35,state.cash)){action={kind:'support',amount:support};uses.set(source.id,(uses.get(source.id)??0)+1);}
  else if(state.cash>0)action={kind:'cash',amount:Math.min(price*.35,state.cash)};
  else action={kind:'hold'};
  const r=resolveTradeOffer(state,action,price);state=r.state;winner=r.winner;
 }
 assert.equal(winner,'player',`normal route must remain winnable with previous city contacts: ${target.name}`);
 owned.push(target);
}
console.log(`Normal acquisition route reachable: ${owned.length} targets with prior contacts and no optional cartel funding.`);
