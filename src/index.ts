import { Scheduler } from "./scheduler";
import { TWorkerMaker } from "./types";

export { REQ_EARLY_TERMINATION_TOKEN } from "./constants";
export { TWorkerMaker } from "./types";

type SchedulerInstance<I, O> = InstanceType<typeof Scheduler<I, O>>;
type ISwarmed<I, O> = SchedulerInstance<I, O>["doRequest"] & {
  terminate: SchedulerInstance<I, O>["kill"];
};
type ISwarmedWithResourceSaving<I, O> = ISwarmed<I, O> & {
  disableRecycling: () => void;
  enableRecycling: () => void;
};

export function swarm<I, O>(
  workerMaker: TWorkerMaker,
  args: { maxCount?: number; recyclable?: true }
): ISwarmedWithResourceSaving<I, O>;
export function swarm<I, O>(
  workerMaker: TWorkerMaker,
  args: { maxCount?: number; recyclable: false }
): ISwarmed<I, O>;
export function swarm<I = any, O = any>(
  workerMaker: TWorkerMaker,
  {
    maxCount = 3,
    recyclable = true,
  }: { maxCount?: number; recyclable?: boolean } = {}
) {
  const scheduler = new Scheduler<I, O>(workerMaker, maxCount, recyclable);

  if (recyclable) {
    const swarmed: ISwarmedWithResourceSaving<I, O> = (req) =>
      scheduler.doRequest(req);
    swarmed["disableRecycling"] = () => scheduler.pauseResourceSaving();
    swarmed["enableRecycling"] = () => scheduler.restartResourceSaving();
    swarmed["terminate"] = () => scheduler.kill();

    return swarmed;
  } else {
    const swarmed: ISwarmed<I, O> = (req) => scheduler.doRequest(req);
    swarmed["terminate"] = () => scheduler.kill();

    return swarmed;
  }
}
