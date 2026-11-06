import { TRUSTED_SKIP_CLICK_MESSAGE } from "../shared/constants.js";

const TRUSTED_CONTROL_SELECTORS = [
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
];

export function isTrustedClickRequestAllowed(message, sender) {
  if (message?.type !== TRUSTED_SKIP_CLICK_MESSAGE) return false;
  if (sender?.frameId !== 0 || !Number.isInteger(sender?.tab?.id)) return false;

  try {
    const senderUrl = new URL(sender.url);
    const tabUrl = new URL(sender.tab.url);
    if (
      senderUrl.protocol !== "https:" ||
      senderUrl.hostname !== "www.youtube.com" ||
      tabUrl.protocol !== "https:" ||
      tabUrl.hostname !== "www.youtube.com"
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return (
    Number.isFinite(message.x) &&
    Number.isFinite(message.y) &&
    message.x >= 0 &&
    message.y >= 0
  );
}

export async function dispatchTrustedClick(message, sender, debuggerApi) {
  if (!isTrustedClickRequestAllowed(message, sender)) return false;

  const target = { tabId: sender.tab.id };
  const x = JSON.stringify(message.x);
  const y = JSON.stringify(message.y);
  const selectors = JSON.stringify(TRUSTED_CONTROL_SELECTORS.join(","));
  const expression = `(() => {
    const x = ${x};
    const y = ${y};
    const player = document.querySelector("#movie_player");
    const hit = document.elementFromPoint(x, y);
    let control = hit?.closest(${selectors});
    if (!player) return false;
    if (!control && player.classList.contains("ad-showing")) {
      const hitControl = hit?.closest('button, [role="button"]');
      const isSkipLabel = (element) => {
        const label = (element.getAttribute("aria-label") || element.title || element.innerText || element.textContent || "")
          .replace(/\\s+/g, " ").trim().toLowerCase();
        return label === "skip" || label === "skip ad" || label === "skip ads";
      };
      const isInSkipCorner = (element) => {
        const playerRect = player.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
          rect.left >= playerRect.left + playerRect.width * 0.6 &&
          rect.top >= playerRect.top + playerRect.height * 0.5 &&
          rect.right <= playerRect.right && rect.bottom <= playerRect.bottom;
      };
      const candidates = [...player.querySelectorAll('button, [role="button"]')].filter(element =>
        !element.disabled && element.getAttribute("aria-disabled") !== "true" &&
        !element.closest('[disabled], [aria-disabled="true"]') &&
        isSkipLabel(element) && isInSkipCorner(element)
      );
      if (candidates.length === 1 && candidates[0] === hitControl) control = hitControl;
    }
    if (!control || !player.contains(control)) return false;
    if (control.disabled || control.getAttribute("aria-disabled") === "true") return false;
    if (control.closest('[disabled], [aria-disabled="true"]')) return false;
    const rect = control.getBoundingClientRect();
    const style = getComputedStyle(control);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden" &&
      style.visibility !== "collapse" && style.opacity !== "0";
  })()`;

  let attached = false;
  let pressed = false;
  try {
    await debuggerApi.attach(target, "1.3");
    attached = true;
    const evaluation = await debuggerApi.sendCommand(
      target,
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
      },
    );
    if (evaluation?.result?.value !== true) return false;

    await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: message.x,
      y: message.y,
      button: "left",
      clickCount: 1,
    });
    pressed = true;
    await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: message.x,
      y: message.y,
      button: "left",
      clickCount: 1,
    });
    pressed = false;
    return true;
  } catch (error) {
    console.warn("AutoSkip browser-input click failed.", error);
    return false;
  } finally {
    if (attached && pressed) {
      try {
        await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: message.x,
          y: message.y,
          button: "left",
          clickCount: 1,
        });
      } catch (error) {
        console.warn(
          "AutoSkip could not release the browser mouse input.",
          error,
        );
      }
    }
    if (attached) {
      try {
        await debuggerApi.detach(target);
      } catch (error) {
        console.warn("AutoSkip could not detach the browser debugger.", error);
      }
    }
  }
}

if (globalThis.chrome?.runtime?.onMessage) {
  globalThis.chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message?.type !== TRUSTED_SKIP_CLICK_MESSAGE) return false;

      dispatchTrustedClick(message, sender, globalThis.chrome.debugger)
        .then((clicked) => sendResponse({ clicked }))
        .catch((error) => {
          console.warn("AutoSkip could not process a skip click.", error);
          sendResponse({ clicked: false });
        });
      return true;
    },
  );
}
