let isRunning = false;
let cycleTimeout = null;
let currentSettings = { 
  delay: 4000, 
  autoScroll: true, 
  jitter: true,
  useCustomClick: false,
  customClickX: undefined,
  customClickY: undefined,
  isPanelMinimized: false,
  useBurstMode: false,
  burstClickCount: 5,
  burstClickDelay: 30,
  useRecordedDelays: false,
  recordedDelays: []
};
let likedInCurrentSession = new Set();
let recordedDelayIndex = 0;

// Dom elements references (inside shadow root)
let panelContainerHost = null;
let likesCountEl = null;
let statusTextEl = null;
let statusBadgeEl = null;
let delaySliderEl = null;
let delayValEl = null;
let toggleScrollEl = null;
let toggleJitterEl = null;
let toggleCustomClickEl = null;
let customClickDetailsEl = null;
let coordsValEl = null;
let btnToggleEl = null;
let btnPickCoordsEl = null;
let btnResetEl = null;
let visualMarkerEl = null;
let toggleBurstModeEl = null;
let burstDetailsEl = null;
let burstCountSliderEl = null;
let burstCountValEl = null;
let burstDelaySliderEl = null;
let burstDelayValEl = null;
let toggleRecordedDelaysEl = null;
let recordedDetailsEl = null;
let recordedStatusValEl = null;
let btnRecordDelaysEl = null;

console.log('TikTok Auto-Liker Pro: Content script loaded.');

// 1. Initialize settings from storage on startup
chrome.storage.local.get([
  'isRunning', 'delay', 'autoScroll', 'jitter', 'useCustomClick', 
  'customClickX', 'customClickY', 'likesCount', 'isPanelMinimized', 'panelShowState',
  'useBurstMode', 'burstClickCount', 'burstClickDelay',
  'useRecordedDelays', 'recordedDelays'
], (res) => {
  isRunning = res.isRunning || false;
  
  // Migrate delay from seconds (<= 15) to milliseconds
  let loadedDelay = res.delay;
  if (loadedDelay !== undefined) {
    if (loadedDelay <= 15) {
      loadedDelay = loadedDelay * 1000;
      chrome.storage.local.set({ delay: loadedDelay });
    }
  } else {
    loadedDelay = 1000; // default 1 second (1000ms)
  }
  currentSettings.delay = Math.max(10, loadedDelay);
  
  currentSettings.autoScroll = res.autoScroll !== undefined ? res.autoScroll : true;
  currentSettings.jitter = res.jitter !== undefined ? res.jitter : true;
  currentSettings.useCustomClick = res.useCustomClick || false;
  currentSettings.customClickX = (res.customClickX === null || res.customClickX === undefined) ? undefined : res.customClickX;
  currentSettings.customClickY = (res.customClickY === null || res.customClickY === undefined) ? undefined : res.customClickY;
  currentSettings.isPanelMinimized = res.isPanelMinimized || false;
  currentSettings.useBurstMode = res.useBurstMode || false;
  currentSettings.burstClickCount = res.burstClickCount || 5;
  currentSettings.burstClickDelay = res.burstClickDelay || 30;
  currentSettings.useRecordedDelays = res.useRecordedDelays || false;
  currentSettings.recordedDelays = res.recordedDelays || [];

  updateVisualMarker();

  // Automatically spawn control panel if it was running or if it was explicitly shown before
  if (isRunning || res.panelShowState === 'visible') {
    createFloatingPanel();
  }

  if (isRunning) {
    startLoop();
  }
});

// 2. Listen for messages from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TOGGLE_PANEL') {
    toggleFloatingPanel();
    sendResponse({ success: true });
  }
  return true;
});

// 3. Sync changes from local storage dynamically
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.delay) {
      currentSettings.delay = changes.delay.newValue;
      if (delaySliderEl) delaySliderEl.value = currentSettings.delay;
      if (delayValEl) {
        const val = currentSettings.delay;
        delayValEl.textContent = val >= 1000 ? `${val}ms (${(val / 1000).toFixed(1)}s)` : `${val}ms`;
      }
    }
    if (changes.autoScroll) {
      currentSettings.autoScroll = changes.autoScroll.newValue;
      if (toggleScrollEl) toggleScrollEl.checked = currentSettings.autoScroll;
    }
    if (changes.jitter) {
      currentSettings.jitter = changes.jitter.newValue;
      if (toggleJitterEl) toggleJitterEl.checked = currentSettings.jitter;
    }
    if (changes.useCustomClick) {
      currentSettings.useCustomClick = changes.useCustomClick.newValue;
      if (toggleCustomClickEl) toggleCustomClickEl.checked = currentSettings.useCustomClick;
      updateVisualMarker();
      updateCustomClickDetailsPane(currentSettings.useCustomClick);
    }
    if (changes.useBurstMode) {
      currentSettings.useBurstMode = changes.useBurstMode.newValue;
      if (toggleBurstModeEl) toggleBurstModeEl.checked = currentSettings.useBurstMode;
      updateBurstDetailsPane(currentSettings.useBurstMode);
    }
    if (changes.burstClickCount) {
      currentSettings.burstClickCount = changes.burstClickCount.newValue;
      if (burstCountSliderEl) burstCountSliderEl.value = currentSettings.burstClickCount;
      if (burstCountValEl) burstCountValEl.textContent = `${currentSettings.burstClickCount}x`;
    }
    if (changes.burstClickDelay) {
      currentSettings.burstClickDelay = changes.burstClickDelay.newValue;
      if (burstDelaySliderEl) burstDelaySliderEl.value = currentSettings.burstClickDelay;
      if (burstDelayValEl) burstDelayValEl.textContent = `${currentSettings.burstClickDelay}ms`;
    }
    if (changes.customClickX || changes.customClickY) {
      const newX = changes.customClickX !== undefined ? changes.customClickX.newValue : currentSettings.customClickX;
      const newY = changes.customClickY !== undefined ? changes.customClickY.newValue : currentSettings.customClickY;
      currentSettings.customClickX = (newX === null) ? undefined : newX;
      currentSettings.customClickY = (newY === null) ? undefined : newY;
      updateVisualMarker();
      if (coordsValEl) {
        if (currentSettings.customClickX !== undefined && currentSettings.customClickY !== undefined) {
          coordsValEl.textContent = `X: ${currentSettings.customClickX}, Y: ${currentSettings.customClickY}`;
        } else {
          coordsValEl.textContent = 'Belum dipilih';
        }
      }
    }
    if (changes.likesCount) {
      if (likesCountEl) likesCountEl.textContent = changes.likesCount.newValue;
    }
    if (changes.isRunning) {
      const runState = changes.isRunning.newValue;
      if (runState && !isRunning) {
        startLoop();
      } else if (!runState && isRunning) {
        stopLoop();
      }
    }
  }
});

