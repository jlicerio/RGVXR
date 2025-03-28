const puppeteer = require('puppeteer');
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

async function runTests() {
    console.log('\n--- Carousel Tests ---');
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--use-fake-ui-for-media-stream'] // Auto-accept camera permissions
    });
    
    try {
        const page = await browser.newPage();
        
        // Test 1: Carousel navigation
        console.log('\nTest 1: Carousel Navigation');
        await page.goto(baseUrl);
        await page.waitForSelector('.controls');
        
        // Check initial state
        const initialTitle = await page.$eval('#projectTitle', el => el.textContent);
        console.log(`Initial project: ${initialTitle}`);
        
        // Click next button
        await page.click('button[onclick="nextProject()"]');
        await page.waitForTimeout(500);
        
        // Check if project changed
        const nextTitle = await page.$eval('#projectTitle', el => el.textContent);
        console.log(`After next: ${nextTitle}`);
        console.log(`Project changed: ${initialTitle !== nextTitle ? '✅ YES' : '❌ NO'}`);
        
        // Click previous button
        await page.click('button[onclick="previousProject()"]');
        await page.waitForTimeout(500);
        
        // Check if project changed back
        const prevTitle = await page.$eval('#projectTitle', el => el.textContent);
        console.log(`After previous: ${prevTitle}`);
        console.log(`Project changed back: ${prevTitle === initialTitle ? '✅ YES' : '❌ NO'}`);
        
        // Test 2: Check for camera access
        console.log('\nTest 2: Camera Access');
        const hasCamera = await page.evaluate(() => {
            return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        });
        console.log(`Camera API available: ${hasCamera ? '✅ YES' : '❌ NO'}`);
        
        // Test 3: Check for AR.js initialization
        console.log('\nTest 3: AR.js Initialization');
        const arjsInitialized = await page.evaluate(() => {
            return document.querySelector('a-scene') !== null;
        });
        console.log(`AR.js initialized: ${arjsInitialized ? '✅ YES' : '❌ NO'}`);
        
        // Test 4: Check asset loading
        console.log('\nTest 4: Asset Loading');
        const assetsLoaded = await page.evaluate(() => {
            const assets = document.querySelectorAll('a-assets');
            let loaded = true;
            assets.forEach(asset => {
                if (!asset.hasLoaded) loaded = false;
            });
            return loaded;
        });
        console.log(`Assets loaded: ${assetsLoaded ? '✅ YES' : '❌ NO'}`);
        
    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await browser.close();
    }
}

runTests().catch(console.error); 