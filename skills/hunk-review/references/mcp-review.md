# Hunk MCP review flow

Hunk MCP is a local-only loopback daemon that brokers commands to one or more live Hunk review sessions.

## Daemon model

- Normal Hunk sessions auto-start and register with the daemon when MCP is enabled.
- Manual startup is available via:

```bash
hunk mcp serve
```

- Disable MCP registration for one Hunk session with:

```bash
HUNK_MCP_DISABLE=1 hunk diff
```

## Current tool surface

The review-oriented MCP tools are:
- `list_sessions`
- `get_session`
- `get_selected_context`
- `navigate_to_hunk`
- `comment`

## Recommended agent flow

### 1. Discover the target session

Call `list_sessions` first.

If no session exists but the user wants interactive review, launch Hunk (`hunk diff`, `hunk show`, or the source entrypoint in this repo), then come back and call `list_sessions` again.

Use `sessionId` explicitly whenever more than one live session exists.

### 2. Inspect current focus

Call `get_selected_context` to see:
- current file
- current hunk index
- selected hunk old/new ranges
- whether agent notes are visible
- live comment count

This is the best way to respect what the human reviewer is already looking at.

### 3. Move only when needed

If the current focus is wrong, call `navigate_to_hunk` with either:
- `hunkIndex`, or
- `side` + `line`

Prefer hunk-level movement over adding broader remote-control actions.

### 4. Leave inline review notes

Call `comment` with:
- `sessionId`
- `filePath`
- `side`
- `line`
- `summary`
- optional `rationale`
- optional `author`
- usually `reveal: true`

Use concise review comments tied to actual diff lines.

## Practical guidance for Pi

- Prefer MCP tools over scraping terminal text when a live Hunk session already exists.
- Use `get_session` when you need broad session metadata; use `get_selected_context` for fast focus-aware checks.
- In multi-session setups, never assume the sole-session fallback is still safe after new windows open.
- Keep comments review-oriented rather than conversational.
- If the user wants silent inspection rather than visible interaction, avoid unnecessary navigation and only comment when asked.
