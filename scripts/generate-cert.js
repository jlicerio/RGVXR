const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function generateCertificate() {
    // Generate a new key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a new certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // Add attributes
    const attrs = [{
        name: 'commonName',
        value: 'localhost'
    }, {
        name: 'countryName',
        value: 'US'
    }, {
        shortName: 'ST',
        value: 'Virginia'
    }, {
        name: 'localityName',
        value: 'Blacksburg'
    }, {
        name: 'organizationName',
        value: 'AR Projects Dev'
    }, {
        shortName: 'OU',
        value: 'Development'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Sign the certificate
    cert.sign(keys.privateKey);
    
    // Convert to PEM format
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);
    
    // Create cert directory if it doesn't exist
    const certDir = path.join(__dirname, '..', 'cert');
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir);
    }
    
    // Save the files
    fs.writeFileSync(path.join(certDir, 'key.pem'), privateKeyPem);
    fs.writeFileSync(path.join(certDir, 'cert.pem'), certPem);
    
    console.log('Certificate generated successfully!');
}

generateCertificate(); 