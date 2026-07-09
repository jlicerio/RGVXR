/**
 * HTML-in-Canvas Bridge for A-Frame / Three.js WebGL
 * 
 * Provides feature detection, canvas setup, transform syncing,
 * and texElementImage2D rendering for spatial UI panels.
 * 
 * Chrome 148-150 origin trial. Enable via:
 *   chrome://flags/#canvas-draw-element (Canary 149+)
 *   Or register origin trial token for production.
 * 
 * API Reference:
 *   https://developer.chrome.com/blog/html-in-canvas-origin-trial
 *   https://github.com/WICG/html-in-canvas
 */

(function() {
  'use strict';

  // --- Feature Detection ---
  const FEATURE_CHECK = (function() {
    try {
      const proto = HTMLCanvasElement.prototype;
      // Primary check: requestPaint method existence
      if (typeof proto.requestPaint === 'function') return true;
      // Secondary check: layoutsubtree attribute support
      if ('layoutsubtree' in proto) return true;
      return false;
    } catch(e) { return false; }
  })();

  // --- State ---
  let canvas = null;
  let gl = null;
  let sceneEl = null;
  let renderer = null;
  let camera = null;
  let bridgeActive = false;
  let registeredElements = new Map(); // element -> {entity, offset, textureObj, material}
  let tickBound = false;

  // --- Public API ---
  const HTMLInCanvasBridge = {
    get supported() { return FEATURE_CHECK; },
    get active() { return bridgeActive; },

    /**
     * Initialize bridge from an A-Frame scene.
     * Call once after scene 'loaded' event.
     */
    init: function(aframeSceneEl) {
      if (!FEATURE_CHECK) {
        console.warn('[HTML-in-Canvas] API not available. Use Chrome Canary 149+ with chrome://flags/#canvas-draw-element');
        return false;
      }

      sceneEl = aframeSceneEl;

      sceneEl.addEventListener('loaded', function() {
        canvas = sceneEl.canvas;
        renderer = sceneEl.renderer;

        if (!canvas) {
          console.error('[HTML-in-Canvas] No canvas found on A-Frame scene');
          return;
        }

        // Apply layoutsubtree attribute to opt in canvas children
        canvas.setAttribute('layoutsubtree', '');

        // Get WebGL context from Three.js renderer
        if (renderer && renderer.getContext) {
          gl = renderer.getContext();
        }

        // Get camera reference
        camera = sceneEl.camera;

        // Listen for paint events (fires when canvas children change)
        canvas.addEventListener('paint', onPaint);

        // Hook into A-Frame tick for per-frame CSS transform syncing
        if (!tickBound) {
          sceneEl.addEventListener('tick', onTick);
          tickBound = true;
        }

        bridgeActive = true;
        console.log('[HTML-in-Canvas] Bridge active. Canvas:', canvas.width + 'x' + canvas.height);
      });

      return true;
    },

    /**
     * Register a DOM element to be rendered as a spatial info panel.
     * The element becomes a direct child of the canvas (required by spec).
     * Returns the element for chaining.
     */
    register: function(element, anchorEntity, options) {
      if (!canvas || !bridgeActive) return null;

      options = options || {};
      const offset = options.offset || { x: 0, y: 0.5, z: 0 };
      const width = options.width || 300;
      const height = options.height || 200;

      // Apply default panel styling
      if (!element.style.width) {
        Object.assign(element.style, {
          width: width + 'px',
          minHeight: height + 'px',
          background: 'rgba(0, 0, 0, 0.85)',
          color: '#ffffff',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '13px',
          lineHeight: '1.4',
          padding: '14px 16px',
          borderRadius: '4px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
          userSelect: 'text',
          overflow: 'hidden',
          position: 'absolute',
          display: 'none'  // hidden until first position sync
        });
      }

      // Must be direct child of canvas for layoutsubtree
      canvas.appendChild(element);

      // Create a WebGL texture for this element
      let textureObj = null;
      let material = null;
      let mesh = null;

      if (gl && renderer) {
        // Create a Three.js texture that will be updated with texElementImage2D
        // We use a canvas-backed texture as placeholder
        const placeholderCanvas = document.createElement('canvas');
        placeholderCanvas.width = width;
        placeholderCanvas.height = height;
        const pctx = placeholderCanvas.getContext('2d');
        pctx.fillStyle = 'rgba(0,0,0,0)';
        pctx.fillRect(0, 0, width, height);

        textureObj = new THREE.CanvasTexture(placeholderCanvas);
        textureObj.minFilter = THREE.LinearFilter;
        textureObj.magFilter = THREE.LinearFilter;
        textureObj.needsUpdate = true;

        material = new THREE.MeshBasicMaterial({
          map: textureObj,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide
        });

        // Create a plane mesh anchored to the entity
        const aspect = width / height;
        const planeGeo = new THREE.PlaneGeometry(aspect * 0.5, 0.5);
        mesh = new THREE.Mesh(planeGeo, material);
        mesh.position.set(offset.x, offset.y, offset.z);
        mesh.renderOrder = 999;
        mesh.material.depthTest = false;

        if (anchorEntity && anchorEntity.object3D) {
          anchorEntity.object3D.add(mesh);
        }
      }

      registeredElements.set(element, {
        entity: anchorEntity,
        offset: offset,
        textureObj: textureObj,
        material: material,
        mesh: mesh,
        width: width,
        height: height,
        lastScreenX: 0,
        lastScreenY: 0,
        lastVisible: false
      });

      // Force initial paint to capture the element
      requestPaint();

      return element;
    },

    /**
     * Unregister a panel element — removes from canvas and Three.js scene.
     */
    unregister: function(element) {
      const entry = registeredElements.get(element);
      if (!entry) return;

      // Remove mesh from scene
      if (entry.mesh && entry.mesh.parent) {
        entry.mesh.parent.remove(entry.mesh);
      }
      if (entry.material) entry.material.dispose();
      if (entry.textureObj) entry.textureObj.dispose();

      // Remove element from canvas
      if (element.parentNode === canvas) {
        canvas.removeChild(element);
      }

      registeredElements.delete(element);
    },

    /**
     * Request a paint event to update rendered HTML textures.
     * Call after changing DOM content of registered elements.
     */
    requestPaint: requestPaint,

    /**
     * Shutdown the bridge — remove listeners and clean up.
     */
    destroy: function() {
      if (canvas) {
        canvas.removeEventListener('paint', onPaint);
      }
      if (sceneEl && tickBound) {
        sceneEl.removeEventListener('tick', onTick);
        tickBound = false;
      }
      for (const [el] of registeredElements) {
        HTMLInCanvasBridge.unregister(el);
      }
      bridgeActive = false;
    }
  };

  // --- Internal ---

  function requestPaint() {
    if (!canvas || !bridgeActive) return;
    try {
      canvas.requestPaint();
    } catch(e) { /* requestPaint may throw if not yet available */ }
  }

  /**
   * paint event handler — called by browser when canvas children change.
   * Uploads changed DOM elements as WebGL textures via texElementImage2D.
   */
  function onPaint(event) {
    if (!gl || !bridgeActive) return;

    const changedElements = (event && event.changedElements) 
      ? event.changedElements 
      : Array.from(registeredElements.keys());

    for (const element of changedElements) {
      const entry = registeredElements.get(element);
      if (!entry || !entry.textureObj) continue;

      try {
        // Bind the texture and upload the live DOM element
        gl.bindTexture(gl.TEXTURE_2D, entry.textureObj.__webglTexture || entry.textureObj);

        // texElementImage2D draws the live rendered DOM into the WebGL texture
        // Signature: texElementImage2D(target, level, internalformat, format, type, element)
        if (gl.texElementImage2D) {
          gl.texElementImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            element
          );

          // Update texture parameters
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

          // Mark texture as updated so Three.js picks up the changes
          entry.textureObj.needsUpdate = true;
        }
      } catch(e) {
        // texElementImage2D may not be available in all versions
        console.debug('[HTML-in-Canvas] texElementImage2D not available:', e.message);
        
        // Fallback: use 2D canvas to render a text snapshot
        renderFallbackTexture(element, entry);
      }
    }

    // Force Three.js to re-upload
    if (renderer) {
      renderer.resetState();
    }
  }

  /**
   * Fallback: render element content to texture via 2D canvas snapshot.
   * Used when texElementImage2D is not available.
   */
  function renderFallbackTexture(element, entry) {
    // This is a best-effort text snapshot for non-supported browsers
    // In production with origin trial, texElementImage2D handles this properly
    const text = element.textContent || '';
    const offCanvas = document.createElement('canvas');
    offCanvas.width = entry.width;
    offCanvas.height = entry.height;
    const ctx = offCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, entry.width, entry.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Inter, sans-serif';
    
    // Simple word wrap
    const words = text.split(' ');
    let line = '';
    let y = 20;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > entry.width - 20) {
        ctx.fillText(line, 10, y);
        line = word + ' ';
        y += 20;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 10, y);

    // Copy to Three.js texture
    if (entry.textureObj && entry.textureObj.image) {
      const img = entry.textureObj.image;
      if (img.getContext) {
        const imgCtx = img.getContext('2d');
        imgCtx.clearRect(0, 0, img.width, img.height);
        imgCtx.drawImage(offCanvas, 0, 0);
        entry.textureObj.needsUpdate = true;
      }
    }
  }

  /**
   * Per-frame tick: sync CSS transforms for accessibility/hit-testing.
   * Projects 3D entity positions to screen space and updates element.style.transform.
   */
  function onTick() {
    if (!bridgeActive || !canvas || registeredElements.size === 0) return;
    if (!sceneEl || !sceneEl.camera) return;

    const cam = sceneEl.camera;
    const canvasW = canvas.clientWidth || canvas.width;
    const canvasH = canvas.clientHeight || canvas.height;

    for (const [element, entry] of registeredElements) {
      const entity = entry.entity;
      if (!entity || !entity.object3D) continue;

      try {
        // Get world position of the anchor entity
        const worldPos = new THREE.Vector3();
        entity.object3D.getWorldPosition(worldPos);

        // Apply offset in world space
        worldPos.x += entry.offset.x;
        worldPos.y += entry.offset.y;
        worldPos.z += entry.offset.z;

        // Project to screen space
        const screenPos = worldPos.clone().project(cam);

        // Check if behind camera or off-screen
        const behindCamera = screenPos.z > 1;
        const offScreen = Math.abs(screenPos.x) > 1.5 || Math.abs(screenPos.y) > 1.5;

        if (behindCamera || offScreen) {
          if (entry.lastVisible) {
            element.style.display = 'none';
            entry.lastVisible = false;
          }
          // Also hide the mesh
          if (entry.mesh) entry.mesh.visible = false;
          continue;
        }

        // Convert NDC to canvas pixel coordinates
        const canvasX = (screenPos.x * 0.5 + 0.5) * canvasW;
        const canvasY = (-screenPos.y * 0.5 + 0.5) * canvasH;

        // Use getElementTransform to compute proper CSS transform
        // This handles DPR scaling and canvas-to-screen mapping
        if (canvas.getElementTransform) {
          // getElementTransform(element) returns a DOMMatrix
          // that maps the element's natural position to screen space
          const transform = canvas.getElementTransform(element);
          if (transform) {
            // Set translation to our computed screen position
            transform.e = canvasX - entry.width / 2;
            transform.f = canvasY - entry.height;
            element.style.transform = transform.toString();
          }
        } else {
          // Fallback: manual transform
          element.style.transform = 
            'translate(' + (canvasX - entry.width / 2) + 'px, ' + (canvasY - entry.height) + 'px)';
        }

        // Show the element
        if (!entry.lastVisible) {
          element.style.display = '';
          entry.lastVisible = true;
        }

        // Show the mesh
        if (entry.mesh) {
          entry.mesh.visible = true;
          // Make the plane always face the camera (billboard)
          entry.mesh.lookAt(cam.position);
        }

        entry.lastScreenX = canvasX;
        entry.lastScreenY = canvasY;

      } catch(e) {
        // Silently skip frames where transforms aren't ready
      }
    }
  }

  // --- Global Export ---
  if (typeof window !== 'undefined') {
    window.HTMLInCanvasBridge = HTMLInCanvasBridge;
  }
})();
