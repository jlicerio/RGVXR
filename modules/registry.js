const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const registry = new Map();

function loadConfig() {
    const configPath = path.join(__dirname, "..", "config.yaml");
    const raw = fs.readFileSync(configPath, "utf8");
    return yaml.load(raw);
}

function loadBuiltin(id) {
    switch (id) {
        case "always":
            return {
                id: "always",
                name: "Always Unlocked",
                description: "Project has no unlock gate",
                init() {},
                check(manifest) {
                    return { unlocked: true, reason: "always unlocked", data: {} };
                },
                getStatus() { return { ready: true, message: "Always available" }; },
                getUISchema() { return null; }
            };
        case "webxr":
            return {
                id: "webxr",
                name: "WebXR",
                description: "WebXR / immersive 3D experience",
                init() {},
                check(manifest) {
                    return { unlocked: true, reason: "webxr experience", data: {} };
                },
                getStatus() { return { ready: true, message: "WebXR available" }; },
                getUISchema() { return null; }
            };
        default:
            return null;
    }
}

function initConnectors() {
    const config = loadConfig();
    if (!config.connectors) {
        console.warn("[connectors] No connectors section in config.yaml");
        return [];
    }
    const loaded = [];
    for (const [id, entry] of Object.entries(config.connectors)) {
        if (!entry.enabled) {
            console.log(`[connectors] ${id}: disabled, skipping`);
            continue;
        }
        try {
            const modulePath = path.join(__dirname, id, "connector.js");
            let connector;
            if (fs.existsSync(modulePath)) {
                connector = require(modulePath);
            } else {
                connector = loadBuiltin(id);
            }
            if (!connector) {
                console.warn(`[connectors] ${id}: no implementation found`);
                continue;
            }
            if (connector.init) connector.init(entry.config || {});
            registry.set(id, {
                id,
                name: entry.name || id,
                description: entry.description || "",
                icon: entry.icon || "🔌",
                connector
            });
            loaded.push(id);
            console.log(`[connectors] ${id}: loaded (${entry.name || id})`);
        } catch (err) {
            console.error(`[connectors] ${id}: failed to load`, err.message);
        }
    }
    return loaded;
}

function checkUnlock(manifest, opts = {}) {
    if (!manifest) {
        return { unlocked: false, reason: "no manifest", by: null };
    }

    // GPS is the primary gating connector
    const gpsEntry = registry.get("gps");
    if (gpsEntry && gpsEntry.connector && typeof gpsEntry.connector.check === "function") {
        try {
            const res = gpsEntry.connector.check(manifest, opts);
            if (res) {
                if (res.unlocked === false) {
                    return { unlocked: false, reason: res.reason, by: "gps", data: res.data || {} };
                }
                if (res.unlocked === true) {
                    return { unlocked: true, reason: res.reason, by: "gps", data: res.data || {} };
                }
            }
        } catch (e) {
            console.warn("[connectors] gps check error:", e.message);
        }
    }

    // No GPS gate or GPS approved → default unlocked
    return { unlocked: true, reason: "no GPS gate or gate satisfied", by: null };
}

function getConnectorsInfo() {
    const info = [];
    for (const [id, entry] of registry) {
        const c = entry.connector;
        const status = (c && c.getStatus) ? c.getStatus() : { ready: true, message: "" };
        const schema = (c && c.getUISchema) ? c.getUISchema() : null;
        info.push({
            id,
            name: entry.name,
            description: entry.description,
            icon: entry.icon,
            ready: !!status.ready,
            statusMessage: status.message || "",
            uiSchema: schema
        });
    }
    return info;
}

module.exports = {
    initConnectors,
    checkUnlock,
    getConnectorsInfo,
    registry
};
