import { nanoid } from 'nanoid';
import { REQ_EARLY_TERMINATION_TOKEN } from './constants';
import { Handler } from './handler';
import { IQueueRequest, TInterruptableReq, TWorkerMaker } from './types';

export class Scheduler<I, O> {
  private busyHandlers = new Set<string>();
  private idleHandlers: string[] = [];
  private handlers = new Map<string, Handler<I, O>>();
  private spawned = 0;
  private requestQueue: IQueueRequest<I, O>[] = [];
  private ownHandlerIds = new Set<string>();

  constructor(private workerMaker: TWorkerMaker, private maxTotal = 3) {
    this.init();
  }

  private init() {
    this.busyHandlers = new Set<string>();
  this.idleHandlers = [];
  this.handlers = new Map<string, Handler<I, O>>();
  this.spawned = 0;
  this.requestQueue = [];
  this.ownHandlerIds = new Set<string>();
  }

  public doRequest = (req: I) => {
    const handler = this.getHandler();
    let result: Promise<TInterruptableReq<O>>;
    const qReq: IQueueRequest<I, O>['details'] = {...req};

    if (!handler) {
      result = this.arrangeRequest(qReq);
    } else {
      this.busyHandlers.add(handler.id);
      result = handler.handle(qReq);
    }

    return result;
  }

  private getHandler() {
    let handlerId = this.idleHandlers.pop();

    if (!handlerId && this.spawned < this.maxTotal) {
      handlerId = nanoid();
      this.handlers.set(handlerId, new Handler(this, this.workerMaker(), handlerId));
      this.ownHandlerIds.add(handlerId);
      this.spawned++;
    }

    return this.handlers.get(handlerId);
  }

  private arrangeRequest(req: IQueueRequest<I,O>['details']) {
    let report: IQueueRequest<I, O>['report'];

    const deferredRequestResult = new Promise<TInterruptableReq<O>>((res) => {
      report = res;
    });

    this.requestQueue.push({
      details: req,
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
      } else {
        this.busyHandlers.delete(handler.id);
        this.idleHandlers.push(handler.id);
      }
    }
  }

  public kill() {
    this.handlers.forEach(h => {
      h.destroy();
    });

    this.requestQueue.forEach(r => {
      r.report(REQ_EARLY_TERMINATION_TOKEN);
    });

    this.init();
  }
}