// 4. Toggle visibility of the floating panel widget
function toggleFloatingPanel() {
  if (!panelContainerHost) {
    createFloatingPanel();
    chrome.storage.local.set({ panelShowState: 'visible' });
  } else {
    const isHidden = panelContainerHost.style.display === 'none';
    panelContainerHost.style.display = isHidden ? 'block' : 'none';
    chrome.storage.local.set({ panelShowState: isHidden ? 'visible' : 'hidden' });
  }
}

// 5. Start the automation loop
function startLoop() {
  if (cycleTimeout) clearTimeout(cycleTimeout);
  recordedDelayIndex = 0; // Reset index when starting loop
  isRunning = true;
  chrome.storage.local.set({ isRunning: true });
  updateStatusUI(true, 'Sedang berjalan...');
  console.log('TikTok Auto-Liker Pro: Memulai siklus liking...');
  runCycle();
}

// 6. Stop the automation loop
function stopLoop() {
  isRunning = false;
  if (cycleTimeout) clearTimeout(cycleTimeout);

  // Clear recorded delays and click coordinates on stop
  currentSettings.customClickX = undefined;
  currentSettings.customClickY = undefined;
  currentSettings.useCustomClick = false;
  currentSettings.recordedDelays = [];
  currentSettings.useRecordedDelays = false;

  chrome.storage.local.set({ 
    isRunning: false,
    customClickX: null,
    customClickY: null,
    useCustomClick: false,
    recordedDelays: [],
    useRecordedDelays: false
  });

  // Update UI components directly to feel instant
  if (toggleCustomClickEl) toggleCustomClickEl.checked = false;
  updateCustomClickDetailsPane(false);
  if (coordsValEl) coordsValEl.textContent = 'Belum dipilih';

  if (toggleRecordedDelaysEl) toggleRecordedDelaysEl.checked = false;
  updateRecordedDetailsPane(false);
  updateRecordedStatusDisplay();

  updateVisualMarker();

  updateStatusUI(false, 'Dihentikan');
  console.log('Auto-Clicker & Liker Pro: Siklus dihentikan. Rekaman dan lokasi klik dibersihkan.');
}

// 7. Primary Automation Cycle
async function runCycle() {
  if (!isRunning) return;

  const isTikTok = window.location.hostname.includes('tiktok.com');

  if (currentSettings.useCustomClick) {
    if (currentSettings.customClickX === undefined || currentSettings.customClickY === undefined) {
      updateStatusUI(false, 'Pilih Koordinat!');
      stopLoop();
      startCoordinatePicker();
      return;
    }
  } else if (!isTikTok) {
    updateStatusUI(false, 'Gunakan Klik Kustom!');
    stopLoop();
    alert('Fitur Smart DOM (Auto-Liker TikTok) hanya bekerja di tiktok.com. Untuk situs lain, silakan aktifkan "Lokasi Klik Kustom" dan pilih lokasi koordinat.');
    return;
  }

  if (!currentSettings.useCustomClick) {
    updateStatusUI(true, 'Mencari video...');
  }

  const container = getActiveVideoContainer();
  
  // Generate unique ID based on video source or snippet to avoid double processing
  const videoEl = container ? container.querySelector('video') : null;
  const videoId = videoEl ? videoEl.src : (container ? container.innerText.slice(0, 40).replace(/\s/g, '') : null);

  if (videoId && likedInCurrentSession.has(videoId)) {
    console.log('TikTok Auto-Liker Pro: Video ini sudah diproses sebelumnya.');
    handleScrollAndNext(container || document.body);
    return;
  }

  // --- LOKASI KLIK KUSTOM ---
  if (currentSettings.useCustomClick && currentSettings.customClickX !== undefined && currentSettings.customClickY !== undefined) {
    if (currentSettings.useRecordedDelays && (!currentSettings.recordedDelays || currentSettings.recordedDelays.length === 0)) {
      updateStatusUI(false, 'Rekam Klik Anda!');
      stopLoop();
      startClickRecorder();
      return;
    }

    if (currentSettings.useRecordedDelays && currentSettings.recordedDelays && currentSettings.recordedDelays.length > 0) {
      updateStatusUI(true, `Pola rekam (${recordedDelayIndex + 1}/${currentSettings.recordedDelays.length})...`);
      
      let success = clickAtCoordinates(currentSettings.customClickX, currentSettings.customClickY);
      
      if (success) {
        incrementLikesCounter();

        // Get delay from recorded list
        const finalDelay = currentSettings.recordedDelays[recordedDelayIndex];
        
        console.log(`Auto-Clicker & Liker Pro: Menggunakan jeda rekam ke-${recordedDelayIndex}: ${finalDelay}ms`);
        
        // Move to next index
        recordedDelayIndex = (recordedDelayIndex + 1) % currentSettings.recordedDelays.length;

        cycleTimeout = setTimeout(() => {
          runCycle();
        }, finalDelay);
      } else {
        updateStatusUI(true, 'Gagal mengeklik, melewati...');
        cycleTimeout = setTimeout(() => {
          runCycle();
        }, 1000);
      }
      return;
    }

    if (currentSettings.useBurstMode) {
      updateStatusUI(true, 'Menjalankan burst klik...');
      
      const burstCount = currentSettings.burstClickCount || 5;
      const intraBurstDelay = currentSettings.burstClickDelay || 30;

      runBurstClicks(burstCount, intraBurstDelay, () => {
        // Calculate delay in milliseconds for post-burst pause
        const baseDelay = currentSettings.delay;
        let finalDelay = baseDelay;

        if (currentSettings.jitter) {
          const jitterRange = baseDelay * 0.25; // 25% variation
          const jitter = (Math.random() * jitterRange * 2) - jitterRange;
          finalDelay = Math.max(10, baseDelay + jitter);
        }

        console.log(`Auto-Clicker & Liker Pro: Burst selesai. Jeda berikutnya: ${finalDelay.toFixed(0)}ms`);

        cycleTimeout = setTimeout(() => {
          runCycle();
        }, finalDelay);
      });
      return;
    }

    updateStatusUI(true, 'Mengeklik target...');
    
    let success = clickAtCoordinates(currentSettings.customClickX, currentSettings.customClickY);
    
    if (success) {
      if (videoId) {
        likedInCurrentSession.add(videoId);
      }
      
      incrementLikesCounter();

      // Calculate delay in milliseconds
      const baseDelay = currentSettings.delay;
      let finalDelay = baseDelay;

      if (currentSettings.jitter) {
        if (baseDelay <= 100) {
          // Choose a random step of 10ms from 10ms to 100ms
          const stepsCount = 10; // 0 to 9 steps of 10ms (10ms to 100ms)
          const randomStep = Math.floor(Math.random() * stepsCount);
          finalDelay = 10 + (randomStep * 10);
        } else {
          const jitterRange = baseDelay * 0.25; // 25% variation
          const jitter = (Math.random() * jitterRange * 2) - jitterRange;
          finalDelay = Math.max(10, baseDelay + jitter);
        }
      }

      console.log(`Auto-Clicker & Liker Pro: Sukses. Jeda berikutnya: ${finalDelay.toFixed(0)}ms`);

      cycleTimeout = setTimeout(() => {
        runCycle();
      }, finalDelay);
    } else {
      updateStatusUI(true, 'Gagal mengeklik, melewati...');
      cycleTimeout = setTimeout(() => {
        runCycle();
      }, 1000);
    }
    return;
  }

  // --- LOKASI KLIK DOM CERDAS ---
  if (!container) {
    console.log('TikTok Auto-Liker Pro: Video aktif tidak ditemukan di layar. Mencoba kembali...');
    updateStatusUI(true, 'Mencari video...');
    cycleTimeout = setTimeout(runCycle, 1500);
    return;
  }

  if (!videoId) {
    console.log('TikTok Auto-Liker Pro: Gagal membuat ID video. Mencoba kembali...');
    cycleTimeout = setTimeout(runCycle, 1000);
    return;
  }

  const likeBtn = getLikeButton(container);
  const alreadyLiked = isAlreadyLiked(likeBtn);

  if (alreadyLiked) {
    console.log('TikTok Auto-Liker Pro: Video sudah disukai (dilewati).');
    updateStatusUI(true, 'Sudah disukai, melewati...');
    likedInCurrentSession.add(videoId);

    // Skip liking, just scroll with a short delay
    cycleTimeout = setTimeout(() => {
      handleScrollAndNext(container);
    }, 1200);
    return;
  }

  // Perform standard like action
  updateStatusUI(true, 'Menyukai video...');
  let success = false;

  if (likeBtn) {
    const rect = likeBtn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    triggerClickRipple(centerX, centerY);

    likeBtn.click();
    success = true;
    console.log('TikTok Auto-Liker Pro: Menyukai lewat klik tombol.');
  } else if (videoEl) {
    const rect = videoEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    triggerClickRipple(centerX, centerY);

    simulateDoubleClick(videoEl);
    success = true;
    console.log('TikTok Auto-Liker Pro: Menyukai lewat double-click video.');
  }

  if (success) {
    likedInCurrentSession.add(videoId);
    
    // Allow animation to play, then update counts
    setTimeout(() => {
      incrementLikesCounter();

      // Calculate delay in milliseconds
      const baseDelay = currentSettings.delay;
      let finalDelay = baseDelay;

      if (currentSettings.jitter) {
        if (baseDelay <= 100) {
          // Choose a random step of 10ms from 10ms to 100ms
          const stepsCount = 10;
          const randomStep = Math.floor(Math.random() * stepsCount);
          finalDelay = 10 + (randomStep * 10);
        } else {
          const jitterRange = baseDelay * 0.25; // 25% variation
          const jitter = (Math.random() * jitterRange * 2) - jitterRange;
          finalDelay = Math.max(10, baseDelay + jitter);
        }
      }

      console.log(`Auto-Clicker & Liker Pro: Sukses. Jeda berikutnya: ${finalDelay.toFixed(0)}ms`);

      cycleTimeout = setTimeout(() => {
        handleScrollAndNext(container);
      }, finalDelay);

    }, 800);
  } else {
    updateStatusUI(true, 'Gagal menyukai, gulir...');
    cycleTimeout = setTimeout(() => {
      handleScrollAndNext(container);
    }, 1500);
  }
}

