/**
 * Characterization test — pins checkUnlock GPS behavior for all GPS-gated projects.
 *
 * Tests the canonical haversine from lib/haversine.js and the GPS unlock logic
 * from modules/registry.js against known near/far coordinates for:
 *   bear, peyote, buffalo-bison-skull, direction-poles
 *
 * Run with:  node test/characterization-unlock.js
 *
 * Exit code 0 = all assertions pass.
 * Exit code 1 = at least one assertion failed.
 */
const path = require('path');
const { haversine, formatDistance } = require('../lib/haversine');
const { scanProjects } = require('../lib/project-scanner');

// ============================================================
// Test harness (zero dependencies)
// ============================================================
let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}`);
    } else {
        failed++;
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
}

function assertClose(label, actual, expected, toleranceMeters) {
    const ok = Math.abs(actual - expected) <= toleranceMeters;
    if (ok) {
        passed++;
        console.log(`  ✓ ${label}  (${actual} ≈ ${expected} ±${toleranceMeters}m)`);
    } else {
        failed++;
        console.error(`  ✗ ${label}`);
        console.error(`    expected ≈ ${expected} ±${toleranceMeters}m, got ${actual}`);
    }
}

// ============================================================
// Reproduce the server-side GPS unlock check (from modules/registry.js)
// Uses the shared haversine, same logic as the 'gps' built-in connector.
// ============================================================
function checkUnlockGPS(manifest, userLocation, defaultRadius) {
    defaultRadius = defaultRadius || 2000;
    const loc = manifest.location || (manifest.unlockMethods && manifest.unlockMethods.gps);
    if (!loc) return { unlocked: true, reason: 'no location gate' };
    if (!userLocation) return { unlocked: false, reason: 'no user location' };

    const dist = haversine(userLocation.lat, userLocation.lng, loc.lat, loc.lng);
    const radius = loc.radius || defaultRadius;
    const unlocked = dist <= radius;

    return {
        unlocked,
        reason: unlocked ? 'within radius' : 'too far',
        distance: Math.round(dist),
        radius
    };
}

// ============================================================
// GPS-gated project specs (pinned from live manifests)
// ============================================================
const GPS_PROJECTS = {
    bear: {
        lat: 25.9017, lng: -97.4975, radius: 2000,
        name: 'Brownsville, TX'
    },
    peyote: {
        lat: 26.3798, lng: -98.8203, radius: 2000,
        name: 'Rio Grande City, TX'
    },
    'buffalo-bison-skull': {
        lat: 27.5306, lng: -99.4803, radius: 2000,
        name: 'Laredo, TX'
    },
    'direction-poles': {
        lat: 26.2034, lng: -98.23, radius: 2000,
        name: 'McAllen, TX'
    }
};

// ============================================================
// Test locations
// ============================================================
const LOCATIONS = {
    // Close to each project (within 2 km)
    nearBrownsville:   { lat: 25.9017,  lng: -97.4975 },   // exact match → 0m
    nearRioGrande:     { lat: 26.38,    lng: -98.82 },      // ~37m from peyote
    nearLaredo:        { lat: 27.531,   lng: -99.48 },      // ~50m from buffalo
    nearMcAllen:       { lat: 26.204,   lng: -98.23 },      // ~67m from direction-poles
    // Far away
    austin:            { lat: 30.2672,  lng: -97.7431 },
    dallas:            { lat: 32.7767,  lng: -96.7970 },
    newYork:           { lat: 40.7128,  lng: -74.0060 },
};

// ============================================================
// 1) Haversine unit tests — pinned values
// ============================================================
console.log('\n=== CHARACTERIZATION: haversine() unit tests ===');

// Identity: same point → 0
assert('haversine same point', haversine(30, -97, 30, -97), 0);

// Known distances (pinned, rounded)
assertClose('peyote near distance',
    haversine(26.38, -98.82, 26.3798, -98.8203),
    37, 1);

assertClose('peyote → Austin',
    haversine(26.3798, -98.8203, 30.2672, -97.7431),
    444924, 1);

assertClose('bear exact → 0',
    haversine(25.9017, -97.4975, 25.9017, -97.4975),
    0, 0);

// ============================================================
// 2) formatDistance pinned values
// ============================================================
console.log('\n=== CHARACTERIZATION: formatDistance() ===');
assert('37m', formatDistance(37), '37m');
assert('999m', formatDistance(999), '999m');
assert('1000m → 1.0km', formatDistance(1000), '1.0km');
assert('2000m → 2.0km', formatDistance(2000), '2.0km');
assert('440285m → 440.3km', formatDistance(440285), '440.3km');
assert('0m', formatDistance(0), '0m');

// ============================================================
// 3) GPS unlock: all four projects × near/far
// ============================================================
console.log('\n=== CHARACTERIZATION: GPS unlock — all projects ===');

// Load live project data to verify manifests match expectations
const allProjects = scanProjects();
const gpsProjects = allProjects.filter(p => GPS_PROJECTS[p.id]);

console.log(`  Found ${gpsProjects.length} GPS-gated projects out of ${allProjects.length} total`);
assert('GPS project count', gpsProjects.length, 4);

// Verify manifest locations match pinned data
for (const p of gpsProjects) {
    const expected = GPS_PROJECTS[p.id];
    assert(`${p.id} lat`, p.location.lat, expected.lat);
    assert(`${p.id} lng`, p.location.lng, expected.lng);
    assert(`${p.id} radius`, p.location.radius, expected.radius);
}

// -- Bear --
console.log('\n  --- bear ---');
const bearManifest = { location: GPS_PROJECTS.bear };

let r = checkUnlockGPS(bearManifest, LOCATIONS.nearBrownsville);
assert('bear near (exact) → unlocked', r.unlocked, true);
assert('bear near distance', r.distance, 0);

r = checkUnlockGPS(bearManifest, LOCATIONS.austin);
assert('bear far (Austin) → locked', r.unlocked, false);
assert('bear far distance > 2000', r.distance > 2000, true);

r = checkUnlockGPS(bearManifest, null);
assert('bear no user location', r.unlocked, false);

// -- Peyote --
console.log('\n  --- peyote ---');
const peyoteManifest = { location: GPS_PROJECTS.peyote };

r = checkUnlockGPS(peyoteManifest, LOCATIONS.nearRioGrande);
assert('peyote near → unlocked', r.unlocked, true);
assert('peyote near distance', r.distance, 37);

r = checkUnlockGPS(peyoteManifest, LOCATIONS.austin);
assert('peyote far (Austin) → locked', r.unlocked, false);

r = checkUnlockGPS(peyoteManifest, LOCATIONS.newYork);
assert('peyote far (NYC) → locked', r.unlocked, false);

// -- Buffalo-Bison Skull --
console.log('\n  --- buffalo-bison-skull ---');
const buffaloManifest = { location: GPS_PROJECTS['buffalo-bison-skull'] };

r = checkUnlockGPS(buffaloManifest, LOCATIONS.nearLaredo);
assert('buffalo near → unlocked', r.unlocked, true);
assert('buffalo near distance < 100', r.distance < 100, true);

r = checkUnlockGPS(buffaloManifest, LOCATIONS.dallas);
assert('buffalo far (Dallas) → locked', r.unlocked, false);

// -- Direction Poles --
console.log('\n  --- direction-poles ---');
const polesManifest = { location: GPS_PROJECTS['direction-poles'] };

r = checkUnlockGPS(polesManifest, LOCATIONS.nearMcAllen);
assert('poles near → unlocked', r.unlocked, true);
assert('poles near distance < 100', r.distance < 100, true);

r = checkUnlockGPS(polesManifest, LOCATIONS.dallas);
assert('poles far (Dallas) → locked', r.unlocked, false);

// ============================================================
// 4) Edge: no location in manifest → always unlocked
// ============================================================
console.log('\n=== CHARACTERIZATION: no-location manifest ===');
r = checkUnlockGPS({}, LOCATIONS.austin);
assert('no location → unlocked', r.unlocked, true);
assert('no location reason', r.reason, 'no location gate');

// ============================================================
// 5) Boundary: exactly at radius
// ============================================================
console.log('\n=== CHARACTERIZATION: radius boundary ===');
// Find a point exactly at ~2000m from peyote and verify boundary
const peyoteLoc = GPS_PROJECTS.peyote;
// At ~0.018 degrees lat north → ~2000m
const boundaryLat = peyoteLoc.lat + 0.018;
const boundaryDist = haversine(boundaryLat, peyoteLoc.lng, peyoteLoc.lat, peyoteLoc.lng);
console.log(`  boundary point distance: ${Math.round(boundaryDist)}m`);
const boundaryResult = checkUnlockGPS(
    { location: peyoteLoc },
    { lat: boundaryLat, lng: peyoteLoc.lng }
);
// 0.018° ≈ 2001m, should be just over → locked
assert('boundary ~2001m → locked', boundaryResult.unlocked, false);

// ============================================================
// Summary
// ============================================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
