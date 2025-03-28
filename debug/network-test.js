const os = require('os');
const interfaces = os.networkInterfaces();

console.log('\nAvailable Network Interfaces:');
console.log('----------------------------');

for (const name in interfaces) {
    console.log(`\nInterface: ${name}`);
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4') {
            console.log(`  IPv4: ${iface.address}`);
            console.log(`  Internal: ${iface.internal}`);
        }
    }
}

console.log('\nTo test on mobile devices:');
console.log('1. Connect your mobile device to the same WiFi network');
console.log('2. Start the server with: node server.js');
console.log('3. On your mobile device, visit one of the Network addresses shown when the server starts');
console.log('\nNote: Make sure your firewall allows incoming connections on port 8080'); 