// 8. Scroll logic transition
function handleScrollAndNext(currentContainer) {
  if (!isRunning) return;

  if (currentSettings.autoScroll) {
    updateStatusUI(true, 'Membuka video baru...');
    
    // Clear focus from active inputs to prevent breaking keyboard navigation
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      activeEl.blur();
    }

    simulateScrollDown();

    // Check if scroll succeeded after animations
    setTimeout(() => {
      const newActive = getActiveVideoContainer();
      const newVideoEl = newActive ? newActive.querySelector('video') : null;
      const newVideoId = newVideoEl ? newVideoEl.src : (newActive ? newActive.innerText.slice(0, 40).replace(/\s/g, '') : null);

      const oldVideoEl = currentContainer.querySelector('video');
      const oldVideoId = oldVideoEl ? oldVideoEl.src : (currentContainer.innerText ? currentContainer.innerText.slice(0, 40).replace(/\s/g, '') : '');

      if ((newVideoId && oldVideoId && newVideoId === oldVideoId) || !newActive) {
        console.log('TikTok Auto-Liker Pro: Gulir tombol gagal, menjalankan fallback scroll...');
        const nextContainer = currentContainer.nextElementSibling;
        if (nextContainer && nextContainer !== document.body) {
          nextContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        }
      }

      // Start next cycle
      cycleTimeout = setTimeout(runCycle, 1200);

    }, 1000);
  } else {
    updateStatusUI(true, 'Auto-Scroll mati');
    cycleTimeout = setTimeout(runCycle, 2500);
  }
}

// Helper to increment like counter
function incrementLikesCounter() {
  chrome.storage.local.get('likesCount', (res) => {
    const count = (res.likesCount || 0) + 1;
    chrome.storage.local.set({ likesCount: count });
    if (likesCountEl) likesCountEl.textContent = count;
    updateStatusUI(true, currentSettings.useCustomClick ? 'Klik terkirim! 🖱️' : 'Like terkirim! ❤️');
  });
}

// Helper to set UI status displays
function updateStatusUI(running, text) {
  chrome.storage.local.set({ statusText: text });
  if (statusTextEl) statusTextEl.textContent = text;
  if (statusBadgeEl) {
    if (running) {
      statusBadgeEl.textContent = 'ON';
      statusBadgeEl.className = 'status-badge running';
      if (btnToggleEl) {
        btnToggleEl.className = 'btn-start btn-stop';
        btnToggleEl.querySelector('span').textContent = 'HENTIKAN AUTO-CLICK';
      }
    } else {
      statusBadgeEl.textContent = 'OFF';
      statusBadgeEl.className = 'status-badge stopped';
      if (btnToggleEl) {
        btnToggleEl.className = 'btn-start';
        btnToggleEl.querySelector('span').textContent = 'MULAI AUTO-CLICK';
      }
    }
  }
}

// 9. Find container of the currently active video in viewport
function getActiveVideoContainer() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  let bestVideo = null;
  let minDistance = Infinity;
  const viewportCenter = window.innerHeight / 2;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const videoCenter = rect.top + rect.height / 2;
    const distance = Math.abs(videoCenter - viewportCenter);

    if (rect.height > 100 && rect.width > 100 && distance < minDistance) {
      minDistance = distance;
      bestVideo = video;
    }
  }

  if (!bestVideo) return null;

  let current = bestVideo;
  while (current && current !== document.body) {
    if (
      current.matches('div[data-e2e="recommend-list-item-container"]') ||
      current.matches('div[data-e2e="browse-video-container"]') ||
      current.tagName === 'ARTICLE' ||
      current.classList.contains('video-card') ||
      (current.className && typeof current.className === 'string' && current.className.includes('DivItemContainer'))
    ) {
      return current;
    }
    current = current.parentElement;
  }

  return bestVideo.parentElement;
}

