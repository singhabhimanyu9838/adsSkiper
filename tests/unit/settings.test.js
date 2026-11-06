import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  STATS_KEY,
} from "../../src/shared/constants.js";
import {
  normalizeSettings,
  normalizeStats,
  readSettings,
  recordAttempt,
  writeSettings,
} from "../../src/shared/settings.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      return { [key]: data[key] };
    },
    async set(values) {
      Object.assign(data, values);
    },
  };
}

describe("local settings and statistics", () => {
  it("uses defaults for absent or malformed stored settings", async () => {
    expect(await readSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("corrupt")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ autoskipEnabled: "yes" }).autoskipEnabled).toBe(
      true,
    );
  });

  it("persists preferences after updating them", async () => {
    const storage = memoryStorage();
    await writeSettings({ autoskipEnabled: false }, storage);
    expect(storage.data[SETTINGS_KEY].autoskipEnabled).toBe(false);
    expect(await readSettings(storage)).toEqual({
      ...DEFAULT_SETTINGS,
      autoskipEnabled: false,
    });
  });

  it("sanitizes statistics and tracks attempts separately from confirmations", async () => {
    const storage = memoryStorage({
      [STATS_KEY]: { attempts: -5, confirmed: "bad" },
    });
    expect(normalizeStats(storage.data[STATS_KEY])).toEqual({
      attempts: 0,
      confirmed: 0,
    });
    const stats = await recordAttempt({ storage });
    expect(stats).toEqual({ attempts: 1, confirmed: 0 });
    expect(storage.data[STATS_KEY]).toEqual(stats);
  });

  it("falls back to defaults if storage throws", async () => {
    const brokenStorage = {
      get: async () => {
        throw new Error("unavailable");
      },
    };
    expect(await readSettings(brokenStorage)).toEqual(DEFAULT_SETTINGS);
  });
});
