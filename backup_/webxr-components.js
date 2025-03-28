// Touch placement component for WebXR
AFRAME.registerComponent('touch-placement', {
    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.camera = document.querySelector('a-camera').object3D;
        this.touchIndicator = document.createElement('div');
        this.touchIndicator.className = 'touch-indicator';
        document.body.appendChild(this.touchIndicator);
        
        // Set up touch event listeners
        document.addEventListener('touchstart', this.onTouchStart.bind(this));
        document.addEventListener('touchmove', this.onTouchMove.bind(this));
        document.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Place object in front of camera initially
        this.el.sceneEl.addEventListener('enter-vr', () => {
            // Wait a bit for the WebXR session to initialize
            setTimeout(() => {
                this.placeObjectInFront();
                this.showToast('AR session started');
            }, 1000);
        });
        
        // Add hit-test support
        if ('XRHitTestSource' in window) {
            this.el.sceneEl.addEventListener('enter-vr', async () => {
                try {
                    const session = this.el.sceneEl.xrSession;
                    const viewerSpace = await session.requestReferenceSpace('viewer');
                    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
                } catch (err) {
                    console.log('Hit test not supported:', err);
                }
            });
        }
    },
    
    onTouchStart: function(event) {
        if (!this.el.sceneEl.is('vr-mode')) return;
        
        event.preventDefault();
        this.touchActive = true;
        this.touchIndicator.style.opacity = '1';
        this.updateTouchIndicator(event);
    },
    
    onTouchMove: function(event) {
        if (!this.el.sceneEl.is('vr-mode') || !this.touchActive) return;
        
        event.preventDefault();
        this.updateTouchIndicator(event);
    },
    
    onTouchEnd: function(event) {
        if (!this.el.sceneEl.is('vr-mode')) return;
        
        event.preventDefault();
        if (this.touchActive) {
            this.touchActive = false;
            this.touchIndicator.style.opacity = '0';
            this.placeObjectAtTouch(event);
        }
    },
    
    updateTouchIndicator: function(event) {
        const touch = event.touches[0];
        this.touchIndicator.style.left = `${touch.clientX}px`;
        this.touchIndicator.style.top = `${touch.clientY}px`;
    },
    
    placeObjectAtTouch: async function(event) {
        if (this.hitTestSource) {
            const frame = this.el.sceneEl.frame;
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(this.el.sceneEl.xrReferenceSpace);
                
                // Update all objects with the class "ar-placeable"
                const arObjects = document.querySelectorAll('.ar-placeable');
                const height = parseFloat(document.getElementById('height-slider')?.value || 1.5);
                
                arObjects.forEach(obj => {
                    obj.setAttribute('position', `${pose.transform.position.x} ${height} ${pose.transform.position.z}`);
                });
                
                this.showToast('Object placed on surface');
                return;
            }
        }
        
        // Fall back to plane intersection if hit test fails
        const touch = event.changedTouches[0];
        const x = (touch.clientX / window.innerWidth) * 2 - 1;
        const y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera({x, y}, this.camera);
        
        // Create a plane for raycasting
        const planeNormal = new THREE.Vector3(0, 1, 0);
        const plane = new THREE.Plane(planeNormal, 0);
        
        // Find intersection with the plane
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, intersection);
        
        if (intersection) {
            // Update all objects with the class "ar-placeable"
            const arObjects = document.querySelectorAll('.ar-placeable');
            const height = parseFloat(document.getElementById('height-slider')?.value || 1.5);
            
            arObjects.forEach(obj => {
                obj.setAttribute('position', `${intersection.x} ${height} ${intersection.z}`);
            });
            
            // Show confirmation
            this.showToast('Object placed');
        }
    },
    
    placeObjectInFront: function() {
        // Get the camera's position and rotation
        const cameraEl = document.querySelector('a-camera');
        const cameraPosition = cameraEl.object3D.position;
        
        // Calculate a position 2 meters in front of the camera
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraEl.object3D.quaternion);
        direction.multiplyScalar(2);
        
        const position = new THREE.Vector3();
        position.addVectors(cameraPosition, direction);
        
        // Update all objects with the class "ar-placeable"
        const arObjects = document.querySelectorAll('.ar-placeable');
        const height = parseFloat(document.getElementById('height-slider')?.value || 1.5);
        
        arObjects.forEach(obj => {
            obj.setAttribute('position', `${position.x} ${height} ${position.z}`);
        });
        
        // Show confirmation
        this.showToast('Object placed in front of you');
    },
    
    showToast: function(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 500);
        }, 2000);
    }
});