// 10. Extract Like button inside active video container
function getLikeButton(container) {
  let btn = container.querySelector('[data-e2e="like-icon"]') || 
            container.querySelector('[data-e2e="like-button"]') ||
            container.querySelector('[class*="like"]') ||
            container.querySelector('[class*="Heart"]');
  
  if (btn) return btn;

  const buttons = container.querySelectorAll('button');
  for (const button of buttons) {
    const html = button.innerHTML.toLowerCase();
    if (html.includes('like') || html.includes('heart') || html.includes('path')) {
      return button;
    }
  }

  const svgs = container.querySelectorAll('svg');
  for (const svg of svgs) {
    let parent = svg.parentElement;
    while (parent && parent !== container) {
      if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
        return parent;
      }
      parent = parent.parentElement;
    }
  }

  return null;
}

// 11. Check if the like icon is already red/active
function isAlreadyLiked(likeBtn) {
  if (!likeBtn) return false;
  const svg = likeBtn.tagName === 'svg' ? likeBtn : likeBtn.querySelector('svg');
  if (!svg) return false;

  const fill = svg.getAttribute('fill');
  if (fill && (fill.includes('254') || fill.includes('fe2c55') || fill.includes('rgba(254, 44, 85'))) {
    return true;
  }

  try {
    const computedStyle = window.getComputedStyle(svg);
    const computedFill = computedStyle.fill;
    const computedColor = computedStyle.color;

    if (
      (computedFill && (computedFill.includes('254') || computedFill.includes('rgb(254, 44, 85)'))) ||
      (computedColor && (computedColor.includes('254') || computedColor.includes('rgb(254, 44, 85)')))
    ) {
      return true;
    }
  } catch (e) {
    console.warn(e);
  }

  const className = likeBtn.className || '';
  if (typeof className === 'string' && (className.toLowerCase().includes('liked') || className.toLowerCase().includes('active'))) {
    return true;
  }

  return false;
}

// 12. Simulates mouse double click on element
function simulateDoubleClick(element) {
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  const clickOpts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: clientX,
    clientY: clientY
  };

  element.dispatchEvent(new MouseEvent('mousedown', clickOpts));
  element.dispatchEvent(new MouseEvent('mouseup', clickOpts));
  element.dispatchEvent(new MouseEvent('click', clickOpts));

  setTimeout(() => {
    element.dispatchEvent(new MouseEvent('mousedown', clickOpts));
    element.dispatchEvent(new MouseEvent('mouseup', clickOpts));
    element.dispatchEvent(new MouseEvent('click', clickOpts));
    element.dispatchEvent(new MouseEvent('dblclick', clickOpts));
  }, 100);
}

// 13. Simulate keyboard ArrowDown/S keypress events to scroll
function simulateScrollDown() {
  const targets = [document.activeElement, document.body, document.documentElement, window];

  const arrowOpts = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true };
  const arrowDown = new KeyboardEvent('keydown', arrowOpts);
  const arrowUp = new KeyboardEvent('keyup', arrowOpts);

  targets.forEach(t => {
    if (t) {
      t.dispatchEvent(arrowDown);
      t.dispatchEvent(arrowUp);
    }
  });

  const sOpts = { key: 's', code: 'KeyS', keyCode: 83, which: 83, bubbles: true, cancelable: true };
  const sDown = new KeyboardEvent('keydown', sOpts);
  const sUp = new KeyboardEvent('keyup', sOpts);

  targets.forEach(t => {
    if (t) {
      t.dispatchEvent(sDown);
      t.dispatchEvent(sUp);
    }
  });
}

// 14. Simulate mouse click at specific viewport coordinate (X, Y)
function clickAtCoordinates(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) {
    console.warn(`TikTok Auto-Liker Pro: Tidak ada elemen pada koordinat X: ${x}, Y: ${y}`);
    return false;
  }

  console.log(`TikTok Auto-Liker Pro: Mengeklik elemen di koordinat (${x}, ${y}):`, el);

  triggerClickRipple(x, y);

  const clickOpts = {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    view: window
  };

  el.dispatchEvent(new MouseEvent('mousedown', clickOpts));
  el.dispatchEvent(new MouseEvent('mouseup', clickOpts));
  el.dispatchEvent(new MouseEvent('click', clickOpts));
  return true;
}

// 15. Coordinate Picker Mode Overlay creation
function startCoordinatePicker() {
  const existing = document.getElementById('tiktok-autoliker-picker-overlay');
  if (existing) existing.remove();

  // Hide permanent visual marker temporarily while selecting to prevent clutter
  if (visualMarkerEl) {
    visualMarkerEl.style.display = 'none';
  }

  // Hide floating panel so it is not clicked by accident
  if (panelContainerHost) {
    panelContainerHost.style.display = 'none';
  }

  // Create temporary preview pointer element
  const previewMarker = document.createElement('div');
  previewMarker.style.cssText = `
    position: fixed;
    width: 14px;
    height: 14px;
    background-color: #FE2C55;
    border: 2px solid #ffffff;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 0 8px #FE2C55, 0 0 16px #FE2C55;
    display: none;
  `;
  const innerDot = document.createElement('div');
  innerDot.style.cssText = `
    width: 4px;
    height: 4px;
    background-color: #ffffff;
    border-radius: 50%;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  `;
  previewMarker.appendChild(innerDot);
  document.body.appendChild(previewMarker);

  const overlay = document.createElement('div');
  overlay.id = 'tiktok-autoliker-picker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 11, 14, 0.75);
    backdrop-filter: blur(4px);
    z-index: 2147483646;
    cursor: crosshair;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: #ffffff;
    font-family: 'Outfit', sans-serif;
  `;

  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(37, 244, 238, 0.3);
    border-radius: 14px;
    padding: 20px 24px;
    text-align: center;
    box-shadow: 0 0 24px rgba(37, 244, 238, 0.25);
    max-width: 85%;
    pointer-events: auto;
  `;

  textContainer.innerHTML = `
    <h3 style="margin-bottom: 6px; font-size: 16px; color: #25F4EE; text-shadow: 0 0 8px rgba(37, 244, 238, 0.3); font-weight: 700;">LOKASI KLIK MANUAL</h3>
    <p style="font-size: 11px; color: #a9abb0; margin-bottom: 14px; line-height: 1.4;">Gerakkan mouse untuk memosisikan dan klik untuk mengunci koordinat klik otomatis Anda.</p>
    <button id="tiktok-autoliker-cancel-picker" style="
      background: rgba(254, 44, 85, 0.15);
      border: 1px solid #FE2C55;
      color: #FE2C55;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    ">BATALKAN</button>
  `;

  overlay.appendChild(textContainer);
  document.body.appendChild(overlay);

  // Update preview pointer position on hover/mousemove
  overlay.addEventListener('mousemove', (e) => {
    previewMarker.style.display = 'block';
    previewMarker.style.left = `${e.clientX}px`;
    previewMarker.style.top = `${e.clientY}px`;
  });

  const cancelBtn = textContainer.querySelector('#tiktok-autoliker-cancel-picker');
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    previewMarker.remove();
    overlay.remove();
    // Restore elements
    if (visualMarkerEl) visualMarkerEl.style.display = 'block';
    if (panelContainerHost) panelContainerHost.style.display = 'block';
  });

  overlay.addEventListener('click', (e) => {
    const x = e.clientX;
    const y = e.clientY;

    console.log(`TikTok Auto-Liker Pro: Koordinat dipilih - X: ${x}, Y: ${y}`);
    
    chrome.storage.local.set({
      customClickX: x,
      customClickY: y,
      useCustomClick: true
    });

    previewMarker.remove();
    overlay.remove();
    
    // Restore panel
    if (panelContainerHost) panelContainerHost.style.display = 'block';
  });
}

