import { Scheduler } from './scheduler';
import { TWorkerMaker } from './types';

export { REQ_EARLY_TERMINATION_TOKEN } from './constants';

export function swarm<R1 = any, R2 = any>(workerMaker: TWorkerMaker, maxCount: number) {
  const scheduler = new Scheduler<R1, R2>(workerMaker, maxCount);

  return scheduler.doRequest;
}
