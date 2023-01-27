# worker-swarmer
A lib that allows spawning a worker implementation into many. This is essentially a worker pooler with simple API surface.

## Usage

### 1. Basic

Wrap your worker implementation in a worker factory function and pass this function to the `swarm`. Along with this factory function, you can also specify the maximum total (default to 3) of web workers can spawn.

```ts
import { swarm, REQ_EARLY_TERMINATION_TOKEN } from "worker-swarmer";

// webpack@4 or below + worker-loader
import SuperWorker from "path/to/my/superworker.ts"; 
const workerMaker = () => new SuperWorker();

/**
 * for webpack@5+ and other bundler tools supporting native web worker instantiation, simply do
 * 
 * const workerMaker = () => new Worker(new URL("path/to/my/suprerworker.ts", import.meta.url));
 */

interface ISuperWorkerInput {
  taskName: string;
  timestamp: number;
}

interface ISuperWorkerOutput {
  taskResult: any;
  timestamp: number;
}

const maxCount = 5; // at most, 5 web workers of SuperWorker will exist
const swarmedSuperWorker = swarm<ISuperWorkerInput, ISuperWorkerOutput>(
  () => new SuperWorker(),
  { maxCount },
);

swarmedSuperworker({
  taskName: "meaning-of-life",
}).then((output) => {
  if (output === REQ_EARLY_TERMINATION_TOKEN) {
    throw new Error("task processing was interrupted.");
  }

  const {
    taskResult,
  } = output;

  if (taskResult === 42) {
    console.log("found the meaning of life");

    return true;
  }

  return false;
});

// let's destroy all spawned super workers.
// This might cause some running ones throw `REQ_EARLY_TERMINATION_TOKEN`.
// If you want to avoid this, do the termination in the Promise's
// lifecycle (e.g., `then`, `catch` or `finally`).
swarmedSuperWorker.terminate();
```

### 2. Control idle web worker's eligibility for recycling.

By default, a swarmed instance will try to recycle some web workers after they are idle for certain period of time. This can potentially reserve some resource consumption. But, it's inteneded to avoid the overhead of spinning up a web worker. The recycling can be disabled completely or paused for as long as needed.

```ts
// disable the recycling completely
import { swarm } from "worker-swarmer";

...

const swarmed = swarm(() => new Worker(
  new URL("path/to/worker.ts", import.meta.url)),
  { recyclable: false /* no recycling at all */ },
);



// pause&resume recycling behavior
const swarmedWithRecycling = swarm(() => new Worker(
  new URL("path/to/worker.ts", import.meta.url)),
);

...

swarmedWithRecycling.disableRecycling(); // Let's pause recycling idle workers

...

// mission-critical work has been finished, let's re-enable recycling.
swarmedWithRecycling.enableRecycling();
```