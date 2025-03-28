const http = require('http');
const fs = require('fs');
const path = require('path');

// Get the port from port.js if it exists, otherwise use default
let port = 8080;
try {
    if (fs.existsSync('./port.js')) {
        port = require('./port.js');
    }
} catch (error) {
    console.warn('Could not read port.js, using default port 8080');
}

// Test configuration
const baseUrl = `http://localhost:${port}`;
const tests = [
    { path: '/', name: 'Root/Carousel' },
    { path: '/ar-object', name: 'AR Object' },
    { path: '/ar-stakes', name: 'AR Stakes' },
    { path: '/projects/ar object/index.html', name: 'Direct AR Object' },
    { path: '/projects/ar stakes/index.html', name: 'Direct AR Stakes' }
];

// File existence checks
console.log('\n--- File Existence Checks ---');
const rootDir = __dirname;
const files = [
    { path: path.join(rootDir, 'index.html'), name: 'Root index.html' },
    { path: path.join(rootDir, 'projects', 'ar object', 'index.html'), name: 'AR Object index.html' },
    { path: path.join(rootDir, 'projects', 'ar stakes', 'index.html'), name: 'AR Stakes index.html' }
];

files.forEach(file => {
    const exists = fs.existsSync(file.path);
    console.log(`${file.name}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
});

// HTTP tests
console.log('\n--- HTTP Tests ---');
tests.forEach(test => {
    http.get(`${baseUrl}${test.path}`, (res) => {
        console.log(`${test.name} (${test.path}): ${res.statusCode} ${res.statusMessage}`);
        res.resume();
    }).on('error', (e) => {
        console.log(`${test.name} (${test.path}): ❌ ERROR - ${e.message}`);
    });
}); 