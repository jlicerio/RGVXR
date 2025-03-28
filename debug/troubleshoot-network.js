const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// HTTPS configuration
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '..', 'cert', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'cert', 'cert.pem'))
};

// Create a simple test server
const server = https.createServer(httpsOptions, (req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('AR Projects Gallery Network Test - OK (HTTPS)');
});

// Test different ports and interfaces
const testPorts = [8080, 3000, 8000];
let currentPort = 0;

function tryPort() {
    const port = testPorts[currentPort];
    
    server.listen(port, '0.0.0.0', () => {
        const interfaces = os.networkInterfaces();
        console.log(`\nServer test successful on port ${port}!`);
        console.log('\nAccessible at:');
        
        for (const name in interfaces) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`http://${iface.address}:${port}`);
                }
            }
        }
        
        console.log('\nTry these URLs on your mobile device');
        process.exit(0);
    });
    
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying next port...`);
            currentPort++;
            if (currentPort < testPorts.length) {
                tryPort();
            } else {
                console.log('No available ports found. Try manually specifying a different port.');
                process.exit(1);
            }
        }
    });
}

console.log('Testing network access...');
tryPort(); 