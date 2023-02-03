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
- issue fix: swarmed worker stops handling incoming requests when the apps fps is quite low and recycling is enabled.
