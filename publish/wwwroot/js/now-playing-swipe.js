// ==================== Now Playing Popup - Swipe & Tabs ====================
// Handles swipe-to-close gesture and tab switching

(function() {
    'use strict';

    let popup = null;
    let sheet = null;
    let handle = null;
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    function init() {
        popup = document.getElementById('global-np-popup');
        sheet = document.getElementById('global-np-popup-sheet');
        handle = document.getElementById('global-np-handle');

        if (!popup || !sheet) return;

        // Touch events for swipe
        sheet.addEventListener('touchstart', onTouchStart, { passive: true });
        sheet.addEventListener('touchmove', onTouchMove, { passive: false });
        sheet.addEventListener('touchend', onTouchEnd, { passive: true });

        // Click on overlay to close
        popup.addEventListener('click', function(e) {
            if (e.target === popup) {
                closeGlobalNowPlayingPopup();
            }
        });

        // Keyboard support
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && popup.classList.contains('visible')) {
                closeGlobalNowPlayingPopup();
            }
        });
    }

    function onTouchStart(e) {
        // Only allow drag from handle or top area
        const touch = e.touches[0];
        const rect = sheet.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;

        // Allow drag from top 60px (handle area) or if touching the handle directly
        if (touchY <= 60 || e.target.closest('.global-np-popup-handle')) {
            isDragging = true;
            startY = touch.clientY;
            currentY = startY;
            sheet.style.transition = 'none';
        }
    }

    function onTouchMove(e) {
        if (!isDragging) return;

        const touch = e.touches[0];
        currentY = touch.clientY;
        const deltaY = currentY - startY;

        // Only allow dragging down
        if (deltaY > 0) {
            e.preventDefault();
            sheet.style.transform = `translateY(${deltaY}px)`;
        }
    }

    function onTouchEnd() {
        if (!isDragging) return;

        isDragging = false;
        sheet.style.transition = '';

        const deltaY = currentY - startY;
        const threshold = 100; // pixels to trigger close

        if (deltaY > threshold) {
            closeGlobalNowPlayingPopup();
        } else {
            // Snap back
            sheet.style.transform = '';
        }
    }

    // Tab switching
    window.switchNowPlayingTab = function(tabName) {
        const tabs = document.querySelectorAll('.global-np-tab');
        const panels = document.querySelectorAll('.global-np-tab-panel');

        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        panels.forEach(panel => {
            const panelName = panel.id.replace('global-np-panel-', '');
            panel.classList.toggle('active', panelName === tabName);
        });

        // Load queue when switching to queue tab
        if (tabName === 'queue' && window.loadAndRenderQueue) {
            // Fetch queue from Bluesound player (or memory for browser playback)
            window.loadAndRenderQueue();
        }
    };

    // Override open/close functions
    window.openGlobalNowPlayingPopup = async function() {
        if (!popup) return;

        // Reset to player tab
        switchNowPlayingTab('player');

        // Sync track info
        const track = window.GlobalPlayer?.getCurrentTrack?.() || window.globalCurrentTrack;
        if (track) {
            const cover = document.getElementById('global-popup-cover');
            const placeholder = document.getElementById('global-popup-cover-placeholder');

            if (track.imageUrl || track.albumCover) {
                cover.src = track.imageUrl || track.albumCover;
                cover.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                cover.style.display = 'none';
                placeholder.style.display = 'flex';
            }

            document.getElementById('global-popup-title').textContent = track.title || 'Unbekannt';
            document.getElementById('global-popup-artist').textContent = track.artist || track.artistName || '-';
            document.getElementById('global-popup-album').textContent = track.album || track.albumTitle || '';
        }

        // Sync progress
        const progressFill = document.getElementById('global-progress-fill');
        const popupProgressFill = document.getElementById('global-popup-progress-fill');
        const currentTime = document.getElementById('global-current-time');
        const popupCurrentTime = document.getElementById('global-popup-current-time');
        const totalTime = document.getElementById('global-total-time');
        const popupTotalTime = document.getElementById('global-popup-total-time');

        if (progressFill && popupProgressFill) {
            popupProgressFill.style.width = progressFill.style.width;
        }
        if (currentTime && popupCurrentTime) {
            popupCurrentTime.textContent = currentTime.textContent;
        }
        if (totalTime && popupTotalTime) {
            popupTotalTime.textContent = totalTime.textContent;
        }

        // Update quality buttons
        if (window.updateQualityButtons) {
            window.updateQualityButtons();
        }

        // Show popup
        popup.style.display = 'flex';
        // Force reflow
        popup.offsetHeight;
        popup.classList.add('visible');
        document.body.style.overflow = 'hidden';
    };

    window.closeGlobalNowPlayingPopup = function() {
        if (!popup) return;

        popup.classList.remove('visible');
        document.body.style.overflow = '';

        // Reset transform in case of swipe
        if (sheet) {
            sheet.style.transform = '';
        }

        // Hide after animation
        setTimeout(() => {
            if (!popup.classList.contains('visible')) {
                popup.style.display = 'none';
            }
        }, 350);
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
