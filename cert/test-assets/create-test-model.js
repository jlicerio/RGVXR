// Create a simple test model using Three.js
const createTestModel = () => {
    const geometry = new THREE.TorusKnotGeometry(0.5, 0.2, 100, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        metalness: 0.5,
        roughness: 0.5
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
};

// Export the model as GLB
const exportTestModel = async () => {
    const mesh = createTestModel();
    const exporter = new THREE.GLTFExporter();
    
    return new Promise((resolve, reject) => {
        exporter.parse(mesh, (gltf) => {
            resolve(gltf);
        }, {
            binary: true
        });
    });
}; 