import { nanoid } from "nanoid";
import { REQ_EARLY_TERMINATION_TOKEN } from "./constants";
import { Handler } from "./handler";
import { DischargeChecker } from "./discharge-checker";
import {
  IQueueRequest,
  TInterruptableReq,
  TWorkerMaker,
  TWorkerEventHandler,
} from "./types";

export class Scheduler<I, O> {
  private busyHandlers = new Set<string>();
  private idleHandlers: string[] = [];
  private handlers = new Map<string, Handler<I, O>>();
  private spawned = 0;
  private requestQueue: IQueueRequest<I, O>[] = [];
  private ownHandlerIds = new Set<string>();
  private dischargeChecker: DischargeChecker;
  public workerEvents = new EventTarget();

  public get idleCount() {
    return this.idleHandlers.length;
  }

  constructor(
    private workerMaker: TWorkerMaker,
    private maxTotal = 3,
    private minAlive = 0,
    private immediate = false,
    recycleIdleWorkers = true
  ) {
    this.init();

    if (recycleIdleWorkers) {
      this.dischargeChecker = new DischargeChecker(this);

      this.dischargeChecker.start();
    }

    if (immediate && (minAlive >= 0 || !recycleIdleWorkers)) {
      let ct = Math.min(minAlive || Infinity, maxTotal);

      while (ct--) {
        this.getHandler();
      }
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

  public doRequest = (
    req: I,
    transferred?: IQueueRequest<I, O>["transferred"]
  ) => {
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
      const h = new Handler(this, this.workerMaker(), handlerId);
      this.handlers.set(handlerId, h);
      this.ownHandlerIds.add(handlerId);
      this.spawned++;
    }

    return this.handlers.get(handlerId);
  }

  private arrangeRequest(
    req: IQueueRequest<I, O>["details"],
    transferred: IQueueRequest<I, O>["transferred"]
  ) {
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

  public handleCrashedHandler(handler: Handler<I, O>) {
    if (this.ownHandlerIds.has(handler.id)) {
      this.handlers.delete(handler.id);
      this.ownHandlerIds.delete(handler.id);
      this.busyHandlers.delete(handler.id);
      this.spawned--;

      if (!this.busyHandlers.size && this.requestQueue.length) {
        // when no active handlers for already queued requests,
        // make a new handler right away.
        this.handleQueuedRequest(this.getHandler());
      }
    }
  }

  public kill() {
    this.handlers.forEach((h) => {
      h.destroy();
    });

    this.requestQueue.forEach((r) => {
      r.report(REQ_EARLY_TERMINATION_TOKEN);
    });

    this.init();
    this.pauseResourceSaving();
  }

  public discharge(numToDischarge: number) {
    while (
      this.idleCount > this.minAlive &&
      this.idleCount > this.requestQueue.length &&
      numToDischarge--
    ) {
      const handlerIdToDischarge = this.idleHandlers.pop();
      const handlerToDischarge = this.handlers.get(handlerIdToDischarge)!;

      if (handlerToDischarge.retire()) {
        this.handlers.delete(handlerIdToDischarge);
        this.ownHandlerIds.delete(handlerIdToDischarge);
        this.spawned--;
      }
    }
  }

  public subWorkerEvent: TWorkerEventHandler = (evtType, handler) => {
    const h = (evt: CustomEvent) => {
      handler(evt.detail);
    };

    this.workerEvents.addEventListener(evtType, h);

    return () => {
      this.workerEvents.removeEventListener(evtType, h);
    };
  };

  public pauseResourceSaving() {
    this.dischargeChecker?.stop();
  }

  public restartResourceSaving() {
    this.dischargeChecker?.start();
  }
}
