import { recordAttempt, recordConfirmation } from "../shared/settings.js";
import { validateSkipControl } from "./validator.js";

export class ActionController {
  constructor({
    storage,
    isEnabled,
    recordStatistics = () => true,
    diagnosticsEnabled = () => false,
    dispatchClick = async (candidate) => {
      candidate.click();
      return { attempted: true, method: "synthetic" };
    },
    onStatus = () => {},
    confirmationDelay = 1200,
    retryDelay = 120,
    maxAttempts = 2,
  }) {
    this.storage = storage;
    this.isEnabled = isEnabled;
    this.recordStatistics = recordStatistics;
    this.diagnosticsEnabled = diagnosticsEnabled;
    this.dispatchClick = dispatchClick;
    this.onStatus = onStatus;
    this.confirmationDelay = confirmationDelay;
    this.retryDelay = retryDelay;
    this.maxAttempts = maxAttempts;
    this.inFlight = new WeakSet();
    this.attemptCounts = new WeakMap();
    this.retryScheduled = new WeakSet();
    this.confirmed = new WeakSet();
    this.pendingTimers = new Set();
    this.destroyed = false;
  }

  async activate(
    candidate,
    player,
    document = globalThis.document,
    { detectedAt = performance.now(), reason = "direct" } = {},
  ) {
    if (this.destroyed || !this.isEnabled()) return false;
    const attempts = this.attemptCounts.get(candidate) ?? 0;
    if (
      attempts >= this.maxAttempts ||
      this.retryScheduled.has(candidate) ||
      this.inFlight.has(candidate)
    )
      return false;
    if (!validateSkipControl(candidate, player, document)) return false;

    this.inFlight.add(candidate);
    this.attemptCounts.set(candidate, attempts + 1);
    const wasAdShowing = player.classList.contains("ad-showing");
    try {
      const clickStartedAt = performance.now();
      const clickResult = await this.dispatchClick(candidate, player, document);
      const clickCompletedAt = performance.now();
      if (!clickResult?.attempted) {
        this.attemptCounts.delete(candidate);
        return false;
      }
      if (this.recordStatistics())
        await recordAttempt({ storage: this.storage });
      if (this.diagnosticsEnabled())
        console.info(
          `[AutoSkip ${new Date().toISOString()}] source=${reason} detectionLatencyMs=${Math.max(0, Math.round(clickStartedAt - detectedAt))} clickDispatchMs=${Math.max(0, Math.round(clickCompletedAt - clickStartedAt))} method=${clickResult.method}`,
        );
      this.onStatus({ type: "attempted", method: clickResult.method });
      this.confirm(candidate, player, wasAdShowing);
      this.scheduleRetry(candidate, player, document);
      return true;
    } catch (error) {
      console.warn("AutoSkip could not activate the skip control.", error);
      return false;
    } finally {
      this.inFlight.delete(candidate);
    }
  }

  scheduleRetry(candidate, player, document) {
    if ((this.attemptCounts.get(candidate) ?? 0) >= this.maxAttempts) return;

    this.retryScheduled.add(candidate);
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      this.retryScheduled.delete(candidate);
      if (this.destroyed || !this.isEnabled()) return;
      this.activate(candidate, player, document);
    }, this.retryDelay);
    this.pendingTimers.add(timer);
  }

  confirm(candidate, player, wasAdShowing) {
    const timer = setTimeout(async () => {
      this.pendingTimers.delete(timer);
      if (this.destroyed) return;

      const confirmed =
        wasAdShowing &&
        !this.confirmed.has(candidate) &&
        player.isConnected &&
        player.classList.contains("ad-showing") === false &&
        candidate.isConnected === false;
      if (!confirmed) return;
      this.confirmed.add(candidate);

      try {
        if (this.recordStatistics()) await recordConfirmation(this.storage);
        if (this.diagnosticsEnabled())
          console.info(
            `[AutoSkip ${new Date().toISOString()}] ad-end confirmed after skip click.`,
          );
        this.onStatus({ type: "confirmed" });
      } catch (error) {
        console.warn("AutoSkip could not update local statistics.", error);
      }
    }, this.confirmationDelay);
    this.pendingTimers.add(timer);
  }

  destroy() {
    this.destroyed = true;
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers.clear();
  }
}
