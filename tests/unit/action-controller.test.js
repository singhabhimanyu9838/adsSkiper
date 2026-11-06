import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionController } from "../../src/content/action-controller.js";

function makeStorage() {
  const values = {};
  return {
    values,
    async get(key) {
      return { [key]: values[key] };
    },
    async set(next) {
      Object.assign(values, next);
    },
  };
}

function setup() {
  document.body.innerHTML =
    '<div id="movie_player" class="ad-showing"><button class="ytp-ad-skip-button">Skip</button></div>';
  const player = document.querySelector("#movie_player");
  const button = player.querySelector("button");
  button.getClientRects = () => [{ width: 80, height: 30 }];
  button.getBoundingClientRect = () => ({ width: 80, height: 30 });
  button.click = vi.fn();
  const storage = makeStorage();
  return { player, button, storage };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("action controller", () => {
  it("does not duplicate actions while a retry is pending", async () => {
    const { player, button, storage } = setup();
    const controller = new ActionController({ storage, isEnabled: () => true });
    expect(await controller.activate(button, player)).toBe(true);
    expect(await controller.activate(button, player)).toBe(false);
    expect(button.click).toHaveBeenCalledTimes(1);
    expect(storage.values.autoskipStats).toEqual({ attempts: 1, confirmed: 0 });
    controller.destroy();
  });

  it("does not start overlapping clicks while debugger dispatch is pending", async () => {
    const { player, button, storage } = setup();
    let finishDispatch;
    const dispatchClick = vi.fn(
      () =>
        new Promise((resolve) => {
          finishDispatch = resolve;
        }),
    );
    const controller = new ActionController({
      storage,
      isEnabled: () => true,
      dispatchClick,
    });

    const first = controller.activate(button, player);
    const second = controller.activate(button, player);
    expect(await second).toBe(false);
    expect(dispatchClick).toHaveBeenCalledOnce();

    finishDispatch({ attempted: true, method: "browser-input" });
    expect(await first).toBe(true);
    controller.destroy();
  });

  it("retries a still-visible control once after a short cooldown", async () => {
    vi.useFakeTimers();
    const { player, button, storage } = setup();
    const controller = new ActionController({
      storage,
      isEnabled: () => true,
      confirmationDelay: 100,
    });
    await controller.activate(button, player);
    await vi.advanceTimersByTimeAsync(119);
    expect(button.click).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(button.click).toHaveBeenCalledTimes(2);
    expect(storage.values.autoskipStats).toEqual({ attempts: 2, confirmed: 0 });
    controller.destroy();
  });

  it("does not click an unrelated control", async () => {
    const { player, storage } = setup();
    const unrelated = document.createElement("button");
    player.append(unrelated);
    unrelated.click = vi.fn();
    const controller = new ActionController({ storage, isEnabled: () => true });
    expect(await controller.activate(unrelated, player)).toBe(false);
    expect(unrelated.click).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("stops immediately when disabled", async () => {
    const { player, button, storage } = setup();
    const controller = new ActionController({
      storage,
      isEnabled: () => false,
    });
    expect(await controller.activate(button, player)).toBe(false);
    expect(button.click).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("increments confirmed only when the ad state ends and control is removed", async () => {
    vi.useFakeTimers();
    const { player, button, storage } = setup();
    const controller = new ActionController({
      storage,
      isEnabled: () => true,
      confirmationDelay: 20,
    });
    await controller.activate(button, player);
    player.classList.remove("ad-showing");
    button.remove();
    await vi.advanceTimersByTimeAsync(20);
    expect(storage.values.autoskipStats).toEqual({ attempts: 1, confirmed: 1 });
    controller.destroy();
  });

  it("reports an ineffective click as an attempt, not a confirmed success", async () => {
    vi.useFakeTimers();
    const { player, button, storage } = setup();
    const controller = new ActionController({
      storage,
      isEnabled: () => true,
      confirmationDelay: 20,
    });
    await controller.activate(button, player);
    await vi.advanceTimersByTimeAsync(20);
    expect(storage.values.autoskipStats).toEqual({ attempts: 1, confirmed: 0 });
    controller.destroy();
  });

  it("logs timestamped detection and dispatch latency when diagnostics are enabled", async () => {
    const { player, button, storage } = setup();
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const controller = new ActionController({
      storage,
      isEnabled: () => true,
      diagnosticsEnabled: () => true,
      dispatchClick: async () => ({
        attempted: true,
        method: "browser-input",
      }),
    });

    await controller.activate(button, player, document, {
      detectedAt: performance.now() - 25,
      reason: "fallback",
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[AutoSkip \d{4}-\d{2}-\d{2}T[^\]]+\] source=fallback detectionLatencyMs=\d+ clickDispatchMs=\d+ method=browser-input$/,
      ),
    );
    controller.destroy();
  });
});
