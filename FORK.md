# hunks

This repository maintains a Hunk fork for reviewing independent Git repositories
from a workspace directory. Workspace launch for `diff`, `show`, and `log` is
implemented: outside an existing repository, Hunk selects the first immediate
child Git repository alphabetically and uses its native command handling.
Ordinary folders and directory symlinks are ignored; Git worktrees are supported.
Noninteractive output also uses that first repository, not a combined diff.

A repository selector above the native Files tree switches reviews on demand and
retains independent notes and review state. Use `--sidebar` when native automatic
pane visibility hides the tree; View offers repository selection and a selector
visibility toggle. History uses a selector below its menu and retains each repository's
graph selection. A failed switch keeps the previous review visible.

Workspace-aware session operations are not implemented yet: existing session commands
do not export or reload every repository or accept explicit workspace targets.
The full behavior and acceptance criteria are recorded in the implementation plan below.

- `origin`: https://github.com/aduverger/hunks.git
- `upstream`: https://github.com/modem-dev/hunk.git
- Implementation plan: [Workspace reviews](docs/workspace-review-plan.md)

Keep native Hunk behavior and its development workflow; see [README.md](README.md),
[CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md). Maintain workspace
changes separately from upstream imports so future merges remain reviewable.

## Upstream updates

The fork retains original upstream ancestry through a one-time merge connecting the
already-imported upstream snapshot to this repository's published history. That
repair preserves the existing source tree instead of replaying or replacing commits.
Land the repair with a merge commit or fast-forward, not a squash or rebase that
would discard its upstream parent.

For subsequent updates, use normal merges:

```bash
git fetch upstream main
git merge upstream/main
```

Resolve conflicts in fork-modified files normally. Do not use the `ours` merge
strategy for updates: it was only appropriate for connecting the snapshot already
present here and would discard new upstream changes. Do not rebase the imported
upstream history onto this repository's independent initial commit.

Local development does not require replacing the installed Hunk executable. Do
not publish packages or releases under upstream's identity as part of fork setup.
