import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseInitialMode, detectWebGL, readSavedMode, saveMode } from "./mode";

describe("chooseInitialMode", () => {
  it("is express whenever WebGL is unavailable, whatever else is set", () => {
    expect(chooseInitialMode({ webgl: false, reducedMotion: false, saved: null })).toBe("express");
    expect(chooseInitialMode({ webgl: false, reducedMotion: false, saved: "ride" })).toBe("express");
  });

  it("is express for reduced motion with nothing saved", () => {
    expect(chooseInitialMode({ webgl: true, reducedMotion: true, saved: null })).toBe("express");
  });

  it("lets an explicit saved choice beat reduced motion", () => {
    expect(chooseInitialMode({ webgl: true, reducedMotion: true, saved: "ride" })).toBe("ride");
  });

  it("honours a saved express choice on a capable device", () => {
    expect(chooseInitialMode({ webgl: true, reducedMotion: false, saved: "express" })).toBe("express");
  });

  it("defaults to ride", () => {
    expect(chooseInitialMode({ webgl: true, reducedMotion: false, saved: null })).toBe("ride");
  });
});

/** A Storage whose every method throws, like Safari private mode or blocked cookies. */
function throwingStorage(): Storage {
  const boom = () => {
    throw new Error("storage blocked");
  };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 } as Storage;
}

describe("readSavedMode / saveMode", () => {
  it("round-trips a mode through the nt-mode key", () => {
    const storage = window.localStorage;
    storage.clear();
    expect(readSavedMode(storage)).toBeNull();
    saveMode("ride", storage);
    expect(storage.getItem("nt-mode")).toBe("ride");
    expect(readSavedMode(storage)).toBe("ride");
    saveMode("express", storage);
    expect(readSavedMode(storage)).toBe("express");
  });

  it("treats invalid stored values as null", () => {
    window.localStorage.setItem("nt-mode", "turbo");
    expect(readSavedMode()).toBeNull();
    window.localStorage.clear();
  });

  it("never throws when storage throws", () => {
    const storage = throwingStorage();
    expect(readSavedMode(storage)).toBeNull();
    expect(() => saveMode("ride", storage)).not.toThrow();
  });
});

describe("detectWebGL", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is true when a webgl2 context is available", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((kind: string) => (kind === "webgl2" ? {} : null)) as never,
    );
    expect(detectWebGL()).toBe(true);
  });

  it("falls back to webgl 1", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      ((kind: string) => (kind === "webgl" ? {} : null)) as never,
    );
    expect(detectWebGL()).toBe(true);
  });

  it("is false when no context can be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(detectWebGL()).toBe(false);
  });

  it("is false when context creation throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("no gpu");
    });
    expect(detectWebGL()).toBe(false);
  });
});
