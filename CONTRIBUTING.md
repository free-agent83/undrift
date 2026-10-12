# Contributing

Issues and pull requests are welcome. A report is most useful with the file that was checked, the rule that fired or
should have, and the output of `undrift gate --format json`. A vulnerability is reported privately, as `SECURITY.md`
describes, and not in an issue.

This repository is built from a private working copy at each release. A change that is accepted is applied there,
credited to its author in the commit, and arrives with the next version, so it is not merged here. The pull request is
closed with a pointer to the release that carries the change.

`npm ci && npm test` runs the suite, on Node 20 or later.
