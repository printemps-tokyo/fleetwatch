import { describe, expect, it } from "vitest";
import { parsePaneList, isClaudePane, projectName, paneIncluded } from "../src/tmux.js";

describe("parsePaneList", () => {
  it("parses tab-separated target/id/command/path", () => {
    const out = [
      "7:9.1\t%37\t2.1.193\t/Users/me/srv/projects/ai_cursor/p5js",
      "7:9.2\t%38\tnvim\t/Users/me/srv/projects",
      "",
    ].join("\n");
    const panes = parsePaneList(out);
    expect(panes).toHaveLength(2);
    expect(panes[0]).toEqual({
      target: "7:9.1",
      id: "%37",
      command: "2.1.193",
      path: "/Users/me/srv/projects/ai_cursor/p5js",
    });
  });
});

describe("isClaudePane", () => {
  it("matches a version-like command and rejects shells/editors", () => {
    expect(isClaudePane("2.1.193")).toBe(true);
    expect(isClaudePane("2.1.179")).toBe(true);
    expect(isClaudePane("nvim")).toBe(false);
    expect(isClaudePane("zsh")).toBe(false);
    expect(isClaudePane("node")).toBe(false);
  });

  it("honors a custom matcher", () => {
    expect(isClaudePane("node", /^node$/)).toBe(true);
  });
});

describe("projectName", () => {
  it("returns the last path segment", () => {
    expect(projectName("/Users/me/srv/projects/ai_cursor/rive")).toBe("rive");
    expect(projectName("/")).toBe("/");
  });
});

describe("paneIncluded", () => {
  const p = "/Users/me/srv/projects/ai_cursor/p5js";
  it("keeps everything with no filters", () => {
    expect(paneIncluded(p, {})).toBe(true);
  });
  it("keeps only paths matching --filter", () => {
    expect(paneIncluded(p, { filter: /ai_cursor/ })).toBe(true);
    expect(paneIncluded(p, { filter: /media-/ })).toBe(false);
  });
  it("drops paths matching --exclude", () => {
    expect(paneIncluded(p, { exclude: /p5js/ })).toBe(false);
    expect(paneIncluded(p, { exclude: /rive/ })).toBe(true);
  });
  it("applies exclude before filter", () => {
    expect(paneIncluded(p, { filter: /ai_cursor/, exclude: /p5js/ })).toBe(false);
  });
});
