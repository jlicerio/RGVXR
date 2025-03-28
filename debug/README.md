# AR Projects Debug Tools

This folder contains tools for debugging and testing the AR Projects application.

## Available Tools

### Project Scanner Test
- **File**: `project-scanner-test.js`
- **Purpose**: Tests the project scanning functionality
- **Usage**: `node debug/project-scanner-test.js`

### Carousel Test
- **File**: `carousel-test.js`
- **Purpose**: Tests the carousel navigation and functionality
- **Usage**: `node debug/carousel-test.js`

### Debug Dashboard
- **File**: `index.html`
- **Purpose**: Web interface for debugging
- **Usage**: Open `http://localhost:8080/debug` in your browser

## Running in Debug Mode

To enable debug mode, set the DEBUG environment variable:

```bash
# On Windows
set DEBUG=true
node server.js

# On macOS/Linux
DEBUG=true node server.js
```

## Available Debug Endpoints

- `/api/debug/scan` - Detailed project scanning information
- `/debug` - Debug dashboard 