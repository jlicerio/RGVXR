/**
 * Simplified Blender AR Project API for testing
 */

const express = require('express');
const blenderRouter = express.Router();

// Basic test endpoint
blenderRouter.get('/test', (req, res) => {
    res.json({ status: 'Blender API is working' });
});

// Export the router
module.exports = blenderRouter; 