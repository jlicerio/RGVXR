/**
 * Characterization test — pins current scanProjects() + unlock behavior.
 * Must produce identical output before and after any refactor.
 * Run with: node test/characterization-scan.js
 */
const { scanProjects } = require("../lib/project-scanner");

// Minimal haversine (same logic as before)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkUnlock(project, opts = {}) {
  const loc = project.location || (project.unlockMethods && project.unlockMethods.gps);
  if (!loc) return { unlocked: true, reason: "no location gate" };
  if (!opts.userLocation) return { unlocked: false, reason: "no user location" };
  const dist = haversine(opts.userLocation.lat, opts.userLocation.lng, loc.lat, loc.lng);
  const radius = loc.radius || 1000;
  const unlocked = dist <= radius;
  return { unlocked, reason: unlocked ? "within radius" : "too far", distance: Math.round(dist) };
}

console.log("=== CHARACTERIZATION: scanProjects ===");
const projects = scanProjects();
console.log("Total projects:", projects.length);
projects.forEach(p => {
  console.log(` - ${p.id} | ${p.title} | status=${p.status} | hasLocation=${!!p.location}`);
});

console.log("\n=== CHARACTERIZATION: GPS unlock (example near Peyote area) ===");
const peyote = projects.find(p => /peyote/i.test(p.title) || /peyote/i.test(p.id));
if (peyote) {
  console.log("Peyote location:", peyote.location);
  const near = checkUnlock(peyote, { userLocation: { lat: 26.38, lng: -98.82 } });
  console.log("Near (26.38, -98.82):", near);
  const far = checkUnlock(peyote, { userLocation: { lat: 30.0, lng: -97.0 } });
  console.log("Far (30, -97):", far);
} else {
  console.log("No Peyote-like project found for test.");
}

console.log("\n=== Characterization complete ===");
