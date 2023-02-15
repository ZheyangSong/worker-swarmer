import { nanoid } from "nanoid";
import { REQ_EARLY_TERMINATION_TOKEN } from "./constants";
import { Handler } from "./handler";
import { DischargeChecker } from "./discharge-checker";
import { IQueueRequest, TInterruptableReq, TWorkerMaker } from "./types";

export class Scheduler<I, O> {
  private busyHandlers = new Set<string>();
  private idleHandlers: string[] = [];
  private handlers = new Map<string, Handler<I, O>>();
  private spawned = 0;
  private requestQueue: IQueueRequest<I, O>[] = [];
  private ownHandlerIds = new Set<string>();
  private dischargeChecker: DischargeChecker;

  public get idleCount() {
    return this.idleHandlers.length;
  }

  constructor(
    private workerMaker: TWorkerMaker,
    private maxTotal = 3,
    recycleIdleWorkers = true
  ) {
    this.init();

    if (recycleIdleWorkers) {
      this.dischargeChecker = new DischargeChecker(this);

      this.dischargeChecker.start();
    }
  }

  private init() {
    this.busyHandlers = new Set<string>();
    this.idleHandlers = [];
    this.handlers = new Map<string, Handler<I, O>>();
    this.spawned = 0;
    this.requestQueue = [];
    this.ownHandlerIds = new Set<string>();
  }

  public doRequest = (req: I, transferred?: IQueueRequest<I, O>["transferred"]) => {
    const handler = this.getHandler();
    let result: Promise<TInterruptableReq<O>>;
    const qReq: IQueueRequest<I, O>["details"] = { ...req };

    if (!handler) {
      result = this.arrangeRequest(qReq, transferred);
    } else {
      this.busyHandlers.add(handler.id);
      result = handler.handle(qReq, transferred);
    }

    return result;
  };

  private getHandler() {
    let handlerId = this.idleHandlers.pop();

    if (!handlerId && this.spawned < this.maxTotal) {
      handlerId = nanoid();
      this.handlers.set(
        handlerId,
        new Handler(this, this.workerMaker(), handlerId)
      );
      this.ownHandlerIds.add(handlerId);
      this.spawned++;
    }

    return this.handlers.get(handlerId);
  }

  private arrangeRequest(req: IQueueRequest<I, O>["details"], transferred: IQueueRequest<I, O>["transferred"]) {
    let report: IQueueRequest<I, O>["report"];

    const deferredRequestResult = new Promise<TInterruptableReq<O>>((res) => {
      report = res;
    });

    this.requestQueue.push({
      details: req,
      transferred,
      report,
    });

    return deferredRequestResult;
  }

  public handleQueuedRequest(handler: Handler<I, O>) {
    if (this.ownHandlerIds.has(handler.id)) {
      const nextReq = this.requestQueue.shift();

      if (nextReq) {
        handler.handleRequest(nextReq);
        this.busyHandlers.add(handler.id);

        return true;
      } else {
        this.busyHandlers.delete(handler.id);
        this.idleHandlers.push(handler.id);
      }
    }

    return false;
  }

  public kill() {
    this.handlers.forEach((h) => {
      h.destroy();
    });

    this.requestQueue.forEach((r) => {
      r.report(REQ_EARLY_TERMINATION_TOKEN);
    });

    this.init();
  }

  public discharge(numToDischarge: number) {
    while (this.idleCount > this.requestQueue.length && numToDischarge--) {
      const handlerIdToDischarge = this.idleHandlers.pop();
      const handlerToDischarge = this.handlers.get(handlerIdToDischarge)!;

      if (handlerToDischarge.retire()) {
        this.handlers.delete(handlerIdToDischarge);
        this.ownHandlerIds.delete(handlerIdToDischarge);
        this.spawned--;
      }
    }
  }

  public pauseResourceSaving() {
    this.dischargeChecker?.stop();
  }

  public restartResourceSaving() {
    this.dischargeChecker?.start();
  }
}
