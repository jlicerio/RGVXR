/**
 * Shared UI Components for AR Projects
 * 
 * This file contains reusable UI components for AR projects
 */

// AR Instruction Overlay
AFRAME.registerComponent('ar-instructions', {
  schema: {
    text: {type: 'string', default: 'Tap to place object'},
    position: {type: 'vec3', default: {x: 0, y: 0, z: -2}},
    visible: {type: 'boolean', default: true},
    duration: {type: 'number', default: 5000} // Auto-hide after this duration (0 = never)
  },
  
  init: function() {
    // Create instruction entity
    const el = document.createElement('a-entity');
    el.setAttribute('text', {
      value: this.data.text,
      align: 'center',
      width: 2,
      color: 'white',
      opacity: 0.8,
      wrapCount: 30
    });
    el.setAttribute('position', this.data.position);
    el.setAttribute('visible', this.data.visible);
    
    // Add background panel
    const bg = document.createElement('a-entity');
    bg.setAttribute('geometry', {
      primitive: 'plane',
      width: 2.2,
      height: 0.6
    });
    bg.setAttribute('material', {
      color: 'black',
      opacity: 0.5
    });
    bg.setAttribute('position', '0 0 -0.01');
    
    el.appendChild(bg);
    this.el.appendChild(el);
    
    // Store for later access
    this.instructionEl = el;
    
    // Auto-hide if duration is set
    if (this.data.duration > 0) {
      setTimeout(() => {
        this.hideInstructions();
      }, this.data.duration);
    }
    
    // Add methods to scene
    const sceneEl = document.querySelector('a-scene');
    sceneEl.showInstructions = (text) => this.showInstructions(text);
    sceneEl.hideInstructions = () => this.hideInstructions();
  },
  
  update: function() {
    if (this.instructionEl) {
      this.instructionEl.setAttribute('text', 'value', this.data.text);
      this.instructionEl.setAttribute('position', this.data.position);
      this.instructionEl.setAttribute('visible', this.data.visible);
    }
  },
  
  showInstructions: function(text) {
    if (text) {
      this.instructionEl.setAttribute('text', 'value', text);
    }
    this.instructionEl.setAttribute('visible', true);
  },
  
  hideInstructions: function() {
    this.instructionEl.setAttribute('visible', false);
  }
});

// AR UI Overlay
AFRAME.registerComponent('ar-ui-overlay', {
  schema: {
    enabled: {type: 'boolean', default: true}
  },
  
  init: function() {
    if (!this.data.enabled) return;
    
    // Create UI overlay
    const overlay = document.createElement('div');
    overlay.className = 'ar-ui-overlay';
    overlay.innerHTML = `
      <div class="ar-ui-container">
        <div class="ar-ui-instructions" id="ar-instructions">Tap to place object</div>
        <div class="ar-ui-controls">
          <button class="ar-ui-button" id="ar-reset-btn">Reset</button>
          <button class="ar-ui-button" id="ar-help-btn">Help</button>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .ar-ui-overlay {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        pointer-events: none;
      }
      .ar-ui-container {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        text-align: center;
        font-family: Arial, sans-serif;
        pointer-events: auto;
      }
      .ar-ui-instructions {
        margin-bottom: 10px;
      }
      .ar-ui-button {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 8px 16px;
        margin: 5px;
        border-radius: 4px;
        cursor: pointer;
      }
      .ar-ui-button:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    // Store references
    this.overlay = overlay;
    this.instructionsEl = document.getElementById('ar-instructions');
    this.resetBtn = document.getElementById('ar-reset-btn');
    this.helpBtn = document.getElementById('ar-help-btn');
    
    // Add event listeners
    this.resetBtn.addEventListener('click', () => {
      // Reset AR content
      const arContent = document.getElementById('ar-content');
      if (arContent) {
        arContent.setAttribute('position', '0 0 -3');
      }
      
      // Emit reset event
      this.el.emit('ar-reset');
    });
    
    this.helpBtn.addEventListener('click', () => {
      // Show help
      this.showInstructions('Tap on the ground to place the object. Use pinch gestures to scale.');
      
      // Emit help event
      this.el.emit('ar-help');
    });
    
    // Add methods to scene
    const sceneEl = this.el;
    sceneEl.showUIInstructions = (text) => this.showInstructions(text);
    sceneEl.hideUIOverlay = () => this.hideOverlay();
    sceneEl.showUIOverlay = () => this.showOverlay();
  },
  
  showInstructions: function(text) {
    if (this.instructionsEl) {
      this.instructionsEl.textContent = text;
    }
  },
  
  hideOverlay: function() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  },
  
  showOverlay: function() {
    if (this.overlay) {
      this.overlay.style.display = 'block';
    }
  }
});

// Touch Placement Component
AFRAME.registerComponent('touch-placement', {
  init: function() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.onTouchEnd = this.onTouchEnd.bind(this);
    
    // Add touch event listener
    document.addEventListener('touchend', this.onTouchEnd);
    
    // Store target entity
    this.targetEl = document.getElementById('ar-content') || this.el;
    
    // Add placed flag
    this.placed = false;
  },
  
  onTouchEnd: function(evt) {
    // Check if in AR mode
    if (!this.el.is('ar-mode')) return;
    
    // Get touch position
    const touch = evt.changedTouches[0];
    const bounds = document.body.getBoundingClientRect();
    
    // Calculate normalized device coordinates
    this.mouse.x = (touch.clientX / bounds.width) * 2 - 1;
    this.mouse.y = -(touch.clientY / bounds.height) * 2 + 1;
    
    // Set raycaster from camera
    const camera = document.querySelector('[camera]').object3D;
    this.raycaster.setFromCamera(this.mouse, camera);
    
    // Get intersections with ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, intersection);
    
    // Place object at intersection
    if (intersection) {
      this.targetEl.setAttribute('position', {
        x: intersection.x,
        y: 0,
        z: intersection.z
      });
      
      // Update placed flag
      if (!this.placed) {
        this.placed = true;
        this.el.emit('ar-placed');
        
        // Update instructions
        const sceneEl = document.querySelector('a-scene');
        if (sceneEl.showUIInstructions) {
          sceneEl.showUIInstructions('Object placed! Use pinch gestures to scale.');
        }
      }
    }
  },
  
  remove: function() {
    document.removeEventListener('touchend', this.onTouchEnd);
  }
}); 