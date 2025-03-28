# WebXR Camera Passthrough Solution

## Problem
The AR projects were showing a black background instead of the camera feed in WebXR mode.

## Solution
The key to making the camera visible in WebXR AR mode is:

1. Setting the renderer to use alpha
2. Setting the clear color alpha to 0
3. Using the appropriate WebXR features

## Implementation

### Scene Configuration
```html
<a-scene 
    webxr="requiredFeatures: local-floor, camera-access; 
           optionalFeatures: dom-overlay, unbounded;"
    renderer="alpha: true;
             colorManagement: true;
             antialias: true;
             precision: high;">
    
    <!-- Camera with passthrough component -->
    <a-camera camera-passthrough></a-camera>
    
    <!-- Your AR content here -->
</a-scene>
```

### Camera Passthrough Component
```javascript
// Camera passthrough component
AFRAME.registerComponent('camera-passthrough', {
    init: function() {
        const sceneEl = this.el.sceneEl;
        
        // Set transparent background when scene loads
        sceneEl.addEventListener('loaded', () => {
            if (sceneEl.renderer) {
                console.log('Setting renderer to transparent');
                sceneEl.renderer.setClearColor('#000', 0);
                sceneEl.renderer.setClearAlpha(0);
            }
        });
        
        // Log session info when entering AR
        sceneEl.addEventListener('enter-vr', () => {
            console.log('Entering VR/AR mode');
            console.log('Is AR mode:', sceneEl.is('ar-mode'));
            
            const session = sceneEl.xrSession;
            if (session) {
                console.log('Session mode:', session.mode);
                console.log('Environment blend mode:', session.environmentBlendMode);
            }
        });
    }
});
```

### CSS Styles
```css
body { 
    margin: 0;
    background-color: transparent !important;
}
.a-canvas {
    background-color: transparent !important;
}
```

## Testing
- Main app server: https://localhost:8080
- Test server: https://localhost:8081

## Browser Compatibility
- Chrome (Android): Full support
- Safari (iOS): Partial support
- Firefox Reality: Supported
- Edge: Supported on compatible devices

## Commands
- Start main server: `node server.js`
- Start test server: `node simple-test-server.js`
- Start with debug mode: `DEBUG=true node server.js` 