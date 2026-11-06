import {
  STATUS_MESSAGE,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  TRUSTED_SKIP_CLICK_MESSAGE,
} from "../shared/constants.js";
import { normalizeSettings, readSettings } from "../shared/settings.js";
import { ActionController } from "./action-controller.js";
import { PlayerObserver } from "./observer.js";
import { validateSkipControl } from "./validator.js";

const INSTANCE_KEY = "__autoskipContentInstance__";

async function initialize() {
  if (globalThis[INSTANCE_KEY]) return;

  let settings = await readSettings();
  let playerDetected = false;
  const actionController = new ActionController({
    isEnabled: () => settings.autoskipEnabled,
    recordStatistics: () => settings.aggregateActionStatistics,
    diagnosticsEnabled: () => settings.diagnosticsEnabled,
    dispatchClick: async (candidate, player, document) => {
      const rect = candidate.getBoundingClientRect();
      try {
        const response = await chrome.runtime.sendMessage({
          type: TRUSTED_SKIP_CLICK_MESSAGE,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        if (response?.clicked) {
          return { attempted: true, method: "browser-input" };
        }
      } catch (error) {
        if (settings.diagnosticsEnabled) {
          console.warn("AutoSkip could not use browser-input clicking.", error);
        }
      }

      if (!validateSkipControl(candidate, player, document)) {
        return { attempted: false };
      }
      candidate.click();
      return { attempted: true, method: "DOM click" };
    },
  });
  const observer = new PlayerObserver({
    onCandidate: (candidate, player, metadata) =>
      actionController.activate(candidate, player, document, metadata),
    shouldRun: () => settings.autoskipEnabled,
    onPlayerChange: (player) => {
      playerDetected = Boolean(player);
    },
  });

  const instance = {
    status() {
      return { enabled: settings.autoskipEnabled, playerDetected };
    },
    destroy() {
      observer.destroy();
      actionController.destroy();
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      delete globalThis[INSTANCE_KEY];
    },
  };

  const handleStorageChange = (changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) {
      settings = normalizeSettings(
        changes[SETTINGS_KEY].newValue ?? DEFAULT_SETTINGS,
      );
      observer.schedule();
    }
  };
  const handleMessage = (message, _sender, sendResponse) => {
    if (message?.type !== STATUS_MESSAGE) return false;
    sendResponse(instance.status());
    return false;
  };

  globalThis[INSTANCE_KEY] = instance;
  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.runtime.onMessage.addListener(handleMessage);
  observer.start();
}

initialize().catch((error) =>
  console.warn("AutoSkip initialization failed.", error),
);
