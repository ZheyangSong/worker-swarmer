import type { Scheduler } from "./scheduler";
import { IQueueRequest, TInterruptableReq } from "./types";

export class Handler<I, O> {
  private working = false;
  private retireRequested = false;
  private errorEvtHandler: (ev: ErrorEvent) => any;
  private messageEvtHandler: (ev: MessageEvent) => any;
  private messageerrorEvtHandler: (ev: MessageEvent) => any;

  constructor(
    private scheduler: Scheduler<I, O>,
    private worker: Worker,
    private _id: string
  ) {
    this.errorEvtHandler = (ev) => {
      this.scheduler.workerEvents.dispatchEvent(new CustomEvent('error', {
        detail: ev
      }));
    };
    this.worker.addEventListener('error', this.errorEvtHandler);

    this.messageEvtHandler = (ev) => {
      this.scheduler.workerEvents.dispatchEvent(new CustomEvent('message', {
        detail: ev
      }));
    };
    this.worker.addEventListener('message', this.messageEvtHandler);

    this.messageerrorEvtHandler = (ev) => {
      this.scheduler.workerEvents.dispatchEvent(new CustomEvent('messageerror', {
        detail: ev
      }));
    };
    this.worker.addEventListener('messageerror', this.messageerrorEvtHandler);
  }

  public handle(
    req: IQueueRequest<I, O>["details"],
    transferred: IQueueRequest<I, O>["transferred"]
  ) {
    return new Promise<TInterruptableReq<O>>((resolve) => {
      this.handleRequest({ details: req, transferred, report: resolve });
    });
  }

  public get id() {
    return this._id;
  }

  public destroy() {
    this.worker.removeEventListener('error', this.errorEvtHandler);
    this.worker.removeEventListener('message', this.messageEvtHandler);
    this.worker.removeEventListener('messageerror', this.messageerrorEvtHandler);

    this.worker.terminate();
  }

  public handleRequest({ details, transferred, report }: IQueueRequest<I, O>) {
    this.working = true;

    const msgHandler = ({ data }: MessageEvent) => {
      this.worker.removeEventListener("message", msgHandler);

      report(data);

      if (this.retireRequested) {
        this.destroy();
      } else {
        this.working = this.scheduler.handleQueuedRequest(this);
      }
    };

    this.worker.addEventListener("message", msgHandler);
    this.worker.postMessage(details, transferred);
  }

  public retire() {
    if (this.working) {
      this.retireRequested = true;

      return false;
    }

    this.destroy();

    return true;
  }
}
