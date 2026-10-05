/** Independent audit. Only this file and tmp/renewal-audit are writable outputs.
 * No browser, user Storage, source patch, Git operation, scene or publication.
 * Fixture field overrides isolate a rule; they are recorded as such in results.
 */
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {registerHooks} from 'node:module';
import ts from 'typescript';

const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'tmp/renewal-audit');
// --no-write permits a read-only run when only this script may be edited.
const writeReports=!process.argv.includes('--no-write');
const sourcePaths=['src/renewal/content.ts','src/renewal/campaign.ts','src/renewal/engine.ts','src/renewal/CoinStage.tsx','src/renewal/audio.ts','src/renewal/raidCatalog.ts','src/renewal/wind.ts','src/renewal/enemy.ts','src/data/battleEncounterData.ts'];
const snapshot=()=>Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')]));
const before=snapshot();
// Node has no Vite import.meta.env. Shim that single asset module in memory;
// no source file is patched and no asset, scene or browser is loaded.
const assetShim=registerHooks({load(url,context,nextLoad){
 if(url.endsWith('/src/data/fankitAssets.ts')){
  const input=readFileSync(resolve(root,'src/data/fankitAssets.ts'),'utf8').replaceAll('import.meta.env','({VITE_PUBLIC_BASE:"/"})');
  return {format:'module',source:ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};
 }
 return nextLoad(url,context);
}});
const {TradeEngine}=await import('../src/renewal/engine');
const {businesses,skills,groups,contracts,raids,finals}=await import('../src/renewal/content');
const {freshCompany,parseCompany,loadCompany,storeCompany,settleCompany,availableSkills,STORAGE_KEY}=await import('../src/renewal/campaign');
const {MarketWind}=await import('../src/renewal/wind');
const {enemyProfile}=await import('../src/renewal/enemy');
const {SAVAGE_ENEMY_SUPPORT_PROFILES,SAVAGE_ENEMY_AUTO_PROFILES,ULTIMATE_ENEMY_AUTO_PATTERNS,ENEMY_SUPPORT_SKILL_BALANCE}=await import('../src/data/battleEncounterData');
assetShim.deregister();
type Company=ReturnType<typeof freshCompany>;
type Encounter=typeof contracts[number];
type Result={id:string;priority:'P1'|'P2'|'control';contract:string;status:'PASS'|'FAIL';actual:unknown;error?:string};
const results:Result[]=[];
let receiptSerial=0;
const company=():Company=>({...freshCompany(),cash:20_000_000_000,owned:businesses.map(b=>b.id),cleared:raids.map(r=>r.id),equipped:skills.map(s=>s.id),patron:'audit-patron',risk:{[businesses[0].id]:7},streak:7});
const encounter=(mode:Encounter['mode']):Encounter=>mode==='normal'?contracts[0]:mode==='savage'?raids[0]:mode==='phantom'?{...raids[0],id:'audit-phantom',mode}:finals.find(f=>f.mode===mode)!;
const engine=(mode:Encounter['mode']='normal')=>new TradeEngine(encounter(mode),company());
// Clears presentation and command lock only; resource counts are preserved.
const ready=(e:InstanceType<typeof TradeEngine>)=>{e.pours=[];e.cooldown=0;};
// Rule-unit fixtures exclude both authored enemy AUTO phases and recurring AI.
// AUTO execution itself is outside these individual timing/effect assertions.
const inert=(e:InstanceType<typeof TradeEngine>)=>{ready(e);e.enemyClock=1e9;(e as any).opened=true;(e as any).criticalUsed=true;};
const tick=(e:InstanceType<typeof TradeEngine>,seconds:number,dt=.05)=>{for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=dt)e.step(Math.min(dt,seconds-elapsed));};
const receipt=(extra:Record<string,unknown>={})=>({id:`audit-${++receiptSerial}`,won:true,direct:0,drain:0,risk:{},allocation:0 as const,...extra});
function check(id:string,priority:Result['priority'],contract:string,run:()=>unknown){
  let actual:unknown=null;
  try{actual=run();results.push({id,priority,contract,status:'PASS',actual});}
  catch(error){results.push({id,priority,contract,status:'FAIL',actual,error:String(error)});}
}
// expectEqual puts the observed value into the failure message and JSON output.
function equal(actual:unknown,expected:unknown){assert.deepEqual(actual,expected);return actual;}
function near(actual:number,expected:number){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-6,`expected ${expected}; actual ${actual}`);return actual;}

