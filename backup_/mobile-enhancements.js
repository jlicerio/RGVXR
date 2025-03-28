/**
 * Mobile Enhancements for AR Projects
 * 
 * This file contains optimizations and enhancements for mobile devices
 */

// Device Optimization Component
AFRAME.registerComponent('device-optimizations', {
  init: function() {
    const isMobile = AFRAME.utils.device.isMobile();
    const sceneEl = this.el;
    
    if (isMobile) {
      console.log('Mobile device detected, applying optimizations');
      
      // Reduce rendering quality for better performance
      sceneEl.setAttribute('renderer', {
        precision: 'mediump',
        antialias: false
      });
      
      // Reduce shadow quality
      document.querySelectorAll('[shadow]').forEach(el => {
        el.setAttribute('shadow', {
          cast: false
        });
      });
      
      // Optimize models
      document.querySelectorAll('[gltf-model]').forEach(el => {
        // Add LOD (Level of Detail) component if available
        if (AFRAME.components['lod']) {
          el.setAttribute('lod', {
            near: 1.5,
            far: 5
          });
        }
      });
    }
  }
});

// Gesture Controls
AFRAME.registerComponent('gesture-controls', {
  schema: {
    enabled: {type: 'boolean', default: true},
    minScale: {type: 'number', default: 0.3},
    maxScale: {type: 'number', default: 3.0}
  },
  
  init: function() {
    if (!this.data.enabled) return;
    
    this.targetEl = document.getElementById('ar-content') || this.el;
    this.initialScale = this.targetEl.getAttribute('scale') || {x: 1, y: 1, z: 1};
    this.currentScale = {...this.initialScale};
    
    // Touch event handlers
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    
    // Add touch event listeners
    document.addEventListener('touchstart', this.onTouchStart);
    document.addEventListener('touchmove', this.onTouchMove);
    document.addEventListener('touchend', this.onTouchEnd);
    
    // Initialize state
    this.touchCache = [];
    this.pinchDistance = 0;
    this.isPinching = false;
  },
  
  onTouchStart: function(evt) {
    // Store touch points
    this.touchCache = [];
    for (let i = 0; i < evt.touches.length; i++) {
      this.touchCache.push(evt.touches[i]);
    }
    
    // Check if pinch gesture (2 fingers)
    if (this.touchCache.length === 2) {
      this.pinchDistance = this.getPinchDistance(this.touchCache);
      this.isPinching = true;
    }
  },
  
  onTouchMove: function(evt) {
    // Handle pinch gesture
    if (this.isPinching && evt.touches.length === 2) {
      evt.preventDefault();
      
      // Calculate new pinch distance
      const newDistance = this.getPinchDistance(evt.touches);
      const scaleFactor = newDistance / this.pinchDistance;
      
      // Update scale
      this.currentScale.x *= scaleFactor;
      this.currentScale.y *= scaleFactor;
      this.currentScale.z *= scaleFactor;
      
      // Clamp scale
      this.currentScale.x = Math.min(Math.max(this.currentScale.x, this.data.minScale), this.data.maxScale);
      this.currentScale.y = Math.min(Math.max(this.currentScale.y, this.data.minScale), this.data.maxScale);
      this.currentScale.z = Math.min(Math.max(this.currentScale.z, this.data.minScale), this.data.maxScale);
      
      // Apply scale
      this.targetEl.setAttribute('scale', this.currentScale);
      
      // Update pinch distance
      this.pinchDistance = newDistance;
    }
  },
  
  onTouchEnd: function(evt) {
    // Reset touch cache
    this.touchCache = [];
    for (let i = 0; i < evt.touches.length; i++) {
      this.touchCache.push(evt.touches[i]);
    }
    
    // Check if pinch ended
    if (this.touchCache.length < 2) {
      this.isPinching = false;
    }
  },
  
  getPinchDistance: function(touches) {
    return Math.sqrt(
      Math.pow(touches[0].clientX - touches[1].clientX, 2) +
      Math.pow(touches[0].clientY - touches[1].clientY, 2)
    );
  },
  
  remove: function() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
  }
});

// Orientation Warning
AFRAME.registerComponent('orientation-warning', {
  init: function() {
    // Create warning element
    const warning = document.createElement('div');
    warning.className = 'orientation-warning';
    warning.innerHTML = `
      <div class="orientation-warning-content">
        <div class="orientation-icon">📱</div>
        <div class="orientation-message">Please rotate your device to landscape mode for the best experience</div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .orientation-warning {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        display: none;
      }
      .orientation-warning-content {
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        max-width: 80%;
      }
      .orientation-icon {
        font-size: 48px;
        margin-bottom: 10px;
        animation: rotate 2s infinite;
      }
      .orientation-message {
        font-family: Arial, sans-serif;
        font-size: 16px;
        color: #333;
      }
      @keyframes rotate {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(90deg); }
        50% { transform: rotate(90deg); }
        75% { transform: rotate(0deg); }
        100% { transform: rotate(0deg); }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(warning);
    
    // Store reference
    this.warning = warning;
    
    // Check orientation
    this.checkOrientation = this.checkOrientation.bind(this);
    window.addEventListener('resize', this.checkOrientation);
    this.checkOrientation();
  },
  
  checkOrientation: function() {
    // Only show warning in portrait mode on mobile
    const isMobile = AFRAME.utils.device.isMobile();
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (isMobile && isPortrait) {
      this.warning.style.display = 'flex';
    } else {
      this.warning.style.display = 'none';
    }
  },
  
  remove: function() {
    window.removeEventListener('resize', this.checkOrientation);
    if (this.warning && this.warning.parentNode) {
      this.warning.parentNode.removeChild(this.warning);
    }
  }
}); 