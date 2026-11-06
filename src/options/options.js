import { DEFAULT_STATS } from "../shared/constants.js";
import { readSettings, readStats, writeSettings } from "../shared/settings.js";

const settingNames = [
  "autoskipEnabled",
  "aggregateActionStatistics",
  "diagnosticsEnabled",
];
const saveStatus = document.querySelector("#save-status");

async function render() {
  const settings = await readSettings();
  for (const name of settingNames) {
    document.querySelector(`#${name}`).checked = settings[name];
  }
  const stats = await readStats();
  document.querySelector("#statistics-summary").textContent =
    `${stats.attempts} attempts, ${stats.confirmed} confirmed`;
}

for (const name of settingNames) {
  document
    .querySelector(`#${name}`)
    .addEventListener("change", async (event) => {
      try {
        await writeSettings({ [name]: event.currentTarget.checked });
        saveStatus.textContent = "Saved";
      } catch {
        saveStatus.textContent = "Could not save this setting";
        render();
      }
    });
}

document.querySelector("#reset-stats").addEventListener("click", async () => {
  try {
    await chrome.storage.local.set({ autoskipStats: { ...DEFAULT_STATS } });
    saveStatus.textContent = "Totals reset";
    await render();
  } catch {
    saveStatus.textContent = "Could not reset totals";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.autoskipStats) render();
});

render().catch(() => {
  saveStatus.textContent = "Could not load local settings";
});
