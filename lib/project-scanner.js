const fs = require("fs");
const path = require("path");

function scanProjects(config = {}) {
  const projectsDir = path.join(__dirname, "..", config.projects?.path || "./projects");
  const projects = [];
  if (!fs.existsSync(projectsDir)) return projects;

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const projectPath = path.join(projectsDir, entry.name);
    const manifestPath = path.join(projectPath, "manifest.json");
    const assetsDir = path.join(projectPath, "assets");
    const modelFile = assetsDir && fs.existsSync(path.join(assetsDir, "asset.glb")) ? "asset.glb" : null;

    let manifest = null;
    let hasManifest = false;

    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        hasManifest = true;
      } catch (e) {
        console.warn(`Invalid manifest in ${entry.name}:`, e.message);
      }
    }

    if (!manifest) {
      const metaPath = path.join(projectPath, "metadata.json");
      if (fs.existsSync(metaPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          manifest.id = manifest.id || entry.name.toLowerCase().replace(/\s+/g, "-");
        } catch (e) {}
      }
    }

    const project = {
      id: manifest?.id || entry.name.toLowerCase().replace(/\s+/g, "-"),
      directory: entry.name,
      title: manifest?.title || entry.name,
      description: manifest?.description || "",
      author: manifest?.author || "",
      version: manifest?.version || "1.0.0",
      technologies: manifest?.technologies || [],
      instructions: manifest?.instructions || [],
      status: manifest?.status || "published",
      visibility: manifest?.visibility || "public",
      unlockMethods: manifest?.unlockMethods || {},
      location: manifest?.location || null,
      license: manifest?.license || (config.projects?.defaults?.license || "CC-BY-4.0"),
      submitted: manifest?.submitted || null,
      reviewedBy: manifest?.reviewedBy || null,
      hasModel: !!modelFile,
      hasManifest,
      path: `/projects/${encodeURIComponent(entry.name)}/index.html`,
      assetsPath: `/projects/${encodeURIComponent(entry.name)}/assets`
    };
    projects.push(project);
  }
  return projects;
}

module.exports = { scanProjects };
