import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerObserver } from "../../src/content/observer.js";

const settleMutations = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("player observer", () => {
  afterEach(() => {
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
});
