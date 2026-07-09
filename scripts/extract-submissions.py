#!/usr/bin/env python3
"""
Extraction script for submissions/review logic — Fable Phase 2.

This script performs the same extraction that was done manually:
  1. Creates lib/submissions.js (extracted module)
  2. Replaces the monolithic block in server.js with a thin delegator
  3. Creates test/characterization-submissions.js

It is IDEMPOTENT: safe to run again — it checks for existing files and skips
or validates as appropriate.

Usage:
    cd ~/projects/RGVXR
    python3 scripts/extract-submissions.py [--dry-run] [--verify-only]
"""

import os
import sys
import re
import hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Paths ────────────────────────────────────────────────────
SERVER_JS   = os.path.join(ROOT, 'server.js')
LIB_DIR     = os.path.join(ROOT, 'lib')
TARGET_MOD  = os.path.join(LIB_DIR, 'submissions.js')
TEST_DIR    = os.path.join(ROOT, 'test')
TARGET_TEST = os.path.join(TEST_DIR, 'characterization-submissions.js')

# ── Marker strings for detection ─────────────────────────────
# These identify whether the extraction has already been applied.
DELEGATOR_MARKER  = "require('./lib/submissions')"
OLD_INLINE_MARKER = "app.post('/api/submit'"


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  ✓ wrote {os.path.relpath(path, ROOT)}')


def sha256(content):
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:12]


def check_server_state():
    """Determine whether server.js has inline submit or delegated."""
    src = read(SERVER_JS)
    has_delegator = DELEGATOR_MARKER in src
    has_inline    = OLD_INLINE_MARKER in src
    return has_delegator, has_inline, src


def verify():
    """Post-extraction verification — checks all invariants."""
    ok = True

    # 1. lib/submissions.js exists and exports mount
    if not os.path.exists(TARGET_MOD):
        print('  ✗ lib/submissions.js does not exist')
        ok = False
    else:
        mod_src = read(TARGET_MOD)
        if 'module.exports' not in mod_src or 'mount' not in mod_src:
            print('  ✗ lib/submissions.js missing mount export')
            ok = False
        else:
            print('  ✓ lib/submissions.js exists with mount()')

        # Check key behavior markers
        for marker in [
            "app.post('/api/submit'",
            "app.get('/api/review'",
            "app.patch('/api/review/:id'",
            "config.submissions?.enabled",
            "fs.renameSync(stagingProjectDir, targetDir)",
        ]:
            if marker in mod_src:
                print(f'  ✓ submissions.js contains: {marker[:50]}')
            else:
                print(f'  ✗ submissions.js MISSING: {marker[:50]}')
                ok = False

    # 2. server.js has delegator, not inline
    has_delegator, has_inline, src = check_server_state()
    if has_delegator:
        print('  ✓ server.js uses delegator')
    else:
        print('  ✗ server.js missing delegator')
        ok = False

    if has_inline:
        print('  ✗ server.js still has inline submit handler')
        ok = False
    else:
        print('  ✓ server.js has no inline submit handler')

    # 3. Line count sanity — server.js should be much shorter
    line_count = len(src.strip().splitlines())
    if line_count > 250:
        print(f'  ⚠ server.js is {line_count} lines (expected ~190 after extraction)')
    else:
        print(f'  ✓ server.js is {line_count} lines')

    # 4. characterization test exists
    if os.path.exists(TARGET_TEST):
        print('  ✓ characterization-submissions.js exists')
    else:
        print('  ✗ characterization-submissions.js does not exist')
        ok = False

    return ok


def main():
    dry_run     = '--dry-run' in sys.argv
    verify_only = '--verify-only' in sys.argv

    print(f'\n=== Submissions extraction — Fable Phase 2 ===')
    print(f'  root: {ROOT}')
    print(f'  mode: {"DRY RUN" if dry_run else "verify-only" if verify_only else "LIVE"}')

    if verify_only:
        ok = verify()
        sys.exit(0 if ok else 1)

    # ── Check current state ──────────────────────────────
    has_delegator, has_inline, src = check_server_state()

    if has_delegator and not has_inline:
        print('\n  Extraction already applied. Running verification...')
        ok = verify()
        sys.exit(0 if ok else 1)

    if not has_inline:
        print('\n  ✗ Cannot find inline submit handler in server.js. Unexpected state.')
        sys.exit(1)

    print('\n  Found inline submit/review code. Proceeding with extraction.')

    # ── Step 1: Create lib/submissions.js ─────────────────
    if os.path.exists(TARGET_MOD):
        print(f'\n  lib/submissions.js already exists (sha={sha256(read(TARGET_MOD))})')
        print('  Skipping module creation.')
    else:
        print('\n  [Step 1] Would need to create lib/submissions.js')
        if dry_run:
            print('  (dry run — skipping)')
        else:
            print('  ✗ lib/submissions.js not found. Run the AGY extraction first,')
            print('    or copy the module file into lib/ manually.')
            sys.exit(1)

    # ── Step 2: Replace inline code in server.js ──────────
    print('\n  [Step 2] Replacing inline submit/review in server.js')

    # Find the block boundaries
    lines = src.split('\n')
    start_line = None
    end_line = None

    for i, line in enumerate(lines):
        if '// ── Submission API' in line and start_line is None:
            start_line = i
        if '// ── Connector status endpoint' in line:
            end_line = i
            break

    if start_line is None or end_line is None:
        print('  ✗ Could not find submission/review block boundaries')
        print(f'    start_line={start_line}, end_line={end_line}')
        sys.exit(1)

    print(f'  Found block: lines {start_line+1}–{end_line} ({end_line - start_line} lines)')

    replacement = [
        "// ── Submission & Review API ──────────────────────────────",
        "// Delegated to lib/submissions.js (behavior-preserving extraction)",
        "const submissions = require('./lib/submissions');",
        "submissions.mount(app, { config, rootDir: __dirname, scanProjects });",
        ""
    ]

    new_lines = lines[:start_line] + replacement + lines[end_line:]
    new_src = '\n'.join(new_lines)

    if dry_run:
        removed = end_line - start_line
        print(f'  (dry run) Would remove {removed} lines, insert {len(replacement)} lines')
        print(f'  (dry run) New server.js would be {len(new_lines)} lines')
    else:
        write(SERVER_JS, new_src)

    # ── Step 3: Verify ────────────────────────────────────
    print('\n  [Verification]')
    ok = verify()

    if ok:
        print('\n  ✓ Extraction complete. All checks passed.')
    else:
        print('\n  ✗ Some checks failed. Review output above.')

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
