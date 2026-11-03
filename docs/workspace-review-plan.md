# Workspace reviews

## Goal

Make Hunk usable from a directory containing independent Git repositories, with one
repository selector and one mounted native review UI. Preserve Hunk's existing Git,
review, history, extension, and session behavior instead of introducing a second
VCS implementation.

This document describes the complete agreed behavior. Workspace discovery, native
launch routing, the repository selector, and retained per-repository review contexts
are implemented. Workspace-aware session targeting, grouped exports, and reload-all
operations remain to be implemented; native session commands are not workspace-aware yet.

## Agreed behavior

### Launch and discovery

- Preserve normal behavior when the launch directory belongs to a repository,
  including a subdirectory of a checkout. A normal review failure is not a reason
  to fall back to workspace discovery.
- When there is no repository at the launch location, inspect immediate child
  directories only. Ignore non-repositories. One child repository is sufficient.
- The original launch directory is the workspace root for the window's lifetime.
- Discover repositories independently of whether they have changes.
- Apply the original repository command, comparison, and options unchanged to the
  selected repository. Do not invent branch defaults, fetch missing refs, or
  silently substitute comparisons.
- Fail normally if no eligible repository exists or the initial review cannot load.

### Repository selector

- Put a dropdown above the existing Files tree. Do not replace or duplicate that tree.
- Offer the workspace's discovered repositories; render one repository at a time.
- Provide mouse and keyboard access and a View-menu visibility toggle.
- Load reviews on demand, not speculatively in the background.
- Keep notes and repository review state separate when switching repositories.
- Unmount the previous repository's expensive UI rather than maintaining hidden
  windows or hidden diff renderers.
- If a switch fails, show the error and leave the previous repository displayed.

### Workspace sessions

- A workspace window has one stable session identity and multiple repository review
  contexts. Only one context is presented in the terminal at a time.
- `hunk session review --workspace <path>` returns all repository reviews grouped
  by repository. Load missing reviews on demand when this command needs them.
- Preserve the existing meanings of `--include-patch`, `--include-notes`, and
  `--json` within each repository's review export.
- If any repository cannot load, fail the whole workspace review request. Do not
  return a successful partial export or silently omit that repository.
- `hunk session reload --workspace <path>` reloads all repository reviews. Report a
  failed command if any repository fails; never claim an atomic rollback unless
  the implementation actually stages and commits all replacements together.
- Navigation and comment creation use an explicit repository target. Navigation
  to a different repository also switches the visible repository.
- Preserve explicit session IDs for ambiguity when multiple windows match a target.
- Do not add workspace-wide destructive comment operations.
- Keep identical relative file paths, note identities, and review generations in
  different repositories isolated.

### Command scope

- Support workspace launch for `diff`, `show`, and `log`, and the relevant session
  operations above.
- Reuse native history routing for `log`; do not introduce another history browser.
- Keep configuration, extensions, daemon management, file/patch input, and other
  unrelated commands unchanged.
- Preserve ordinary single-repository behavior and other native VCS behavior.

## Recommended implementation

### 1. Reuse application routing and native providers

Trace `main.tsx -> app/startup.ts -> app/cli.ts`, the extension/config bootstrap,
`app/sessionBootstrap.ts`, and `app/historyBootstrap.ts` before changing launch
behavior. Add workspace discovery at the application boundary, after normal
repository discovery fails and before preparing a repository-backed route.

Keep Git detection and Git operations with their existing domain owners in the
bundled provider. Do not introduce an extension backend, synthetic prefixed patches,
or a wrapper that catches arbitrary command errors and retries another repository.

### 2. Own repository contexts above the mounted UI

Use the cross-route lifetime already owned by `ui/session/HunkSessionHost.tsx`.
Retain repository review data and semantic state independently of mounted React
surfaces. Extend the existing review store, source loaders, reload serialization,
and route preparation rather than creating parallel note or diff models.

Keep workspace identity, selected repository, and repository contexts distinct.
Only the active context should own live terminal rendering and active UI-specific
subscriptions. Reuse existing refresh and source-cache semantics; add no background
preloading or independent polling mechanism.

