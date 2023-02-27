import { Scheduler } from "./scheduler";
import { TWorkerMaker, IConfigOpts, TWorkerEventHandler } from "./types";

export { REQ_EARLY_TERMINATION_TOKEN } from "./constants";

export { TWorkerMaker, IConfigOpts, TWorkerEventHandler };

type SchedulerInstance<I, O> = InstanceType<typeof Scheduler<I, O>>;
type ISwarmed<I, O> = SchedulerInstance<I, O>["doRequest"] & {
  terminate: SchedulerInstance<I, O>["kill"];
  onWorkerEvent: TWorkerEventHandler
};
type ISwarmedWithResourceSaving<I, O> = ISwarmed<I, O> & {
  disableRecycling: () => void;
  enableRecycling: () => void;
};

export function swarm<I, O>(
  workerMaker: TWorkerMaker,
  args?: Omit<IConfigOpts, 'recyclable'> & { recyclable?: true }
): ISwarmedWithResourceSaving<I, O>;
export function swarm<I, O>(
  workerMaker: TWorkerMaker,
  args?: Omit<IConfigOpts, 'recyclable'> & { recyclable: false }
): ISwarmed<I, O>;
export function swarm<I = any, O = any>(
  workerMaker: TWorkerMaker,
  {
    maxCount = 3,
    recyclable = true,
    minCount = 0,
    immediate = false,
  }: IConfigOpts = {}
) {
  const scheduler = new Scheduler<I, O>(workerMaker, maxCount, minCount, immediate, recyclable);

  if (recyclable) {
    const swarmed: ISwarmedWithResourceSaving<I, O> = (req) =>
      scheduler.doRequest(req);
    swarmed["onWorkerEvent"] = scheduler.subWorkerEvent;
    swarmed["disableRecycling"] = () => scheduler.pauseResourceSaving();
    swarmed["enableRecycling"] = () => scheduler.restartResourceSaving();
    swarmed["terminate"] = () => scheduler.kill();

    return swarmed;
  } else {
    const swarmed: ISwarmed<I, O> = (req) => scheduler.doRequest(req);
    swarmed["onWorkerEvent"] = scheduler.subWorkerEvent;
    swarmed["terminate"] = () => scheduler.kill();

    return swarmed;
  }
}
