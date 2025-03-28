const fs = require('fs');
const path = require('path');
const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter');

// Create test objects
const createTestObjects = () => {
    const group = new THREE.Group();
    
    // Add basic shapes
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x4CC3D9 })
    );
    box.position.set(0, 1.5, -3);
    group.add(box);
    
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5),
        new THREE.MeshStandardMaterial({ color: 0xEF2D5E })
    );
    sphere.position.set(-1, 1.5, -3);
    group.add(sphere);
    
    const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 1),
        new THREE.MeshStandardMaterial({ color: 0xFFC65D })
    );
    cylinder.position.set(1, 1.5, -3);
    group.add(cylinder);
    
    // Add complex object
    const torusKnot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    torusKnot.position.set(0, 0, -3);
    group.add(torusKnot);
    
    return group;
};

// Export objects to each project
const exportToProjects = async () => {
    const projects = ['webxr-basic', 'webxr-gps', 'webxr-advanced'];
    const objects = createTestObjects();
    const exporter = new GLTFExporter();
    
    for (const project of projects) {
        const assetsDir = path.join(__dirname, '../../projects', project, 'assets');
        
        // Create assets directory if it doesn't exist
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }
        
        // Export objects
        const gltf = await new Promise((resolve) => {
            exporter.parse(objects, resolve, { binary: true });
        });
        
        // Write to file
        const filePath = path.join(assetsDir, 'test-objects.glb');
        fs.writeFileSync(filePath, Buffer.from(gltf));
        console.log(`Exported test objects to ${filePath}`);
    }
};

// Run export
exportToProjects().catch(console.error); 