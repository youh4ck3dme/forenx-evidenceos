import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extraTopInsetPx } from "./viewport.ts";

describe("extraTopInsetPx", () => {
  it("is 0 in installed PWA (display-mode standalone)", () => {
    assert.equal(
      extraTopInsetPx({
        displayModeStandalone: true,
        navigatorStandalone: false,
        isCoarsePointer: true,
      }),
      0,
    );
  });

  it("is 0 for iOS navigator.standalone", () => {
    assert.equal(
      extraTopInsetPx({
        displayModeStandalone: false,
        navigatorStandalone: true,
        isCoarsePointer: true,
      }),
      0,
    );
  });

  it("is 0 on desktop fine pointer (no Chrome overlay buttons)", () => {
    assert.equal(
      extraTopInsetPx({
        displayModeStandalone: false,
        navigatorStandalone: false,
        isCoarsePointer: false,
      }),
      0,
    );
  });

  it("adds 48px on mobile browser so overlay X/… sit above the header", () => {
    assert.equal(
      extraTopInsetPx({
        displayModeStandalone: false,
        navigatorStandalone: false,
        isCoarsePointer: true,
      }),
      48,
    );
  });
});
