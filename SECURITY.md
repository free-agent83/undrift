# Security

## Reporting a vulnerability

A vulnerability is reported privately, through GitHub's private vulnerability reporting: the Security tab of this
repository, then "Report a vulnerability". A public issue is the wrong place for one. Undrift is maintained by one
person, so no response time is promised, and a report is read as soon as it can be.

## Why a version should be pinned

The write-time hook runs on every file a coding agent writes, with the permissions of the shell that started the
agent. A compromised release of Undrift would run there.

Version 0.1.0 was published from the maintainer's machine, with two-factor authentication and without npm provenance,
so npm holds no provenance statement for that version. Later releases are published from GitHub Actions with npm
provenance, which links the package on npm to the commit and the workflow that built it.

A project that installs Undrift should pin an exact version (`"undrift": "0.1.0"`, not `"^0.1.0"`) and update on
purpose.

## The advisory that `npm install` reports

Installing Undrift reports 3 high severity vulnerabilities. They are one chain, and the chain has no fixed version
anywhere:

- `fast-glob` 3.3.3 finds files for the gate. It is the latest release, and it depends on `micromatch` 4.0.8.
- `micromatch` 4.0.8 is the latest release, and it depends on `braces` 3.0.3.
- Every release of `braces` up to 3.0.3, the latest, is in
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): a deeply nested pattern exhausts the stack.

The advisory needs a hostile pattern, and the patterns Undrift gives `fast-glob` are the ones in a person's own
`undrift.config.json` and on the command line. The worst case is a crash, or a slow run, on a pattern that person
wrote. `fast-glob` is to be replaced in a later version, and this section goes with it.

## Development dependencies

When 0.1.0 was built, `npm audit` reported 5 vulnerabilities: the 3 high above and 2 moderate, no critical.

The 2 moderate are one advisory, [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), in `vitest`
and `@vitest/mocker`, fixed from `vitest` 4.1.11. `vitest` runs the tests and is not installed with Undrift. The tests
move to a newer major later.

`package.json` overrides `tinypool` to `^2.1.2`. Without the override, `vitest` 3 resolves `tinypool` 1.1.1, which has 2
critical advisories (prototype pollution in worker options, leading to remote code execution). With it, `npm audit`
reports no critical advisory.

## How this is checked

CI runs `npm audit --audit-level=critical` on every push and pull request, as an advisory job: it reports and does not
block. The threshold is `critical` because the high advisories above are known and explained, and a job that is always
red is a job nobody reads. A critical advisory is something new, and someone should look.
