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

### 2. Transfer transferables

Often times, using multi-threading involves processing huge amount of data. In this case, the data exchange overhaeds won't be negligible if structured cloning is used. Thus, transferring the data when possible will significantly cut the overheads. When using native `postMessage`, this can be done by listing out all objects to transfer when sending data to the other context. For the swarmed instance, similar syntax is also supported.

```ts
import { swarm } from "worker-swarmer";

interface IDataCruncherInput {
  data: ArrayBuffer;
}

const swarmed = swarm<IDataCruncherInput, void>(
  () => new Worker(new URL("my-data-cruncher.ts", import.meta.url))
);

const msg = {
  data: new ArrayBuffer(8 * 1024 * 1024) // 8MB data
};

swarmed(msg, [msg.data]).then(
  (result) => console.log(msg.data === undefined) // 'true' should be logged in the console.
);
```

### 3. Control idle web worker's eligibility for recycling.

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

### 4. Subscribe to work-emitted event.

In some cases, when web workers are used as long-running services, they can actively emit events to notify main thread as well. For such scenarios, the promise-based APIs won't help much by nature. On the other hand, one can use a different event-based API to receive a streams of work-emitted events.

```ts
/* random-work.ts */

setInterval(() => {
  globalThis.postMessage({
    myth: Math.random(),
  });
}, 1500);
```

```ts
/* main app */

import { swarm } from "worker-swarmer";

const swarmed = swarm(() => new Worker(
  new URL("./random-worker.ts", import.meta.url)),
  { maxCount: 10 }
);

swarmed.onWorkerEvent("message", (msg) => {
  const { myth } = msg.data;

  console.log(`Here is a new myth: ${myth}`);
});

```

### 5. Automatically Recover from Worker Crash
From time to time, a web worker may crash and emit "error" event due to unhandled exceptions. Since `v2.2.1`, this worker crash will be handled internally automatically. This means,
+ the emitted "error" event will still be reported to subscribers
+ the crashed worker will be cleaned up
+ a replacement will be created when it's necessary
+ the swarmed instance will always function regardless of worker crashes.

In rare cases, if one wants to completely stop the swarmed instance's execution upon a work crash, he/she can invoke the `terminate()` method inside an "error" event handler:
```ts
/* main app */

import { swarm } from "worker-swarmer";

const swarmed = swarm(() => new Worker(
  new URL("./random-worker.ts", import.meta.url)),
  { maxCount: 10 }
);

swarmed.onWorkerEvent("error", () => {
  swarmed.terminate();
});

```