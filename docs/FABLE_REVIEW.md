# RGVXR Fable Review (Double-Loop Audit + Multi-Altitude)
Date: 2026-07-06
Project: ~/projects/RGVXR (CarrouselXR)

## The Current Fable (Espoused Theory)
RGVXR is a clean, config-driven, modular AR experience platform.
- config.yaml is the single source of truth.
- Connectors are pluggable (GPS, image-recognition, always, splat, webxr, marker).
- Registry provides a standard interface.
- Server is lightweight Express that scans projects and serves unlock-aware APIs.
- Client platform.js uses the same connectors.
- Cultural AR experiences for Carrizo Comecrudo with location/image triggers.
- Easy to add new methods or projects.

## Observed Reality (Theory-in-Use)
- 227MB repo with 12+ backup_ directories full of old experiments.
- Large debug/ with duplicated templates and test servers.
- server.js is monolithic (400+ lines, embedded HTML, scanProjects with legacy fallbacks, submission/review all mixed).
- Connector system is partially modular: many "built-in" inside registry.js instead of separate files.
- Image-recognition connector is stubbed ("not implemented").
- Duplicated GPS logic (haversine) in server registry and client platform.js.
- No real tests.
- package.json has core modules as npm deps.
- Legacy code everywhere (metadata.json, A-Frame claims in manifests).
- Review API has TODO for auth.
- Strong cultural content in manifests, but the platform engineering has drifted into experiment graveyard.

## Altitude 3: System
The connector abstraction is the right high-level seam but not honored in implementation.
Dataflow: config.yaml → registry.init → scanProjects() + registry.checkUnlock() → client.
Coupling between server and client for unlock rules is high (duplication).
Boundaries are blurry due to monolith and cruft.
Accidental complexity: experiment graveyard + legacy fallbacks + embedded logic.
Leverage point: Treat connectors as first-class modules. Make server the source of truth for unlock. Extract concerns from server.js.

## Leverage Points & Recommendations
1. Clean graveyard (archive backups/debug after inventory) — makes the real system visible.
2. Fully honor connector seam: move built-ins to modules/<id>/connector.js.
3. Extract from server.js:
   - lib/project-scanner.js
   - lib/submission.js
   - lib/review.js
4. Add characterization tests for current scan + unlock behavior (behavior-preserving).
5. Remove duplication: single haversine/unlock evaluation.
6. Fix package.json and legacy fallbacks.
7. Later: proper auth, real asset upload, client/server contract.

First safe slice: Inventory cruft → characterization tests for scanProjects + GPS unlock → extract project-scanner as module.

This preserves published experiences while improving maintainability.