Extend the native Files pane, command table, and `ui/lib/appMenus.ts` for the
selector and its visibility command. Preserve existing file navigation behavior.

### 3. Extend the existing session protocol

Trace `app/session/registration.ts`, `ui/hooks/useHunkSessionBridge.ts`,
`session/agent/{surface,commands,cliClient}.ts`, and broker selection/publication.
Represent workspace membership explicitly while preserving one authoritative
review state per repository and one stable window identity.

Route repository-targeted operations to the corresponding context. Workspace review
exports must use native review projections, not independently reconstructed patches
or UI scraping. Validate workspace/session/repository combinations and preserve
existing authentication and ambiguity errors.

Update the session wire version and fixture whenever the registered or published
contract changes. Update generated CLI documentation and review skills from their
source definitions, not by hand.

### 4. Safety and lifecycle

- Validate actual repository roots, including worktrees whose `.git` is a file.
- Skip directory symlinks during workspace discovery; validate resolved containment.
- Keep Git invocation argument-based; treat filenames literally in mutation paths.
- Bind explicit `--extension` paths and file-backed `--agent-context` paths to the
  original launch directory before selecting a child. Preserve stdin's `-` sentinel
  and keep Git pathspecs repository-relative.
- Preserve existing repository-local configuration and extension trust boundaries.
  Switching repositories must not implicitly trust another repository's extensions.
- Serialize switches, reloads, and exports through existing lifecycle owners. A
  stale load must not replace a newer selected review.
- Reuse existing file size limits, source readers, cancellation, and reload errors.
- Do not change credential handling, remote fetching, network exposure, or install
  behavior for this feature.

## Acceptance and validation

Use disposable real Git repositories for discovery, ref resolution, and comparison
checks, and existing review fixtures for semantic state and protocol behavior.

- A normal repository and a subdirectory preserve native behavior without discovery.
- A workspace with one or several repositories works; ordinary folders are ignored.
- Discovery stays at depth one, handles worktrees, and skips directory symlinks.
- A comparison such as `origin/main...HEAD` reaches the native provider unchanged.
- Startup fails for an invalid comparison or a workspace without repositories.
- Switching changes the repository, Files tree, source context, and native review
  together. Notes and selections do not leak between identical paths in two repos.
- A failed switch retains the previous review. Rapid switches and reloads cannot
  publish stale results.
- Workspace review loads unopened repositories and exports all reviews; an invalid
  ref in one repository fails the request.
- Repository-specific comments reach only the target repository. Navigation also
  switches the displayed repository.
- Workspace reload updates all repository contexts and reports failures honestly.
- The selector and View toggle work with keyboard and mouse.
- There is only one mounted review UI; inactive repositories have no hidden diff
  renderer or separate terminal window.
- Native `show` and `log` routing work from a workspace, including returning from
  a commit review to the correct repository's history.
- Ordinary session targeting, patch input, other VCS providers, and unrelated CLI
  commands retain their behavior.

Run the affected colocated tests and black-box CLI tests, then the repository's
standard typecheck, formatting, lint, dependency-boundary, and unit checks. Run the
review-conformance and session/broker suites for semantic/protocol changes, including
Node broker conformance. Run PTY integration and TTY smoke checks for the selector,
switching, and history routing. Document any unavailable environment prerequisites.

## Non-goals

No combined multi-repository diff stream, custom Git backend, hidden UI instances,
background preloading, automatic fetches, recursive workspace scanning, automatic
branch substitution, new persistent review database, or workspace-wide destructive
comment operations.

## Decision ledger

Defaults below were not individually specified by the user, ordered least-confident
first. Keep this section current as implementation reveals additional choices.

1. Noninteractive output: `diff`, `show`, and `log` use the same first repository as
   initial interactive launch. If asking were free, ask whether a separate combined
   static-output command is useful; it is not added here.
2. Initial selection: choose the first eligible repository alphabetically. If asking
   were free, ask whether a preferred or remembered repository is needed. Do not add
   preference persistence without an actual requirement.
3. Workspace reload failure: fail the request, without promising rollback of reviews
   already reloaded. If asking were free, ask whether all-or-nothing rollback matters;
   it is not part of the approved behavior and should not add transaction machinery.
