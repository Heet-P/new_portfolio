import { detectWebGL } from "./mode";

let memo: boolean | undefined;

/**
 * WebGL support for this page load, probed at most once. Creating a GL context is not free and
 * both the initial-mode hook and the toggle need the answer, so they share this memo.
 */
export function webglSupported(): boolean {
  return (memo ??= detectWebGL());
}

/**
 * Test-only: forget the memo so a test can mock a different detectWebGL result. Undefined in
 * production builds (NODE_ENV is inlined, so the bundler drops the function entirely).
 */
export const resetWebglMemo =
  process.env.NODE_ENV === "test"
    ? () => {
        memo = undefined;
      }
    : undefined;
