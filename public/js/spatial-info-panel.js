/**
 * spatial-info-panel — A-Frame Component
 * 
 * Renders project metadata (title, description, technologies) as a
 * world-space HTML-in-Canvas panel anchored to a 3D entity.
 * 
 * Requires: html-in-canvas-bridge.js (loaded first)
 * 
 * Usage:
 *   <a-entity spatial-info-panel="title: My Project;
 *                                   description: A cool AR thing;
 *                                   technologies: A-Frame, AR.js, WebXR;
 *                                   anchor: #my-model;
 *                                   offset: 0 0.4 0">
 *   </a-entity>
 */
AFRAME.registerComponent('spatial-info-panel', {
  schema: {
    title:        { type: 'string',  default: '' },
    description:  { type: 'string',  default: '' },
    technologies: { type: 'array',   default: [] },
    instructions: { type: 'array',   default: [] },
    author:       { type: 'string',  default: '' },
    anchor:       { type: 'selector', default: null },
    offset:       { type: 'vec3',    default: { x: 0, y: 0.4, z: 0 } },
    width:        { type: 'number',  default: 280 },
    visible:      { type: 'boolean', default: true },
    showOnMarker: { type: 'boolean', default: true }
  },

  init: function() {
    this.panelElement = null;
    this.bridgeReady = false;
    this.markerFound = !this.data.showOnMarker; // If not marker-dependent, show immediately

    // Wait for bridge to be available
    this.waitForBridge();
  },

  waitForBridge: function() {
    const bridge = window.HTMLInCanvasBridge;
    
    if (!bridge) {
      // Retry after a short delay
      setTimeout(() => this.waitForBridge(), 100);
      return;
    }

    if (!bridge.supported) {
      console.log('[spatial-info-panel] HTML-in-Canvas not supported. Using fallback.');
      this.setupFallback();
      return;
    }

    // Initialize bridge from this scene if not already active
    if (!bridge.active) {
      bridge.init(this.el.sceneEl);
    }

    this.bridgeReady = true;

    // Wait for scene to load before creating panel
    if (this.el.sceneEl.hasLoaded) {
      this.createPanel();
    } else {
      this.el.sceneEl.addEventListener('loaded', () => this.createPanel());
    }

    // Listen for marker events
    if (this.data.showOnMarker) {
      this.setupMarkerListeners();
    }
  },

  setupMarkerListeners: function() {
    const sceneEl = this.el.sceneEl;
    
    // AR.js marker found/lost events
    sceneEl.addEventListener('markerFound', (event) => {
      // Show panels when any marker is found
      this.markerFound = true;
      if (this.panelElement) {
        this.panelElement.style.opacity = '1';
      }
      if (this.fallbackEntity) {
        this.fallbackEntity.setAttribute('visible', true);
      }
    });

    sceneEl.addEventListener('markerLost', (event) => {
      this.markerFound = false;
      if (this.panelElement) {
        this.panelElement.style.opacity = '0.3';
      }
      if (this.fallbackEntity) {
        this.fallbackEntity.setAttribute('visible', false);
      }
    });
  },

  createPanel: function() {
    const bridge = window.HTMLInCanvasBridge;
    if (!bridge || !bridge.active) return;

    // Build panel DOM element
    const panel = document.createElement('div');
    panel.className = 'spatial-info-panel';
    panel.setAttribute('data-spatial-panel', '');
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', this.data.title + ' information panel');
    panel.innerHTML = this.buildPanelHTML();

    // Register with bridge
    const anchorEl = this.data.anchor || this.el;
    this.panelElement = bridge.register(panel, anchorEl, {
      offset: this.data.offset,
      width: this.data.width,
      height: 180
    });

    this.el.emit('panel-created', { element: panel });
  },

  buildPanelHTML: function() {
    const d = this.data;
    const desc = d.description || '';
    const truncated = desc.length > 250 ? desc.substring(0, 247) + '...' : desc;

    // Technologies tags
    let techHTML = '';
    if (d.technologies && d.technologies.length > 0) {
      techHTML = 
        '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px;">' +
        d.technologies.map(function(t) {
          return '<span style="background:rgba(255,255,255,0.12);padding:2px 8px;' +
                 'border-radius:2px;font-size:11px;letter-spacing:0.5px;">' + 
                 escapeHTML(t) + '</span>';
        }).join('') +
        '</div>';
    }

    // Author line
    let authorHTML = '';
    if (d.author) {
      authorHTML = 
        '<div style="margin-top:8px;font-size:11px;opacity:0.5;">' +
        escapeHTML(d.author) + '</div>';
    }

    return (
      '<div style="font-size:15px;font-weight:600;margin-bottom:6px;letter-spacing:0.3px;">' +
        escapeHTML(d.title) +
      '</div>' +
      '<div style="font-size:12px;line-height:1.5;opacity:0.85;">' +
        escapeHTML(truncated) +
      '</div>' +
      techHTML +
      authorHTML
    );
  },

  setupFallback: function() {
    // Legacy: create an A-Frame plane with text for non-supported browsers
    const desc = this.data.description || '';
    const truncated = desc.length > 150 ? desc.substring(0, 147) + '...' : desc;

    const container = document.createElement('a-entity');
    container.setAttribute('position', this.data.offset);

    // Background plane
    const bg = document.createElement('a-entity');
    bg.setAttribute('geometry', { primitive: 'plane', width: 1.6, height: 0.8 });
    bg.setAttribute('material', { color: '#111111', opacity: 0.75, transparent: true });
    bg.setAttribute('position', '0 0 -0.01');
    container.appendChild(bg);

    // Title text
    const titleText = document.createElement('a-entity');
    titleText.setAttribute('text', {
      value: this.data.title,
      align: 'center',
      width: 1.5,
      color: '#ffffff',
      wrapCount: 28,
      anchor: 'center'
    });
    titleText.setAttribute('position', '0 0.2 0');
    container.appendChild(titleText);

    // Description text  
    const descText = document.createElement('a-entity');
    descText.setAttribute('text', {
      value: truncated,
      align: 'center',
      width: 1.5,
      color: '#cccccc',
      wrapCount: 30,
      anchor: 'center'
    });
    descText.setAttribute('position', '0 -0.1 0');
    container.appendChild(descText);

    this.el.appendChild(container);
    this.fallbackEntity = container;
  },

  update: function(oldData) {
    if (!this.panelElement) return;

    // Rebuild content when data changes
    this.panelElement.innerHTML = this.buildPanelHTML();

    const bridge = window.HTMLInCanvasBridge;
    if (bridge) bridge.requestPaint();
  },

  remove: function() {
    if (this.panelElement) {
      const bridge = window.HTMLInCanvasBridge;
      if (bridge) bridge.unregister(this.panelElement);
    }
    if (this.fallbackEntity && this.fallbackEntity.parentNode) {
      this.fallbackEntity.parentNode.removeChild(this.fallbackEntity);
    }
  },

  /**
   * Set panel content programmatically from metadata object.
   * Convenience method for use from parent scope.
   */
  setMetadata: function(metadata) {
    this.el.setAttribute('spatial-info-panel', {
      title: metadata.title || '',
      description: metadata.description || '',
      technologies: metadata.technologies || [],
      instructions: metadata.instructions || [],
      author: metadata.author || ''
    });
  }
});

/**
 * HTML escape utility (internal, not exported to AFRAME namespace)
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
