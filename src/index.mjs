export { loadContract, findConfig, parseCatalog } from "./contract.mjs";
export {
  gateSource, gateSourceWithGaps, gateFiles, gatePaths, gateProfile,
  countDeclarations, compliance, ALL_RULES, DEFAULT_RULES,
} from "./gate.mjs";
export { tokenColorIndex, nearestToken } from "./nearest.mjs";
export { statusLine, gapNotice } from "./report.mjs";
// Every module is also reachable as undrift/unstable/<path>, outside semantic versioning: a minor version may change it.
// A consumer writes the path without the extension, undrift/unstable/gate or undrift/unstable/readers/css-tokens, because
// the package's exports map it to src/<path>.mjs: undrift/unstable/gate.mjs resolves to src/gate.mjs.mjs, which does not exist.
