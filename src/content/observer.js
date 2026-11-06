import { findPlayer, findSkipControl } from "./detector.js";

export class PlayerObserver {
  constructor({
    document = globalThis.document,
    onCandidate,
    onPlayerChange = () => {},
    shouldRun = () => true,
    fallbackInterval = 250,
  }) {
    this.document = document;
    this.onCandidate = onCandidate;
    this.onPlayerChange = onPlayerChange;
    this.shouldRun = shouldRun;
    this.fallbackInterval = fallbackInterval;
    this.player = null;
    this.playerObserver = null;
    this.documentObserver = null;
    this.fallbackTimer = null;
    this.scheduled = false;
    this.destroyed = false;
    this.pendingReason = "mutation";
    this.handleNavigation = () => {
      this.attachPlayer();
      this.schedule("navigation");
    };
  }

  start() {
    if (this.destroyed || this.documentObserver) return;
    this.documentObserver = new MutationObserver((records) => {
      const playerWasReplaced =
        (this.player !== null && !this.player.isConnected) ||
        records.some((record) =>
          [...record.addedNodes, ...record.removedNodes].some((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            return (
              node.id === "movie_player" ||
              node.querySelector?.("#movie_player")
            );
          }),
        );
      if (!playerWasReplaced) return;
      this.attachPlayer();
      this.schedule("player-replacement");
    });
    this.documentObserver.observe(this.document.documentElement, {
      childList: true,
      subtree: true,
    });
    this.document.addEventListener("yt-navigate-finish", this.handleNavigation);
    this.document.addEventListener(
      "yt-page-data-updated",
      this.handleNavigation,
    );
    this.attachPlayer();
    this.schedule("initial");
  }

  attachPlayer() {
    const nextPlayer = findPlayer(this.document);
    if (nextPlayer === this.player) return;

    this.playerObserver?.disconnect();
    this.playerObserver = null;
    this.player = nextPlayer;
    this.onPlayerChange(nextPlayer);

    if (nextPlayer) {
      this.playerObserver = new MutationObserver(() =>
        this.schedule("player-mutation"),
      );
      this.playerObserver.observe(nextPlayer, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "aria-hidden",
          "disabled",
          "aria-disabled",
        ],
      });
    } else {
      this.stopFallbackCheck();
    }
  }

  schedule(reason = "mutation") {
    this.pendingReason = reason;
    if (this.scheduled || this.destroyed) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.destroyed) return;
      if (!this.player?.isConnected) this.attachPlayer();
      this.checkPlayer(this.pendingReason);
    });
  }

  checkPlayer(reason) {
    const player = this.player;
    if (!player?.isConnected) {
      this.stopFallbackCheck();
      return;
    }

    if (this.shouldRun() && player.classList.contains("ad-showing")) {
      this.startFallbackCheck();
    } else {
      this.stopFallbackCheck();
    }

    const candidate = findSkipControl(player);
    if (candidate) {
      this.onCandidate(candidate, player, {
        detectedAt: performance.now(),
        reason,
      });
    }
  }

  startFallbackCheck() {
    if (this.fallbackTimer !== null) return;
    this.fallbackTimer = setInterval(() => {
      if (this.destroyed || !this.shouldRun()) {
        this.stopFallbackCheck();
        return;
      }
      if (!this.player?.isConnected) this.attachPlayer();
      if (!this.player?.classList.contains("ad-showing")) {
        this.stopFallbackCheck();
        return;
      }
      this.checkPlayer("fallback");
    }, this.fallbackInterval);
  }

  stopFallbackCheck() {
    if (this.fallbackTimer === null) return;
    clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  destroy() {
    this.destroyed = true;
    this.documentObserver?.disconnect();
    this.playerObserver?.disconnect();
    this.stopFallbackCheck();
    this.document.removeEventListener(
      "yt-navigate-finish",
      this.handleNavigation,
    );
    this.document.removeEventListener(
      "yt-page-data-updated",
      this.handleNavigation,
    );
    this.documentObserver = null;
    this.playerObserver = null;
    this.player = null;
  }
}