4. Refresh: preserve native snapshot and refresh semantics for loaded reviews; loading
   an unopened repository computes its first review at that time. If asking were
   free, ask whether a workspace-wide Git snapshot is needed. Do not create one.
5. Detection: let the complete extension-aware VCS catalog recognize the launch
   directory before scanning children. Retire the provisional workspace-root
   extensions before bootstrapping the selected child with its own configuration
   and trust checks; do not borrow another repository's extension authority.
6. Discovery safety: recognize Git worktrees and skip directory symlinks, rather than
   silently reading or changing repositories outside the launch workspace.
7. Fork setup: preserve the existing `hunk_ws` initial commit and `origin`, add Hunk as
   `upstream`, and import upstream history on a local feature branch. Do not push,
   publish releases, replace the installed executable, or change global config.
8. Ancestry repair: connect the original, already-imported upstream tip with a
   snapshot-preserving merge rather than rewriting published fork commits. If
   asking were free, ask whether replacing the published history is preferred;
   preserving it avoids breaking existing PRs and checkouts. Use ordinary merges
   for later upstream updates and retain the repair's merge parents when landing it.

## Selector implementation decisions

Choices for the terminal slice, ordered least-confident first:

1. Keep native Files-pane visibility rules, including `--no-sidebar` and automatic
   hiding. The selector appears above the tree when that pane is visible; use
   `--sidebar` to force it open. Repository selection remains available in View.
   If asking were free, ask whether workspace launches should override automatic
   pane visibility; explicit launch options are not overridden here.
2. Ignore another selection while a switch is preparing instead of queueing it or
   cancelling the first load. This prevents stale publication without adding a
   competing scheduler. If asking were free, ask whether last-request-wins matters.
3. In history, use the existing blank row below the menu for the selector because
   there is no Files tree. Keep graph geometry unchanged and show switch errors on
   the native status line. If asking were free, ask whether another placement is preferred.
4. Keep the committed theme window-wide, like native history routing, while retaining
   review view preferences separately per repository. Neither choice introduces
   additional preference persistence.
5. Reuse a loaded review until native refresh is requested; do not reload it merely
   because it becomes visible. Keep only its semantic store, bootstrap, and extension
   owner, not hidden renderers. Validate its directory again before restoring it so
   a removed checkout or directory symlink cannot redirect a cached context.
6. Give the new commands no default shortcut to avoid taking existing bindings.
   `hunk.view.selectRepository` and `hunk.view.toggleRepositorySelector` remain
   public, remappable native commands, enabled only with workspace controls. They
   share the native select dialog's mouse and keyboard behavior.
7. Reject a switch while filesystem writes are pending; drain existing reloads and
   block new writes/reloads during preparation. Failed loads release that gate and
   leave the old review and notes usable. Retire retained repository extension
   owners and history cursors when the window closes, not on every switch.

## Selector validation

- `bun run test`: 5,196 passed, 40 skipped in the final full run. Earlier runs hit
  an intermittent GC-retention assertion (also reproduced on clean `main`) and a
  session-test teardown `EPIPE`; targeted reruns and the final full run passed.
- `bun run test:integration`: 289 passed, one macOS-only case skipped; includes
  five real-Git workspace selector tests for notes, failed/retried loads, redirected
  cached paths, history selection, revision show, and repeated requests during startup.
- `bun run test:tty-smoke`: 11 passed, including a real terminal multi-file diff.
- `bun test ./test/review-conformance`: 118 passed.
- `bun run test:session-broker-node`: four passed.
- Typecheck, lint, formatting, dependency boundaries, and the unchanged session wire
  fixture passed. No registered or published wire fields changed in this slice.
- Verified from source on Linux arm64. macOS and Windows remain unverified; optional
  JJ/Sapling and compiled-binary cases were skipped. The installed binary was not replaced.

## Next step

Extend the existing broker/session protocol against the retained repository owner:
explicit workspace membership and targeting, grouped review export with on-demand
loading, reload-all failures, wire fixtures, and generated agent documentation.
Keep the single-repository regression path covered throughout.
The broad feature is not complete until CLI, terminal, and agent/session behavior
satisfy the acceptance list.
