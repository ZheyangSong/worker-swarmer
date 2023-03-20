import { REQ_EARLY_TERMINATION_TOKEN } from "./constants";

export type TInterruptableReq<T> = T | typeof REQ_EARLY_TERMINATION_TOKEN;

export interface IQueueRequest<I, O> {
  details: I;
  transferred?: Transferable[];
  report: (data: TInterruptableReq<O>) => void;
}

export type TWorkerMaker = () => Worker;

export interface IConfigOpts {
  maxCount?: number;
  minCount?: number;
  immediate?: boolean;
  recyclable?: boolean;
}

export type TWorkerEventHandler = <K extends keyof WorkerEventMap>(
  evtType: K,
  handler: (evt: WorkerEventMap[K]) => any
) => () => void;
