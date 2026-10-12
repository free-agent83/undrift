// tests/readers/css-tokens.test.mjs
import { expect, test } from "vitest";
import { readCssTokens } from "../../src/readers/css-tokens.mjs";

test("extracts custom properties from formatted CSS", () => {
  const css = `:root {\n  --color-primary: #3b5bdb;\n  --space-4: 1rem;\n}`;
  expect(readCssTokens(css)).toEqual({
    "--color-primary": "#3b5bdb",
    "--space-4": "1rem",
  });
});

test("extracts from minified CSS (no line anchors)", () => {
  const css = `:root{--a:1px;--b:red}[data-theme=dark]{--a:2px}`;
  const tokens = readCssTokens(css);
  expect(tokens["--b"]).toBe("red");
  expect(Object.keys(tokens)).toContain("--a");
});

test("ignores var() references, keeps declarations", () => {
  const css = `:root{--x:blue;--y:var(--x)}`;
  const tokens = readCssTokens(css);
  expect(tokens["--y"]).toBe("var(--x)");
  expect(Object.keys(tokens)).toHaveLength(2);
});

test("returns empty object for CSS with no custom properties", () => {
  expect(readCssTokens(`.a{color:red}`)).toEqual({});
});
