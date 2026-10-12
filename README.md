# Undrift

**Checks every file a coding agent writes against a React and Tailwind design system's own rules, as it is written, and says what it did not check.**

A design system's documentation states its rules and cannot enforce them, and an agent that has read every rule can still write a hex value, a hand-rolled `<button>`, an import from another UI kit or a token that does not exist. Undrift enforces the rules instead. Registered as a Claude Code `PostToolUse` hook, it checks each file the agent writes straight after the write, and returns each violation as an error that names the fix. `undrift gate` applies the same rules to a whole repository, by hand or in CI.

The contract is the files the design system already maintains: its token files and stylesheets, and its component list, read from the package's type declarations, from a folder of component source or from a `CATALOG.md`. `undrift.config.json` points at them.

## Status

Version 0.1.0. Undrift reads React and Tailwind only. The write-time hook is for Claude Code only, and `undrift gate` runs wherever Node 20 or later does. Commands, configuration and messages may change before 1.0.

## Quick start

```bash
npm i -D undrift
npx undrift init @acme/ds   # writes undrift.config.json + the <Missing> placeholder
```

`init` reads what the system and the app already have: the package's type declarations, every entry its manifest names (the component list, followed through re-exports so compound parts like `TableRow` are known), and the app's own stylesheets with everything they import (the tokens). When a reading finds nothing it says what, and writes nothing unless `--force`. For a design system that lives in a folder of the app, as shadcn's `components/ui` does:

```bash
npx undrift init --components components/ui
```

A native element the system has no component for (a `<select>` where there is no `Select`) is left out of the config, and `init` says so: "not checked by no-raw-elements". It never bans an element it has no replacement for, because that is the system's decision to make, in its own config. It also suggests the system's primitives for `primitives`, marked as a suggestion to check, and says which of the opt-in rules exist and are off.

It ends by printing how many of the app's UI files the config covers. On an app with problems already in it, `undrift later --all` puts them on the later list, so the gate fails only on new ones.

Then register the hook, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "node node_modules/undrift/hooks/undrift-hook.mjs" }
        ]
      }
    ]
  }
}
```

Add `.undrift/` to `.gitignore`: it holds attempt counters and a record of what the agent has already been told, which are scratch state. `undrift.later.json` is the opposite: it is committed (see "Older problems and the later list").

## The hook

A file that was checked and is clean produces no output, unless a notice is due (below). A violation exits 2 with the fix on stderr, which is how Claude Code hands it back to the agent.

When the hook could not check a file, it says so, as JSON on stdout that reaches the agent without blocking it: a config it cannot read, a UI file no profile covers, a stylesheet (Undrift does not check those yet), or rules that had no input to run on. Each notice is sent once for each version of `undrift.config.json`, so the agent is told and not nagged, and what was sent is recorded in `.undrift/notices.json`. A file with violations still exits 2, and any pending notice is added to that message. If the hook itself meets an error, it says so in a notice and does not throw, so a file it could not check never reads as checked.

The config that governs a file is the nearest `undrift.config.json` above it, so a package with a config of its own is checked by that one, wherever the hook is run from. The directory the hook runs from is used only when no config is found above the file.

When the repository cannot hold `.undrift/` (a read-only checkout or sandbox), the state goes to a private folder in the temporary directory instead. If that cannot be written either, nothing fails: a notice is told again and the attempt count does not move. Hooks that run at once share the record under a lock.

After three failed attempts on the same file, the hook stops asking for a fix and asks for a decision: a declared gap or an explained exemption. Enforcement never traps the agent in a loop.

## The three situations

Every case of "the design system does not have this" is one of three things, and only the third is a gap. The rule behind them: compose freely from what the system has, and never invent a primitive.

1. **The component exists.** Use it. `no-unknown-components` catches a hallucinated name, and `no-raw-elements` catches a raw `<button>` or `<input>` where the system has a component for it.
2. **It does not exist, but it composes from things that do.** Build it from existing components and tokens. That is not drift. It is the system working: a `StatCard` assembled from `Card`, `Badge` and spacing utilities passes the gate untouched.
3. **It cannot be built.** It needs a primitive or a token the system does not have. Declare it:

   ```tsx
   <Missing what="DateRangePicker" reason="single-date Calendar only, no range variant exists" />
   ```

   The placeholder `init` copies into the repository (`components/undrift-missing.tsx`) renders as a dashed, hatched box that reads `MISSING: DateRangePicker`. It holds the place of the missing piece in the layout and is too visible to ship by accident. A valid gap is a success state: the agent declined to improvise. It never fails the dev loop.

A gap is checked against the contract, so declaring one cannot be used to skip something that exists. A gap for a component that exists fails at once, in the dev loop as well as under `--strict`: `Component Button exists in @acme/ds. Use it rather than declaring a gap.` A gap with no reason fails too.

## The seven rules

Each file is parsed with the TypeScript compiler API. The evasions that a text match lets through are pinned in [`tests/conformance.test.mjs`](tests/conformance.test.mjs).

| Rule | Catches | The message names |
|---|---|---|
| `no-raw-colors` | `#4f46e5`, `rgb()`, `hsl()`, `oklch()`, a `color-mix()` with a raw colour in it, and a named colour (`crimson`) in a colour-valued style prop | the nearest token by CIEDE2000 distance, or generic token advice where there is no trustworthy one. In a layered token set, the roles built on the nearest colour, never a primitive as the fix |
| `no-arbitrary-values` | Tailwind `rounded-[8px]`, `bg-[#fff]` | the scale utility or token to use instead |
| `no-raw-elements` | a raw `<button>`, `<input>`, `<select>` or any other element the config's `intrinsics` maps to a component, also written as `React.createElement("button")` | the component that replaces it |
| `no-foreign-ui-imports` | an import from `@mui/*`, `antd` or another prefix in the config's `foreignUi` | the package UI must come from |
| `no-inline-style-values` | `style={{ borderRadius: 8, padding: "14px" }}`, longhand splits included | the token-backed utility |
| `no-unknown-tokens` | `var(--color-brand-500)` where no such token exists | that CSS fails silently here: the declaration is dropped and the element inherits |
| `no-unknown-components` | `import { Rating } from "@acme/ds"` where `Rating` does not exist | the catalog, or a gap if nothing fits |

