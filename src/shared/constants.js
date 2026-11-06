export const SETTINGS_KEY = "autoskipSettings";
export const STATS_KEY = "autoskipStats";
export const STATUS_MESSAGE = "AUTOSKIP_GET_STATUS";
export const TRUSTED_SKIP_CLICK_MESSAGE = "AUTOSKIP_TRUSTED_SKIP_CLICK";

export const DEFAULT_SETTINGS = Object.freeze({
  autoskipEnabled: true,
  diagnosticsEnabled: false,
  aggregateActionStatistics: true,
});

export const DEFAULT_STATS = Object.freeze({
  attempts: 0,
  confirmed: 0,
});
