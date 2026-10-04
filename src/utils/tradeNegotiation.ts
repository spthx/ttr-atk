/** Normal trade is a sequence of offers and counteroffers, with no idle ATB. */
import type {Property} from '../types';
import {calculateSubsidiarySupportAmount} from './gameBalance';

/** Established contacts underwrite larger contracts as the trade network grows. */
export const calculateNegotiationSupport=(property:Property,price:number,uses:number,contacts:number)=>
  Math.round(Math.max(calculateSubsidiarySupportAmount(property,uses),
    price*Math.min(.12,contacts*.006)*Math.pow(.72,uses)));

export interface TradeNegotiationState {
  cash: number;
  invested: number;
  support: number;
  rival: number;
  rivalReserve: number;
  ownership: number;
  round: number;
  rally: number;
  guard: boolean;
}
export type TradeOffer = {kind:'cash'|'support';amount:number} | {kind:'rally'|'guard'|'hold'};
export const resolveTradeOffer=(state:TradeNegotiationState,offer:TradeOffer,price:number)=>{
  const next={...state,round:state.round+1};
  if(offer.kind==='cash'){
    if(!Number.isFinite(offer.amount)||offer.amount<=0||offer.amount>state.cash)throw new Error('Invalid company offer');
    next.cash-=offer.amount;next.invested+=offer.amount;
  }else if(offer.kind==='support'){
    if(!Number.isFinite(offer.amount)||offer.amount<=0)throw new Error('Invalid support offer');
    next.support+=offer.amount;
  }else if(offer.kind==='rally') next.rally+=Math.max(1,price)*.18;
  else if(offer.kind==='guard') next.guard=true;
  const counter=Math.min(next.rivalReserve,Math.max(1,Math.round(price*(offer.kind==='cash'&&offer.amount>=price*.3?.18:.1))));
  next.rival+=counter;next.rivalReserve-=counter;
  const effectiveRival=next.rival*(next.guard?.65:1);
  const difference=(next.invested+next.support+next.rally-effectiveRival)/Math.max(1,price);
  const push=Math.max(-24,Math.min(24,difference*28));
  // A tied offer still moves slightly towards the larger actual treasury.
  next.ownership=Math.max(0,Math.min(100,next.ownership+push));
  next.guard=false;
  const winner=next.ownership>=100?'player':next.ownership<=0?'opponent':
    next.round>=18?(next.ownership>50?'player':'opponent'):null;
  return {state:next,counter,winner} as const;
};
