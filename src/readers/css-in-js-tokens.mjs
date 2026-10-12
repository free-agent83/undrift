// Custom properties declared inside JavaScript or TypeScript template
// literals: Lit's css``, styled-components' createGlobalStyle``, or a plain
// exported string of CSS. The declarations are ordinary CSS once the backticks
// are removed, so this reader finds every template literal in the source and
// hands its body to the same CSS reader every stylesheet goes through. No
// parser, no framework knowledge: a backtick-delimited run of text that
// contains `--name: value` is the whole signal.
//
// `${...}` interpolations are blanked before reading so a value that is
// itself an expression (`--x: ${theme.x}`) is recorded as declared with an
// opaque value rather than dropped or mis-split.
import { readCssTokens } from "./css-tokens.mjs";

const TEMPLATE_LITERAL_RE = /`(?:[^`\\]|\\.)*`/g;
const INTERPOLATION_RE = /\$\{[^}]*\}/g;

/** @returns {Record<string,string>} token name → declared value (last wins) */
export function readCssInJsTokens(source) {
  const tokens = {};
  for (const m of source.matchAll(TEMPLATE_LITERAL_RE)) {
    const body = m[0].slice(1, -1).replace(INTERPOLATION_RE, "(expr)");
    if (!body.includes("--")) continue;
    Object.assign(tokens, readCssTokens(body));
  }
  return tokens;
}

/** Path conventions for "this file authors tokens", by segment or stem. The
 *  same convention-by-filename posture as `*.tokens.json` and `*.stylex.ts`:
 *  a file called theme.ts, tokens.ts, variables.ts or palette.ts, or any
 *  file under a theme/, tokens/ or styles/ directory. Deliberately not
 *  "every source file": a 12,000-file product would credit every
 *  component's local scratch variable as a token. */
const AUTHORING_RE = /(^|\/)(theme|themes|tokens?|design-tokens|variables|vars|palette|colou?rs?|globals?|foundations?|styles?)([./-]|$)|\.(globals?|theme|tokens?|vars?|variables)\.[cm]?[jt]sx?$/i;
export function looksLikeTokenAuthoringFile(relPath) {
  return AUTHORING_RE.test(relPath);
}