`no-unknown-tokens` guards the silent failure: a `var()` to a token that does not exist looks right, passes every naive check and renders wrong.

What the rules leave alone matters as much, because a gate that flags correct code gets switched off:

- `no-raw-colors` passes a colour built only from tokens (`color-mix(in oklch, var(--a), var(--b) 5%)`, `oklch(from var(--primary) l c h / 0.5)`), a colour an attribute selector matches (`[stroke='#ccc']`), a value that is compared (`hex === "#ffffff"`) and a `placeholder` prop. A relative colour that computes a channel (`oklch(from var(--accent) calc(l * 0.9) c h)`) makes a shade the system does not define, and is flagged as that, with a request for a token.
- `no-raw-elements` judges an `<input>` by its type. A hidden input is never flagged, a text-like one is checked against `input`, and a checkbox or radio against `"input[type=checkbox]"` or `"input[type=radio]"` where `intrinsics` maps them.
- `no-unknown-tokens` accepts a name Tailwind 4's own theme declares (`--spacing`, but not its colours), and a name the product's own code sets (`[--gutter:20px]`, a style object's key, `setProperty`, a chart config's keys). Tailwind's theme is found through the stylesheets' imports, honours `prefix()` and `reference`, and is found even where `tokensCss` does not list the stylesheet that imports Tailwind.
- `no-unknown-components` runs only when the component list is known to be complete, which means it was resolved from the package's type declarations or from a folder of component source. Against a hand-written `CATALOG.md`, which may leave out compound parts, it stays quiet, and the gate lists it under "Not checked". It checks PascalCase imports only, because the list is made of PascalCase exports and a hook or utility (`useToast`, `cn`) can never appear in it however real the export is.

## Opt-in rules

Two more rules are known to the config and run only in a profile whose `rules` list names them. A profile with no `rules` list runs the seven above. They stay opt-in until they have been run over real systems, because a rule that misfires gets switched off.