// 16. Manage glowing visual target dot with radar pulse animation
function updateVisualMarker() {
  if (visualMarkerEl) {
    visualMarkerEl.remove();
    visualMarkerEl = null;
  }

  if (currentSettings.useCustomClick && currentSettings.customClickX !== undefined && currentSettings.customClickY !== undefined) {
    visualMarkerEl = document.createElement('div');
    visualMarkerEl.id = 'tiktok-autoliker-marker';
    visualMarkerEl.style.cssText = `
      position: fixed;
      left: ${currentSettings.customClickX}px;
      top: ${currentSettings.customClickY}px;
      width: 14px;
      height: 14px;
      background-color: #FE2C55;
      border: 2px solid #ffffff;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      pointer-events: none;
      box-shadow: 0 0 8px #FE2C55, 0 0 16px #FE2C55;
    `;

    const innerDot = document.createElement('div');
    innerDot.style.cssText = `
      width: 4px;
      height: 4px;
      background-color: #ffffff;
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    `;

    const radarRing = document.createElement('div');
    radarRing.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      border: 2px solid #FE2C55;
      border-radius: 50%;
      box-shadow: 0 0 8px #FE2C55;
      box-sizing: border-box;
      pointer-events: none;
      animation: tiktok-autoliker-pulse 1.6s infinite ease-out;
    `;

    injectKeyframesStyle();

    visualMarkerEl.appendChild(innerDot);
    visualMarkerEl.appendChild(radarRing);
    document.body.appendChild(visualMarkerEl);
  }
}

// Inject pulsing animation stylesheet
function injectKeyframesStyle() {
  if (document.getElementById('tiktok-autoliker-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'tiktok-autoliker-global-styles';
  style.textContent = `
    @keyframes tiktok-autoliker-pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(3.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// 17. Trigger tap ripple animation on click coordinate
function triggerClickRipple(x, y) {
  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: fixed;
    border: 3px solid #25F4EE;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2147483647;
    width: 10px;
    height: 10px;
    opacity: 1;
    transition: width 0.4s ease-out, height 0.4s ease-out, opacity 0.4s ease-out;
  `;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);

  requestAnimationFrame(() => {
    ripple.style.width = '60px';
    ripple.style.height = '60px';
    ripple.style.opacity = '0';
  });

  setTimeout(() => {
    ripple.remove();
  }, 400);
}

// Helper to perform quick clicks in succession (Burst Mode)
function runBurstClicks(count, clickDelay, onComplete) {
  let clicked = 0;
  
  function nextClick() {
    if (!isRunning) return; // Stop if the auto-clicker is stopped
    
    let success = clickAtCoordinates(currentSettings.customClickX, currentSettings.customClickY);
    if (success) {
      incrementLikesCounter();
      clicked++;
    }
    
    if (clicked < count) {
      let currentDelay = clickDelay;
      if (currentSettings.jitter) {
        // Randomize between 10ms and 100ms (in steps of 10ms) if basic jitter is on
        const stepsCount = 10;
        const randomStep = Math.floor(Math.random() * stepsCount);
        currentDelay = 10 + (randomStep * 10);
      }
      setTimeout(nextClick, currentDelay);
    } else {
      onComplete();
    }
  }
  
  nextClick();
}

function updateBurstDetailsPane(visible) {
  if (burstDetailsEl) {
    burstDetailsEl.style.display = visible ? 'flex' : 'none';
  }
}

function updateRecordedDetailsPane(visible) {
  if (recordedDetailsEl) {
    recordedDetailsEl.style.display = visible ? 'flex' : 'none';
  }
}

function updateRecordedStatusDisplay() {
  if (recordedStatusValEl) {
    const len = currentSettings.recordedDelays ? currentSettings.recordedDelays.length : 0;
    if (len > 0) {
      recordedStatusValEl.textContent = `${len} Jeda Terkam`;
    } else {
      recordedStatusValEl.textContent = 'Belum ada rekaman';
    }
  }
}

function startClickRecorder() {
  const existing = document.getElementById('autoclicker-recorder-overlay');
  if (existing) existing.remove();

  // Hide permanent visual marker temporarily
  if (visualMarkerEl) visualMarkerEl.style.display = 'none';

  // Hide floating panel
  if (panelContainerHost) panelContainerHost.style.display = 'none';

  let clickTimestamps = [];

  const overlay = document.createElement('div');
  overlay.id = 'autoclicker-recorder-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 11, 14, 0.85);
    backdrop-filter: blur(5px);
    z-index: 2147483646;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: #ffffff;
    font-family: 'Outfit', sans-serif;
    user-select: none;
  `;

  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(254, 44, 85, 0.3);
    border-radius: 14px;
    padding: 24px;
    text-align: center;
    box-shadow: 0 0 32px rgba(254, 44, 85, 0.25);
    max-width: 85%;
    pointer-events: auto;
  `;

  textContainer.innerHTML = `
    <h3 style="margin-bottom: 6px; font-size: 16px; color: #FE2C55; text-shadow: 0 0 8px rgba(254, 44, 85, 0.3); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 0;">
      <span style="width: 8px; height: 8px; background-color: #FE2C55; border-radius: 50%; display: inline-block; animation: pulse-recorder 1s infinite alternate;"></span>
      REKAM POLA KLIK ANDA
    </h3>
    <p style="font-size: 11px; color: #a9abb0; margin-bottom: 14px; line-height: 1.4;">
      Silakan klik/ketuk di mana saja di area layar ini dengan kecepatan dan jeda yang ingin Anda tiru.<br>
      (Bot akan mengulangi jeda klik persis seperti yang Anda rekam).
    </p>
    <div id="recorder-counter" style="font-size: 14px; font-weight: 700; color: #25F4EE; margin-bottom: 16px;">Klik terdeteksi: 0</div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button id="btn-save-record" style="
        background: rgba(37, 244, 238, 0.15);
        border: 1px solid #25F4EE;
        color: #25F4EE;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">SELESAI & SIMPAN</button>
      <button id="btn-cancel-record" style="
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">BATAL</button>
    </div>
  `;

  overlay.appendChild(textContainer);
  document.body.appendChild(overlay);

  // Keyframes injection for recording red indicator dot pulse
  if (!document.getElementById('autoclicker-recorder-styles')) {
    const rStyle = document.createElement('style');
    rStyle.id = 'autoclicker-recorder-styles';
    rStyle.textContent = `
      @keyframes pulse-recorder {
        0% { opacity: 0.3; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(rStyle);
  }

  const counterEl = textContainer.querySelector('#recorder-counter');
  const saveBtn = textContainer.querySelector('#btn-save-record');
  const cancelBtn = textContainer.querySelector('#btn-cancel-record');

  overlay.addEventListener('click', (e) => {
    // Only register click if it's outside the buttons container
    if (textContainer.contains(e.target) && e.target !== textContainer) return;

    const t = Date.now();
    clickTimestamps.push(t);
    counterEl.textContent = `Klik terdeteksi: ${clickTimestamps.length}`;

    // Visual ripple effect feedback
    triggerClickRipple(e.clientX, e.clientY);
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    if (visualMarkerEl) visualMarkerEl.style.display = 'block';
    if (panelContainerHost) panelContainerHost.style.display = 'block';
  });

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (clickTimestamps.length < 2) {
      alert('Harap rekam minimal 2 klik untuk menghitung jeda waktu klik Anda!');
      return;
    }

    // Calculate interval delays
    let delays = [];
    for (let i = 1; i < clickTimestamps.length; i++) {
      delays.push(clickTimestamps[i] - clickTimestamps[i-1]);
    }

    chrome.storage.local.set({
      recordedDelays: delays,
      useRecordedDelays: true
    });

    overlay.remove();
    if (visualMarkerEl) visualMarkerEl.style.display = 'block';
    if (panelContainerHost) panelContainerHost.style.display = 'block';
  });
}

// 18. Build floating UI Panel inside page using Shadow DOM
function createFloatingPanel() {
  if (panelContainerHost) return;

  try {
    panelContainerHost = document.createElement('div');
  panelContainerHost.id = 'tiktok-autoliker-panel-host';
  panelContainerHost.style.cssText = `
    position: fixed;
    right: 20px;
    top: 80px;
    width: 290px;
    z-index: 2147483640;
    display: block;
  `;

  const shadow = panelContainerHost.attachShadow({ mode: 'open' });

  // Stylesheet
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');

    :host {
      font-family: 'Outfit', sans-serif;
      user-select: none;
    }

    .panel-container {
      background: #0a0b0e;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(254, 44, 85, 0.05);
      backdrop-filter: blur(12px);
      background: radial-gradient(circle at top right, rgba(254, 44, 85, 0.12), transparent 65%),
                  radial-gradient(circle at bottom left, rgba(37, 244, 238, 0.06), transparent 65%),
                  #0a0b0e;
      transition: width 0.3s ease;
    }

    .panel-container.minimized {
      width: 200px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 12px;
      cursor: move;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .heart-logo {
      width: 15px;
      height: 15px;
      fill: #FE2C55;
      filter: drop-shadow(0 0 3px #FE2C55);
    }

    .brand-name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #fff 60%, #25F4EE);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .badge-pro {
      font-size: 7px;
      font-weight: 800;
      color: #000;
      background: linear-gradient(90deg, #25F4EE, #ffffff);
      padding: 0px 3px;
      border-radius: 2px;
      margin-left: 2px;
      vertical-align: middle;
    }

    .header-controls {
      display: flex;
      gap: 4px;
    }

    .header-btn {
      background: none;
      border: none;
      color: #86888c;
      cursor: pointer;
      padding: 3px;
      display: inline-flex;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .header-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .header-btn#btn-close:hover {
      background: rgba(254, 44, 85, 0.2);
      color: #FE2C55;
    }

    .panel-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .panel-container.minimized .panel-body {
      display: none;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 52px;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #25F4EE;
      text-shadow: 0 0 6px rgba(37, 244, 238, 0.25);
      margin-bottom: 2px;
    }

    .stat-value.text-small {
      font-size: 10px;
      font-weight: 600;
      color: #ffffff;
      text-shadow: none;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 8px;
      color: #86888c;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-reset {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease-out;
    }

    .btn-reset:hover {
      background: rgba(254, 44, 85, 0.22) !important;
      border-color: #FE2C55 !important;
      transform: rotate(-60deg);
    }

    .status-badge {
      font-size: 8px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 10px;
      text-transform: uppercase;
      transition: all 0.3s;
    }

    .status-badge.running {
      background-color: rgba(37, 244, 238, 0.12);
      color: #25F4EE;
      border: 1px solid #25F4EE;
      box-shadow: 0 0 4px rgba(37, 244, 238, 0.25);
    }

    .status-badge.stopped {
      background-color: rgba(254, 44, 85, 0.08);
      color: #FE2C55;
      border: 1px solid rgba(254, 44, 85, 0.25);
    }

    .glass-panel {
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .control-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      max-width: 75%;
    }

    .control-title {
      font-size: 10px;
      font-weight: 600;
      color: #ffffff;
    }

    .control-desc {
      font-size: 8px;
      color: #86888c;
      line-height: 1.1;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 30px;
      height: 16px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.08);
      transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 8px;
      width: 8px;
      left: 3px;
      bottom: 3px;
      background-color: #86888c;
      transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    input:checked + .slider {
      background-color: rgba(37, 244, 238, 0.15);
      border-color: #25F4EE;
    }

    input:checked + .slider:before {
      transform: translateX(14px);
      background-color: #25F4EE;
      box-shadow: 0 0 4px #25F4EE;
    }

    .slider.round {
      border-radius: 16px;
    }

    .slider.round:before {
      border-radius: 50%;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .range-labels {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .range-val {
      font-size: 10px;
      font-weight: 700;
      color: #FE2C55;
      background: rgba(254, 44, 85, 0.08);
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid rgba(254, 44, 85, 0.2);
    }

    .range-input {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      transition: background 0.3s;
    }

    .range-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FE2C55;
      cursor: pointer;
      box-shadow: 0 0 6px rgba(254, 44, 85, 0.5);
      transition: transform 0.1s;
    }

    .range-input::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .divider-top {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 8px;
    }

    .custom-click-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 2px;
    }

    .custom-click-details.hidden {
      display: none;
    }

    .coords-display {
      display: flex;
      flex-direction: column;
    }

    .coords-display span:first-child {
      font-size: 8px;
      color: #86888c;
      text-transform: uppercase;
    }

    .coords-val {
      font-size: 10px;
      font-weight: 700;
      color: #25F4EE;
      text-shadow: 0 0 4px rgba(37, 244, 238, 0.3);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #ffffff;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 9px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      background: rgba(37, 244, 238, 0.1);
      border-color: #25F4EE;
      color: #25F4EE;
    }

    .btn-start {
      width: 100%;
      padding: 8px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 8px rgba(37, 244, 238, 0.35);
      background: linear-gradient(135deg, #25F4EE, #1ee6de);
      color: #000000;
    }

    .btn-start:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 12px rgba(37, 244, 238, 0.45);
    }

    .btn-start:active {
      transform: translateY(0);
    }

    .btn-start.btn-stop {
      background: linear-gradient(135deg, #FE2C55, #e01b43);
      color: #ffffff;
      box-shadow: 0 0 8px rgba(254, 44, 85, 0.35);
    }

    .btn-start.btn-stop:hover {
      box-shadow: 0 0 12px rgba(254, 44, 85, 0.45);
    }
  `;

  // HTML Layout
  const htmlContainer = document.createElement('div');
  htmlContainer.className = 'panel-container';
  if (currentSettings.isPanelMinimized) {
    htmlContainer.classList.add('minimized');
  }

  htmlContainer.innerHTML = `
    <header class="panel-header" id="drag-handle">
      <div class="logo-area">
        <svg class="heart-logo" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span class="brand-name">Auto-Clicker & Liker <span class="badge-pro">PRO</span></span>
      </div>
      <div class="header-controls">
        <button id="btn-minimize" class="header-btn" title="${currentSettings.isPanelMinimized ? 'Maximize' : 'Minimize'}">
          ${currentSettings.isPanelMinimized ? 
            `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 5v14M5 12h14"></path></svg>` : 
            `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M5 12h14"></path></svg>`}
        </button>
        <button id="btn-close" class="header-btn" title="Close Panel">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </button>
      </div>
    </header>

    <div class="panel-body">
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="likes-count">0</div>
          <div class="stat-label">Total Klik/Like</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-small" id="status-text">Siap Memulai</div>
          <div class="stat-label">
            <span id="status-badge" class="status-badge stopped">OFF</span>
          </div>
        </div>
      </div>

      <!-- Controls Panel -->
      <div class="glass-panel">
        <div class="control-row">
          <div class="control-info">
            <span class="control-title">Auto Scroll</span>
            <span class="control-desc">Gulir otomatis ke video berikutnya</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-scroll">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="control-row">
          <div class="control-info">
            <span class="control-title">Jeda Manusiawi (Jitter)</span>
            <span class="control-desc">Variasi waktu acak agar aman dari deteksi</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-jitter">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="control-group">
          <div class="range-labels">
            <span class="control-title">Jeda Waktu (Milidetik)</span>
            <span class="range-val" id="delay-val">1000ms</span>
          </div>
          <input type="range" id="delay-slider" min="10" max="10000" step="10" value="1000" class="range-input">
        </div>

        <div class="control-row divider-top">
          <div class="control-info">
            <span class="control-title">Mode Burst (Klik Beruntun)</span>
            <span class="control-desc">Klik cepat berturut-turut lalu jeda lama</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-burst-mode">
            <span class="slider round"></span>
          </label>
        </div>

        <div id="burst-details" class="control-group" style="display: none; padding-left: 10px; border-left: 2px solid rgba(37, 244, 238, 0.3); margin-top: 4px; gap: 8px;">
          <div class="control-group">
            <div class="range-labels">
              <span class="control-title">Jumlah Klik per Burst</span>
              <span class="range-val" id="burst-count-val">5x</span>
            </div>
            <input type="range" id="burst-count-slider" min="2" max="20" step="1" value="5" class="range-input">
          </div>
          <div class="control-group">
            <div class="range-labels">
              <span class="control-title">Jeda Klik Beruntun (ms)</span>
              <span class="range-val" id="burst-delay-val">30ms</span>
            </div>
            <input type="range" id="burst-delay-slider" min="10" max="500" step="10" value="30" class="range-input">
          </div>
        </div>

        <div class="control-row divider-top">
          <div class="control-info">
            <span class="control-title">Gunakan Pola Rekaman</span>
            <span class="control-desc">Tiru jeda & kecepatan klik manual Anda</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-recorded-delays">
            <span class="slider round"></span>
          </label>
        </div>

        <div id="recorded-details" class="custom-click-details" style="display: none; justify-content: space-between; align-items: center; margin-top: 4px;">
          <div class="coords-display">
            <span>Pola Rekaman:</span>
            <span id="recorded-status-val" class="coords-val">Belum ada rekaman</span>
          </div>
          <button id="btn-record-delays" class="btn-secondary">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
            </svg>
            <span>Rekam Klik</span>
          </button>
        </div>

        <div class="control-row divider-top">
          <div class="control-info">
            <span class="control-title">Lokasi Klik Kustom</span>
            <span class="control-desc">Mengeklik koordinat layar manual</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-custom-click">
            <span class="slider round"></span>
          </label>
        </div>

        <div id="custom-click-details" class="custom-click-details" style="display: none;">
          <div class="coords-display">
            <span>Koordinat:</span>
            <span id="coords-val" class="coords-val">Belum dipilih</span>
          </div>
          <button id="btn-pick-coords" class="btn-secondary">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
            </svg>
            <span>Pilih Lokasi</span>
          </button>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button id="btn-toggle" class="btn-start" style="flex: 1;">
          <span>MULAI AUTO-CLICK</span>
        </button>
        <button id="btn-reset" class="btn-reset" style="padding: 8px 12px; border-radius: 8px; background: rgba(254, 44, 85, 0.12); border: 1px solid rgba(254, 44, 85, 0.4); color: #FE2C55; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Reset Semua Data">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(htmlContainer);
  document.body.appendChild(panelContainerHost);

  // 18a. Bind DOM elements references
  likesCountEl = shadow.querySelector('#likes-count');
  statusTextEl = shadow.querySelector('#status-text');
  statusBadgeEl = shadow.querySelector('#status-badge');
  delaySliderEl = shadow.querySelector('#delay-slider');
  delayValEl = shadow.querySelector('#delay-val');
  toggleScrollEl = shadow.querySelector('#toggle-scroll');
  toggleJitterEl = shadow.querySelector('#toggle-jitter');
  toggleCustomClickEl = shadow.querySelector('#toggle-custom-click');
  customClickDetailsEl = shadow.querySelector('#custom-click-details');
  coordsValEl = shadow.querySelector('#coords-val');
  btnToggleEl = shadow.querySelector('#btn-toggle');
  btnPickCoordsEl = shadow.querySelector('#btn-pick-coords');
  btnResetEl = shadow.querySelector('#btn-reset');
  toggleBurstModeEl = shadow.querySelector('#toggle-burst-mode');
  burstDetailsEl = shadow.querySelector('#burst-details');
  burstCountSliderEl = shadow.querySelector('#burst-count-slider');
  burstCountValEl = shadow.querySelector('#burst-count-val');
  burstDelaySliderEl = shadow.querySelector('#burst-delay-slider');
  burstDelayValEl = shadow.querySelector('#burst-delay-val');
  toggleRecordedDelaysEl = shadow.querySelector('#toggle-recorded-delays');
  recordedDetailsEl = shadow.querySelector('#recorded-details');
  recordedStatusValEl = shadow.querySelector('#recorded-status-val');
  btnRecordDelaysEl = shadow.querySelector('#btn-record-delays');

  // Initialize values
  chrome.storage.local.get(['likesCount', 'statusText'], (res) => {
    if (likesCountEl) likesCountEl.textContent = res.likesCount || 0;
    if (statusTextEl) statusTextEl.textContent = res.statusText || (isRunning ? 'Sedang berjalan...' : 'Siap Memulai');
  });

  delaySliderEl.value = currentSettings.delay;
  const dVal = currentSettings.delay;
  delayValEl.textContent = dVal >= 1000 ? `${dVal}ms (${(dVal / 1000).toFixed(1)}s)` : `${dVal}ms`;
  toggleScrollEl.checked = currentSettings.autoScroll;
  toggleJitterEl.checked = currentSettings.jitter;
  toggleCustomClickEl.checked = currentSettings.useCustomClick;
  updateCustomClickDetailsPane(currentSettings.useCustomClick);
  toggleBurstModeEl.checked = currentSettings.useBurstMode;
  updateBurstDetailsPane(currentSettings.useBurstMode);
  burstCountSliderEl.value = currentSettings.burstClickCount;
  burstCountValEl.textContent = `${currentSettings.burstClickCount}x`;
  burstDelaySliderEl.value = currentSettings.burstClickDelay;
  burstDelayValEl.textContent = `${currentSettings.burstClickDelay}ms`;
  toggleRecordedDelaysEl.checked = currentSettings.useRecordedDelays;
  updateRecordedDetailsPane(currentSettings.useRecordedDelays);
  updateRecordedStatusDisplay();

  if (currentSettings.customClickX !== undefined && currentSettings.customClickY !== undefined) {
    coordsValEl.textContent = `X: ${currentSettings.customClickX}, Y: ${currentSettings.customClickY}`;
  }

  updateStatusUI(isRunning, isRunning ? 'Sedang berjalan...' : 'Siap Memulai');

  // 18b. Bind Event Listeners
  delaySliderEl.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    delayValEl.textContent = val >= 1000 ? `${val}ms (${(val / 1000).toFixed(1)}s)` : `${val}ms`;
    chrome.storage.local.set({ delay: val });
  });

  toggleScrollEl.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoScroll: e.target.checked });
  });

  toggleBurstModeEl.addEventListener('change', (e) => {
    const val = e.target.checked;
    chrome.storage.local.set({ useBurstMode: val });
    updateBurstDetailsPane(val);
  });

  burstCountSliderEl.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    burstCountValEl.textContent = `${val}x`;
    chrome.storage.local.set({ burstClickCount: val });
  });

  burstDelaySliderEl.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    burstDelayValEl.textContent = `${val}ms`;
    chrome.storage.local.set({ burstClickDelay: val });
  });

  toggleRecordedDelaysEl.addEventListener('change', (e) => {
    const val = e.target.checked;
    chrome.storage.local.set({ useRecordedDelays: val });
    updateRecordedDetailsPane(val);
    if (val && (!currentSettings.recordedDelays || currentSettings.recordedDelays.length === 0)) {
      startClickRecorder();
    }
  });

  btnRecordDelaysEl.addEventListener('click', () => {
    startClickRecorder();
  });

  toggleJitterEl.addEventListener('change', (e) => {
    chrome.storage.local.set({ jitter: e.target.checked });
  });

  toggleCustomClickEl.addEventListener('change', (e) => {
    const val = e.target.checked;
    chrome.storage.local.set({ useCustomClick: val });
    updateCustomClickDetailsPane(val);
    if (val) {
      startCoordinatePicker();
    } else {
      updateVisualMarker();
    }
  });

  btnPickCoordsEl.addEventListener('click', () => {
    startCoordinatePicker();
  });

  btnResetEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Reset semua data ekstensi (termasuk koordinat, pola rekaman, dan jumlah klik)?')) {
      // Clear storage
      chrome.storage.local.set({
        likesCount: 0,
        customClickX: null,
        customClickY: null,
        useCustomClick: false,
        recordedDelays: [],
        useRecordedDelays: false,
        useBurstMode: false,
        delay: 1000
      });

      // Clear memory settings
      currentSettings.customClickX = undefined;
      currentSettings.customClickY = undefined;
      currentSettings.useCustomClick = false;
      currentSettings.recordedDelays = [];
      currentSettings.useRecordedDelays = false;
      currentSettings.useBurstMode = false;
      currentSettings.delay = 1000;

      // Update UI components
      if (likesCountEl) likesCountEl.textContent = '0';
      if (coordsValEl) coordsValEl.textContent = 'Belum dipilih';
      if (toggleCustomClickEl) toggleCustomClickEl.checked = false;
      updateCustomClickDetailsPane(false);

      if (toggleRecordedDelaysEl) toggleRecordedDelaysEl.checked = false;
      updateRecordedDetailsPane(false);
      updateRecordedStatusDisplay();

      if (toggleBurstModeEl) toggleBurstModeEl.checked = false;
      updateBurstDetailsPane(false);

      if (delaySliderEl) delaySliderEl.value = 1000;
      if (delayValEl) delayValEl.textContent = '1000ms (1.0s)';

      updateVisualMarker();

      // Stop loop if active, else set status to ready
      if (isRunning) {
        stopLoop();
      } else {
        updateStatusUI(false, 'Siap Memulai');
      }
    }
  });

  btnToggleEl.addEventListener('click', () => {
    const nextRunningState = !isRunning;
    chrome.storage.local.set({ isRunning: nextRunningState });
    updateStatusUI(nextRunningState, nextRunningState ? 'Sedang berjalan...' : 'Dihentikan');
  });

  // Minimize Control
  const btnMinimize = shadow.querySelector('#btn-minimize');
  btnMinimize.addEventListener('click', () => {
    htmlContainer.classList.toggle('minimized');
    const isMinimized = htmlContainer.classList.contains('minimized');
    chrome.storage.local.set({ isPanelMinimized: isMinimized });

    if (isMinimized) {
      btnMinimize.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 5v14M5 12h14"></path></svg>`;
      btnMinimize.title = 'Maximize Panel';
    } else {
      btnMinimize.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M5 12h14"></path></svg>`;
      btnMinimize.title = 'Minimize Panel';
    }
  });

  // Close Panel Control (Hides it)
  const btnClose = shadow.querySelector('#btn-close');
  btnClose.addEventListener('click', () => {
    panelContainerHost.style.display = 'none';
    chrome.storage.local.set({ panelShowState: 'hidden' });
  });

    // 18c. Initialize Dragging
    const dragHandle = shadow.querySelector('#drag-handle');
    initDragging(dragHandle, panelContainerHost);
  } catch (err) {
    console.error('TikTok Auto-Liker Panel Error:', err);
    alert('Panel Error: ' + err.message + '\nStack:\n' + err.stack);
  }
}

// Drag and drop helper
let isDragging = false;
let startX, startY;
let initialLeft, initialTop;

function initDragging(dragHandle, panelEl) {
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panelEl.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    panelEl.style.left = `${initialLeft + dx}px`;
    panelEl.style.top = `${initialTop + dy}px`;
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

// Helper to show/hide custom click details
function updateCustomClickDetailsPane(visible) {
  if (customClickDetailsEl) {
    customClickDetailsEl.style.display = visible ? 'flex' : 'none';
  }
}
