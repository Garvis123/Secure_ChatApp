/**
 * Screen capture detection and prevention utilities
 */

/**
 * Initialize screen capture detection
 * @param {Function} onDetected - Callback when screenshot is detected
 */
export const initScreenCaptureDetection = (onDetected) => {
  // Detect screenshot attempts via keyboard shortcuts
  const detectKeyboardScreenshot = (event) => {
    const isScreenshot = 
      // Windows: PrtScn, Alt+PrtScn, Win+PrtScn, Win+Shift+S
      event.key === 'PrintScreen' ||
      (event.altKey && event.key === 'PrintScreen') ||
      (event.metaKey && event.key === 'PrintScreen') ||
      (event.metaKey && event.shiftKey && event.key === 'S') ||
      // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(event.key));
    
    if (isScreenshot) {
      event.preventDefault();
      onDetected('keyboard_screenshot');
    }
  };

  // Detect browser developer tools
  const detectDevTools = () => {
    const threshold = 160;
    const devtools = {
      open: false,
      orientation: null
    };

    const check = () => {
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;

      if (!(heightThreshold && widthThreshold) &&
          ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) ||
           heightThreshold || widthThreshold)) {
        if (!devtools.open || devtools.orientation !== (heightThreshold ? 'vertical' : 'horizontal')) {
          devtools.open = true;
          devtools.orientation = heightThreshold ? 'vertical' : 'horizontal';
          onDetected('devtools_open');
        }
      } else {
        devtools.open = false;
        devtools.orientation = null;
      }
    };

    check();
    return setInterval(check, 500);
  };

  // Detect context menu (right-click)
  const detectContextMenu = (event) => {
    event.preventDefault();
    onDetected('context_menu');
  };

  // Detect selection attempts
  const detectSelection = (event) => {
    event.preventDefault();
    return false;
  };

  // Detect drag attempts
  const detectDrag = (event) => {
    event.preventDefault();
    return false;
  };

  // Add event listeners
  document.addEventListener('keydown', detectKeyboardScreenshot);
  document.addEventListener('contextmenu', detectContextMenu);
  document.addEventListener('selectstart', detectSelection);
  document.addEventListener('dragstart', detectDrag);

  // Start dev tools detection
  const devToolsInterval = detectDevTools();

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', detectKeyboardScreenshot);
    document.removeEventListener('contextmenu', detectContextMenu);
    document.removeEventListener('selectstart', detectSelection);
    document.removeEventListener('dragstart', detectDrag);
    clearInterval(devToolsInterval);
  };
};

/**
 * Apply visual protection to sensitive content
 * @param {HTMLElement} element - Element to protect
 */
export const applyVisualProtection = (element) => {
  if (!element) return;

  // Disable text selection
  element.style.userSelect = 'none';
  element.style.webkitUserSelect = 'none';
  element.style.mozUserSelect = 'none';
  element.style.msUserSelect = 'none';

  // Disable drag
  element.draggable = false;

  // Add protection overlay
  const overlay = document.createElement('div');
  overlay.className = 'screen-protection-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
    background: transparent;
  `;

  element.style.position = 'relative';
  element.appendChild(overlay);

  return overlay;
};

/**
 * Create a watermark overlay
 * @param {string} text - Watermark text
 * @param {HTMLElement} container - Container element
 */
export const createWatermark = (text, container) => {
  const watermark = document.createElement('div');
  watermark.textContent = text;
  watermark.className = 'watermark-overlay';
  
  watermark.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 48px;
    color: rgba(255, 255, 255, 0.1);
    font-weight: bold;
    pointer-events: none;
    z-index: 999;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  `;

  container.appendChild(watermark);
  return watermark;
};

/**
 * Blur content when window loses focus
 * @param {HTMLElement} element - Element to blur
 */
export const initFocusBlur = (element) => {
  const blurContent = () => {
    element.style.filter = 'blur(10px)';
  };

  const unblurContent = () => {
    element.style.filter = 'none';
  };

  window.addEventListener('blur', blurContent);
  window.addEventListener('focus', unblurContent);

  return () => {
    window.removeEventListener('blur', blurContent);
    window.removeEventListener('focus', unblurContent);
  };
};

/**
 * Detect if page is being viewed in an iframe
 */
export const detectIframeEmbedding = () => {
  return window.self !== window.top;
};

/**
 * Initialize comprehensive screen protection
 * @param {Object} options - Protection options
 * @param {Function} options.onThreatDetected - Callback for threat detection
 * @param {HTMLElement} options.protectedElement - Element to protect
 * @param {string} options.watermarkText - Watermark text
 */
export const initScreenProtection = (options = {}) => {
  const {
    onThreatDetected = () => {},
    protectedElement = document.body,
    watermarkText = 'SECURE CHAT'
  } = options;

  // Check if embedded in iframe
  if (detectIframeEmbedding()) {
    onThreatDetected('iframe_embedding');
  }

  // Initialize capture detection
  const cleanupCapture = initScreenCaptureDetection(onThreatDetected);

  // Apply visual protection
  const overlay = applyVisualProtection(protectedElement);

  // Create watermark
  const watermark = createWatermark(watermarkText, document.body);

  // Initialize focus blur
  const cleanupFocus = initFocusBlur(protectedElement);

  // Return cleanup function
  return () => {
    cleanupCapture();
    cleanupFocus();
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (watermark && watermark.parentNode) {
      watermark.parentNode.removeChild(watermark);
    }
  };
};