| Rule | Catches | The message names | Needs |
|---|---|---|---|
| `no-default-palette` | a colour class from Tailwind's built-in palette (`bg-indigo-700`, `text-white`, `border-black`) in a system that declares colours of its own | the roles built on the system's own colour of that name, or the roles nearest its colour, as utilities. Where the system has switched the palette off, that the class builds nothing | a `--color-*` token in the token sources |
| `no-primitive-tokens` | a reference to a primitive: `var(--color-primitive-indigo-700)`, the Tailwind 4 shorthand `bg-(--color-primitive-indigo-700)`, and a colour utility whose token is a primitive | the roles built on that primitive (up to eight, then a count), never the primitive as the fix. Where no role is built on it, the roles nearest its colour, said to be near, or a proposal for one | `primitives` in `undrift.config.json` |

A role says what a value is for (`primary`). A primitive says which value it is (`indigo-700`). Code names the role, so a theme or a rebrand changes the palette without touching a screen.

Primitives are declared, not guessed. The token graph cannot tell a role from a palette step: a literal `--accent` that another token passes on has the same shape as a palette step such as `--blue-9`. So the design system says which tokens are its primitives, as names or as globs where `*` stands for any run of characters:

```json
"primitives": ["--color-primitive-*", "--dimension-*", "--shadow-primitive-*"]
```

The set is exactly the tokens the list names, and the aliases in Tailwind's `--color-` namespace that only rename them. Where `primitives` is absent, `no-primitive-tokens` does not run, and says so under "Not checked", with the fix. A name in the list that matches no token is listed there too, so a renamed palette cannot go undefended unnoticed. An agent may propose a change to `primitives`, never make one.

### The escape hatch

A `// token-exempt: <reason>` comment on a line suppresses the rules for that line. The reason is mandatory: a bare `// token-exempt` does nothing, because an escape hatch that asks for no explanation becomes the cheapest path to done.

Exemptions are counted and reported, in the status line and in `--format json`, because an exemption is a violation someone chose to suppress. A run with exemptions never reads as a run without any:

```
✓ on-system · 14 declarations · 3 exemptions · @acme/ds
```

## Release: `--strict`

```bash
undrift gate            # the dev loop: declared gaps pass
undrift gate --strict   # release and CI: unresolved gaps block
```

A gap must never punish the agent mid-build, and must never ship. Under `--strict` each valid gap becomes an `unresolved-gap` violation: `Unresolved gap "DateRangePicker" cannot ship. Resolve it first: add it to the system and use it, or replace it with an existing component.` The status line names it as such, once, not as both a violation and a gap:

```
✗ 1 unresolved gap · 14 declarations · @acme/ds
```

## Older problems and the later list

The hook judges only the agent's lines: the lines `git diff HEAD` shows as added or changed. A person's own uncommitted edits cannot be told apart from the agent's, so they count as the agent's. A problem on any other line was there before the agent came, so it is not the agent's to fix. The agent is told once per file per session, in a note that lists each older problem with the choices open for it, and asks the person when its task is done. Each problem has three choices:

- **Fix it**, with the fix named. Where a token is the same colour, that token. Where a token is only the nearest, that token, said not to be an exact match. Where none is close, a proposal for a new token. In a layered token set the token named is a role built on the nearest colour, never the primitive, and where no role uses that colour the note proposes a role.
- **Later**, for this problem.
- **Later, for everything old in this file.**

The agent offers them as clickable choices where it can, and asks in words where it cannot. It defers nothing without an answer.

"Later" goes on `undrift.later.json`, in the same folder as `undrift.config.json`. It is committed, so the team sees what was put off. Each entry is a file, a rule, a value and a count, with the person's reason if they gave one, and the date:

```json
{ "file": "app/page.tsx", "rule": "no-raw-colors", "value": "#333333", "count": 1, "reason": "Rebrand next quarter", "date": "2026-09-30" }
```

An entry names no line, so moving code keeps it. The count says how many occurrences it covers, so a new one is still a problem. Only the gate's rules can be deferred, the opt-in ones included where a profile turns them on. A gap on an older line is left to the gate.

`undrift later` writes the entries. It has one form for each way of naming a problem:

```bash
undrift later app/page.tsx --line 12 --rule no-raw-colors --value '#333333'   # what the note prints
undrift later app/page.tsx --rule no-raw-colors --value '#333333'             # every older occurrence in the file
undrift later app/page.tsx --line 12                                          # what is on line 12, for typing by hand
undrift later app/page.tsx                                                    # everything old in the file
undrift later --all --reason "Adopting Undrift"                               # everything, in every file
```

