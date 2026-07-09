/**
 * Haversine distance — shared between server (modules/registry.js) and tests.
 *
 * Canonical source for GPS-distance math used by the RGVXR platform.
 * The client (public/js/platform.js) keeps an inline copy because it runs
 * in the browser as an IIFE — see the comment there.
 *
 * DO NOT change the math without updating public/js/platform.js to match.
 *
 * @param {number} lat1  Latitude of point 1 (degrees)
 * @param {number} lng1  Longitude of point 1 (degrees)
 * @param {number} lat2  Latitude of point 2 (degrees)
 * @param {number} lng2  Longitude of point 2 (degrees)
 * @returns {number}     Great-circle distance in meters
 */
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a distance in meters to a human-readable string.
 * @param {number} m  Distance in meters
 * @returns {string}  e.g. "450m" or "12.3km"
 */
function formatDistance(m) {
    if (m < 1000) return Math.round(m) + 'm';
    return (m / 1000).toFixed(1) + 'km';
}

module.exports = { haversine, formatDistance };
