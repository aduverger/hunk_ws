# hunk_ws

This repository maintains a Hunk fork for reviewing independent Git repositories
from a workspace directory. The workspace feature is planned, not implemented.

- `origin`: https://github.com/aduverger/hunk_ws.git
- `upstream`: https://github.com/modem-dev/hunk.git
- Implementation plan: [Workspace reviews](docs/workspace-review-plan.md)

Keep native Hunk behavior and its development workflow; see [README.md](README.md),
[CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md). Maintain workspace
changes separately from upstream imports so future merges remain reviewable.

Local development does not require replacing the installed Hunk executable. Do
not publish packages or releases under upstream's identity as part of fork setup.
