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
