# CHANGELOG

## 1.0.0
- initial release

## 2.0.0
- update `swarm` interface. The second optional argument changes to an option object that can accept below optional parameters:
  - `maxCount` -- the max # of web workers can be spawned. Default to **3**
  - `recyclable` -- weather idle web workers can be recycled. Default to **true**
- introduce new behavior of recycling idle web workers automatically.
  - if a certain number of workers are idled in one checking cycle (~168ms, which is roughly 10 checks/frames in a 60fps app), an average number of idle workers in the cycle will be terminated.
  - when recycling is enabled, two new methods becomes avaialbe on the swarmed callable:
    - `enableRecycling`
    - `disableRecycling`

## 2.0.1
- INVALID. It contains the same content as 2.0.0

## 2.0.2
- issue fix: swarmed worker stops handling incoming requests when the apps fps is quite low and recycling is enabled.

## 2.1.0
- issue fix: relax worker recycling logic to avoid too frequent worker destroy/re-create.
- enhancement: support specifying objects to transfer. One can now optionally specify a list of transferable objects along with messsage to send. See `README` for details.

## 2.2.0
- introduce new API, `onWorkerEvent`, to receive worker-emitted event streams.

## 2.2.1
- issue fix: when a worker crashes, automatically cleaning it up to allow the swarmed instance to continue function properly
- expose extra possible worker event to the users:
  - rejectionhandled
  - rejectionunhandled

## 2.2.2
- issue fix: does extra code purge when needed. This helps to eliminate some potential entry points for memory leakage.