`--rule` and `--value` go together. Any form takes `--reason`. The note's form names the problem as well as the line, because a line can move between the note and the answer. If line 12 no longer holds it, the command defers nothing, exits 2 and names the lines that do, to be run again with one of them. It defers only older problems, never the agent's own: a problem that is now only on the agent's lines, or a line the agent wrote, is refused with exit 2. A file is judged with the rules of every profile that covers it, as the gate judges it, and a rule that none of them turns on, or that could not run (no token source, say), is refused with exit 2 as "Undrift did not look for" it, and never called gone. Running a command again adds nothing. Entries are written under a lock folder beside the list, so several `later` commands at once all keep their entries, and a lock that cannot be had in time is an error that writes nothing.

`--all` is for adopting Undrift on an app that already has problems. It defers every problem there is now, in whole files and uncommitted lines included, and is run once by a person. Otherwise the agent is asked about older problems a file at a time, as it edits each file.

`undrift gate` reads the list and never fails on it, `--strict` included, and never calls a deferred problem clean. A run with any deferred problem ends with a status line such as `⚠ 3 deferred`, and lists each under "Deferred", with its date and reason. Two further blocks appear on a run of every profile over the whole repository, and neither fails the run:

- **Out of date** lists entries the run looked for and can no longer defend: one that matches nothing now, one that covers more than the run found (with the count to lower it to), and one whose file is gone.
- **Not looked for** lists entries the run could not check, each with its reason: no profile checked the file, the profile that covers it does not turn the rule on, or the rule could not run. Such an entry is never called out of date.

A run over paths, or over one profile, defers what it can and says neither. Deleting an entry brings the problem back. A list that cannot be read stops the gate and `later`, naming what is wrong, and is never read as "nothing deferred".

When git cannot say whose a line is (no repository, no commit yet, a file git does not track, git missing or too slow), every line counts as the agent's. Judging too much is safe where judging too little would be silence. `undrift later` on such a file with `--line`, or `--rule` and `--value`, is refused with exit 2, and `undrift later <file>` says nothing is deferred and why, with exit 0. The gate judges whole files whatever git says, so nothing goes unjudged in CI.

## What was not checked

A clean result means checked and clean. Anything the gate was configured to check and could not is listed under "Not checked", each item naming the thing, the reason and the fix:

```
⚠ 3 not checked · 0 declarations · @acme/ds
```

- **A configured source that does not exist, or exists and cannot be read** (a directory, a token file with a trailing comma): `tokens`, a `tokensCss` entry, `catalog` or `componentsFrom`. The gate still runs on what could be read, and the config file is not blamed for a source's fault.
- **A rule that is on but has no input**: `no-unknown-tokens` with no tokens, `no-unknown-components` with no complete component list, `no-raw-elements` with an empty `intrinsics`, `no-foreign-ui-imports` with an empty `foreignUi`, `no-primitive-tokens` with no `primitives` declared, `no-default-palette` with no `--color-*` token.
- **A value no token can reach**, listed with its file and line and never counted as a violation: a style for `@react-pdf/renderer`, the content of a `<meta>` tag, a custom property name the code finishes at runtime (`` var(--chart-${color}) ``), an `<input>` whose type has no component mapped or is read at runtime, and a colour function around a token whose value could not be read. These are notes: they never fail `--strict`, the status line is a warning (`⚠ 1 value not checked`) and not on-system, and the hook says nothing about them.
- **Tailwind's own variables, where its theme was not read.** With a sign of Tailwind 4 and no stylesheet that imports it, a `var()` to a name Tailwind could be writing is set aside with its file and line, and never reported as an unknown token. Every other name is still checked.
- **A declared primitive that matches no token.**
- **A profile that matched no files**, or paths on the command line that matched none.
- **UI files no profile covers** (`.tsx` and `.jsx`), on whole-repository runs.
- **UI files only another profile covers**, when `--profile` ran one profile. A run of one profile is not on-system, so `--strict` with `--profile` (and no paths, where another profile has files) is a usage error, exit 2, that says to run `undrift gate --strict` with no `--profile`.
- **A directory that cannot be read** (permission denied). Whatever UI file or stylesheet is inside was not looked at, so the directory is named.
- **A symbolic link that leads outside the repository, or into a place the scan skips.** A link is not followed, so what is behind it was not checked. The item names each link and where it leads, and the fix is to include the real path in a profile, or to propose an `ignore` entry.
- **Files that are not scripts**, which a path or a profile's glob reached: Markdown, MDX, JSON, SVG. Only a script (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`) is gated, so `gate --strict README.md` is not clean.
- **Stylesheets** (`.css`, `.scss`, `.sass`, `.less`), on whole-repository runs. Undrift does not check stylesheets yet, so a value set in one is not checked against the design system's tokens.

