# CarrouselXR — AGENTS.md

Open-source config-driven AR platform. Branded "CarrouselXR" via config.yaml platform.name.

## Architecture
- **config.yaml** is single source of truth — modules, connectors, branding
- Express server at :8080, static + API
- Connector system: GPS, image-recognition, splat (Gaussian), always (fallback)
- Gallery: model-viewer for GLB models, SparkJS 2.1.0 for Gaussian splats
- WebXR AR: hit-test placement + pinch-to-scale + drag
- Admin panel at /admin/ — submission form + review dashboard
- XR simulator at ?xr=sim — test without device

## Conventions
- Config-driven, never hardcoded. Platform name changes per deployment via config.yaml
- Connectors: enable in config.yaml → create modules/{id}/connector.js → add to public/js/platform.js
- Tailscale funnel: velobid.tailfceaca.ts.net/rgvxr/ → :8080

## Key Files
- `config.yaml` — platform config, connectors, branding
- `server.js` — Express API
- `modules/registry.js` — connector loader
- `public/js/platform.js` — client core
- `admin/index.html` — admin UI

## Pitfalls
- Don't edit HTML directly for platform behavior — use config.yaml and modules
- Gaussian splats need SparkJS, not model-viewer
