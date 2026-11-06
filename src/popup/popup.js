import { DEFAULT_SETTINGS, STATUS_MESSAGE } from "../shared/constants.js";
import {
  normalizeSettings,
  readSettings,
  readStats,
  writeSettings,
} from "../shared/settings.js";

const toggle = document.querySelector("#enabled-toggle");
const statusText = document.querySelector("#status-text");
const statusMark = document.querySelector("#status-mark");
const errorText = document.querySelector("#error-text");

document.querySelector("#settings-link").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime
    .openOptionsPage()
    .catch(() => showError("Could not open Settings."));
});

function showError(message) {
  errorText.textContent = message;
  errorText.hidden = false;
}

async function updateStatus(enabled) {
  if (!enabled) {
    statusText.textContent = "Automatic skip is off";
    statusMark.dataset.state = "off";
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const status = await chrome.tabs.sendMessage(tab.id, {
      type: STATUS_MESSAGE,
    });
    statusText.textContent = status.playerDetected
      ? "Ready on this YouTube player"
      : "Waiting for a YouTube player";
    statusMark.dataset.state = "ready";
  } catch {
    statusText.textContent = "Open a YouTube video to use AutoSkip";
    statusMark.dataset.state = "off";
  }
}

async function render() {
  const settings = normalizeSettings(await readSettings());
  toggle.setAttribute("aria-checked", String(settings.autoskipEnabled));
  toggle.title = settings.autoskipEnabled
    ? "Disable automatic skip"
    : "Enable automatic skip";
  const stats = await readStats();
  document.querySelector("#attempt-count").textContent =
    settings.aggregateActionStatistics ? String(stats.attempts) : "-";
  document.querySelector("#confirmed-count").textContent =
    settings.aggregateActionStatistics ? String(stats.confirmed) : "-";
  document.querySelector(".stat-note").textContent =
    settings.aggregateActionStatistics
      ? "Confirmed means the player left its ad state after an attempt."
      : "Local action statistics are disabled in Settings.";
  await updateStatus(settings.autoskipEnabled);
}

toggle.addEventListener("click", async () => {
  toggle.disabled = true;
  try {
    const current = await readSettings();
    const settings = await writeSettings({
      autoskipEnabled: !current.autoskipEnabled,
    });
    await render();
    toggle.setAttribute("aria-checked", String(settings.autoskipEnabled));
  } catch {
    showError("Could not save your preference.");
  } finally {
    toggle.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.autoskipStats) render();
});

render().catch(() => {
  toggle.setAttribute("aria-checked", String(DEFAULT_SETTINGS.autoskipEnabled));
  showError("AutoSkip could not load its local settings.");
});