// Video player component
AFRAME.registerComponent('play-on-click', {
    init: function () {
        this.onClick = this.onClick.bind(this);
        this.el.addEventListener('click', this.onClick);
        this.el.addEventListener('touchend', this.onClick);
        
        // Initialize video
        const videoEl = document.querySelector(this.el.getAttribute('src'));
        if (videoEl) {
            // Set video properties for mobile
            videoEl.playsInline = true;
            videoEl.webkitPlaysInline = true;
            
            // Handle iOS
            document.addEventListener('touchstart', () => {
                videoEl.play().catch(() => {
                    console.log('Deferred video playback');
                });
            }, { once: true });
        }
    },
    onClick: function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        
        const videoEl = document.querySelector(this.el.getAttribute('src'));
        if (videoEl) {
            if (videoEl.paused) {
                videoEl.play().then(() => {
                    this.showToast('Video playing');
                }).catch(e => {
                    console.log('Video play failed:', e);
                    this.showToast('Tap again to play video');
                });
            } else {
                videoEl.pause();
                this.showToast('Video paused');
            }
        }
    },
    showToast: function(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 500);
        }, 2000);
    }
});

// WebXR session manager
AFRAME.registerSystem('webxr-session-manager', {
    init: function() {
        this.onSessionEnded = this.onSessionEnded.bind(this);
        this.onSessionStarted = this.onSessionStarted.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        
        this.el.addEventListener('enter-vr', this.onSessionStarted);
        this.el.addEventListener('exit-vr', this.onSessionEnded);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    },
    
    onVisibilityChange: function() {
        if (document.hidden && this.el.is('vr-mode')) {
            // Clean up when page is hidden
            this.el.exitVR();
        }
    },
    
    remove: function() {
        // Clean up event listeners
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    },
    
    onSessionStarted: function() {
        console.log('WebXR session started');
        
        // Reset any previous state
        const arObjects = document.querySelectorAll('.ar-placeable');
        arObjects.forEach(obj => {
            // Make sure objects are visible
            obj.setAttribute('visible', true);
        });
        
        // Show control panel
        const controlPanel = document.querySelector('.control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'flex';
        }
    },
    
    onSessionEnded: function() {
        console.log('WebXR session ended');
        
        // Clean up
        const controlPanel = document.querySelector('.control-panel');
        if (controlPanel) {
            controlPanel.style.display = 'none';
        }
        
        // Show enter AR button again
        const enterARButton = document.getElementById('enter-ar');
        if (enterARButton) {
            enterARButton.style.display = 'block';
        }
    }
});

// Loading manager
AFRAME.registerSystem('loading-manager', {
    init: function() {
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.id = 'loading-overlay';
        this.loadingOverlay.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-text">Loading experience...</div>
            <div class="loading-error" style="display: none; color: #ff4444; margin-top: 10px;"></div>
        `;
        document.body.appendChild(this.loadingOverlay);
        
        this.el.addEventListener('model-loaded', this.hideLoading.bind(this));
        this.el.addEventListener('model-error', this.showError.bind(this));
        this.el.addEventListener('loaded', this.checkAllLoaded.bind(this));
        
        // Set timeout but allow more time on slow connections
        this.timeout = setTimeout(this.hideLoading.bind(this), 15000);
    },
    
    checkAllLoaded: function() {
        // Check if all assets are loaded
        const assets = document.querySelector('a-assets');
        if (assets && assets.hasLoaded) {
            this.hideLoading();
        }
    },
    
    hideLoading: function() {
        clearTimeout(this.timeout);
        this.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none';
        }, 500);
    },
    
    showError: function(event) {
        const errorDiv = this.loadingOverlay.querySelector('.loading-error');
        if (errorDiv) {
            errorDiv.textContent = 'Error loading content. Please try again.';
            errorDiv.style.display = 'block';
        }
        // Keep overlay visible for error
        clearTimeout(this.timeout);
    }
});

// Device orientation fallback
AFRAME.registerComponent('device-orientation-permission', {
    init: function() {
        if (!navigator.xr && typeof DeviceOrientationEvent !== 'undefined') {
            const button = document.createElement('button');
            button.textContent = 'Enable Device Orientation';
            button.style.position = 'fixed';
            button.style.bottom = '80px';
            button.style.left = '50%';
            button.style.transform = 'translateX(-50%)';
            button.style.zIndex = '999999';
            
            button.addEventListener('click', async () => {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        button.style.display = 'none';
                    }
                }
            });
            
            document.body.appendChild(button);
        }
    }
});

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

// Other shared components 