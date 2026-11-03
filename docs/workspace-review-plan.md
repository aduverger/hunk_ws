# Workspace reviews

## Goal

Make Hunk usable from a directory containing independent Git repositories, with one
repository selector and one mounted native review UI. Preserve Hunk's existing Git,
review, history, extension, and session behavior instead of introducing a second
VCS implementation.

This document describes the complete agreed behavior. Workspace discovery and
native launch routing are implemented. The selector, retained per-repository
review contexts, and workspace session operations remain to be implemented.

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

## Next step

Extend the launch-owned workspace initialization into retained per-repository review
contexts, then wire the native Files-pane selector and session protocol against
that same owner. Keep the single-repository regression path covered throughout.
The broad feature is not complete until CLI, terminal, and agent/session behavior
satisfy the acceptance list.
