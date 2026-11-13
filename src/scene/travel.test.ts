import { beforeEach, describe, expect, it } from "vitest";
import { STOP_HOLD } from "@/ride/mapping";
import { MAX_SPEED, resetTravel, SMOOTH_TIME, stepTravel, travel, trainPosition, type LegWarp } from "./travel";

const N = 8;
const seg = 1 / (N - 1);
const dt = 1 / 60;
/** Progress at travel fraction `t` (0..1) of the leg from station `i` (outside the dwell zones). */
const inLeg = (i: number, t: number) => (i + STOP_HOLD / 2 + t * (1 - STOP_HOLD)) * seg;

describe("trainPosition", () => {
  it("sits exactly on a station while in its dwell zone", () => {
    expect(trainPosition(0, N)).toBe(0);
    expect(trainPosition(2 * seg, N)).toBe(2);
    expect(trainPosition(1, N)).toBe(N - 1);
  });

  it("is halfway between stations mid-travel and grows monotonically", () => {
    expect(trainPosition(1.5 * seg, N)).toBeCloseTo(1.5);
    let last = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const x = trainPosition(p, N);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });

  it("spreads the leg through a warp, still landing on the stations", () => {
    const slowStart: LegWarp = (_, f) => f * f; // a stand-in for "more scroll here"
    expect(trainPosition(inLeg(3, 0.5), N, slowStart)).toBeCloseTo(3.25);
    expect(trainPosition(3 * seg, N, slowStart)).toBe(3);
    expect(trainPosition(4 * seg, N, slowStart)).toBe(4);
  });
});

describe("stepTravel: the scroll is the throttle", () => {
  beforeEach(() => resetTravel(0, N));

  it("velocity is zero while stopped at a station", () => {
    for (let i = 0; i < 60; i++) stepTravel(0.01 * (i % 2), N, dt); // jitter inside the dwell zone
    expect(travel.velocity).toBe(0);
    expect(travel.speed).toBe(0);
  });

  it("moves forward with the scroll and backward when the scroll goes back", () => {
    let p = inLeg(1, 0.3);
    resetTravel(p, N);
    for (let i = 0; i < 30; i++) stepTravel((p += 0.002), N, dt);
    expect(travel.velocity).toBeGreaterThan(0);
    expect(travel.speed).toBeGreaterThan(0);
    expect(travel.speed).toBeLessThanOrEqual(1);
    for (let i = 0; i < 60; i++) stepTravel((p -= 0.002), N, dt);
    expect(travel.velocity).toBeLessThan(0);
  });

  it("follows a steadily scrolled target with a bounded lag of about SMOOTH_TIME", () => {
    // Scroll through leg 2 at a pace whose top train speed (mid-leg) is 0.9 stations/s.
    const legTime = 1.5 / 0.9;
    resetTravel(inLeg(2, 0), N);
    let worst = 0;
    for (let k = 1; k * dt <= legTime; k++) {
      const p = inLeg(2, (k * dt) / legTime);
      stepTravel(p, N, dt);
      const lag = trainPosition(p, N) - travel.position;
      expect(lag).toBeGreaterThanOrEqual(-1e-9); // never ahead of the scroll
      worst = Math.max(worst, lag);
      if (Math.abs(k * dt - legTime / 2) < dt / 2) {
        // Mid-leg the target moves at ~0.9 stations/s: the train trails by ~SMOOTH_TIME of it.
        const v = (trainPosition(inLeg(2, (k * dt + dt) / legTime), N) - trainPosition(p, N)) / dt;
        expect(lag).toBeGreaterThan(0.75 * v * SMOOTH_TIME);
        expect(lag).toBeLessThan(1.25 * v * SMOOTH_TIME);
      }
    }
    expect(worst).toBeLessThan(0.9 * SMOOTH_TIME * 1.2);
  });

  it("coasts to a stop shortly after the scrolling stops, without running past the scroll", () => {
    const legTime = 1.5 / 0.9;
    resetTravel(inLeg(2, 0), N);
    let p = 0;
    for (let k = 1; k * dt <= legTime / 2; k++) stepTravel((p = inLeg(2, (k * dt) / legTime)), N, dt);
    expect(travel.speed).toBeGreaterThan(0.5);
    const target = trainPosition(p, N);
    for (let k = 1; k * dt <= 1; k++) {
      stepTravel(p, N, dt);
      expect(travel.position).toBeLessThanOrEqual(target);
      // A brief coast: after 0.4 s it is down to a crawl (from ~0.75 of full speed).
      if (Math.abs(k * dt - 0.4) < dt / 2) expect(travel.speed).toBeLessThan(0.15);
    }
    expect(travel.position).toBe(target);
    expect(travel.velocity).toBe(0);
    expect(travel.speed).toBe(0);
  });

  it("settles exactly on the station when the scroll rests in its dwell zone", () => {
    resetTravel(inLeg(3, 0.6), N);
    for (let i = 0; i < 90; i++) stepTravel(4 * seg - 0.01 * seg, N, dt); // inside station 4's dwell, off its centre
    expect(travel.position).toBe(4);
    expect(travel.velocity).toBe(0);
    expect(travel.speed).toBe(0);
  });

  it("caps a flick at MAX_SPEED, never runs past the Terminus, and parks on it", () => {
    resetTravel(inLeg(1, 0.5), N);
    for (let i = 0; i < 60 * 10; i++) {
      stepTravel(1, N, dt);
      expect(Math.abs(travel.velocity)).toBeLessThanOrEqual(MAX_SPEED);
      expect(travel.speed).toBeLessThanOrEqual(1);
      expect(travel.position).toBeLessThanOrEqual(N - 1);
    }
    expect(travel.position).toBe(N - 1);
    expect(travel.velocity).toBe(0);
  });

  it("never runs back past Departure either", () => {
    resetTravel(inLeg(2, 0.5), N);
    for (let i = 0; i < 60 * 10; i++) {
      stepTravel(0, N, dt);
      expect(travel.position).toBeGreaterThanOrEqual(0);
    }
    expect(travel.position).toBe(0);
    expect(travel.velocity).toBe(0);
  });

  it("ignores a zero or huge frame delta (tab switch) without exploding", () => {
    stepTravel(0.5, N, 0);
    expect(Number.isFinite(travel.velocity)).toBe(true);
    stepTravel(0.6, N, 5);
    expect(Number.isFinite(travel.velocity)).toBe(true);
  });

  it("is frame-rate independent (30 vs 120 fps land close together)", () => {
    for (let i = 0; i < 15; i++) stepTravel(2 * seg, N, 1 / 30);
    const a = travel.position;
    resetTravel(0, N);
    for (let i = 0; i < 60; i++) stepTravel(2 * seg, N, 1 / 120);
    expect(Math.abs(travel.position - a)).toBeLessThan(0.01);
  });
});
