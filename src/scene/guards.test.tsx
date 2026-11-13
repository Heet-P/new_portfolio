import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useRide } from "@/ride/rideStore";
import { useGuardedFrameLoop, watchContextLoss } from "./guards";
import { SceneBoundary } from "./SceneBoundary";

beforeEach(() => {
  useRide.setState({ mode: "ride" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Runs requestAnimationFrame callbacks on demand. */
function manualFrames() {
  let queue: FrameRequestCallback[] = [];
  let now = 1000;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.push(cb);
    return queue.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
    queue = [];
  });
  return {
    step(ms = 16) {
      now += ms;
      const run = queue;
      queue = [];
      act(() => run.forEach((cb) => cb(now)));
    },
  };
}

function Loop({ frame }: { frame: (seconds: number) => void }) {
  useGuardedFrameLoop(frame);
  return <p>scene</p>;
}

describe("useGuardedFrameLoop (Task 13)", () => {
  it("drives frames with seconds since the first frame (first delta 0)", () => {
    const frames = manualFrames();
    const seen: number[] = [];
    render(<Loop frame={(s) => seen.push(s)} />);
    frames.step(16);
    frames.step(16);
    frames.step(16);
    expect(seen[0]).toBe(0);
    expect(seen[2]).toBeCloseTo(0.032, 6);
  });

  it("an error thrown inside a frame (a useFrame) drops the visitor into Express", () => {
    const frames = manualFrames();
    let n = 0;
    const { container } = render(
      <SceneBoundary>
        <Loop
          frame={() => {
            if (++n === 3) throw new Error("useFrame blew up");
          }}
        />
      </SceneBoundary>,
    );
    frames.step();
    frames.step();
    expect(useRide.getState().mode).toBe("ride");
    frames.step();
    expect(useRide.getState().mode).toBe("express");
    expect(container.textContent).toBe("");
  });
});

describe("watchContextLoss (Task 13)", () => {
  it("switches to Express when the GPU drops the WebGL context, and can be unhooked", () => {
    const canvas = document.createElement("canvas");
    const stop = watchContextLoss(canvas);
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(useRide.getState().mode).toBe("express");
    useRide.setState({ mode: "ride" });
    stop();
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(useRide.getState().mode).toBe("ride");
  });
});
