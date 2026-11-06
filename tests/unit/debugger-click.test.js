import { describe, expect, it, vi } from "vitest";
import {
  dispatchTrustedClick,
  isTrustedClickRequestAllowed,
} from "../../src/background/index.js";

const sender = {
  frameId: 0,
  url: "https://www.youtube.com/watch?v=fixture",
  tab: { id: 17, url: "https://www.youtube.com/watch?v=fixture" },
};

function makeDebuggerApi(hitIsSkipControl = true) {
  return {
    attach: vi.fn(async () => {}),
    detach: vi.fn(async () => {}),
    sendCommand: vi.fn(async (_target, method) => {
      if (method === "Runtime.evaluate") {
        return { result: { value: hitIsSkipControl } };
      }
      return {};
    }),
  };
}

describe("trusted browser click boundary", () => {
  it("only accepts top-level messages from www.youtube.com", () => {
    const message = {
      type: "AUTOSKIP_TRUSTED_SKIP_CLICK",
      x: 100,
      y: 200,
    };
    expect(isTrustedClickRequestAllowed(message, sender)).toBe(true);
    expect(
      isTrustedClickRequestAllowed(message, {
        ...sender,
        frameId: 2,
      }),
    ).toBe(false);
    expect(
      isTrustedClickRequestAllowed(message, {
        ...sender,
        url: "https://example.com/",
      }),
    ).toBe(false);
  });

  it("dispatches one mouse click and always detaches", async () => {
    const debuggerApi = makeDebuggerApi();
    const clicked = await dispatchTrustedClick(
      {
        type: "AUTOSKIP_TRUSTED_SKIP_CLICK",
        x: 100,
        y: 200,
      },
      sender,
      debuggerApi,
    );

    expect(clicked).toBe(true);
    expect(debuggerApi.attach).toHaveBeenCalledWith({ tabId: 17 }, "1.3");
    expect(debuggerApi.sendCommand.mock.calls.map((call) => call[1])).toEqual([
      "Runtime.evaluate",
      "Input.dispatchMouseEvent",
      "Input.dispatchMouseEvent",
    ]);
    expect(debuggerApi.detach).toHaveBeenCalledWith({ tabId: 17 });
  });

  it("does not click coordinates that are not on a recognized control", async () => {
    const debuggerApi = makeDebuggerApi(false);
    const clicked = await dispatchTrustedClick(
      {
        type: "AUTOSKIP_TRUSTED_SKIP_CLICK",
        x: 100,
        y: 200,
      },
      sender,
      debuggerApi,
    );

    expect(clicked).toBe(false);
    expect(debuggerApi.sendCommand).toHaveBeenCalledTimes(1);
    expect(debuggerApi.detach).toHaveBeenCalledOnce();
  });
});
