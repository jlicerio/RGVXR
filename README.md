# RGVXR — Modular AR Experience Platform

Open-source, config-driven AR gallery platform. Supports geo-fenced, image-recognition, and marker-based AR experiences with a web-based submission and review system.

## Architecture

```
config.yaml              ←── Single source of truth
     │
modules/registry.js      ←── Connector loader (GPS, image-recog, markers, etc.)
     │
server.js                ←── Express API + static serving
     │
├── /api/projects        ←── Project CRUD with unlock checks
├── /api/submit          ←── Community submissions
├── /api/review          ←── Approval queue
├── /api/config          ←── Public platform config
└── /api/connectors      ←── Active connector status
     │
admin/index.html         ←── Web UI: submission form, review dashboard
     │
public/js/platform.js    ←── Client core: connector loading, carousel, geo-fence
     │
index.html               ←── AR gallery (model-viewer + platform.js)
     │
projects/{id}/
  ├── manifest.json      ←── Project metadata + unlockMethods
  ├── assets/asset.glb   ←── 3D model
  ├── index.html         ←── Standalone viewer
  └── index-ar.html      ←── Legacy AR.js viewer
```

## Quick Start

```bash
git clone https://github.com/jlicerio/RGVXR.git
cd RGVXR
npm install
npm start
```

Open http://localhost:8080

## Configuration

Everything is driven by `config.yaml`:

```yaml
connectors:
  gps:
    enabled: true           # Geo-fence unlock
  image-recognition:
    enabled: true           # MindAR image tracking
  always:
    enabled: true           # Fallback (no restrictions)
  marker-ar:
    enabled: false          # AR.js markers (legacy)
```

## Connector System

Connectors are pluggable modules that provide unlock methods for projects. Each connector implements:

```js
{
  init(config)           // One-time setup from config.yaml
  check(manifest, opts)  // Returns { unlocked, reason, data }
  getStatus()            // Returns { ready, message }
  getUISchema()          // Returns JSON Schema for admin form
}
```

### Built-in Connectors

| Connector | Status | Description |
|-----------|--------|-------------|
| `gps` | 🟢 active | Unlock projects when user is within GPS radius |
| `always` | 🟢 active | No restrictions — always available |
| `image-recognition` | 🟢 active | Unlock by scanning a target image (MindAR) |
| `marker-ar` | 🔴 planned | Unlock with printed AR markers (AR.js) |
| `webxr` | 🔴 planned | Surface placement via WebXR hit-test |

### Adding a Connector

1. Enable in `config.yaml` connectors section
2. Create `modules/{id}/connector.js` implementing the interface
3. Add client-side counterpart in `public/js/platform.js` under `clientConnectors`

## Project Manifest

Each project has a `manifest.json`:

```json
{
  "id": "peyote",
  "title": "Carrizo Comecrudo Peyote Cactus",
  "description": "...",
  "author": "AR Projects Team",
  "status": "published",
  "visibility": "public",
  "unlockMethods": {
    "gps": {
      "lat": 26.3798,
      "lng": -98.8203,
      "radius": 2000,
      "name": "Rio Grande City, TX"
    }
  },
  "technologies": ["model-viewer", "WebXR"],
  "license": "CC-BY-4.0"
}
```

### Status Workflow

```
draft → review → published
              ↘ rejected
```

## Submission & Review

**Submit:** `POST /api/submit` or use `/admin/` web UI

**Review:** `/admin/` → Review Queue tab → Approve/Reject

**Publish:** Approved projects automatically move from `_staging/` to `projects/`

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List published projects |
| `/api/projects?lat=X&lng=Y` | GET | Projects with unlock status for location |
| `/api/projects/:id` | GET | Single project detail |
| `/api/submit` | POST | Submit new project for review |
| `/api/review` | GET | List projects awaiting review |
| `/api/review/:id` | PATCH | Approve/reject (`{action:"approve"}`) |
| `/api/config` | GET | Public platform configuration |
| `/api/connectors` | GET | Active connector status |
| `/health` | GET | Server health check |

## Deploying

```bash
# Production (use process manager)
npm install -g pm2
pm2 start server.js --name rgvxr

# With Tailscale Funnel (public URL)
tailscale funnel --bg --set-path /rgvxr/ http://127.0.0.1:8080
```

## Technologies

- **[model-viewer](https://modelviewer.dev)** (Google) — 3D rendering + WebXR AR
- **[MindAR](https://github.com/hiukim/mind-ar-js)** — Image tracking
- **[A-Frame](https://aframe.io)** — Legacy AR.js support
- **Express** — API server
- **js-yaml** — Config parsing

## Contributing

1. Fork the repo
2. Enable the connectors you want in `config.yaml`
3. Add projects via `/admin/` or by creating `projects/{id}/manifest.json`
4. To add a new connector type: create `modules/{id}/connector.js`
5. Submit a PR!

## License

MIT — see [LICENSE](LICENSE)
