import {
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
  SETTINGS_KEY,
  STATS_KEY,
} from "./constants.js";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSettings(value) {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

  return {
    autoskipEnabled:
      typeof value.autoskipEnabled === "boolean"
        ? value.autoskipEnabled
        : DEFAULT_SETTINGS.autoskipEnabled,
    diagnosticsEnabled:
      typeof value.diagnosticsEnabled === "boolean"
        ? value.diagnosticsEnabled
        : DEFAULT_SETTINGS.diagnosticsEnabled,
    aggregateActionStatistics:
      typeof value.aggregateActionStatistics === "boolean"
        ? value.aggregateActionStatistics
        : DEFAULT_SETTINGS.aggregateActionStatistics,
  };
}

export function normalizeStats(value) {
  if (!isRecord(value)) return { ...DEFAULT_STATS };
  const safeCount = (count) =>
    Number.isSafeInteger(count) && count >= 0 ? count : 0;

  return {
    attempts: safeCount(value.attempts),
    confirmed: safeCount(value.confirmed),
  };
}

export async function readSettings(storage = chrome.storage.local) {
  try {
    const stored = await storage.get(SETTINGS_KEY);
    return normalizeSettings(stored?.[SETTINGS_KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(patch, storage = chrome.storage.local) {
  const current = await readSettings(storage);
  const next = normalizeSettings({ ...current, ...patch });
  await storage.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function readStats(storage = chrome.storage.local) {
  try {
    const stored = await storage.get(STATS_KEY);
    return normalizeStats(stored?.[STATS_KEY]);
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function recordAttempt({
  confirmed = false,
  storage = chrome.storage.local,
} = {}) {
  const current = await readStats(storage);
  const next = {
    attempts: current.attempts + 1,
    confirmed: current.confirmed + (confirmed ? 1 : 0),
  };
  await storage.set({ [STATS_KEY]: next });
  return next;
}

export async function recordConfirmation(storage = chrome.storage.local) {
  const current = await readStats(storage);
  const next = { ...current, confirmed: current.confirmed + 1 };
  await storage.set({ [STATS_KEY]: next });
  return next;
}
