const fs = require('fs');
const path = require('path');

// Create log entry
const logEntry = `
# WebXR Camera Passthrough Fix - Log Entry
Date: ${new Date().toISOString()}

## Issue
The main application carousel was being overridden by WebXR test files, causing the index.html to display test links instead of the AR project carousel.

## Root Cause
Test files were being served from the root directory, and the index.html file was replaced with a WebXR test links page.

## Solution Steps
1. Completely replaced the index.html file with the proper carousel interface
2. Separated test files from the main application by moving them to the debug directory
3. Created separate servers:
   - Main server (port 8080) for the carousel and AR projects
   - Debug server (port 8081) for tests and development tools
4. Added blocking middleware to prevent test files from being served by the main server

## Technical Details
- WebXR camera passthrough requires:
  - Setting renderer to use alpha: true
  - Setting clear color alpha to 0
  - Using appropriate WebXR features (local-floor, camera-access)
  - Adding a camera-passthrough component to handle transparency

## Code Changes
1. Updated server.js to block test-related paths
2. Created separate debug server on port 8081
3. Restored carousel interface in index.html
4. Implemented camera passthrough component in shared/webxr-components.js
5. Updated AR project templates with proper camera configuration

## Lessons Learned
1. Keep test files separate from production code
2. Use different ports for different purposes
3. Maintain backups of critical files
4. Add middleware to block unwanted paths
5. Configure servers to serve only what they should

## Going Forward
To prevent similar issues:
1. Always run tests on the debug server (port 8081)
2. Keep the main application server (port 8080) clean
3. Use the debug directory for all testing and development tools
4. Maintain backups of critical files like index.html
`;

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Write to log file
const logFile = path.join(logDir, 'fix-log.md');
fs.appendFileSync(logFile, logEntry);

console.log(`Log entry added to ${logFile}`);

// Also create a README in the debug directory
const debugReadme = `# Debug Tools and Tests

This directory contains tools and tests for development and debugging purposes.

## WebXR Tests
- Basic Camera Test: Simple test with minimal configuration
- Explicit Passthrough Test: Test with explicit camera-access feature
- Browser-Specific Test: Test with browser detection and feature checking

## How to Use
1. Run the debug server: \`npm run debug-server\`
2. Access the debug dashboard at: https://localhost:8081

## Important Notes
- The debug server runs on port 8081
- The main application runs on port 8080
- Do not move test files to the root directory
- Always use the debug server for testing

## Camera Passthrough Solution
The WebXR camera passthrough requires:
- Setting renderer to use alpha: true
- Setting clear color alpha to 0
- Using appropriate WebXR features (local-floor, camera-access)
- Adding a camera-passthrough component to handle transparency

See \`../docs/webxr-camera-solution.md\` for complete documentation.
`;

const debugReadmePath = path.join(__dirname, 'README.md');
fs.writeFileSync(debugReadmePath, debugReadme);

console.log(`Debug README created at ${debugReadmePath}`); 