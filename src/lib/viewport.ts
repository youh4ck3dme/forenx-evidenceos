/** Extra top inset so iOS Chrome's overlay buttons do not cover the app header. */

export function extraTopInsetPx(input: {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
  isCoarsePointer: boolean;
}): number {
  if (input.displayModeStandalone || input.navigatorStandalone) return 0;
  if (!input.isCoarsePointer) return 0;
  return 48;
}

export function readViewportFlags(
  win: Pick<Window, "matchMedia" | "navigator"> = window,
): {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
  isCoarsePointer: boolean;
} {
  const standaloneMq = win.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const coarse = win.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return {
    displayModeStandalone: standaloneMq,
    navigatorStandalone: nav.standalone === true,
    isCoarsePointer: coarse,
  };
}
