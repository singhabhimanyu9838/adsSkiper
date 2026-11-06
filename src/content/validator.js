import { isAdSkipFallback, SKIP_CONTROL_SELECTORS } from "./detector.js";

function isVisible(element) {
  if (element.hidden || element.getAttribute("aria-hidden") === "true")
    return false;
  if (element.getClientRects().length === 0) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse" &&
    style.opacity !== "0"
  );
}

function matchesKnownControl(element, player) {
  return SKIP_CONTROL_SELECTORS.some((selector) => {
    const localSelector = selector.replace("#movie_player ", "");
    const knownControl = player.querySelector(localSelector);
    if (!knownControl) return false;
    if (knownControl === element && element.matches(localSelector)) return true;

    return (
      element.matches('button, [role="button"]') &&
      knownControl.contains(element) &&
      element.closest(localSelector) === knownControl
    );
  });
}

export function validateSkipControl(
  element,
  player,
  document = globalThis.document,
) {
  if (!element || !player || !document) return false;
  if (!element.isConnected || !player.isConnected) return false;
  if (player.ownerDocument !== document || element.ownerDocument !== document)
    return false;
  if (element.closest("#movie_player") !== player) return false;
  if (
    !matchesKnownControl(element, player) &&
    !isAdSkipFallback(element, player)
  ) {
    return false;
  }
  if (element.disabled || element.getAttribute("aria-disabled") === "true")
    return false;
  if (element.closest('[disabled], [aria-disabled="true"]')) return false;
  return isVisible(element);
}
