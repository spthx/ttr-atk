import {lazy,Suspense} from 'react';
import type {BattleModalProps} from './BattleModal';
import {TradeNegotiationBattle} from './TradeNegotiationBattle';

const AdvancedBattle=lazy(()=>import('./BattleModal').then(module=>({default:module.BattleModal})));
export const BattleModal=(props:BattleModalProps)=>
  props.isSavage||props.isUltimate||props.isCruel||props.isKarma||props.isPhantom||props.isTraining
    ? <Suspense fallback={<div role="status">商戦を準備しています…</div>}><AdvancedBattle {...props}/></Suspense>
    : <TradeNegotiationBattle {...props}/>;
