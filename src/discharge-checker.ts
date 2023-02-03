import { Scheduler } from './scheduler';

export class DischargeChecker {
  private checkerCycleStartTs = 0;
  private accumulatedIdleCount = 0;
  private totalChecksOfCycle = 0;
  private _handle: number;

  constructor(private scheduler: Scheduler<unknown, unknown>) {}

  public start() {
    this.doCheck(0);
  }

  private doCheck(t: number) {
    if (
      this.totalChecksOfCycle /* only consider discharging when there's meaningful data */ &&
      t - this.checkerCycleStartTs >= 168
    ) {
      const numToDischarge = Math.ceil(this.accumulatedIdleCount / this.totalChecksOfCycle);

      if (numToDischarge >= this.scheduler.idleCount) {
        this.scheduler.discharge(numToDischarge);
      }

      this.checkerCycleStartTs = t;
      this.accumulatedIdleCount = 0;
      this.totalChecksOfCycle = 0;
    } else if (t > 0) {
      this.accumulatedIdleCount += this.scheduler.idleCount;
      this.totalChecksOfCycle++;
    }

    this._handle = requestAnimationFrame((t) => this.doCheck(t));
  }

  public stop() {
    cancelAnimationFrame(this._handle);
    this.checkerCycleStartTs = 0;
    this.accumulatedIdleCount = 0;
    this.totalChecksOfCycle = 0;
  }
}