While anything is listed, the status line is a warning and never `✓ on-system`. Normal mode still exits 0, because the dev loop never blocks on configuration. `--strict` exits 1, because a CI run that checked less than it was told to is not a pass. `--format json` adds `notChecked`, `coverage` (counts of UI files covered, excluded, ignored and not covered, and of stylesheets) and `rulesNotRun` on each run. An item that names files carries every path in the JSON, and the text lists the first ten and says how many more there are.

Two things account for a file without checking it, and both are counted on one quiet line, never hidden:

- **Excluded on purpose**: a profile's positive patterns match the file and only that profile's own `!` patterns drop it. The defaults `undrift init` writes drop tests, stories and the placeholder this way.
- **Ignored**: the file matches the `ignore` key, a map of glob to the reason it is not checked.

```json
"ignore": { "packages/legacy/**": "old screens, replaced next quarter" }
```

A blank reason is a config error, the same stance as a `<Missing>` gap with no reason. `ignore` is the way out of a "Not checked" item for a UI file no profile covers, and the only way out for a stylesheet, since no profile can cover one. It never removes a file from a profile that includes it.

An `ignore` entry is the owner's call. Every fix that names `ignore`, on the command line and in the hook's notices, says to propose the entry, with its reason, to the user and not to add one: the reader may be the agent that wrote the file, and one that writes its own entry passes strict.

## Commands

```bash
undrift init <package> | --components <folder>  [--config <dir>] [--force]
undrift gate [paths…]  [--profile <name>] [--config <path>] [--format json] [--strict]
undrift later <file> [--rule <rule> --value <value>] [--line <n>] [--reason <text>] | --all [--reason <text>]  [--config <path>]
```

`undrift init` writes `undrift.config.json` and the `<Missing>` placeholder. Files that exist are kept unless `--force` is given. When a reading finds nothing it exits 1 and writes nothing, unless `--force` is given. With `--components`, it writes a `design-system` profile for the folder, which runs `no-raw-colors`, `no-arbitrary-values` and `no-foreign-ui-imports` because components legitimately render `<button>`, and an `app` profile for the rest, with the default rules.

`undrift later` puts problems a person chose to fix later on `undrift.later.json`, and exits 2 for anything it refuses. See "Older problems and the later list".

Exit codes: 0 for clean, or a pass that has only deferred problems; 1 for violations; 2 for a usage error. Under `--strict`, 1 also means the run checked less than it was configured to.

`undrift gate <paths>`: an argument that names an existing file is gated as a literal path, even when its name is glob syntax, as in `app/(dashboard)/[id]/page.tsx`. Any other argument is a glob, and one that matches nothing is reported under "Not checked". No glob follows a symbolic link: a file is its real path, gated once where it lives, and a profile covers it by including that path. An explicit path that names a link is gated.

A glob, and every `include` and `ignore` pattern in the config, reads parentheses and brackets as syntax. A Next.js route group or dynamic route in a pattern has to be escaped with a backslash, doubled inside JSON: `"app/\\(marketing\\)/**/*.tsx"` covers the folder `app/(marketing)`, and `"app/(marketing)/**"` matches nothing at all. The fix text of every "Not checked" item and of the hook's notices that asks for a pattern says so, with the pattern to write.

## The contract

Undrift is configured by `undrift.config.json`, found at or above the folder it runs in. It points at artefacts the design system already maintains: a token JSON that maps custom property names to values (a flattened build, not a nested DTCG tree) and one or more stylesheets, a `CATALOG.md` or the package's type declarations, and optionally a folder of component source. Token sources are additive, and later sources win. [`schema.json`](schema.json) documents every key.

**Profiles** scope rules to a set of files. The `app` profile that `init` writes covers the consumer code with the default rules. With `--components`, the folder of component source is a profile of its own, `design-system`, which runs only `no-raw-colors`, `no-arbitrary-values` and `no-foreign-ui-imports`.

