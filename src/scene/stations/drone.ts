/** The SAHARA drone's hover bob: peak height (units) and angular speed (radians/s). */
export const DRONE_BOB = { amplitude: 0.22, speed: 1.7 } as const;

/**
 * Vertical offset of the drone from its hover height at time `t` (seconds): a gentle sine
 * bob. Under reduced motion it hangs perfectly still (offset 0).
 */
export function droneBobY(t: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.sin(t * DRONE_BOB.speed) * DRONE_BOB.amplitude;
}
