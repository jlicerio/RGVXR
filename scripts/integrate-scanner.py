#!/usr/bin/env python3
"""
integrate-scanner.py
Integrates lib/project-scanner.js into server.js by:
  1. Adding `const { scanProjects: _scanModule } = require('./lib/project-scanner');`
     near the other top-level requires.
  2. Replacing the full inline scanProjects() definition (lines 77-143 in the
     original) with a thin delegator that calls the module version.

Usage:  python3 scripts/integrate-scanner.py        (run from project root)
"""

import re
import sys
import os

SERVER_FILE = os.path.join(os.path.dirname(__file__), '..', 'server.js')
SERVER_FILE = os.path.normpath(SERVER_FILE)

def main():
    if not os.path.isfile(SERVER_FILE):
        print(f"ERROR: {SERVER_FILE} not found. Run from project root.", file=sys.stderr)
        sys.exit(1)

    with open(SERVER_FILE, 'r', encoding='utf-8') as f:
        original = f.read()

    src = original

    # ── Step 1: Add require for project-scanner ─────────────────────────
    # Insert after the last top-level require block (after yaml require line).
    require_line = "const { scanProjects: _scanModule } = require('./lib/project-scanner');"

    if require_line in src:
        print("SKIP: project-scanner require already present.")
    elif './lib/project-scanner' in src:
        print("SKIP: project-scanner require already present (variant detected).")
    else:
        # Insert after the yaml require line
        yaml_require = "const yaml = require('js-yaml');"
        if yaml_require not in src:
            print("ERROR: Cannot find yaml require line to anchor insertion.", file=sys.stderr)
            sys.exit(1)
        src = src.replace(
            yaml_require,
            yaml_require + '\n' + require_line,
            1  # only first occurrence
        )
        print(f"OK: Added require for ./lib/project-scanner after yaml require.")

    # ── Step 2: Replace inline scanProjects() with thin delegator ───────
    # Match the entire function definition from "function scanProjects() {"
    # up to its closing brace (the one at column 0 followed by a blank line
    # or the next section comment).
    #
    # We use a regex that captures everything between the function header
    # and the closing `}` that is on its own line (not indented).
    pattern = re.compile(
        r'(// Scan projects directory for manifests\n)?'
        r'function scanProjects\(\)\s*\{.*?\n\}',
        re.DOTALL
    )

    match = pattern.search(src)
    if not match:
        # Check if already delegating
        if '_scanModule' in src and 'function scanProjects' in src:
            print("SKIP: scanProjects() already appears to delegate to _scanModule.")
        else:
            print("ERROR: Cannot locate inline scanProjects() function to replace.", file=sys.stderr)
            sys.exit(1)
    else:
        delegator = (
            "// Scan projects directory for manifests\n"
            "// Delegated to lib/project-scanner.js (behavior-preserving extraction)\n"
            "function scanProjects() {\n"
            "    return _scanModule(config);\n"
            "}"
        )
        src = src[:match.start()] + delegator + src[match.end():]
        print("OK: Replaced inline scanProjects() with delegator to _scanModule(config).")

    # ── Step 3: Write back ──────────────────────────────────────────────
    if src == original:
        print("\nNo changes were necessary — server.js is already integrated.")
        sys.exit(0)

    with open(SERVER_FILE, 'w', encoding='utf-8') as f:
        f.write(src)

    print(f"\nSUCCESS: server.js updated ({len(src)} bytes written).")
    print("Next: run verification commands (see docs).")

if __name__ == '__main__':
    main()
