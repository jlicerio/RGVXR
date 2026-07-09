# RGVXR Refactor Plan — Claude Fable (Double-Loop)
**Goal**: Make the connector abstraction real, reduce accidental complexity, preserve published cultural experiences, and create a maintainable platform.
**Approach**: Behavior-preserving slices per refactoring skill. Characterization tests first. One seam at a time. Double-loop audit after each major slice.
**Date**: 2026-07-06
**Fable Reference**: docs/FABLE_REVIEW.md

## Current State Summary (from Fable)
- Espoused: Clean config-driven modular AR platform.
- Reality: Monolithic server.js, partial connector implementation, massive cruft (backups/debug), duplication, no tests, bogus package deps, legacy fallbacks.
- Key leverage: Connector seam + extraction from server.js + cruft removal.

## Phase 0: Hygiene & Visibility (First Slice)
1. Inventory cruft and archive (do not delete until reviewed).
2. Add characterization tests for existing scanProjects() + GPS unlock behavior.
3. Extract project-scanner as a module (behavior-preserving).
4. Clean package.json (remove fs/https/os/path as deps).

## Phase 1: Honor the Connector Seam
- Move all built-in connectors to modules/<id>/connector.js.
- Implement full interface for image-recognition (or mark clearly).
- Share or centralize haversine/unlock logic.
- Update client platform.js to rely on server where possible or share contract.

## Phase 2: Extract Server Concerns
- ✅ lib/submissions.js — submit + review + review-action routes (62-pass characterization test)
- server.js: 351 → 190 lines (thin delegator via `submissions.mount(app, deps)`)
- TODO: Add admin auth seam for GET/PATCH /api/review (inherited TODO)
- Keep server.js thin.

## Phase 3: Tests, Hygiene, Polish
- Real test suite.
- Remove legacy metadata.json fallbacks.
- Fix manifests (tech stack truth).
- Add basic auth for review.

## Verification
- All existing published projects continue to work (geo unlock, model-viewer, etc.).
- `node server.js` starts cleanly.
- New characterization tests pass on current behavior.

## First Slice Details (Cruft + Characterization + Scanner Extract)

Task 1: Cruft inventory and archive
- Run: mkdir -p archive/backup archive/debug
- Move backup_* and most of debug/ into archive.
- Document what was kept and why in docs/CRUFT_INVENTORY.md
- Verify: ls projects/ still shows the 6 real ones; published experiences unaffected.

Task 2: Characterization tests for scan + unlock
- Create test/ or use mocha/jest if added, or simple node test script.
- Test scanProjects() returns the expected 6 projects with correct fields.
- Test GPS checkUnlock for known locations (e.g. Peyote coords).
- These tests must pass BEFORE any structural change.

Task 3: Extract lib/project-scanner.js
- Move scan logic to lib/project-scanner.js exporting scanProjects(config).
- Update server.js to require and use it.
- Run characterization tests to confirm identical output.

Task 4: Clean package.json
- Remove "fs", "https", "os", "path" from dependencies.
- Add "engines" and "scripts" for test if missing.

Each task: test current behavior → change → re-test → commit.

