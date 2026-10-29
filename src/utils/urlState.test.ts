import { describe, expect, it } from "vitest";
import {
  buildExplorationSearch,
  commitHref,
  demoHref,
  explorationHref,
  parseExplorationSearch,
} from "./urlState";

describe("parseExplorationSearch", () => {
  it("parses a complete exploration URL", () => {
    const state = parseExplorationSearch(
      new URLSearchParams(
        "demo=1&view=codebase&commit=ABCD1234&branch=feature%2Fscene&base=beef42&file=src%2Fmain.ts",
      ),
    );

    expect(state).toEqual({
      demo: true,
      view: "codebase",
      commit: "abcd1234",
      branch: "feature/scene",
      base: "beef42",
      file: "src/main.ts",
    });
  });

  it("defaults unknown views and rejects unsafe URL fields", () => {
    const state = parseExplorationSearch(
      new URLSearchParams(
        `view=timeline&commit=not-a-sha&branch=${"x".repeat(256)}&file=${"a".repeat(501)}`,
      ),
    );

    expect(state.view).toBe("history");
    expect(state.commit).toBeNull();
    expect(state.branch).toBeNull();
    expect(state.file).toBeNull();
    expect(state.demo).toBe(false);
  });

  it("preserves branch names with slashes and dots", () => {
    expect(parseExplorationSearch(new URLSearchParams("branch=release/2.0")).branch).toBe(
      "release/2.0",
    );
  });
});

describe("buildExplorationSearch", () => {
  it("updates provided fields without dropping unrelated query parameters", () => {
    const current = new URLSearchParams("view=history&demo=1&utm=readme");
    const next = buildExplorationSearch(current, {
      commit: "abc123",
      branch: "main",
      file: "src/app.tsx",
    });

    expect(next.get("view")).toBe("history");
    expect(next.get("demo")).toBe("1");
    expect(next.get("utm")).toBe("readme");
    expect(next.get("commit")).toBe("abc123");
    expect(next.get("branch")).toBe("main");
    expect(next.get("file")).toBe("src/app.tsx");
  });

  it("deletes fields explicitly set to null", () => {
    const current = new URLSearchParams("commit=abc123&base=def456&file=src%2Fmain.ts");
    const next = buildExplorationSearch(current, {
      commit: null,
      base: null,
      file: null,
    });

    expect(next.has("commit")).toBe(false);
    expect(next.has("base")).toBe(false);
    expect(next.has("file")).toBe(false);
  });
});

describe("exploration links", () => {
  it("encodes owner and repository path segments", () => {
    expect(
      explorationHref("open source", "repo#1", {
        view: "codebase",
        demo: false,
      }),
    ).toBe("/r/open%20source/repo%231?view=codebase");
  });

  it("builds commit and demo links", () => {
    expect(commitHref("acme", "rocket", "abc123", "history")).toBe(
      "/r/acme/rocket?view=history&commit=abc123",
    );
    expect(demoHref("codebase", "abc123")).toBe(
      "/r/demo/atlas-lens?view=codebase&commit=abc123&demo=1",
    );
  });
});