check('cash-positive','control','正額の直接出資：現金・direct・playerだけに記帳',()=>{
 const e=engine();ready(e);const c=e.cash,n=e.enemy,r=e.reserve;equal(e.act({kind:'cash',ratio:.1}),true);
 return equal({cash:e.cash,direct:e.direct,player:e.player,enemy:e.enemy,reserve:e.reserve},{cash:c-200,direct:200,player:200,enemy:n,reserve:r});
});
for(const ratio of [-.1,0,NaN,Infinity,.13])check(`cash-reject-${String(ratio)}`,'control','負額・非有限・不正比率の直接出資は無変更で拒否',()=>{
 const e=engine();ready(e);const b=[e.cash,e.direct,e.player,e.enemy];equal(e.act({kind:'cash',ratio}),false);return equal([e.cash,e.direct,e.player,e.enemy],b);
});
for(const field of ['direct','drain'] as const)for(const value of [-100,NaN,Infinity])check(`settlement-${field}-${String(value)}`,'P1','異常な精算額は拒否し、有限の通常資金を維持',()=>{
 const c=company(),e=encounter('normal'),r=receipt({[field]:value});
 let next:Company;try{next=settleCompany(c,e,r);}catch{return 'rejected';}
 return equal({cash:next.cash,cleared:next.cleared}, {cash:c.cash,cleared:c.cleared});
});
check('settlement-negative-profit','P1','負の精算額で利益を生成しない',()=>{
 const c={...company(),cash:1000},e=encounter('normal');const next=settleCompany(c,e,receipt({won:false,direct:0,drain:-500}));
 assert.ok(next.cash<=c.cash,`cash ${c.cash} -> ${next.cash}`);return next.cash;
});
check('save-reject-invalid-cash','control','ロードは負数と非有限資金を拒否',()=>{
 return equal([-1,NaN,Infinity].map(cash=>parseCompany(JSON.stringify({...company(),cash}))),[null,null,null]);
});
check('save-new-loadout-roundtrip','control','新保存のopening/critical/synergyを往復保持',()=>{
 const c={...company(),opening:'skill_demoralize',critical:'skill_sns_blitz',synergy:'ERA_WIND_SYNERGY'};
 const parsed=parseCompany(JSON.stringify(c));return equal([parsed?.opening,parsed?.critical,parsed?.synergy],[c.opening,c.critical,c.synergy]);
});
// Save-boundary regressions: whole-save rejection is also acceptable for
// malformed values; if accepted, every resulting field must be safe.
const saveRegressionStart=results.length;
function safeRisk(parsed:Company|null){
 if(!parsed)return 'rejected';
 assert.ok(parsed.risk&&typeof parsed.risk==='object'&&!Array.isArray(parsed.risk),'risk must be a dictionary');
 for(const [id,value] of Object.entries(parsed.risk)){
  assert.ok(businesses.some(b=>b.id===id)&&parsed.owned.includes(id),`unexpected risk key ${id}`);
  assert.ok(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100,`invalid risk ${id}: ${String(value)}`);
 }
 return parsed.risk;
}
for(const [label,value] of [['negative',-1],['over100',101],['null',null],['string','75'],['object',{}],['boolean',true]] as const)check(`save-risk-value-${label}`,'P1','保存riskの不正値は拒否または有限0〜100へ正規化',()=>{
 const c=company();return safeRisk(parseCompany(JSON.stringify({...c,risk:{[businesses[0].id]:value}})));
});
for(const [label,risk] of [['array',[7]],['string','unsafe'],['null',null],['number',7]] as const)check(`save-risk-container-${label}`,'P1','保存riskの配列・非辞書は拒否または安全な辞書へ正規化',()=>{
 return safeRisk(parseCompany(JSON.stringify({...company(),risk})));
});
check('save-risk-nonfinite','P1','JSON数値1e309によるInfinityのriskを保持しない',()=>{
 const id=businesses[0].id,text=JSON.stringify({...company(),risk:{[id]:0}}).replace(`"${id}":0`,`"${id}":1e309`);
 return safeRisk(parseCompany(text));
});
check('save-risk-unknown-unowned','P1','riskは既知かつ所有中の事業だけ保持',()=>{
 const id=businesses[0].id,other=businesses[1].id;
 return safeRisk(parseCompany(JSON.stringify({...company(),owned:[id],risk:{[id]:7,[other]:88,'audit-unknown-business':80}})));
});
check('save-risk-prototype-key','P1','保存riskの__proto__/constructorキーを事業危険度として保持しない',()=>{
 const risk=JSON.parse('{"__proto__":{"polluted":true},"constructor":99}');
 const result=safeRisk(parseCompany(JSON.stringify({...company(),risk})));equal(({} as Record<string,unknown>).polluted,undefined);return result;
});
check('save-risk-valid-preserved','control','保存riskの正常な値は保持',()=>{
 const risk={[businesses[0].id]:0,[businesses[1].id]:100,[businesses[2].id]:37.5};
 const parsed=parseCompany(JSON.stringify({...company(),risk}));assert.ok(parsed);return equal(parsed.risk,risk);
});
function safeLoadout(parsed:Company|null){
 if(!parsed)return 'rejected';
 const available=new Set(availableSkills(parsed).map(s=>s.id));
 assert.ok(Array.isArray(parsed.equipped)&&parsed.equipped.length<=3,`manual slots ${parsed.equipped?.length}`);
 equal(new Set(parsed.equipped).size,parsed.equipped.length);
 assert.ok(parsed.equipped.every(id=>typeof id==='string'&&available.has(id)),`invalid or locked manual skill ${JSON.stringify(parsed.equipped)}`);
 for(const slot of ['opening','critical'] as const){const id=parsed[slot];
  if(id==null)continue;
  assert.ok(typeof id==='string'&&available.has(id),`invalid ${slot}: ${String(id)}`);
  assert.ok(parsed.cleared.includes(raids[slot==='opening'?0:3].id),`locked AUTO slot ${slot}`);
  assert.ok(!parsed.equipped.includes(id),`${slot} duplicates manual ${id}`);
 }
 assert.ok(!parsed.opening||parsed.opening!==parsed.critical,'opening/critical duplicate');
 return {manual:parsed.equipped,opening:parsed.opening??null,critical:parsed.critical??null};
}
check('save-equipped-three-slot-cap','P1','正常な技が6件入った保存でも手動3枠以内へ正規化',()=>{
 return safeLoadout(parseCompany(JSON.stringify(company())));
});
check('save-equipped-invalid-entries','P1','不正な装備ID・型・重複を除去、手動3枠を維持',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),equipped:[null,42,{},'audit-unknown-skill','skill_sabotage','skill_sabotage','skill_fast_horse','skill_synergy_push','skill_capital_boost']})));
});
for(const [label,equipped] of [['null',null],['string','skill_sabotage'],['object',{}]] as const)check(`save-equipped-container-${label}`,'P1','装備配列以外の保存を拒否または安全に正規化',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),equipped})));
});
check('save-equipped-locked-skill','P1','未解放技は保存装備から除去',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...freshCompany(),equipped:['skill_sabotage','skill_sns_blitz','skill_demoralize']})));
});
check('save-auto-duplicate','P1','開幕/瀕死AUTOの同一技重複を解消',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),equipped:['skill_sabotage'],opening:'skill_demoralize',critical:'skill_demoralize'})));
});
check('save-auto-manual-overlap','P1','AUTO技を手動枠から除去し残り手動3枠以内へ正規化',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),opening:'skill_demoralize',critical:'skill_sns_blitz'})));
});
for(const [label,opening,critical] of [['unknown','audit-unknown-skill','audit-other-skill'],['invalid-types',42,{}]] as const)check(`save-auto-${label}`,'P1','AUTOの未知ID・不正型を拒否または解除',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),equipped:['skill_sabotage'],opening,critical})));
});
check('save-auto-locked-role','P1','技を習得していても未解放AUTO枠には装備できない',()=>{
 return safeLoadout(parseCompany(JSON.stringify({...company(),cleared:[],equipped:['skill_sabotage'],opening:'skill_demoralize',critical:'skill_synergy_push'})));
});
check('save-valid-three-plus-two','control','正常な手動3＋AUTO2は変更せず保持',()=>{
 const c={...company(),equipped:['skill_sabotage','skill_capital_boost','skill_synergy_push'],opening:'skill_demoralize',critical:'skill_sns_blitz'};
 const parsed=parseCompany(JSON.stringify(c));assert.ok(parsed);safeLoadout(parsed);
 return equal([parsed.equipped,parsed.opening,parsed.critical],[c.equipped,c.opening,c.critical]);
});
// These structural fixture types allow RED tests before the parent adds fields.
type CarryCompany=Company&{lbCarry?:number};
const carry=(c:Company)=>(c as CarryCompany).lbCarry;
check('save-lb-carry-roundtrip','control','新保存の正常LB持越し値を往復保持',()=>{
 const parsed=parseCompany(JSON.stringify({...company(),lbCarry:175.5}));assert.ok(parsed);return equal(carry(parsed),175.5);
});
for(const [label,value] of [['negative',-1],['over300',301],['string','150'],['null',null]] as const)check(`save-lb-carry-${label}`,'P1','保存LBは拒否または有限0〜300へ正規化',()=>{
 const parsed=parseCompany(JSON.stringify({...company(),lbCarry:value}));if(!parsed)return 'rejected';
 const lb=carry(parsed)??0;assert.ok(typeof lb==='number'&&Number.isFinite(lb)&&lb>=0&&lb<=300,`invalid carry ${String(lb)}`);return lb;
});
check('save-lb-carry-nonfinite','P1','保存LBのInfinityを保持しない',()=>{
 const parsed=parseCompany(JSON.stringify({...company(),lbCarry:0}).replace('"lbCarry":0','"lbCarry":1e309'));if(!parsed)return 'rejected';
 const lb=carry(parsed)??0;assert.ok(Number.isFinite(lb)&&lb>=0&&lb<=300,`invalid carry ${String(lb)}`);return lb;
});
check('engine-lb-carry-start','P1','通常戦は保存した残LBから開始',()=>{
 const c:CarryCompany={...company(),lbCarry:175};const e=new TradeEngine(encounter('normal'),c);return equal(e.lb,175);
});
check('engine-lb-carry-tier-cap','control','LB持越しは現在の解放容量を超えない',()=>{
 const c:CarryCompany={...company(),owned:businesses.slice(0,3).map(b=>b.id),lbCarry:275};const e=new TradeEngine(encounter('normal'),c);
 assert.ok(e.lb>=0&&e.lb<=e.lbTier*100,`carry ${e.lb}, tier ${e.lbTier}`);return e.lb;
});
for(const mode of ['normal','savage','ultimate','cruel'] as const)for(const won of [true,false])check(`settlement-lb-carry-${mode}-${won}`,'P1','通常精算は勝敗を問わず戦闘の残LBを持ち越す',()=>{
 const c:CarryCompany={...company(),lbCarry:75};const next=settleCompany(c,encounter(mode),receipt({won,lbCarry:150}));return equal(carry(next),150);
});
check('settlement-lb-carry-zero','P1','LB使用後の残量0も明示的に持ち越す',()=>{
 const c:CarryCompany={...company(),lbCarry:275};return equal(carry(settleCompany(c,encounter('normal'),receipt({lbCarry:0}))),0);
});
check('settlement-lb-carry-once','P1','同一receiptの再送でLB持越しを書き換えない',()=>{
 const c:CarryCompany={...company(),lbCarry:75},r=receipt({lbCarry:150});
 const first=settleCompany(c,encounter('normal'),r);equal(carry(first),150);
 const second=settleCompany(first,encounter('normal'),{...r,lbCarry:275} as typeof r);return equal(second,first);
});
for(const mode of ['phantom','karma'] as const)for(const won of [true,false])for(const lbCarry of [0,275])check(`record-lb-carry-${mode}-${won}-${lbCarry}`,'control','幻/業は戦闘残LBでなく元のcompany.lbCarryを維持',()=>{
 const c:CarryCompany={...company(),lbCarry:150};return equal(carry(settleCompany(c,encounter(mode),receipt({won,lbCarry}))),150);
});
const saveRegressionResults=results.slice(saveRegressionStart);
check('network-ledger','control','支援はdirect・手元現金を消費しない',()=>{
 const e=engine();ready(e);const cash=e.cash;equal(e.act({kind:'network'}),true);assert.ok(e.player>0);return equal([e.cash,e.direct,e.supportUses],[cash,0,1]);
});
for(const mode of ['normal','savage','ultimate','cruel','phantom','karma'] as const)check(`support-limit-${mode}`,'control','絶・業8回／他18回、次回拒否',()=>{
 const e=engine(mode),limit=['ultimate','karma'].includes(mode)?8:18;
 for(let i=0;i<limit;i++){ready(e);e.ownership=50;e.warning=null;equal(e.act({kind:'network'}),true);}
 ready(e);equal(e.act({kind:'network'}),false);return equal(e.supportUses,limit);
});
check('network-decay-floor','P2','人脈減衰は初回1倍、0.1ずつ減少、下限0.5',()=>{
 const e=engine(),id=e.strongest(),first=e.supportAmount(id);e.supportUses=12;return near(e.supportAmount(id)/first,.5);
});
check('alliance-independent','control','相場75%・1回・人脈回数と現金非消費',()=>{
 const e=engine();ready(e);const cash=e.cash;equal(e.act({kind:'alliance'}),true);ready(e);equal(e.act({kind:'alliance'}),false);
 return equal([e.player,e.direct,e.cash,e.supportUses],[e.encounter.price*.75,0,cash,0]);
});
for(const mode of ['ultimate','normal','phantom','karma'] as const)check(`lb-repeat-${mode}`,'control','LB全消費、絶だけ再充填後も2回目拒否',()=>{
 const e=engine(mode);ready(e);e.lb=300;equal(e.act({kind:'limit'}),true);equal(e.lb,0);ready(e);e.ownership=50;e.warning=null;e.lb=300;
 return equal(e.act({kind:'limit'}),mode!=='ultimate');
});
check('lb-through-free-capital','P2','ぶんどるの支援投入もLBを蓄積する',()=>{
 const e=engine();ready(e);equal(e.act({kind:'skill',id:'skill_capital_boost'}),true);assert.ok(e.lb>0,`actual LB ${e.lb}`);return e.lb;
});
for(const mode of ['phantom','karma'] as const)for(const won of [true,false])check(`record-protect-${mode}-${won}`,'control','記録戦は出資・ドレイン・危険度を通常精算へ反映しない',()=>{
 const c=company(),next=settleCompany(c,encounter(mode),receipt({won,direct:999999,drain:999999,risk:{[businesses[0].id]:99},allocation:1}));
 equal([next.cash,next.owned,next.risk,next.patron],[c.cash,c.owned,c.risk,c.patron]);
 return equal(next.streak,mode==='phantom'?(won?c.streak+1:0):c.streak);
});
check('receipt-once','control','同じreceiptの即時再精算は一度のみ',()=>{
 const c=company(),e=encounter('normal'),r=receipt(),first=settleCompany(c,e,r),second=settleCompany(first,e,r);return equal(second,first);
});
check('receipt-after-eviction','P1','256件超の後も同じreceiptを再精算しない',()=>{
 const e=encounter('normal'),r=receipt();let c=settleCompany(company(),e,r);
 for(let i=0;i<260;i++)c=settleCompany(c,e,receipt({won:false}));
 const cash=c.cash;return equal(settleCompany(c,e,r).cash,cash);
});
check('progress-after-eviction','P1','receiptの履歴上限で恒久踏破が消えない',()=>{
 let c={...company(),cleared:['ultimate','cruel',...raids.map(r=>r.id)]};
 for(let i=0;i<260;i++)c=settleCompany(c,encounter('normal'),receipt({won:false}));
 return equal(['ultimate','cruel',...raids.map(r=>r.id)].every(id=>c.cleared.includes(id)),true);
});
check('storage-old-key-zero','control','旧Storageのget/set/remove/clear呼出0、番兵値不変',()=>{
 const old=['tataru-world-trade-save-v3','tataru-company-name','tataru_trade_pending_battle_v1','tataru_trade_pending_battle_recovery_v1','ttr-battle-frame-rate','ttr-lightweight-mode'];
 const map=new Map(old.map(k=>[k,`sentinel:${k}`]));const calls:Array<[string,string]>=[];
 const fake={getItem(k:string){calls.push(['get',k]);return map.get(k)??null;},setItem(k:string,v:string){calls.push(['set',k]);map.set(k,v);},removeItem(k:string){calls.push(['remove',k]);map.delete(k);},clear(){calls.push(['clear','*']);map.clear();}};
 const descriptors=['localStorage','sessionStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 try{for(const [key] of descriptors)Object.defineProperty(globalThis,key,{value:fake,configurable:true});
  equal(loadCompany().owned,[]);equal(storeCompany(company()),true);equal(loadCompany().owned,company().owned);storeCompany(freshCompany());loadCompany();
  equal(calls.filter(([op,key])=>op==='clear'||old.includes(key)),[]);equal(old.map(k=>map.get(k)),old.map(k=>`sentinel:${k}`));
  assert.ok(calls.every(([,key])=>key===STORAGE_KEY));return calls;
 }finally{for(const [key,d] of descriptors){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key);}}
});
check('reversal-70-30','control','反転は全額direct、70%自社・30%競合、次の一回で消去',()=>{
 const e=engine();ready(e);e.reversal=10;const cash=e.cash,enemy=e.enemy;equal(e.act({kind:'cash',ratio:.1}),true);
 return equal([e.direct,e.player,e.enemy-enemy,e.cash,e.reversal],[200,140,60,cash-200,0]);
});
check('reversal-excludes-network','control','人脈で反転契約を消費しない',()=>{
 const e=engine();ready(e);e.reversal=10;equal(e.act({kind:'network'}),true);return equal([e.direct,e.reversal],[0,10]);
});
check('karma-six-seconds','control','業のコピー予告は論理6秒',()=>{
 const e=engine('karma');ready(e);e.lb=300;equal(e.act({kind:'limit'}),true);equal(e.warning?.kind,'copy');equal(e.warning?.remaining,6);
 inert(e);tick(e,5.9);equal(e.warning?.kind,'copy');tick(e,.15);return equal(e.warning,null);
});
check('karma-perfect-network','P1','直接出資のコピーは予告された人脈／SYNERGYで完全取消',()=>{
 const e=engine('karma');ready(e);equal(e.act({kind:'cash',ratio:.35}),true);equal(e.warning?.copyKind,'cash');ready(e);
 equal(e.act({kind:'network'}),true);return equal(e.warning?.countered,1);
});
check('karma-nonperfect-ability','P1','表示外の別系統アビリティは半減で、万能完全取消ではない',()=>{
 const e=engine('karma');ready(e);equal(e.act({kind:'cash',ratio:.35}),true);ready(e);equal(e.act({kind:'skill',id:'skill_sabotage'}),true);
 return equal(e.warning?.countered,.5);
});
// Old authored counter pairs, expressed in renewal's action-family names.
// Each case sets one copy warning as a fixture and sends a real public action.
const oldCounterPairs={cash:['network','group'],network:['cash','skill'],group:['skill','limit'],alliance:['cash','skill'],limit:['skill','network'],skill:['cash','group']} as const;
const actionKinds=['cash','network','group','alliance','limit','skill'] as const;
for(const copied of actionKinds)for(const response of actionKinds)check(`karma-matrix-${copied}-${response}`,'P1',`旧コピー対処表: ${copied} に ${response} を返す`,()=>{
 const e=engine('karma');ready(e);e.lb=300;e.warning={kind:'copy',name:'fixture',hint:'fixture',remaining:6,copyKind:copied,copyAmount:10};
 const action=response==='cash'?{kind:response,ratio:.1}:response==='group'?{kind:response,id:'ERA_WIND_SYNERGY'}:response==='skill'?{kind:response,id:'skill_sabotage'}:{kind:response};
 equal(e.act(action),true);
 const expected=copied===response?0:(oldCounterPairs[copied] as readonly string[]).includes(response)?1:.5;
 return equal(e.warning?.countered??0,expected);
});
check('karma-no-synthetic-cash','P1','受動圧力だけで架空の直接出資を記憶しない',()=>{
 const e=engine('karma');inert(e);e.ownership=56;e.player=0;e.enemy=0;e.step(.05);return equal(e.warning,null);
});
check('karma-escrow','P1','開始時競合予算24%を写し用に事前隔離し、通常出資に使わない',()=>{
 const e=engine('karma');const cashForNormal=e.reserve+e.enemy;return near(cashForNormal,e.budget*.76);
});
check('cruel-declaration-time','P1','酷の第一宣告は所有率に関係なく有効時間15秒で開始',()=>{
 const e=engine('cruel');inert(e);e.ownership=50;e.player=e.enemy;e.time=14.95;e.step(.1);return equal(e.warning?.kind,'declaration');
});
check('cruel-no-early-declaration','P1','酷で15秒未満に65%へ届いても第一宣告を早めない',()=>{
 const e=engine('cruel');ready(e);e.time=0;e.ownership=64;equal(e.act({kind:'cash',ratio:.1}),true);return equal(e.warning,null);
});
check('cruel-does-not-heal','P1','第一宣告は10%未満の所有率を回復させない',()=>{
 const e=engine('cruel');inert(e);e.ownership=5;e.warning={kind:'declaration',name:'fixture',hint:'fixture',remaining:.01};e.step(.05);return equal(e.ownership,5);
});
for(const [ownership,signature,expected] of [[75,.1,null],[74.9,.1,'opponent'],[75,.099,'opponent']] as const)check(`cruel-condition-${ownership}-${signature}`,'control','酷の着弾条件は所有率75%以上かつ直接署名相場10%以上',()=>{
 const e=engine('cruel');inert(e);e.ownership=ownership;(e as any).signature=e.encounter.price*signature;(e as any).cruelStage=3;e.warning={kind:'reckoning',name:'fixture',hint:'fixture',remaining:.01};e.step(.05);return equal(e.winner,expected);
});
check('cruel-signature-direct-only','control','酷の査定署名は直接出資だけ、支援を数えない',()=>{
 const e=engine('cruel');ready(e);(e as any).cruelStage=3;e.warning={kind:'reckoning',name:'fixture',hint:'fixture',remaining:15};
 e.act({kind:'network'});equal((e as any).signature,0);ready(e);e.act({kind:'cash',ratio:.1});return equal((e as any).signature,e.encounter.price*.1);
});
check('cruel-recovery-ten-seconds','control','酷は50%未到達でも10秒後に15秒査定へ移る',()=>{
 const e=engine('cruel');inert(e);e.ownership=10;e.player=e.enemy;(e as any).cruelStage=2;(e as any).cruelClock=10;tick(e,10.1);equal(e.warning?.kind,'reckoning');assert.ok((e.warning?.remaining??0)>14.8);return e.warning;
});
check('ultimate-108-boundary','control','絶は108秒境界で終了',()=>{
 const e=engine('ultimate');inert(e);e.time=107.95;e.step(.1);return equal(e.winner,'opponent');
});
check('ultimate-warning-clock','control','絶の予告中は108秒時計を停止、予告時計は進む',()=>{
 const e=engine('ultimate');inert(e);e.warning={kind:'drill',name:'fixture',hint:'fixture',remaining:2};const time=e.time;tick(e,1);equal(e.time,time);return near(e.warning!.remaining,1);
});
check('ultimate-grace-ready','P1','強制清算直後に反撃コマンドが即入力可能',()=>{
 const e=engine('ultimate');inert(e);e.cooldown=1.3;e.ownership=80;e.warning={kind:'liquidation',name:'fixture',hint:'fixture',remaining:.01};e.step(.05);return equal(e.ready,true);
});
check('ultimate-grace-manual-gate','P1','4秒猶予後も入力するまで自社旧継続圧力の回復を禁止',()=>{
 const e=engine('ultimate');inert(e);e.ownership=80;e.player=e.encounter.price*100;e.warning={kind:'liquidation',name:'fixture',hint:'fixture',remaining:.01};e.step(.05);const after=e.ownership;tick(e,4.2);return near(e.ownership,after);
});
for(const [id,expected,field] of [['skill_fast_horse',15,'haste'],['skill_demoralize',16,'cover'],['skill_sabotage',10,'feint'],['skill_synergy_push',25,'shield'],['skill_sns_blitz',10,'immortal']] as const)check(`skill-${id}-${field}`,'P1','既存6技の有効時間／防御量と一致',()=>{
 const e=engine();ready(e);equal(e.act({kind:'skill',id}),true);return equal(e[field],expected);
});
check('skill-haste-not-cash','P1','疾風怒濤はリキャスト短縮で、資金回復技ではない',()=>{
 const e=engine();ready(e);e.cash=500;const before=e.cash;e.act({kind:'skill',id:'skill_fast_horse'});return equal(e.cash,before);
});
for(const mode of ['savage','ultimate'] as const)check(`skill-cover-mitigation-${mode}`,'P1','ドリルの規定8/10ptに対しパッセは被押込を92%軽減',()=>{
 const bare=engine(mode),covered=engine(mode);inert(bare);inert(covered);equal(covered.act({kind:'skill',id:'skill_demoralize'}),true);ready(covered);
 for(const e of [bare,covered])e.warning={kind:'drill',name:'fixture',hint:'fixture',remaining:.01};
 const beforeBare=bare.ownership,beforeCovered=covered.ownership;bare.step(.05);covered.step(.05);
 const raw=beforeBare-bare.ownership,mitigated=beforeCovered-covered.ownership;
 near(raw,mode==='ultimate'?ENEMY_SUPPORT_SKILL_BALANCE.drill.ultimateOwnershipPush:ENEMY_SUPPORT_SKILL_BALANCE.drill.savageOwnershipPush);
 near(mitigated/raw,.08);return {raw,mitigated,remainingRatio:mitigated/raw};
});
check('skill-cover-capacity','P1','パッセは42所有率ポイント相当の有限容量',()=>{
 const e=engine('savage');ready(e);e.act({kind:'skill',id:'skill_demoralize'});for(let i=0;i<7;i++){inert(e);e.ownership=50;e.warning={kind:'drill',name:'fixture',hint:'fixture',remaining:.001};e.step(.001);}return equal(e.cover,0);
});
check('skill-mug-40','P1','ぶんどるは相場40%無料支援',()=>{
 const e=engine();ready(e);const c=e.cash;e.act({kind:'skill',id:'skill_capital_boost'});equal([e.cash,e.direct],[c,0]);return near(e.player,e.encounter.price*.4);
});
check('skill-repeat-block','control','各技は戦闘1回',()=>{
 const e=engine();ready(e);equal(e.act({kind:'skill',id:'skill_sabotage'}),true);ready(e);return equal(e.act({kind:'skill',id:'skill_sabotage'}),false);
});
for(const id of skills.filter(s=>s.id!=='skill_sabotage').map(s=>s.id))check(`skill-locked-reject-${id}`,'control','未解放技は装備済みでも無変更で拒否',()=>{
 const c={...freshCompany(),cash:20000,equipped:[id]};const e=new TradeEngine(encounter('normal'),c);ready(e);
 const before=[e.cash,e.player,e.direct,e.lb,e.cover,e.shield,e.haste,e.immortal,e.usedSkills.size];
 equal(e.act({kind:'skill',id}),false);return equal([e.cash,e.player,e.direct,e.lb,e.cover,e.shield,e.haste,e.immortal,e.usedSkills.size],before);
});
check('skill-living-internal-debt','P1','リビングデッドは表示1%でも内部負圧を保持する',()=>{
 const e=engine('savage');ready(e);e.act({kind:'skill',id:'skill_sns_blitz'});inert(e);e.ownership=1;e.warning={kind:'drill',name:'fixture',hint:'fixture',remaining:.01};e.step(.05);ready(e);e.act({kind:'cash',ratio:.1});
 const rawHit=ENEMY_SUPPORT_SKILL_BALANCE.drill.savageOwnershipPush,firstRecovery=24*.1;
 near(e.ownership,1);near((e as any).debt,rawHit-firstRecovery);
 // A later recovery that exceeds the actual debt must regain ownership.
 ready(e);equal(e.act({kind:'cash',ratio:.35}),true);
 near(e.ownership,1-rawHit+firstRecovery+24*.35);near((e as any).debt,0);
 return {rawHit,firstRecovery,ownershipAfterSecondRecovery:e.ownership};
});
check('skill-living-unlock','P1','零式第1編4層踏破でリビングデッドを解放',()=>{
 const c={...company(),cleared:[raids.find(r=>r.series===1&&r.layer===4)!.id]};return equal(availableSkills(c).some(s=>s.id==='skill_sns_blitz'),true);
});
check('skill-passage-unlock','P1','連合本部1つ制覇でパッセを解放',()=>{
 return equal(availableSkills(company()).some(s=>s.id==='skill_demoralize'),true);
});
check('manual-synergy','P1','戦闘専用SYNERGYを手動発動できる',()=>{
 const e=engine();ready(e);return equal(e.act({kind:'group',id:groups.find(g=>g.id==='ERA_WIND_SYNERGY')!.id}),true);
});
check('wind-effect-separation','P2','自社追い風は直接押込1.35倍、記帳実額は不変',()=>{
 const calm=engine(),wind=engine();ready(calm);ready(wind);wind.marketWind.kind='player';wind.marketWind.phase='active';
 calm.act({kind:'cash',ratio:.1});wind.act({kind:'cash',ratio:.1});equal([wind.direct,wind.player],[calm.direct,calm.player]);return near((wind.ownership-50)/(calm.ownership-50),1.35);
});
check('wind-initial-calm','control','初期静穏10秒中は抽選せず倍率1',()=>{
 let calls=0;const w=new MarketWind(()=>{calls++;return 0;});w.step(9.99);
 equal([w.kind,w.phase,calls],['calm','calm',0]);near(w.remaining,.01);return equal(w.multipliers,{player:1,enemy:1,recovery:1,enemyRecovery:1,speed:1});
});
for(const [probability,expected] of [[.2499,'forecast'],[.25,'calm']] as const)check(`wind-probability-${probability}`,'control','10秒ごとの抽選は25%未満で発生、境界25%では不発',()=>{
 const sequence=[probability,0];const w=new MarketWind(()=>sequence.shift()??0);w.step(10);return equal(w.phase,expected);
});
check('wind-forecast-active-cooldown','control','予告2秒→有効7秒→静穏冷却18秒',()=>{
 const w=new MarketWind(()=>0);w.step(10);equal([w.phase,w.kind,w.pending,w.remaining],['forecast','calm','player',2]);
 w.step(1.99);equal(w.kind,'calm');w.step(.01);equal([w.phase,w.kind,w.remaining],['active','player',7]);
 w.step(7);return equal([w.phase,w.kind,w.remaining],['cooldown','calm',18]);
});
check('wind-active-duration-range','control','有効時間は乱数境界で7〜9秒内',()=>{
 const sequence=[0,0,.999999];const w=new MarketWind(()=>sequence.shift()??0);w.step(10);w.step(2);
 assert.ok(w.remaining>=7&&w.remaining<=9,`duration ${w.remaining}`);return w.remaining;
});
check('wind-no-repeat','control','冷却後の抽選で直前と同じ風を避ける',()=>{
 const w=new MarketWind(()=>0);w.step(10);w.step(2);equal(w.kind,'player');w.step(7);w.step(18);
 if(w.phase==='calm')w.step(10);equal(w.phase,'forecast');assert.notEqual(w.pending,'player');return w.pending;
});
check('wind-cooldown-roll-interval','P2','冷却18秒終了後は次の10秒抽選間隔まで静穏を保つ（旧時計契約）',()=>{
 const w=new MarketWind(()=>0);w.step(10);w.step(2);w.step(7);w.step(18);return equal([w.phase,w.kind,w.remaining],['calm','calm',10]);
});
for(const [kind,expected] of [
 ['player',{player:1.35,enemy:1,recovery:1.25,enemyRecovery:1,speed:1}],
 ['head',{player:.72,enemy:1,recovery:.75,enemyRecovery:1,speed:1}],
 ['enemy',{player:1,enemy:1.35,recovery:1,enemyRecovery:1.25,speed:1}],
 ['cross',{player:1.12,enemy:1.12,recovery:1.2,enemyRecovery:1.2,speed:1.45}],
] as const)check(`wind-multipliers-${kind}`,'control','各風の押込・回復・速度倍率を論理的に分離',()=>{
 const w=new MarketWind();w.kind=kind;w.phase='active';return equal(w.multipliers,expected);
});
check('wind-freeze-warning','control','敵予告中に通常風の時計を進めない',()=>{
 const e=engine('ultimate');inert(e);e.marketWind.kind='player';e.marketWind.phase='active';e.marketWind.remaining=7;
 e.warning={kind:'drill',name:'fixture',hint:'fixture',remaining:2};tick(e,1);return equal(e.marketWind.remaining,7);
});
check('wind-freeze-motion','control','コイン演出中に通常風の時計を進めない',()=>{
 const e=engine('ultimate');const before=e.marketWind.remaining;e.step(.05);return equal(e.marketWind.remaining,before);
});
check('elapsed-time-not-discarded','P2','非演出中の1秒経過は1秒のゲーム時間',()=>{
 const e=engine();inert(e);e.step(1);return near(e.time,1);
});
check('frame-rate-30-60','control','正常な30/60fps経過で論理時間一致',()=>{
 const a=engine(),b=engine();inert(a);inert(b);tick(a,1,1/30);tick(b,1,1/60);return near(a.time,b.time);
});
check('speed-scope','control','速度2倍は表示時間のみで、ゲーム時計は同じ',()=>{
 const a=engine(),b=engine();inert(a);inert(b);a.step(.05,1);b.step(.05,2);equal(a.time,b.time);return equal(b.visual,a.visual*2);
});
check('old-runtime-imports','P2','renewalは旧ルール実装のimportを持ち込まない',()=>{
 const content=readFileSync(resolve(root,'src/renewal/content.ts'),'utf8');return equal([...content.matchAll(/from\s+['"](\.\.\/utils\/[^'"]+)/g)].map(m=>m[1]),[]);
});
check('twelve-explicit-layers','control','零式は3編4層の12戦を明示',()=>equal([raids.length,new Set(raids.map(r=>`${r.series}:${r.layer}`)).size],[12,12]));
// Profile coverage is distinct from inert timing fixtures: real opening and
// critical enemy AUTO gates remain enabled here. Only recurring AI is disabled.
const profileRegressionStart=results.length;
const warningKinds={drain:'drain',drill:'drill',blackest_night:'barrier',divination:'divination',rapid_assault:'rapid',limit_break_3:'enemyLimit'} as const;
function verifyAutoWarning(e:InstanceType<typeof TradeEngine>,expected:string|null){
 if(expected===null)return equal(e.warning,null);
 const kind=warningKinds[expected as keyof typeof warningKinds];assert.ok(kind,`unsupported authored AUTO ${expected}`);
 equal(e.warning?.kind,kind);assert.ok(e.warning!.name.length>0&&e.warning!.hint.length>0,'warning name/hint must be readable');
 const remaining=e.warning!.remaining;assert.ok(Number.isFinite(remaining)&&remaining>0,'warning must precede impact');
 const before={cash:e.cash,ownership:e.ownership,time:e.time,remaining};ready(e);e.step(Math.min(.05,remaining/2));
 equal([e.cash,e.ownership,e.time],[before.cash,before.ownership,before.time]);assert.ok(e.warning!.remaining<remaining,'telegraph clock must advance while battle clock pauses');
 return {expected,kind,name:e.warning!.name,hint:e.warning!.hint,remaining:e.warning!.remaining};
}
function openingWarning(target:Encounter,expected:string|null){
 const e=new TradeEngine(target,company());ready(e);e.enemyClock=1e9;e.step(.05);return verifyAutoWarning(e,expected);
}
function criticalWarning(target:Encounter,expected:string|null){
 const e=new TradeEngine(target,company());ready(e);e.enemyClock=1e9;
 // Start immediately before critical threshold, with opening already resolved.
 // Layer reversal/liquidation are marked resolved to isolate this AUTO event.
 (e as any).opened=true;(e as any).resolved=new Set(['reversal','liquidation']);e.ownership=69;
 equal(e.act({kind:'cash',ratio:.1}),true);return verifyAutoWarning(e,expected);
}
for(let pattern=0;pattern<ULTIMATE_ENEMY_AUTO_PATTERNS.length;pattern++){
 const authored=ULTIMATE_ENEMY_AUTO_PATTERNS[pattern],target={...encounter('ultimate'),pattern};
 check(`enemy-ultimate-profile-${pattern}`,'P1','絶6パターンの開幕/瀕死と対処ヒントを純データから判別',()=>{
  const p=enemyProfile(target);return equal([p.opening,p.critical,p.hint],[authored.opening,authored.critical,authored.counterPlan]);
 });
 check(`enemy-ultimate-opening-${pattern}`,'P1','絶パターンの開幕予告と着弾前時計停止',()=>openingWarning(target,authored.opening));
 check(`enemy-ultimate-critical-${pattern}`,'P1','絶パターンの瀕死予告と着弾前時計停止',()=>criticalWarning(target,authored.critical));
}
for(const target of raids){
 const series=target.series-1,layer=target.layer-1,auto=SAVAGE_ENEMY_AUTO_PROFILES[series][layer],support=SAVAGE_ENEMY_SUPPORT_PROFILES[series][layer];
 const suffix=`${target.series}-${target.layer}`;
 check(`enemy-savage-profile-${suffix}`,'P1','零式12層の支援/開幕/瀕死を編・層の明示データから判別',()=>{
  const p=enemyProfile(target);return equal([p.skills,p.opening,p.critical],[support,auto.opening,auto.critical]);
 });
 check(`enemy-savage-opening-${suffix}`,'P1','零式各層の開幕予告（未設定層は予告なし）',()=>openingWarning(target,auto.opening));
 check(`enemy-savage-critical-${suffix}`,'P1','零式各層の瀕死予告（未設定層は予告なし）',()=>criticalWarning(target,auto.critical));
 check(`enemy-phantom-profile-${suffix}`,'P1','幻は抽選零式層の支援/開幕/瀕死プロフィールを再現',()=>{
  const p=enemyProfile({...target,mode:'phantom'});return equal([p.skills,p.opening,p.critical],[support,auto.opening,auto.critical]);
 });
}
const profileRegressionResults=results.slice(profileRegressionStart);
// Audio and Canvas are read statically only. Importing CoinStage would create Images.
const staticObservations={
 canvasAdvancesEngine:/engine\.step\s*\(/.test(readFileSync(resolve(root,'src/renewal/CoinStage.tsx'),'utf8')),
 audioReadsStorage:/localStorage|sessionStorage/.test(readFileSync(resolve(root,'src/renewal/audio.ts'),'utf8')),
 scope:'engine/campaign imports, in-memory fixtures and fake Storage only; App/CSS/browser/audio playback/scene are untested',
 nodeViteShim:'Only src/data/fankitAssets.ts gets import.meta.env.VITE_PUBLIC_BASE=/ in memory via Node loader hook; source unchanged.',
};
const after=snapshot();
const changed=sourcePaths.filter(path=>before[path]!==after[path]);
const report={createdAt:new Date().toISOString(),parentToolId:'01a10c72-2a66-7db0-a220-7fb6be6122d1',nickname:'Copernicus',model:'GPT-6.1 Sol',reasoning:'medium',identityEvidence:'起動引数と親公式ツール戻りIDは依頼者の確認報告。子から再照会は未実施。',
 sourceHashesBefore:before,sourceHashesAfter:after,changedDuringRun:changed,summary:{total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length},staticObservations,results};
const jsonPath=resolve(output,'results.json');
if(writeReports){
mkdirSync(output,{recursive:true});
// Preserve the previous measured run before publishing the latest report.
if(existsSync(jsonPath)){
 const previous=readFileSync(jsonPath,'utf8');const stamp=JSON.parse(previous).createdAt.replaceAll(':','-');
 const archive=resolve(output,`results-${stamp}.json`);if(!existsSync(archive))writeFileSync(archive,previous);
 const oldMarkdown=resolve(output,'results.md'),archiveMarkdown=resolve(output,`results-${stamp}.md`);
 if(existsSync(oldMarkdown)&&!existsSync(archiveMarkdown))writeFileSync(archiveMarkdown,readFileSync(oldMarkdown,'utf8'));
}
writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');
const lines=['# Renewal audit run',`UTC: ${report.createdAt}`,`Cases: ${report.summary.total}; pass ${report.summary.passed}; fail ${report.summary.failed}`,`Changed during run: ${changed.join(', ')||'none'}`,'','This is a partial implementation audit, not product acceptance.','',...results.map(r=>`- ${r.status} [${r.priority}] ${r.id}: ${r.contract}${r.error?' | '+r.error.replace(/\r?\n/g,' '):''}`)];
writeFileSync(resolve(output,'results.md'),lines.join('\n')+'\n');
}
console.log(JSON.stringify({createdAt:report.createdAt,summary:report.summary,newSaveRegressions:{total:saveRegressionResults.length,passed:saveRegressionResults.filter(r=>r.status==='PASS').length,failed:saveRegressionResults.filter(r=>r.status==='FAIL').length},enemyProfileRegressions:{total:profileRegressionResults.length,passed:profileRegressionResults.filter(r=>r.status==='PASS').length,failed:profileRegressionResults.filter(r=>r.status==='FAIL').length},changedDuringRun:changed,report:writeReports?jsonPath:null,noWrite:!writeReports,failures:results.filter(r=>r.status==='FAIL').map(r=>({id:r.id,priority:r.priority,error:r.error}))},null,2));
// Parent source changes are informational and never fail the audit by themselves.
if(report.summary.failed)process.exitCode=1;
