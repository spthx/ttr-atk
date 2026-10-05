import {useCallback,useEffect,useRef,useState} from 'react';
import {Coins,MapPinned,BookOpen,Swords,Volume2,VolumeX,ArrowUpRight,ArrowLeft,Check,Lock,HandCoins,Users,Sparkles,X,Settings} from 'lucide-react';
import {contracts,businesses,cities,regions,raids,finals,skills,patrons,amount,type Encounter} from './content';
import {FANKIT_ART,getFankitCommerceIcon,getFankitJobArt} from './assets';
import {accrue,loadCompany,storeCompany,chapter,accessible,ownedBusinesses,income,availableSkills,availableSynergies,autoUnlocked,activeGroups,unlockedRaid,settleCompany,type Company} from './campaign';
import {TradeEngine,type Action} from './engine';
import {CoinStage} from './CoinStage';
import {renewalAudio} from './audio';
import {enemyProfile} from './enemy';
import './renewal.css';

function Preparation({company,commit}:{company:Company;commit:(c:Company)=>boolean}){
  const choices=availableSkills(company);
  return <div className="r-preparation">{(['opening','critical'] as const).filter(slot=>autoUnlocked(company,slot)).map(slot=><label key={slot}>{slot==='opening'?'開幕に使う技':'瀕死で使う技'}<select value={company[slot]??''} onChange={e=>{const id=e.target.value||null;commit({...company,[slot]:id,equipped:company.equipped.filter(s=>s!==id),...(slot==='opening'&&id===company.critical?{critical:null}:slot==='critical'&&id===company.opening?{opening:null}:{}),savedAt:Date.now()});}}><option value="">装備しない</option>{choices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}{availableSynergies(company).length>0&&<label>戦闘中に使う事業連携<select value={company.synergy??availableSynergies(company).at(-1)?.id} onChange={e=>commit({...company,synergy:e.target.value,savedAt:Date.now()})}>{availableSynergies(company).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}</div>;
}

function Battle({engine,onFinish}:{engine:TradeEngine;onFinish:(allocation:0|.5|1)=>boolean}){
  const [,refresh]=useState(0);const [panel,setPanel]=useState<'cash'|'sources'|'skills'|null>(null);const [fast,setFast]=useState(false);const speed=useRef<1|2>(1);const [allocation,setAllocation]=useState<0|.5|1>(.5);const [saveError,setSaveError]=useState(false);
  const root=useRef<HTMLDivElement>(null);const view=engine.encounter;
  useEffect(()=>{
    let raf=0,last=performance.now(),paint=last;root.current?.focus();
    const visibility=()=>{last=performance.now();renewalAudio.stop();renewalAudio.rate(speed.current);wasMotion=false;};document.addEventListener('visibilitychange',visibility);
    let wasMotion=false,wasWinner=false;
    const tick=(now:number)=>{const delta=(now-last)/1000;last=now;if(!document.hidden){
      engine.step(Math.min(2,delta),speed.current);
      if(engine.motion&&!wasMotion)void renewalAudio.coins();
      if(!engine.motion&&wasMotion){renewalAudio.stop();speed.current=1;setFast(false);}wasMotion=engine.motion;
      if(engine.winner&&!engine.motion&&!wasWinner){wasWinner=true;renewalAudio.cue(engine.winner==='player');}
      if(now-paint>=80){refresh(n=>n+1);paint=now;}
    }raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(raf);renewalAudio.stop();document.removeEventListener('visibilitychange',visibility);};
  },[engine]);
  const act=(action:Action)=>{renewalAudio.unlock();if(engine.act(action)){setPanel(null);refresh(n=>n+1);}};
  const won=engine.winner==='player';const settled=!!engine.winner&&!engine.motion;
  const sources=ownedBusinesses(engine.company);const equipped=skills.filter(s=>engine.company.equipped.includes(s.id)&&![engine.company.opening,engine.company.critical].includes(s.id));
  const synergy=availableSynergies(engine.company).find(g=>g.id===engine.company.synergy)??availableSynergies(engine.company).at(-1);
  return <div className="r-battle" role="dialog" aria-modal="true" aria-label={`${view.name}との商戦`} ref={root} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape'){setPanel(null);e.preventDefault();}if(e.key==='Tab'){const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    <header className="r-battle-title"><div><span>{view.mode==='normal'?view.city:`${view.mode==='savage'?`零式 ${view.series}編 ${view.layer}層`:view.mode==='ultimate'?'絶商戦':view.mode==='cruel'?'酷商戦':view.mode==='karma'?'業商戦':'幻・商戦'}`}</span><h1>{view.name}</h1></div>{!settled&&<button className="r-quiet" onClick={()=>engine.surrender()}>撤退</button>}</header>
    <section className="r-arena">
      <CoinStage engine={engine}/>
      <div className="r-money"><span>{engine.company.name}<b>{amount(engine.player)}<small> ギル</small></b></span><span>{view.opponent}<b>{amount(engine.enemy)}<small> ギル</small></b></span></div>
      <div className="r-front" role="progressbar" aria-label="自社の所有率" aria-valuenow={Math.round(engine.ownership)} aria-valuemin={0} aria-valuemax={100}><i style={{transform:`scaleX(${engine.ownership/100})`}}/><b style={{left:`${engine.ownership}%`}}/></div>
      <img className="r-actor r-actor--ally" src={FANKIT_ART.tataru.windUp} alt="タタル"/><img className="r-actor r-actor--enemy" src={getFankitJobArt(view.id)} alt="競合代表"/>
      {engine.warning&&<div className="r-warning" role="alert"><b>{engine.warning.name} <span>{engine.warning.remaining.toFixed(1)}秒</span></b><p>{engine.warning.hint}</p></div>}
      {engine.remaining!==null&&<span className="r-deadline">査定まで {Math.ceil(engine.remaining)}秒</span>}
      {engine.recovery>0&&<span className="r-deadline">蘇生 {engine.recovery.toFixed(1)}秒／所有30%へ</span>}
      {engine.marketWind.phase!=='calm'&&engine.marketWind.phase!=='cooldown'&&!engine.warning&&<span className="r-wind">{engine.marketWind.label}{engine.marketWind.phase==='forecast'?'の予兆':''} {Math.ceil(engine.marketWind.remaining)}秒</span>}
      {engine.motion&&!settled&&<button className="r-fast" onClick={()=>{speed.current=2;setFast(true);renewalAudio.rate(2);}} aria-label="積み上げを2倍速にする"><span>{fast?'積載 ×2':'タップで積載 ×2'}</span></button>}
    </section>
    <p className="r-battle-line" role="status">{settled?(won?'商談成立！ 新しい商いがつながったでっす。':engine.message):engine.message}</p>
    {settled?<section className="r-settlement"><div><h2>{won?'交渉成立':'交渉終了'}</h2><p>{engine.record?'通常資金と人脈はそのまま。戦績だけを記録します。':won?'利益の配分を決めて、次の商いへ。':'手数料などを精算して、再挑戦できます。'}</p></div>
      {won&&!engine.record&&sources.length>0&&<div className="r-allocation" aria-label="利益の配分">{([0,.5,1] as const).map((v,i)=><button key={v} aria-pressed={allocation===v} onClick={()=>setAllocation(v)}>{['商会に残す','半分を分ける','全額を分ける'][i]}</button>)}</div>}
      {saveError&&<p role="alert">保存できませんでした。データを確定せずに保持しています。</p>}
      <button className="r-primary" onClick={()=>{if(!onFinish(allocation))setSaveError(true);}}>商会へ戻る <ArrowUpRight size={18}/></button>
    </section>:<>
      <nav className="r-commands" aria-label="商戦の行動">
        <button className="r-primary" disabled={!engine.ready} aria-expanded={panel==='cash'} onClick={()=>setPanel(panel==='cash'?null:'cash')}><HandCoins/><span>自社資金<small>手元 {amount(engine.cash)}</small></span></button>
        {sources.length>0&&<button disabled={!engine.ready} aria-expanded={panel==='sources'} onClick={()=>setPanel(panel==='sources'?null:'sources')}><Users/><span>資金を集める<small>人脈 {engine.supportLimit-engine.supportUses}回</small></span></button>}
        <button disabled={!engine.ready} aria-expanded={panel==='skills'} onClick={()=>setPanel(panel==='skills'?null:'skills')}><Sparkles/><span>かけひき<small>{engine.cooldown>0?'準備中':'技・連携・限界突破'}</small></span></button>
      </nav>
      {panel&&<section className="r-action-sheet" aria-label="行動を選ぶ"><header><h2>{panel==='cash'?'いくら積むでっす？':panel==='sources'?'仲間の力を借りるでっす。':'勝負どころを見極めるでっす。'}</h2><button className="r-icon" onClick={()=>setPanel(null)} aria-label="選択を閉じる"><X/></button></header>
        {panel==='cash'?<div className="r-offers">{[.02,.05,.1,.2,.35].map((ratio,i)=><button key={ratio} disabled={engine.cash<Math.round(view.price*ratio)||!engine.ready} onClick={()=>act({kind:'cash',ratio})}><b>{['小口','控えめ','標準','大口','全力'][i]}</b><span>{amount(view.price*ratio)} ギル</span></button>)}</div>:
        panel==='sources'?<div className="r-source-list">{sources.length>6?<button disabled={!engine.ready||engine.supportUses>=engine.supportLimit} onClick={()=>act({kind:'network'})}><b>有力な人脈へ一斉要請</b><span>{amount(engine.supportAmount(engine.strongest()))} ギル</span></button>:sources.map(p=><button key={p.id} disabled={!engine.ready||engine.supportUses>=engine.supportLimit} onClick={()=>act({kind:'network',id:p.id})}><img src={getFankitCommerceIcon(p.name)} alt=""/><b>{p.name}</b><span>{amount(engine.supportAmount(p.id))} ギル</span></button>)}
          {activeGroups(engine.company).map(g=><button key={g.id} disabled={!engine.ready||engine.usedGroups.has(g.id)} onClick={()=>act({kind:'group',id:g.id})}><b>{g.name}</b><span>交易網をまとめる</span></button>)}
          {engine.company.patron&&<button disabled={!engine.ready||engine.allianceUsed} onClick={()=>act({kind:'alliance'})}><b>{patrons.find(p=>p.allyId===engine.company.patron)?.allyName}</b><span>後援 {amount(view.price*.75)} ギル／一度</span></button>}
        </div>:<div className="r-source-list">{equipped.map(s=><button key={s.id} disabled={!engine.ready||engine.usedSkills.has(s.id)} onClick={()=>act({kind:'skill',id:s.id})}><b>{s.name}</b><span>{s.effectType==='FEINT'?'10秒、敵の押し込みを軽減':s.effectType==='COVER'?'有限の強い防御':s.effectType==='BARRIER'?'障壁を張り、割れたら反撃':s.effectType==='CAPITAL_BOOST'?'資金をぶんどり即投入':s.effectType==='LIVING_DEAD'?'致死に耐えて回復を狙う':'行動の準備を加速'}</span></button>)}{synergy&&<button disabled={!engine.ready||engine.usedGroups.has(synergy.id)} onClick={()=>act({kind:'group',id:synergy.id})}><b>{synergy.name}</b><span>事業連携の力で攻勢を強める</span></button>}{engine.lbTier>0&&<button disabled={!engine.ready||engine.lb<100||view.mode==='ultimate'&&engine.lbUses>=1} onClick={()=>act({kind:'limit'})}><b>LIMIT BREAK {Math.floor(engine.lb/100)}</b><span>{Math.floor(engine.lb)} / {engine.lbTier*100}</span></button>}</div>}
      </section>}
    </>}
  </div>;
}

export default function RenewalApp({initialCompany,initialEncounter,isolated=false}:{initialCompany?:Company;initialEncounter?:Encounter;isolated?:boolean}={}){
  const [company,setCompany]=useState(()=>initialCompany??accrue(loadCompany()));const companyRef=useRef(company);companyRef.current=company;
  const [screen,setScreen]=useState<'desk'|'routes'|'company'|'challenges'>('desk');const [city,setCity]=useState<string>(()=>cities[Math.min(chapter(company),9)]);
  const [companyTab,setCompanyTab]=useState<'business'|'skills'|'alliance'>('business');
  const [selected,setSelected]=useState<Encounter|null>(null);const [battle,setBattle]=useState<TradeEngine|null>(()=>initialEncounter&&initialCompany?new TradeEngine(initialEncounter,initialCompany):null);const [notice,setNotice]=useState('');const [settings,setSettings]=useState(false);
  const [showFuture,setShowFuture]=useState(false);const owned=ownedBusinesses(company);const progress=chapter(company);const revenue=income(company);
  const [phantomIndex,setPhantomIndex]=useState(()=>Math.floor(Math.random()*raids.length));
  useEffect(()=>{
    if(!selected&&!settings)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=document.querySelector<HTMLElement>('.r-invitation');
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setSettings(false);}if(e.key==='Tab'){
      const controls=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]')??[]);const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }};
    dialog?.addEventListener('keydown',keydown);return()=>{dialog?.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
  },[selected,settings]);
  const commit=useCallback((next:Company)=>{if(!isolated&&!storeCompany(next)){setNotice('保存領域へ書き込めません。画面を閉じず、空き容量を確認してください。');return false;}setCompany(next);return true;},[isolated]);
  useEffect(()=>{renewalAudio.enabled=company.sound;},[company.sound]);
  useEffect(()=>{if(battle)return;const timer=window.setInterval(()=>{const current=companyRef.current;const next=accrue(current);if(next.cash!==current.cash)commit(next);},3000);return()=>window.clearInterval(timer);},[battle,commit]);
  const next=contracts.filter(e=>!company.owned.includes(e.id)&&accessible(company,e.city)&&businesses.find(p=>p.id===e.id)?.countsTowardCityConquest!==false).sort((a,b)=>cities.indexOf(a.city as typeof cities[number])-cities.indexOf(b.city as typeof cities[number])||a.price-b.price)[0];
  const start=(e:Encounter)=>{if(!unlockedRaid(company,e)){setNotice('まずは、手前の交易路を開くでっす。');return;}if(!['karma','phantom'].includes(e.mode)&&company.cash<e.price*.03){setNotice('開始手数料が足りません。商会の収益を待つか、小さな商談から。');return;}renewalAudio.unlock();setSelected(null);setBattle(new TradeEngine(e,company));};
  const finish=(allocation:0|.5|1)=>{if(!battle?.winner)return false;const next=settleCompany(companyRef.current,battle.encounter,{id:battle.receipt,won:battle.winner==='player',direct:battle.direct,drain:battle.drain,risk:battle.risk,allocation,lbCarry:battle.lb});if(!commit(next))return false;if(battle.encounter.mode==='phantom')setPhantomIndex(Math.floor(Math.random()*raids.length));setBattle(null);setNotice(battle.winner==='player'?'新しい商いがつながりました。人脈と次の交易路を確認しましょう。':'準備を整えて、もう一度挑めます。');setScreen('desk');return true;};
  const choose=(e:Encounter)=>{
    const encounter=e.mode==='ultimate'?{...e,pattern:Math.floor(Math.random()*6)}:e;
    setSelected({...encounter,description:[encounter.description,enemyProfile(encounter).hint].filter(Boolean).join(' ')});setNotice('');
  };
  const selectSkill=(id:string)=>{const choices=availableSkills(company);if(!choices.some(s=>s.id===id))return;const equipped=company.equipped.includes(id)?company.equipped.filter(s=>s!==id):[...company.equipped,id];if(equipped.length>3){setNotice('手動の技は3つまで。入れ替える技を外してください。');return;}commit({...company,equipped,opening:company.opening===id?null:company.opening,critical:company.critical===id?null:company.critical,savedAt:Date.now()});};
  return <div className="renewal-root"><div inert={!!selected||settings||!!battle}>
    <header className="r-masthead"><button className="r-brand" onClick={()=>setScreen('desk')}><span>タタルの</span><b>大繁盛商店</b></button><div className="r-wallet"><Coins size={18}/><b>{amount(company.cash)}</b><span>ギル</span></div><button className="r-icon" aria-label="設定を開く" onClick={()=>setSettings(true)}><Settings size={20}/></button></header>
    <nav className="r-navigation" aria-label="商会の行き先">{([['desk','商会',BookOpen],['routes','交易路',MapPinned],['company','仲間と準備',Users],['challenges','挑戦状',Swords]] as const).map(([id,label,Icon])=><button key={id} aria-current={screen===id?'page':undefined} onClick={()=>{setScreen(id);setSelected(null);setNotice('');}}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <main className="r-main" inert={!!selected||settings||!!battle}>
      {notice&&<div className="r-notice" role="status"><span>{notice}</span><button className="r-icon" aria-label="通知を閉じる" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {screen==='desk'&&<>
        <section className="r-desk"><div className="r-desk-copy"><h1>ひとつの商談から、<br/>世界へ。</h1><p>{progress===0?'小さな契約を結び、次の商いの味方を増やす。今日もタタルと、商機を探しに。':`${owned.length}の事業と結んだ人脈。積み重ねた商いが、次の大きな取引を支えます。`}</p><button className="r-primary" onClick={()=>{if(next){setCity(next.city);setScreen('routes');choose(next);}else setScreen('challenges');}}>{next?'次の商談へ':'新たな挑戦へ'}<ArrowUpRight size={20}/></button><div className="r-income">商会の収益 <strong>＋{amount(revenue)}</strong> ギル／秒</div></div><div className="r-desk-art"><img src={FANKIT_ART.launchWallpaperMobile} alt="エオルゼアの交易世界"/><div className="r-tataru-note"><img src={FANKIT_ART.tataru.dressUp} alt="タタル"/><p>仲間の力を、<br/>次の商いにつなぐでっす！</p></div></div></section>
        <section className="r-ledger-strip"><div><span>今日の商機</span><h2>{next?.name??'世界の交易路が、ひとつにつながりました。'}</h2><p>{next?.city??'零式・絶の商戦へ挑戦できます。'}</p></div><div className="r-journey"><span>交易路</span><b>{progress}<small> / {cities.length}</small></b><div>{cities.map((name,i)=><i key={name} title={name} data-open={i<progress}/>)}</div></div></section>
      </>}
      {screen==='routes'&&<section className="r-page"><header><div><h1>交易路をひらく</h1><p>契約を結んだ事業が、次の商戦の資金源になります。</p></div></header><div className="r-travel"><aside className="r-city-list">{cities.filter((name,i)=>showFuture||i<=progress).map((name,i)=><button key={name} disabled={!accessible(company,name)} aria-pressed={city===name} onClick={()=>{setCity(name);setSelected(null);}}><span>{name}</span>{i<progress?<Check size={16}/>:accessible(company,name)?<ArrowUpRight size={16}/>:<Lock size={16}/>}</button>)}{progress<9&&<button className="r-more" onClick={()=>setShowFuture(v=>!v)}>{showFuture?'未開通の都市を閉じる':'先の交易路を見る'}</button>}</aside><div className="r-contracts"><div className="r-city-heading"><h2>{city}</h2><span>{regions.find(r=>r.id===city)?.marketCharacter}</span></div>{contracts.filter(e=>e.city===city).map(e=><button key={e.id} className="r-contract" disabled={company.owned.includes(e.id)} onClick={()=>choose(e)}><img src={getFankitCommerceIcon(e.name)} alt=""/><span><b>{e.name}</b><small>{company.owned.includes(e.id)?'契約を締結済み':`相場 ${amount(e.price)} ギル`}</small></span>{company.owned.includes(e.id)?<Check/>:<ArrowUpRight/>}</button>)}</div></div></section>}
      {screen==='company'&&<section className="r-page"><header><div><h1>仲間と、次の一手。</h1><p>育てた事業、人脈、技。商会の力を整えましょう。</p></div></header><div className="r-tabs">{([['business','事業と人脈'],['skills','持ち込む技'],['alliance','外部の後援']] as const).map(([id,label])=><button key={id} aria-pressed={companyTab===id} onClick={()=>setCompanyTab(id)}>{label}</button>)}</div>
        {companyTab==='skills'&&<Preparation company={company} commit={commit}/>}
        {companyTab==='business'?<div className="r-roster">{owned.length===0?<p className="r-empty">最初の契約を結ぶと、ここに仲間の商いが並びます。<button className="r-primary" onClick={()=>setScreen('routes')}>商談を探す</button></p>:owned.map(p=><article key={p.id}><img src={getFankitCommerceIcon(p.name)} alt=""/><div><h2>{p.name}</h2><p>{p.community}・収益 ＋{amount(p.annualRevenue*2)}／秒</p>{(company.risk[p.id]??0)>0&&<small>独立危険度 {Math.round(company.risk[p.id])}%</small>}</div>{(company.risk[p.id]??0)>0&&<button disabled={company.cash<p.marketPrice*.02} onClick={()=>commit({...company,cash:company.cash-Math.round(p.marketPrice*.02),risk:{...company.risk,[p.id]:Math.max(0,company.risk[p.id]-30)},savedAt:Date.now()})}>関係を整える<small>{amount(p.marketPrice*.02)} ギル</small></button>}</article>)}</div>:
        companyTab==='skills'?<div className="r-roster">{skills.map(s=>{const unlocked=availableSkills(company).some(v=>v.id===s.id);return <article key={s.id}><div><h2>{s.name}</h2><p>{unlocked?s.description:s.unlockRequirements}</p></div><button disabled={!unlocked} aria-pressed={company.equipped.includes(s.id)} onClick={()=>selectSkill(s.id)}>{company.equipped.includes(s.id)?'装備中':unlocked?'装備する':'未修得'}</button></article>;})}</div>:<div className="r-roster">{patrons.map(p=><article key={p.allyId}><div><h2>{p.allyName}</h2><p>{p.summary}</p></div><button disabled={progress<2} aria-pressed={company.patron===p.allyId} onClick={()=>commit({...company,patron:p.allyId,savedAt:Date.now()})}>{company.patron===p.allyId?'協力中':progress<2?'2都市の人脈開通で解放':'協力を結ぶ'}</button></article>)}</div>}
      </section>}
      {screen==='challenges'&&<section className="r-page"><header><div><h1>さらなる大商いへ。</h1><p>{progress<10?'まずは十の都市の交易路をつなぎましょう。':'育てた商会と戦術で、高難度の交易に挑む。'}</p></div><img src={FANKIT_ART.darkKnight} alt=""/></header><div className="r-challenges">{[...raids,...finals].map(e=><button key={e.id} disabled={!unlockedRaid(company,e)} onClick={()=>choose(e)}><span>{e.mode==='savage'?`零式 第${e.series}編・${e.layer}層`:e.mode==='ultimate'?'絶':e.mode==='cruel'?'酷':'業'}</span><b>{e.name}</b>{company.cleared.includes(e.id)?<Check/>:unlockedRaid(company,e)?<ArrowUpRight/>:<Lock/>}</button>)}<button disabled={!company.cleared.includes('cruel')} onClick={()=>{const raid=raids[phantomIndex];choose({...raid,id:'phantom',mode:'phantom',name:`幻・商戦：${raid.name}`});}}><span>幻・商戦</span><b>現在 {company.streak}連勝</b><ArrowUpRight/></button></div></section>}
    </main>
    <footer className="r-legal">非公式ファンゲーム · © SQUARE ENIX <a href="https://jp.finalfantasyxiv.com/lodestone/special/fankit/" target="_blank" rel="noreferrer">FFXIVファンキット</a></footer></div>
    {selected&&<div className="r-overlay" onClick={()=>setSelected(null)}><section className="r-invitation" role="dialog" aria-modal="true" aria-label="商談の招待状" onClick={e=>e.stopPropagation()}><button className="r-icon r-close" onClick={()=>setSelected(null)} aria-label="招待状を閉じる"><X/></button><img src={getFankitJobArt(selected.id)} alt="商談相手"/><span>{selected.city}</span><h2>{selected.name}</h2><p>{selected.description}</p><dl><div><dt>相場</dt><dd>{amount(selected.price)} ギル</dd></div><div><dt>開始手数料</dt><dd>{amount(['phantom','karma'].includes(selected.mode)?0:selected.price*.03)} ギル</dd></div></dl>{selected.mode!=='normal'&&<p className="r-rule-hint">{selected.mode==='ultimate'?'査定108秒・人脈8回・LB1回。強制清算への防御と反撃を準備。':selected.mode==='cruel'?'宣告後に立て直し、15秒で所有75%＋直接出資10%。':selected.mode==='karma'?'55・70・85・95%で一手を模倣。6秒以内に別系統で対抗。':selected.layer===3?'資本反転は次の直接出資を30%反射。':selected.layer===4?'強制清算へ防御を準備し、反撃の資源を残す。':'敵の予告を読み、防御と出資の順序を組み立てる。'}</p>}<button className="r-primary" onClick={()=>start(selected)}>商談に入る<ArrowUpRight/></button></section></div>}
    {settings&&<div className="r-overlay"><section className="r-invitation" role="dialog" aria-modal="true" aria-label="設定"><button className="r-icon r-close" aria-label="設定を閉じる" onClick={()=>setSettings(false)}><X/></button><h2>商会の設定</h2><label>商会名<input maxLength={24} value={company.name} onChange={e=>commit({...company,name:e.target.value,savedAt:Date.now()})}/></label><button onClick={()=>{renewalAudio.enabled=!company.sound;if(company.sound)renewalAudio.stop();else renewalAudio.unlock();commit({...company,sound:!company.sound,savedAt:Date.now()});}}>{company.sound?<Volume2/>:<VolumeX/>}効果音 {company.sound?'オン':'オフ'}</button><p>新しい商会として自動保存します。</p></section></div>}
    {battle&&<Battle key={battle.receipt} engine={battle} onFinish={finish}/>}
  </div>;
}
