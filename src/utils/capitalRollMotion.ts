import { resolveBattleCapitalSfcPacketSteppedProgress } from './battleCapitalCanvasLayout';

export const resolveCapitalRollProgress = (
  frame: {
    packetProgress: number;
    beatDurationMs: number;
    incomingLaneTimings?: readonly { columnIndex: number; startMs: number; durationMs: number }[];
  }, columnIndex: number
) => {
  const flight = frame.incomingLaneTimings?.find(item=>item.columnIndex===columnIndex);
  if (!flight) return frame.packetProgress;
  const elapsed=frame.packetProgress*frame.beatDurationMs-flight.startMs;
  if (elapsed >= flight.durationMs - 1e-7) return 1;
  if (elapsed <= 1e-7) return 0;
  return Math.min(1,Math.max(0,elapsed/flight.durationMs));
};

export const resolveCapitalRollStep = (progress: number, columnIndex: number, seed: number, authoredFlight: boolean) =>
  // Authored flight offsets already stagger the pairs. Keep those offsets
  // stable across beat boundaries instead of adding a second seed delay.
  resolveBattleCapitalSfcPacketSteppedProgress({
    rawProgress:progress,columnIndex:authoredFlight?0:columnIndex,packetSeed:authoredFlight?0:seed,
  });

/** Heavy authored rolls become a bounded succession of short cylinders.
 * This changes only presentation: the timeline still owns the exact ledger,
 * final height and 330ms flight. Early and reduced-motion rolls stay intact.
 */
export const resolveCapitalBurstPackets = (
  logicalLayers: number,
  progress: number,
  flightMs: number,
) => {
  if (logicalLayers < 12 || flightMs < 260) return null;
  const count=Math.min(4,Math.ceil(logicalLayers/8));
  const launchGapMs=65;
  const fallMs=flightMs-launchGapMs*(count-1);
  if (fallMs<90) return null;
  const elapsed=Math.max(0,Math.min(1,progress))*flightMs;
  let settledLayers=0;
  const airborne:Array<{layers:number;settledLayers:number;progress:number}>=[];
  for(let index=0;index<count;index++){
    const layers=Math.floor(logicalLayers/count)+(index<logicalLayers%count?1:0);
    const local=(elapsed-index*launchGapMs)/fallMs;
    if(local>=1) settledLayers+=layers;
    else if(local>0) airborne.push({layers,settledLayers:Math.floor(logicalLayers/count)*index+Math.min(index,logicalLayers%count),progress:local*local});
  }
  return {settledLayers,airborne};
};
