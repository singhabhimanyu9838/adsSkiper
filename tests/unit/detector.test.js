import { beforeEach, describe, expect, it } from "vitest";
import {
  findSkipControl,
  isAdSkipFallback,
} from "../../src/content/detector.js";
import { validateSkipControl } from "../../src/content/validator.js";

function makeVisible(element) {
  element.getClientRects = () => [{ width: 80, height: 30 }];
  element.getBoundingClientRect = () => ({ width: 80, height: 30 });
}

describe("skip-control detection and validation", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="movie_player" class="ad-showing"></div>';
  });

  it("detects a visible enabled known skip button inside the player", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML =
      '<button class="ytp-ad-skip-button-modern">Skip</button>';
    const button = player.querySelector("button");
    makeVisible(button);

    expect(findSkipControl(player)).toBe(button);
    expect(validateSkipControl(button, player)).toBe(true);
  });

  it("chooses a nested interactive control inside a known YouTube skip wrapper", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML =
      '<div class="ytp-ad-skip-button-slot"><button>Skip</button></div>';
    const button = player.querySelector("button");
    makeVisible(button);

    expect(findSkipControl(player)).toBe(button);
    expect(validateSkipControl(button, player)).toBe(true);
  });

  it("recognizes the class-marked YouTube control without a button tag", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML = '<div class="ytp-ad-skip-button-modern">Skip</div>';
    const control = player.firstElementChild;
    makeVisible(control);

    expect(findSkipControl(player)).toBe(control);
    expect(validateSkipControl(control, player)).toBe(true);
  });

  it("validates a nested button when the modern skip class is on its wrapper", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML =
      '<div class="ytp-ad-skip-button-modern"><button>Skip</button></div>';
    const button = player.querySelector("button");
    makeVisible(button);

    expect(findSkipControl(player)).toBe(button);
    expect(validateSkipControl(button, player)).toBe(true);
  });

  it("recognizes one exact Skip button in the lower-right of an active ad player", () => {
    const player = document.querySelector("#movie_player");
    player.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 400,
      bottom: 225,
      width: 400,
      height: 225,
    });
    player.innerHTML = "<button>Skip</button>";
    const button = player.querySelector("button");
    button.getClientRects = () => [{ width: 70, height: 30 }];
    button.getBoundingClientRect = () => ({
      left: 310,
      top: 180,
      right: 380,
      bottom: 210,
      width: 70,
      height: 30,
    });

    expect(findSkipControl(player)).toBe(button);
    expect(validateSkipControl(button, player)).toBe(true);
  });

  it("does not use the classless Skip fallback outside the ad skip corner", () => {
    const player = document.querySelector("#movie_player");
    player.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 400,
      bottom: 225,
      width: 400,
      height: 225,
    });
    player.innerHTML = "<button>Skip</button>";
    const button = player.querySelector("button");
    button.getClientRects = () => [{ width: 70, height: 30 }];
    button.getBoundingClientRect = () => ({
      left: 30,
      top: 30,
      right: 100,
      bottom: 60,
      width: 70,
      height: 30,
    });

    expect(findSkipControl(player)).toBeNull();
    expect(isAdSkipFallback(button, player)).toBe(false);
  });

  it("does not use the classless Skip fallback when the player is not showing an ad", () => {
    const player = document.querySelector("#movie_player");
    player.classList.remove("ad-showing");
    player.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 400,
      bottom: 225,
      width: 400,
      height: 225,
    });
    player.innerHTML = "<button>Skip</button>";
    const button = player.querySelector("button");
    button.getClientRects = () => [{ width: 70, height: 30 }];
    button.getBoundingClientRect = () => ({
      left: 310,
      top: 180,
      right: 380,
      bottom: 210,
      width: 70,
      height: 30,
    });

    expect(findSkipControl(player)).toBeNull();
  });

  it("returns no candidate when no known selector matches", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML = "<button>Skip ad</button>";
    expect(findSkipControl(player)).toBeNull();
  });

  it("ignores hidden controls", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML = '<button class="ytp-ad-skip-button">Skip</button>';
    const button = player.querySelector("button");
    expect(validateSkipControl(button, player)).toBe(false);
  });

  it("ignores disabled controls", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML =
      '<button disabled class="ytp-ad-skip-button">Skip</button>';
    const button = player.querySelector("button");
    makeVisible(button);
    expect(validateSkipControl(button, player)).toBe(false);
  });

  it("ignores recognized controls outside the current player", () => {
    document.body.innerHTML +=
      '<button class="ytp-ad-skip-button">Skip</button>';
    const player = document.querySelector("#movie_player");
    const outsideButton = document.querySelector("body > button");
    makeVisible(outsideButton);
    expect(validateSkipControl(outsideButton, player)).toBe(false);
  });

  it("rejects stale detached candidates", () => {
    const player = document.querySelector("#movie_player");
    player.innerHTML = '<button class="ytp-ad-skip-button">Skip</button>';
    const button = player.querySelector("button");
    makeVisible(button);
    button.remove();
    expect(validateSkipControl(button, player)).toBe(false);
  });
});
