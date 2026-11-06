import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerObserver } from "../../src/content/observer.js";
import { validateSkipControl } from "../../src/content/validator.js";

const settleMutations = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("player observer", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("handles player replacement and YouTube client navigation", async () => {
    document.body.innerHTML = '<div id="movie_player"></div>';
    const onPlayerChange = vi.fn();
    const onCandidate = vi.fn();
    const observer = new PlayerObserver({
      onCandidate,
      onPlayerChange,
    });
    observer.start();
    await settleMutations();

    const replacement = document.createElement("div");
    replacement.id = "movie_player";
    document.querySelector("#movie_player").replaceWith(replacement);
    await settleMutations();
    expect(onPlayerChange).toHaveBeenLastCalledWith(replacement);

    const candidate = document.createElement("button");
    candidate.className = "ytp-ad-skip-button";
    replacement.append(candidate);
    await settleMutations();
    const detectionsBeforeNavigation = onCandidate.mock.calls.length;
    document.dispatchEvent(new Event("yt-navigate-finish"));
    await settleMutations();
    expect(onCandidate).toHaveBeenCalledTimes(detectionsBeforeNavigation + 1);
    observer.destroy();
    expect(observer.player).toBeNull();
  });

  it("initialization and cleanup are idempotent", async () => {
    document.body.innerHTML = '<div id="movie_player"></div>';
    const observer = new PlayerObserver({ onCandidate: vi.fn() });
    observer.start();
    const mutationObserver = observer.documentObserver;
    observer.start();
    expect(observer.documentObserver).toBe(mutationObserver);
    observer.destroy();
    observer.destroy();
    await settleMutations();
    expect(observer.documentObserver).toBeNull();
  });

  it("ignores unrelated page mutations when no player is present", async () => {
    document.body.innerHTML = "<main></main>";
    const main = document.querySelector("main");
    const querySpy = vi.spyOn(document, "querySelector");
    const observer = new PlayerObserver({ onCandidate: vi.fn() });
    observer.start();
    await settleMutations();
    querySpy.mockClear();

    main.append(document.createElement("div"));
    await settleMutations();
    expect(querySpy).not.toHaveBeenCalled();
    observer.destroy();
  });

  it("reacts to class, style, and enabled-state changes without pointer events", async () => {
    document.body.innerHTML =
      '<div id="movie_player" class="ad-showing"><button class="unrelated" disabled hidden>Skip</button></div>';
    const player = document.querySelector("#movie_player");
    const button = player.querySelector("button");
    button.getClientRects = () => [{ width: 80, height: 30 }];
    button.getBoundingClientRect = () => ({ width: 80, height: 30 });
    const validCandidates = vi.fn();
    const observer = new PlayerObserver({
      onCandidate: (candidate, currentPlayer) => {
        if (validateSkipControl(candidate, currentPlayer)) {
          validCandidates(candidate);
        }
      },
    });
    observer.start();
    await settleMutations();

    button.className = "ytp-ad-skip-button-modern";
    button.style.visibility = "visible";
    button.disabled = false;
    button.hidden = false;
    await settleMutations();

    expect(validCandidates).toHaveBeenCalledWith(button);
    observer.destroy();
  });

  it("catches a CSS-only visibility change while the mouse is stationary", async () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<div id="movie_player" class="ad-showing"><button class="ytp-ad-skip-button-modern">Skip</button></div>';
    const player = document.querySelector("#movie_player");
    const button = player.querySelector("button");
    let visible = false;
    button.getClientRects = () => (visible ? [{ width: 80, height: 30 }] : []);
    button.getBoundingClientRect = () => ({ width: 80, height: 30 });
    const validCandidates = vi.fn();
    const observer = new PlayerObserver({
      fallbackInterval: 50,
      onCandidate: (candidate, currentPlayer) => {
        if (validateSkipControl(candidate, currentPlayer)) {
          validCandidates(candidate);
        }
      },
    });
    observer.start();
    await settleMutations();
    expect(validCandidates).not.toHaveBeenCalled();

    visible = true;
    await vi.advanceTimersByTimeAsync(50);
    expect(validCandidates).toHaveBeenCalledWith(button);
    observer.destroy();
  });
});