## From code

```js
import { loadContract, gateSource } from "undrift";

const contract = loadContract("."); // a folder to search upward from, or the path of a config file
const violations = gateSource(source, { fileName: "src/page.tsx", contract });
```

The entry exports the gate (`gateSource`, `gateSourceWithGaps`, `gateFiles`, `gatePaths`, `gateProfile`), the contract (`loadContract`, `findConfig`, `parseCatalog`), the nearest-token lookup (`tokenColorIndex`, `nearestToken`), the status line and gap notice (`statusLine`, `gapNotice`), the declaration count (`countDeclarations`, `compliance`) and the rule lists (`ALL_RULES`, `DEFAULT_RULES`). Every module is also reachable as `undrift/unstable/<path>` without the extension, for example `undrift/unstable/gate` or `undrift/unstable/readers/css-tokens`. That path is outside semantic versioning: a minor version may change it.

## What the tests cover

`npm test` runs the suite:

- a realistically implemented screen ([`tests/corpus/clean`](tests/corpus/clean)) passes with zero violations, and its deliberately drifted twin ([`tests/corpus/drift`](tests/corpus/drift)) is caught by rule, at exact counts;
- the [conformance corpus](tests/conformance.test.mjs) pins every known evasion (longhand border splits, unquoted numeric widths, named colours, `color-mix()` blends of legal tokens, arbitrary values smuggled through helper calls, `createElement` around a blocked element, reasonless exemption markers) beside the correct code that must never be flagged (`url(#fade)` id references, composed components, declared gaps);
- the hook, the CLI's exit codes and the JSON payload are tested end to end;
- the tests read a real design system, Plinth, as a frozen copy of its contract in [`tests/fixtures/plinth`](tests/fixtures/plinth).

## Limits

- **No auto-fix.** Undrift names the nearest token and the exact substitution, and the agent applies it. Nothing is rewritten behind anyone's back.
- **Gaps block release, never the dev loop.** That is deliberate, and it means a passing `undrift gate` is not the same as ready to ship. `--strict` is the check for that.
- **Enforcement is per file, on write.** The hook sees the file the agent just wrote, not the whole repository. `undrift gate` gives the repository-wide picture.
- **The hook is silent in a repository with no `undrift.config.json`,** because it cannot tell one that does not use Undrift from a broken install.
- **Stylesheets are reported, not checked.** No rule reads CSS, so a raw colour or length in a `.css`, `.scss`, `.sass` or `.less` file passes through. The gate lists each stylesheet as not checked until it is ignored with a reason, and the hook says so once when one is written.
- **Expressions the gate cannot resolve statically are not listed as not checked.** A variable passed through `cn()` or a class string built at runtime is most often harmless, and listing every one would bury the useful items.
- **Colours that are data are still flagged.** A stored default (a new label's colour), or a colour sent to an email or an iframe, cannot be told by its syntax from a style constant. `token-exempt: <reason>` on the line records it.
- **A custom property a library sets at runtime is reported as unknown** unless the product's own code sets it too. A name set by code counts wherever the code sets it, from the shape of the text, so this can only miss an unknown token, never flag a known one. A Tailwind shorthand reference (`bg-(--x)`) is not checked by `no-unknown-tokens`.
- **Nearest-token suggestions need resolvable colours.** A system that declares every colour through `var()`, `light-dark()` or `color-mix()` gives Undrift nothing to measure against, so the raw-colour message falls back to generic token advice, because a confident wrong token is worse than none.
- **The declaration count is a judgement call.** The status line counts declarations (an inline style property, or a utility class that carries a value), and `compliance` in the JSON is the share that resolved to a token. Layout-only utilities (`flex`, `items-center`) are not counted, because counting them would inflate the denominator and flatter the score.
- **Undrift ships no runtime code into the app.** The `<Missing>` placeholder is copied into the repository with zero imports. The repository owns it and can edit it freely.

## Where it comes from

Undrift is the gate of [Plinth](https://github.com/free-agent83/plinth), the reference design system for [Correct by Design](https://correctby.design/thesis.html), a standard for agent-ready design systems.

## Licence

MIT. See [`LICENSE`](LICENSE). The third-party packages Undrift depends on keep their own licences. The names Correct by Design, Undrift and Plinth are not licensed.
