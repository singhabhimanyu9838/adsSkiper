export const SKIP_CONTROL_SELECTORS = Object.freeze([
  "#movie_player button.ytp-ad-skip-button",
  "#movie_player button.ytp-ad-skip-button-modern",
  "#movie_player button.ytp-skip-ad-button",
  '#movie_player [role="button"].ytp-ad-skip-button',
  '#movie_player [role="button"].ytp-ad-skip-button-modern',
  '#movie_player [role="button"].ytp-skip-ad-button',
  "#movie_player .ytp-ad-skip-button-slot button",
  '#movie_player .ytp-ad-skip-button-slot [role="button"]',
  "#movie_player .ytp-ad-skip-button-container button",
  '#movie_player .ytp-ad-skip-button-container [role="button"]',
  "#movie_player .ytp-ad-skip-button-modern",
  "#movie_player .ytp-ad-skip-button",
  "#movie_player .ytp-skip-ad-button",
]);

export function findPlayer(document = globalThis.document) {
  return document.querySelector("#movie_player");
}

function isSkipLabel(element) {
  const label = (
    element.getAttribute("aria-label") ||
    element.title ||
    element.innerText ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return label === "skip" || label === "skip ad" || label === "skip ads";
}

function isInSkipCorner(element, player) {
  const playerRect = player.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left >= playerRect.left + playerRect.width * 0.6 &&
    rect.top >= playerRect.top + playerRect.height * 0.5 &&
    rect.right <= playerRect.right &&
    rect.bottom <= playerRect.bottom
  );
}

export function isAdSkipFallback(element, player) {
  if (!player?.classList.contains("ad-showing")) return false;
  if (!element?.matches('button, [role="button"]')) return false;

  const candidates = [
    ...player.querySelectorAll('button, [role="button"]'),
  ].filter((candidate) => {
    if (
      candidate.disabled ||
      candidate.getAttribute("aria-disabled") === "true" ||
      candidate.closest('[disabled], [aria-disabled="true"]')
    ) {
      return false;
    }
    return isSkipLabel(candidate) && isInSkipCorner(candidate, player);
  });

  return candidates.length === 1 && candidates[0] === element;
}

export function findSkipControl(player) {
  if (!player?.isConnected) return null;

  for (const selector of SKIP_CONTROL_SELECTORS) {
    const candidate = player.querySelector(
      selector.replace("#movie_player ", ""),
    );
    if (!candidate) continue;

    if (candidate.matches('button, [role="button"]')) return candidate;
    return (
      candidate.querySelector('button:not([disabled]), [role="button"]') ??
      candidate
    );
  }

  const fallbackCandidates = [
    ...player.querySelectorAll('button, [role="button"]'),
  ].filter((candidate) => isAdSkipFallback(candidate, player));
  return fallbackCandidates.length === 1 ? fallbackCandidates[0] : null;
}
