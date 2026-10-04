import {useEffect,useMemo,useRef,useState} from 'react';
import type {BattleModalProps} from './BattleModal';
import {BattleCapitalCanvas} from './BattleCapitalCanvas';
import {buildCapitalStackTimeline,type CapitalStackTimeline} from '../utils/battlePresentation';
import {calculateNegotiationSupport,resolveTradeOffer,type TradeNegotiationState,type TradeOffer} from '../utils/tradeNegotiation';
import {calculateEnemyBudget,calculateBattleVictoryReward} from '../utils/gameBalance';
import {calculateDirectInvestmentSettlementCost} from '../utils/battleSettlement';
import {formatCurrency} from '../utils/formatter';
import {soundFx} from '../utils/audio';
import {FANKIT_ART,getFankitJobArt} from '../data/fankitAssets';
import './TradeNegotiationBattle.css';

interface Pour {id:number;from:TradeNegotiationState;to:TradeNegotiationState;winner:'player'|'opponent'|null;label:string}

/** One RAF owns both sides, every wave and the speed switch. No beat timers. */
function NegotiationTable({pour,price,fps,done,company,rival,running}: {
  pour:Pour;price:number;fps:30|60;done:()=>void;company:string;rival:string;running:boolean;
}){
  const reduced=useMemo(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const timelines=useMemo(()=>{
    const make=(side:'player'|'enemy',before:number,after:number)=>buildCapitalStackTimeline({
      id:`negotiation-${pour.id}-${side}`,side,source:side==='player'?'direct':'enemy-defense',
      previousCapital:before,nextCapital:after,marketPrice:price,intensity:reduced?'compact':'heavy',seed:pour.id});
    return [make('player',pour.from.invested+pour.from.support,pour.to.invested+pour.to.support),
      make('enemy',pour.from.rival,pour.to.rival)];
  },[pour,price,reduced]);
  const [sampled,setSampled]=useState({id:pour.id,elapsed:0});
  const elapsed=sampled.id===pour.id?sampled.elapsed:0;
  const [fast,setFast]=useState(false);
  const clock=useRef({elapsed:0,last:0,speed:1});
  const doneRef=useRef(done);doneRef.current=done;
  const duration=Math.max(...timelines.map(t=>t.pourDurationMs))+165;
  useEffect(()=>{
    if(!running)return;
    let raf=0,disposed=false,lastPaint=0;
    setFast(false);
    clock.current={elapsed:0,last:performance.now(),speed:1};
    for(const [index,t] of timelines.entries()) if(t.pourDurationMs>0)
      soundFx.playCapitalStackStep(index===0?'player':'opponent',0,2,true,t.pourDurationMs);
    const tick=(now:number)=>{
      if(disposed)return;
      const c=clock.current;
      const delta=now-c.last;c.last=now;
      if(!document.hidden)c.elapsed+=delta*c.speed;
      if(now-lastPaint>=1000/fps-.5 || c.elapsed>=duration){setSampled({id:pour.id,elapsed:Math.min(duration,c.elapsed)});lastPaint=now;}
      if(c.elapsed>=duration){soundFx.stopCapitalStackStream('player');soundFx.stopCapitalStackStream('opponent');doneRef.current();return;}
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const visibility=()=>{clock.current.last=performance.now();};
    document.addEventListener('visibilitychange',visibility);
    return()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);soundFx.stopCapitalStackStream('player');soundFx.stopCapitalStackStream('opponent');};
  },[duration,fps,timelines,running,pour.id]);
  const sample=(t:CapitalStackTimeline)=>{
    const time=running?elapsed+t.preloadMs:t.totalMs;
    const frame=t.frames.findLast(f=>f.atMs<=time)??t.frames[0];
    return {...frame,presentationSerial:pour.id,beatDurationMs:frame.durationMs,
      packetProgress:reduced?1:Math.min(1,Math.max(0,(time-frame.atMs)/frame.durationMs))};
  };
  const ownership=running?pour.from.ownership+(pour.to.ownership-pour.from.ownership)*Math.min(1,elapsed/duration):pour.to.ownership;
  return <>
    <BattleCapitalCanvas player={{amount:pour.to.invested+pour.to.support,marketPrice:price,previewFrame:sample(timelines[0])}}
      enemy={{amount:pour.to.rival,marketPrice:price,previewFrame:sample(timelines[1])}} ownershipPercent={ownership} frameRate={fps}/>
    <div className="trade-table__score"><span>{company}<b>{formatCurrency(pour.to.invested+pour.to.support)}</b></span><span>{rival}<b>{formatCurrency(pour.to.rival)}</b></span></div>
    <div className="trade-table__pressure" role="progressbar" aria-label="交渉の優勢" aria-valuenow={Math.round(ownership)} aria-valuemin={0} aria-valuemax={100}><i style={{transform:`scaleX(${ownership/100})`}}/></div>
    {running&&<button className="trade-table__accelerate" onClick={()=>{clock.current.speed=2;setFast(true);soundFx.setCapitalStackSpeed('player',2);soundFx.setCapitalStackSpeed('opponent',2);}} aria-label="金貨の積み込みを2倍速にする"><span>{fast?'積み込み ×2':'タップで早送り'}</span></button>}
  </>;
}

