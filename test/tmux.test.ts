import { describe, expect, it } from "vitest";
import { parsePaneList, isClaudePane, projectName } from "../src/tmux.js";

describe("parsePaneList", () => {
  it("parses tab-separated target/command/path", () => {
    const out = [
      "7:9.1\t2.1.193\t/Users/me/srv/projects/ai_cursor/p5js",
      "7:9.2\tnvim\t/Users/me/srv/projects",
      "",
    ].join("\n");
    const panes = parsePaneList(out);
    expect(panes).toHaveLength(2);
    expect(panes[0]).toEqual({ target: "7:9.1", command: "2.1.193", path: "/Users/me/srv/projects/ai_cursor/p5js" });
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
