const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

// First, install the node-forge package
if (!fs.existsSync(path.join(__dirname, '..', 'node_modules', 'node-forge'))) {
    console.log('Installing required package (node-forge)...');
    require('child_process').execSync('npm install node-forge', { stdio: 'inherit' });
}

const certDir = path.join(__dirname, '..', 'cert');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

// Create cert directory if it doesn't exist
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

console.log('Generating self-signed certificate...');

try {
    // Generate a new key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a new certificate
    const cert = forge.pki.createCertificate();
    
    // Setup certificate details
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // Add subject and issuer details
    const attrs = [{
        name: 'commonName',
        value: 'AR Projects Local'
    }, {
        name: 'countryName',
        value: 'US'
    }, {
        shortName: 'ST',
        value: 'Test State'
    }, {
        name: 'localityName',
        value: 'Test Locality'
    }, {
        name: 'organizationName',
        value: 'Test Org'
    }, {
        shortName: 'OU',
        value: 'Test OU'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    // Convert to PEM format
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = forge.pki.certificateToPem(cert);
    
    // Save the files
    fs.writeFileSync(keyPath, privateKeyPem);
    fs.writeFileSync(certPath, certificatePem);
    
    console.log('\n✅ Certificate generated successfully!');
    console.log('\nCertificate files:');
    console.log(`- Private key: ${keyPath}`);
    console.log(`- Certificate: ${certPath}`);
    
    console.log('\nImportant steps for testing on mobile:');
    console.log('1. On Android Chrome:');
    console.log('   - Type chrome://flags in the address bar');
    console.log('   - Search for "insecure origins"');
    console.log('   - Enable "Insecure origins treated as secure"');
    console.log('   - Add your local IP address (e.g., https://192.168.1.100:8080)');
    console.log('   - Restart Chrome');
    console.log('\n2. On iOS Safari:');
    console.log('   - When prompted, tap "Show Details" and "Visit Website"');
    console.log('   - Go to Settings > General > About > Certificate Trust Settings');
    console.log('   - Enable full trust for the certificate');
    
} catch (error) {
    console.error('Error generating certificate:', error);
    process.exit(1);
} 