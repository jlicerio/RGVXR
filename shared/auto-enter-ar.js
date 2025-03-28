/**
 * Auto Enter AR Component
 * 
 * This component automatically enters AR mode when the scene is ready
 */

AFRAME.registerComponent('auto-enter-ar', {
  schema: {
    enabled: {type: 'boolean', default: true},
    timeout: {type: 'number', default: 500} // Delay before entering AR (ms)
  },
  
  init: function() {
    if (!this.data.enabled) return;
    
    // Store reference to scene
    this.sceneEl = this.el;
    
    // Check if AR is supported
    if (!this.sceneEl.xrSession && AFRAME.utils.device.checkHeadsetConnected()) {
      console.log('VR headset detected, not auto-entering AR');
      return; // Don't auto-enter AR if VR headset is connected
    }
    
    // Wait for scene to be fully loaded
    if (this.sceneEl.hasLoaded) {
      this.startAR();
    } else {
      this.sceneEl.addEventListener('loaded', this.startAR.bind(this));
    }
    
    // Also try to enter AR when user interacts with the page
    const tryEnterAR = () => {
      this.startAR();
      document.removeEventListener('click', tryEnterAR);
    };
    document.addEventListener('click', tryEnterAR);
  },
  
  startAR: function() {
    // Add a slight delay to ensure everything is initialized
    setTimeout(() => {
      if (this.sceneEl.xrSession) {
        console.log('XR session already active, not auto-entering AR');
        return;
      }
      
      // Check if AR is supported
      if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then(supported => {
          if (supported) {
            console.log('Auto-entering AR mode');
            
            // Find the AR button and click it
            const arButton = document.querySelector('.a-enter-ar-button');
            if (arButton) {
              arButton.click();
            } else {
              // If no button found, try to enter AR programmatically
              this.sceneEl.enterAR();
              
              // Also try to hide any instruction overlays
              const instructions = document.getElementById('instructions');
              if (instructions) {
                instructions.style.display = 'none';
              }
              
              this.sceneEl.emit('auto-entered-ar');
            }
          } else {
            console.log('AR not supported on this device');
          }
        });
      }
    }, this.data.timeout);
  }
}); 