/**
 * Carousel Enhancements
 * 
 * This script enhances the carousel interface with better transitions,
 * mobile support, and improved user experience.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Add smooth transitions to project containers
  document.querySelectorAll('.project-container').forEach(container => {
    container.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });
  
  // Add swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  const handleSwipe = () => {
    if (touchEndX < touchStartX - 50) {
      // Swipe left - next project
      if (typeof nextProject === 'function') {
        nextProject();
      }
    }
    if (touchEndX > touchStartX + 50) {
      // Swipe right - previous project
      if (typeof previousProject === 'function') {
        previousProject();
      }
    }
  };
  
  // Enhance project loading
  const enhanceProjectLoading = () => {
    // Add loading indicator to iframes
    document.querySelectorAll('.project-iframe').forEach(iframe => {
      iframe.addEventListener('load', function() {
        // Remove loading class when iframe is loaded
        this.parentNode.classList.remove('loading');
      });
      
      // Add loading class to container
      iframe.parentNode.classList.add('loading');
    });
  };
  
  // Add keyboard shortcuts info
  const addKeyboardInfo = () => {
    const infoPanel = document.getElementById('infoPanel');
    if (infoPanel) {
      const keyboardSection = document.createElement('div');
      keyboardSection.className = 'info-section';
      keyboardSection.innerHTML = `
        <div class="info-section-title">Keyboard Shortcuts</div>
        <div class="info-section-content">
          <ul style="padding-left: 20px; margin: 0;">
            <li>Left/Right Arrow: Navigate projects</li>
            <li>I: Toggle info panel</li>
            <li>Esc: Close info panel</li>
          </ul>
        </div>
      `;
      infoPanel.appendChild(keyboardSection);
    }
  };
  
  // Improve mobile UI
  const improveMobileUI = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Add mobile class to body
      document.body.classList.add('mobile');
      
      // Adjust project title for mobile
      const projectTitle = document.getElementById('projectTitle');
      if (projectTitle) {
        projectTitle.style.width = '90%';
        projectTitle.style.fontSize = '16px';
        projectTitle.style.padding = '10px';
      }
      
      // Adjust controls for mobile
      const controls = document.querySelector('.controls');
      if (controls) {
        controls.style.padding = '10px';
      }
      
      // Add swipe hint
      const swipeHint = document.createElement('div');
      swipeHint.className = 'swipe-hint';
      swipeHint.innerHTML = `
        <div class="swipe-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9l6 6-6 6"/>
            <path d="M4 4l6 6-6 6"/>
          </svg>
        </div>
        <div class="swipe-text">Swipe to navigate</div>
      `;
      document.body.appendChild(swipeHint);
      
      // Add styles for swipe hint
      const style = document.createElement('style');
      style.textContent = `
        .swipe-hint {
          position: fixed;
          bottom: 120px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 15px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          z-index: 999;
          animation: fadeOut 3s forwards;
          animation-delay: 5s;
        }
        .swipe-icon {
          margin-right: 10px;
          animation: swipe 2s infinite;
        }
        .swipe-text {
          font-size: 14px;
        }
        @keyframes swipe {
          0% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          100% { transform: translateX(-5px); }
        }
        @keyframes fadeOut {
          to { opacity: 0; visibility: hidden; }
        }
      `;
      document.head.appendChild(style);
      
      // Hide swipe hint after user swipes
      document.addEventListener('touchend', () => {
        const hint = document.querySelector('.swipe-hint');
        if (hint) {
          hint.style.display = 'none';
        }
      }, { once: true });
    }
  };
  
  // Call enhancement functions
  enhanceProjectLoading();
  addKeyboardInfo();
  improveMobileUI();
  
  console.log('Carousel enhancements applied');
}); 