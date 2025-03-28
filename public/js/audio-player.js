class AudioPlayer {
    constructor() {
        console.log('Initializing AudioPlayer...');
        this.audio = new Audio();
        this.isPlaying = false;
        this.setupDragAndDrop();
        this.setupControls();
        this.setupAudioEvents();
        
        // Set volume to 30% for subtle background audio
        this.audio.volume = 0.3;
        
        // Load the existing audio file
        const audioPath = '/audio/example-enhanced-GKEYTz3alKojBj4m.mp3';
        console.log('Setting initial audio source:', audioPath);
        
        // Test if the file exists
        fetch(audioPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                console.log('Audio file exists and is accessible');
                this.audio.src = audioPath;
                
                // Try to autoplay when the page loads
                this.audio.play().catch(error => {
                    console.log('Autoplay prevented:', error);
                    // If autoplay is prevented, we'll need user interaction
                    document.getElementById('audio-control').innerHTML = '▶';
                });
            })
            .catch(error => {
                console.error('Error checking audio file:', error);
            });
    }

    setupAudioEvents() {
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            console.error('Audio error details:', this.audio.error);
        });

        this.audio.addEventListener('loadeddata', () => {
            console.log('Audio loaded successfully');
            // Try to play automatically when loaded
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Audio started playing successfully');
                    this.isPlaying = true;
                    document.getElementById('audio-control').innerHTML = '||';
                }).catch(error => {
                    console.log('Autoplay prevented:', error);
                    document.getElementById('audio-control').innerHTML = '▶';
                });
            }
        });

        this.audio.addEventListener('play', () => {
            console.log('Audio started playing');
        });

        this.audio.addEventListener('pause', () => {
            console.log('Audio paused');
        });
    }

    setupDragAndDrop() {
        console.log('Setting up drag and drop...');
        const dropZone = document.createElement('div');
        dropZone.id = 'audio-drop-zone';
        dropZone.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            opacity: 0.7;
            transition: opacity 0.3s;
        `;

        dropZone.innerHTML = `
            <button id="audio-control" style="
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: monospace;
                letter-spacing: 2px;
            ">▶</button>
        `;

        document.body.appendChild(dropZone);
        console.log('Drop zone added to document');

        // Make the button more subtle on hover
        dropZone.addEventListener('mouseenter', () => {
            dropZone.style.opacity = '1';
        });

        dropZone.addEventListener('mouseleave', () => {
            dropZone.style.opacity = '0.7';
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(0, 0, 0, 0.5)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.background = 'rgba(0, 0, 0, 0.3)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(0, 0, 0, 0.3)';
            
            const file = e.dataTransfer.files[0];
            console.log('Audio file dropped:', file.name, file.type);
            if (file && file.type.startsWith('audio/')) {
                this.handleAudioFile(file);
            } else {
                console.error('Invalid file type:', file ? file.type : 'no file');
            }
        });
    }

    setupControls() {
        console.log('Setting up controls...');
        const control = document.getElementById('audio-control');
        control.addEventListener('click', () => {
            console.log('Control clicked, current state:', this.isPlaying);
            if (this.isPlaying) {
                this.audio.pause();
                control.innerHTML = '▶';
            } else {
                this.audio.play().catch(error => {
                    console.error('Error playing audio:', error);
                });
                control.innerHTML = '||';
            }
            this.isPlaying = !this.isPlaying;
        });
    }

    async handleAudioFile(file) {
        console.log('Handling audio file:', file.name);
        const formData = new FormData();
        formData.append('audio', file);

        try {
            console.log('Uploading audio file...');
            const response = await fetch('/api/audio/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Upload response:', data);
            
            if (data.success) {
                this.audio.src = data.path;
                console.log('Setting audio source:', data.path);
                
                // Wait for the audio to be loaded before playing
                this.audio.addEventListener('canplaythrough', () => {
                    console.log('Audio ready to play');
                    this.audio.play().catch(error => {
                        console.error('Error playing audio:', error);
                    });
                    this.isPlaying = true;
                    document.getElementById('audio-control').innerHTML = '||';
                }, { once: true });
            }
        } catch (error) {
            console.error('Error uploading audio:', error);
        }
    }
}

// Initialize the audio player when the page loads
console.log('Waiting for DOM content to load...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, creating AudioPlayer...');
    new AudioPlayer();
}); 