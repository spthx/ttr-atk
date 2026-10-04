export type CapitalPresentationSpeed = 1 | 2;

/** Keeps a scheduled beat in virtual presentation time when speed changes. */
export const createCapitalPresentationScheduler = () => {
  let speed: CapitalPresentationSpeed = 1;
  let timer: number | null = null;
  let task: {
    callback: () => void;
    remainingMs: number;
    startedAt: number;
    speed: CapitalPresentationSpeed;
  } | null = null;

  const accountElapsed = (now: number) => {
    if (!task) return;
    task.remainingMs = Math.max(0,task.remainingMs-(now-task.startedAt)*task.speed);
    task.startedAt=now;
  };
  const arm = () => {
    if (!task) return;
    timer=window.setTimeout(()=>{
      timer=null;
      if (!task) return;
      accountElapsed(performance.now());
      if (task.remainingMs <= 0.5) {
        const callback=task.callback;
        task=null;
        callback();
      } else arm();
    },Math.max(1,task.remainingMs/task.speed));
  };

  return {
    get speed() { return speed; },
    get timerId() { return timer; },
    schedule(callback: () => void, durationMs: number) {
      if (timer !== null) window.clearTimeout(timer);
      task={callback,remainingMs:Math.max(0,durationMs),startedAt:performance.now(),speed};
      arm();
    },
    setSpeed(next: CapitalPresentationSpeed) {
      if (speed === next) return;
      const now=performance.now();
      accountElapsed(now);
      speed=next;
      if (task) {
        task.speed=next;
        if (timer !== null) window.clearTimeout(timer);
        timer=null;
        arm();
      }
    },
    clear() {
      if (timer !== null) window.clearTimeout(timer);
      timer=null;
      task=null;
      speed=1;
    },
  };
};