export function TradeNegotiationBattle(props:BattleModalProps){
  const {targetProperty:target,companyName,totalFunds,ownedProperties,alliance,battleFrameRate,onBattleEnd,onClose,onTimeScaleChange}=props;
  const price=target.marketPrice;
  const budget=useMemo(()=>calculateEnemyBudget({targetProperty:target,industryInfluence:props.industryInfluence,
    regionalInfluence:props.regionalInfluence,isTutorial:!!props.isTutorial,isCityBoss:props.isCityBoss}),[target,props.industryInfluence,props.regionalInfluence,props.isTutorial,props.isCityBoss]);
  const [state,setState]=useState<TradeNegotiationState>({cash:Math.min(totalFunds,price),invested:0,support:0,rival:Math.round(budget*.2),rivalReserve:budget-Math.round(budget*.2),ownership:50,round:0,rally:0,guard:false});
  const [phase,setPhase]=useState<'briefing'|'choose'|'pour'|'result'>('briefing');
  const [panel,setPanel]=useState<'none'|'cash'|'sources'|'tactics'>('none');
  const [pour,setPour]=useState<Pour|null>(null);
  const [winner,setWinner]=useState<'player'|'opponent'|null>(null);
  const [requests,setRequests]=useState<Record<string,number>>({});
  const [used,setUsed]=useState<string[]>([]);
  const [message,setMessage]=useState('まずは自社資金を。人脈が増えれば、商いの幅も広がるでっす。');
  const [error,setError]=useState('');
  const busy=useRef(false),committed=useRef(false);
  const dialogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const rootOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    onTimeScaleChange?.(0);dialogRef.current?.focus();
    return()=>{document.body.style.overflow=overflow;document.documentElement.style.overflow=rootOverflow;onTimeScaleChange?.(1);if(previous?.isConnected)previous.focus();};
  },[onTimeScaleChange]);
  const amountFor=(property:typeof target)=>calculateNegotiationSupport(property,price,requests[property.id]??0,ownedProperties.length);
  const groups=props.activeSynergies.filter(group=>!group.battleOnly && group.requiredPropertyIds.length>0 &&
    group.requiredPropertyIds.every(id=>ownedProperties.some(p=>p.id===id)));
  const learnedTactics=props.equippedSkills.length?props.equippedSkills:props.availableSkills.slice(0,1);
  const groupMembers=(ids:string[])=>ownedProperties.filter(p=>ids.includes(p.id));
  const requestGroup=(id:string,name:string,ids:string[],multiplier:number)=>{
    if(busy.current||used.includes(id))return;
    const members=groupMembers(ids);
    offer({kind:'support',amount:Math.round(members.reduce((sum,p)=>sum+amountFor(p),0)*multiplier)},`${name}――交易網の力をまとめるでっす！`);
    setUsed(v=>[...v,id]);
    setRequests(current=>{const next={...current};members.forEach(p=>{next[p.id]=(next[p.id]??0)+1;});return next;});
  };
  const offer=(action:TradeOffer,label:string)=>{
    if(busy.current||phase!=='choose')return;
    busy.current=true;
    const resolution=resolveTradeOffer(state,action,price);
    setPanel('none');setMessage(label);setState(resolution.state);
    setPour({id:resolution.state.round,from:state,to:resolution.state,winner:resolution.winner,label});setPhase('pour');
  };
  const finishPour=()=>{
    if(!pour)return;
    if(pour.winner){setWinner(pour.winner);setPhase('result');}
    else {setPhase('choose');setMessage(pour.to.round>=15?`交渉期限まであと${18-pour.to.round}手。最後に優勢な側が契約を取るでっす。`:pour.to.ownership>=50?'こちらが優勢でっす。次の資金をどこから集めるでっす？':'競合が押してきたでっす。人脈と駆け引きの出番でっす。');}
    setPour(null);busy.current=false;
  };
  const support=(property:typeof target)=>{
    if(busy.current)return;
    offer({kind:'support',amount:amountFor(property)},`${property.name}から着金！`);
    setRequests(current=>({...current,[property.id]:(current[property.id]??0)+1}));
  };
  const reward=calculateBattleVictoryReward(price,winner==='player','normal');
  const fee=Math.round(price*.03);
  const cost=calculateDirectInvestmentSettlementCost({companyCapitalAtRisk:state.invested,winner:winner??'opponent',isHighEndRaid:false,isRecordOnlyBattle:false,isInitiatedAcquisition:true});
  const settle=()=>{
    if(!winner||committed.current)return;
    committed.current=true;
    const saved=onBattleEnd({winner,targetProperty:target,companyFundsInvested:state.invested,demandFundsInvested:state.support,
      brokerageFee:fee,settlementCost:cost,battleCashDelta:0,victoryReward:reward,
      celebrationGiftCost:0,celebrationGiftRate:0,rebelledProperties:[],
      survivingRiskUpdates:ownedProperties.map(p=>({id:p.id,loyaltyRisk:Math.min(100,p.loyaltyRisk+(requests[p.id]??0)*12)})),
      finishMethod:'NORMAL',finalOwnership:winner==='player'?100:0,overkill:0});
    if(!saved){committed.current=false;setError('保存できませんでした。もう一度確定してください。');}
  };
  const choose=phase==='choose';
  return <div className="trade-negotiation" role="dialog" aria-modal="true" aria-label={`${target.name}との商談`} tabIndex={-1} ref={dialogRef}
    onKeyDown={event=>{if(event.key==='Escape'&&panel!=='none'){event.preventDefault();setPanel('none');}if(event.key==='Tab'){
      const elements=Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
      const first=elements[0],last=elements.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}}>
    <header><span>{target.community}</span><h1>{target.name}</h1>{phase==='briefing'?<button onClick={onClose}>戻る</button>:choose?<button onClick={()=>{setWinner('opponent');setPhase('result');setPanel('none');}}>交渉を降りる</button>:null}</header>
    <section className="trade-table" aria-label="金貨と交渉の盤面">
      <NegotiationTable pour={pour??{id:state.round,from:state,to:state,winner:null,label:''}} running={!!pour}
        price={price} fps={battleFrameRate} done={finishPour} company={companyName} rival={target.ownerName}/>
      <img className="trade-table__tataru" src={FANKIT_ART.tataru.windUp} alt="タタル"/>
      <img className="trade-table__rival" src={getFankitJobArt(target.id)} alt="競合代表"/>
    </section>
    <div className="trade-negotiation__line" role="status">{phase==='result'?(winner==='player'?'交渉成立！ 新たな商いが、仲間になったでっす。':'今回は撤収でっす。出資金を持ち帰って立て直すでっす。'):message}</div>
    {phase==='briefing'?<section className="trade-negotiation__brief"><p>相場 {formatCurrency(price)}<span>開始手数料 {formatCurrency(fee)}</span></p><button className="trade-primary" onClick={()=>{setPhase('choose');}}>商談を始める</button></section>:
      phase==='result'?<section className="trade-negotiation__result"><h2>{winner==='player'?'交渉成立':'交渉終了'}</h2><p>今回の収支 {formatCurrency(reward-fee-cost)}</p>{error&&<p role="alert">{error}</p>}<button className="trade-primary" onClick={settle}>結果を確定して市場へ</button></section>:
      <nav className="trade-negotiation__commands" aria-label="資金と駆け引き">
        <button className="trade-primary" disabled={!choose} aria-expanded={panel==='cash'} onClick={()=>setPanel(panel==='cash'?'none':'cash')}>自社資金<span>{formatCurrency(state.cash)}</span></button>
        {ownedProperties.length>0||alliance.active?<button disabled={!choose} aria-expanded={panel==='sources'} onClick={()=>setPanel(panel==='sources'?'none':'sources')}>人脈を頼る<span>商会・交易・後援</span></button>:null}
        <button disabled={!choose} aria-expanded={panel==='tactics'} onClick={()=>setPanel(panel==='tactics'?'none':'tactics')}>かけひき<span>交渉の流れを変える</span></button>
      </nav>}
    {choose&&panel!=='none'&&<section className="trade-negotiation__choices" aria-label="今回の一手">
      <header><h2>{panel==='cash'?'いくら積むでっす？':panel==='sources'?'誰の力を借りるでっす？':'勝負どころでっす。'}</h2><button onClick={()=>setPanel('none')}>閉じる</button></header>
      {panel==='cash'?<>{[.1,.2,.35].map((ratio,index)=>{const amount=Math.round(price*ratio);return <button key={ratio} disabled={state.cash<amount} onClick={()=>offer({kind:'cash',amount},`${formatCurrency(amount)}、運び込むでっす！`)}><b>{['小口で探る','本腰を入れる','大口で押す'][index]}</b><span>{formatCurrency(amount)}</span></button>;})}{state.cash>0&&state.cash<price*.1&&<button onClick={()=>offer({kind:'cash',amount:state.cash},'残った資金を積むでっす！')}>残金を積む {formatCurrency(state.cash)}</button>}</>:
        panel==='sources'?<>{groups.map(group=><button key={group.id} disabled={used.includes(group.id)} onClick={()=>requestGroup(group.id,group.name,group.requiredPropertyIds,group.battleGroupMultiplier??1.25)}><b>{group.name}</b><span>交易網をまとめて要請（一度）</span></button>)}{ownedProperties.map(property=><button key={property.id} disabled={(requests[property.id]??0)>=3} onClick={()=>support(property)}><b>{property.name}</b><span>{(requests[property.id]??0)>=3?'今回は支援済み':`${formatCurrency(amountFor(property))} ・${requests[property.id]?'再要請':'初回支援'}`}</span></button>)}{alliance.active&&<button disabled={used.includes('alliance')} onClick={()=>{offer({kind:'support',amount:Math.round(price*.75)},`${alliance.allyName}の後援が到着！`);setUsed(v=>[...v,'alliance']);}}><b>{alliance.allyName}</b><span>後援を要請（一度）</span></button>}</>:
        <><button disabled={used.includes('rally')} onClick={()=>{offer({kind:'rally'},'タタルの商談術――こちらの信用を押し上げるでっす！');setUsed(v=>[...v,'rally']);}}><b>タタルの商談術</b><span>信用を積み、以後の交渉を強める（一度）</span></button>
          {learnedTactics.map(skill=>{const defense=['FEINT','COVER','BARRIER','LIVING_DEAD'].includes(skill.effectType);return <button key={skill.id} disabled={used.includes(skill.id)} onClick={()=>{offer({kind:defense?'guard':'rally'},`${skill.name}――暁の仲間が交渉を支える！`);setUsed(v=>[...v,skill.id]);}}><b>{skill.name}</b><span>{defense?'今回の競合の押し込みを和らげる（一度）':'信用を積み、以後の交渉を強める（一度）'}</span></button>;})}
          <button onClick={()=>offer({kind:'hold'},'積んだ資金で交渉を進めるでっす。')}><b>出方を見る</b><span>追加出資せず、競りを進める</span></button></>}
    </section>}
  </div>;
}
