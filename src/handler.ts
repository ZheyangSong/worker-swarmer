import type { Scheduler } from "./scheduler";
import { IQueueRequest, TInterruptableReq } from "./types";

export class Handler<I, O> {
  private working = false;
  private retireRequested = false;

  constructor(
    private scheduler: Scheduler<I, O>,
    private worker: Worker,
    private _id: string
  ) {}

  public handle(req: IQueueRequest<I, O>["details"], transferred: IQueueRequest<I, O>["transferred"]) {
    return new Promise<TInterruptableReq<O>>((resolve) => {
      this.handleRequest({ details: req, transferred, report: resolve });
    });
  }

  public get id() {
    return this._id;
  }

  public destroy() {
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
