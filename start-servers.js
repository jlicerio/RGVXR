const { spawn } = require('child_process');
const path = require('path');

console.log('Starting all servers...');

// Start main server
const mainServer = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true
});

console.log('Main server starting on port 8080...');

// Wait a bit before starting debug server
setTimeout(() => {
    // Start debug server
    const debugServer = spawn('node', ['debug/server.js'], {
        stdio: 'inherit',
        shell: true
    });

    console.log('Debug server starting on port 8081...');

    // Handle debug server exit
    debugServer.on('exit', (code) => {
        console.log(`Debug server exited with code ${code}`);
        mainServer.kill();
        process.exit();
    });
}, 2000);

// Handle main server exit
mainServer.on('exit', (code) => {
    console.log(`Main server exited with code ${code}`);
    process.exit();
});

// Handle process exit
process.on('SIGINT', () => {
    console.log('Stopping servers...');
    mainServer.kill();
    process.exit();
});
