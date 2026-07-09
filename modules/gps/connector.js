const { haversine, formatDistance } = require("../../lib/haversine");

module.exports = {
    id: "gps",
    name: "GPS / Location",
    description: "Unlock projects when the user is within a radius of the project location",

    init(config) {
        this.defaultRadius = config?.defaultRadius || 2000;
    },

    check(manifest, opts) {
        const loc = manifest.location || manifest.unlockMethods?.gps;
        if (!loc) {
            return { unlocked: true, reason: "no GPS gate", data: {} };
        }

        const userLoc = opts?.userLocation;
        if (!userLoc) {
            return { unlocked: false, reason: "user location not provided", data: {} };
        }

        const dist = haversine(userLoc.lat, userLoc.lng, loc.lat, loc.lng);
        const radius = loc.radius || this.defaultRadius;
        const unlocked = dist <= radius;

        return {
            unlocked,
            reason: unlocked 
                ? `within range (${formatDistance(dist)} / ${formatDistance(radius)})`
                : `${formatDistance(dist)} away (limit: ${formatDistance(radius)})`,
            data: { distance: Math.round(dist), radius }
        };
    },

    getStatus() {
        return { ready: true, message: "GPS geo-fence active" };
    },

    getUISchema() {
        return {
            type: "object",
            properties: {
                lat: { type: "number", title: "Latitude" },
                lng: { type: "number", title: "Longitude" },
                radius: { type: "number", title: "Radius (meters)", default: 2000 }
            }
        };
    }
};
