import { findPlayer, findSkipControl } from "./detector.js";

export class PlayerObserver {
  constructor({
    document = globalThis.document,
    onCandidate,
    onPlayerChange = () => {},
  }) {
    this.document = document;
    this.onCandidate = onCandidate;
    this.onPlayerChange = onPlayerChange;
    this.player = null;
    this.playerObserver = null;
    this.documentObserver = null;
    this.scheduled = false;
    this.destroyed = false;
    this.handleNavigation = () => this.schedule();
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
      this.schedule();
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
    this.schedule();
  }

  attachPlayer() {
    const nextPlayer = findPlayer(this.document);
    if (nextPlayer === this.player) return;

    this.playerObserver?.disconnect();
    this.playerObserver = null;
    this.player = nextPlayer;
    this.onPlayerChange(nextPlayer);

    if (nextPlayer) {
      this.playerObserver = new MutationObserver(() => this.schedule());
      this.playerObserver.observe(nextPlayer, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  }

  schedule() {
    if (this.scheduled || this.destroyed) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.destroyed) return;
      this.attachPlayer();
      const candidate = findSkipControl(this.player);
      if (candidate) this.onCandidate(candidate, this.player);
    });
  }

  destroy() {
    this.destroyed = true;
    this.documentObserver?.disconnect();
    this.playerObserver?.disconnect();
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
