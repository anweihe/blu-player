// ==================== Global Player Controller ====================
// Handles playback status and controls across all pages

(function() {
    'use strict';

    // Constants
    const STORAGE_SELECTED_PLAYER = 'bluesound_selected_player';
    const STORAGE_STREAM_QUALITY = 'qobuz_stream_quality';

    // State
    let globalSelectedPlayer = { type: 'browser', name: 'Dieses Gerät' };
    let globalIsPlaying = false;
    let globalCurrentTrack = null;
    let globalStreamQuality = 27; // Default: Hi-Res Max
    let globalStatusInterval = null;
    let globalAvailablePlayers = [];

    // Progress animation state
    let progressAnimationFrame = null;
    let lastKnownPosition = 0;
    let lastKnownTotal = 0;
    let lastStatusTime = 0;
    let lastTrackTitle = null;

    // DOM Elements (initialized after DOM ready)
    let nowPlayingBar = null;
    let popup = null;
    let playerSelector = null;

    // ==================== Initialization ====================

    function initGlobalPlayer() {
        // Get DOM elements
        nowPlayingBar = document.getElementById('global-now-playing-bar');
        popup = document.getElementById('global-np-popup');
        playerSelector = document.getElementById('global-player-selector');

        if (!nowPlayingBar) return;

        // Load saved player
        loadSavedPlayer();

        // Load stream quality
        loadStreamQuality();

        // Check if user is logged in (has profile)
        if (hasActiveProfile()) {
            // Check current playback status
            checkCurrentPlayback();
        }

        // Close popups on overlay click
        popup?.addEventListener('click', function(e) {
            if (e.target === popup) closeGlobalNowPlayingPopup();
        });

        playerSelector?.addEventListener('click', function(e) {
            if (e.target === playerSelector) closeGlobalPlayerSelector();
        });
    }

    // ==================== Profile Check ====================

    function hasActiveProfile() {
        try {
            const profilesData = localStorage.getItem('user_profiles');
            if (!profilesData) return false;

            const data = JSON.parse(profilesData);
            return data.activeProfileId && data.profiles && data.profiles.length > 0;
        } catch (e) {
            return false;
        }
    }

    function getActiveProfileCredentials() {
        try {
            const profilesData = localStorage.getItem('user_profiles');
            if (!profilesData) return null;

            const data = JSON.parse(profilesData);
            if (!data.activeProfileId || !data.profiles) return null;

            const profile = data.profiles.find(p => p.id === data.activeProfileId);
            if (!profile || !profile.qobuzCredentials) return null;

            return profile.qobuzCredentials;
        } catch (e) {
            return null;
        }
    }

    // ==================== Player Selection ====================

    function loadSavedPlayer() {
        const saved = localStorage.getItem(STORAGE_SELECTED_PLAYER);
        if (saved) {
            try {
                globalSelectedPlayer = JSON.parse(saved);
                updatePlayerDisplay();
            } catch (e) {
                console.error('Failed to load saved player:', e);
            }
        }
    }

    function saveSelectedPlayer() {
        localStorage.setItem(STORAGE_SELECTED_PLAYER, JSON.stringify(globalSelectedPlayer));
    }

    function updatePlayerDisplay() {
        const nameEl = document.getElementById('global-selected-player-name');
        if (nameEl) {
            nameEl.textContent = globalSelectedPlayer.name;
        }
    }

    // ==================== Playback Status ====================

    async function checkCurrentPlayback() {
        if (globalSelectedPlayer.type !== 'bluesound' || !globalSelectedPlayer.ip) {
            return;
        }

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${globalSelectedPlayer.ip}&port=${globalSelectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status) {
                updateGlobalStatus(data.status, true);

                // Start polling if something is playing
                if (data.status.state === 'play' || data.status.state === 'stream') {
                    startStatusPolling();
                }
            }
        } catch (error) {
            console.error('Failed to check current playback:', error);
        }
    }

    function startStatusPolling() {
        stopStatusPolling();

        if (globalSelectedPlayer.type !== 'bluesound' || !globalSelectedPlayer.ip) return;

        // Start client-side progress animation
        startProgressAnimation();

        // Poll every 5 seconds (reduced from 2 seconds for efficiency)
        globalStatusInterval = setInterval(async () => {
            if (globalSelectedPlayer.type !== 'bluesound' || !globalSelectedPlayer.ip) {
                stopStatusPolling();
                return;
            }

            try {
                const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${globalSelectedPlayer.ip}&port=${globalSelectedPlayer.port || 11000}`);
                const data = await response.json();

                if (data.success && data.status) {
                    updateGlobalStatus(data.status);
                }
            } catch (error) {
                console.error('Failed to get Bluesound status:', error);
            }
        }, 5000);
    }

    function stopStatusPolling() {
        if (globalStatusInterval) {
            clearInterval(globalStatusInterval);
            globalStatusInterval = null;
        }
        stopProgressAnimation();
    }

    // Start client-side progress bar animation
    function startProgressAnimation() {
        stopProgressAnimation();

        function animateProgress() {
            if (!globalIsPlaying || lastKnownTotal <= 0) {
                progressAnimationFrame = requestAnimationFrame(animateProgress);
                return;
            }

            // Calculate estimated current position based on time elapsed since last status update
            const elapsed = (Date.now() - lastStatusTime) / 1000;
            const estimatedPosition = Math.min(lastKnownPosition + elapsed, lastKnownTotal);
            const progress = (estimatedPosition / lastKnownTotal) * 100;

            // Update progress bar
            const progressFill = document.getElementById('global-progress-fill');
            const currentTime = document.getElementById('global-current-time');
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (currentTime) currentTime.textContent = formatTime(estimatedPosition);

            // Update popup progress if open
            if (popup && popup.style.display === 'flex') {
                const popupProgressFill = document.getElementById('global-popup-progress-fill');
                const popupCurrentTime = document.getElementById('global-popup-current-time');
                if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
                if (popupCurrentTime) popupCurrentTime.textContent = formatTime(estimatedPosition);
            }

            progressAnimationFrame = requestAnimationFrame(animateProgress);
        }

        progressAnimationFrame = requestAnimationFrame(animateProgress);
    }

    // Stop client-side progress animation
    function stopProgressAnimation() {
        if (progressAnimationFrame) {
            cancelAnimationFrame(progressAnimationFrame);
            progressAnimationFrame = null;
        }
    }

    function updateGlobalStatus(status, showBar = false) {
        const wasPlaying = globalIsPlaying;
        globalIsPlaying = status.state === 'play' || status.state === 'stream';

        // Update play/pause buttons
        updatePlayPauseButtons();

        // Check if track changed
        const trackChanged = lastTrackTitle !== status.title;

        // Update Now Playing bar with track info
        if (status.title && (showBar || nowPlayingBar?.classList.contains('visible'))) {
            document.getElementById('global-np-title').textContent = status.title;
            document.getElementById('global-np-artist').textContent = status.artist || '-';

            const cover = document.getElementById('global-np-cover');
            const placeholder = document.getElementById('global-np-cover-placeholder');

            if (status.imageUrl) {
                cover.src = status.imageUrl;
                cover.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                cover.style.display = 'none';
                placeholder.style.display = 'flex';
            }

            // Store current track info
            globalCurrentTrack = {
                title: status.title,
                artist: status.artist,
                album: status.album,
                imageUrl: status.imageUrl
            };

            lastTrackTitle = status.title;

            // Update popup if open
            if (popup && popup.style.display === 'flex') {
                document.getElementById('global-popup-title').textContent = status.title;
                document.getElementById('global-popup-artist').textContent = status.artist || '-';
                document.getElementById('global-popup-album').textContent = status.album || '';

                const popupCover = document.getElementById('global-popup-cover');
                const popupPlaceholder = document.getElementById('global-popup-cover-placeholder');
                if (status.imageUrl) {
                    popupCover.src = status.imageUrl;
                    popupCover.style.display = 'block';
                    popupPlaceholder.style.display = 'none';
                } else {
                    popupCover.style.display = 'none';
                    popupPlaceholder.style.display = 'flex';
                }
            }

            // Show the Now Playing bar
            if (showBar && (globalIsPlaying || status.state === 'pause')) {
                showNowPlayingBar();
            }
        }

        // Update progress tracking for client-side animation
        if (status.currentSeconds !== undefined && status.totalSeconds !== undefined && status.totalSeconds > 0) {
            // Calculate expected position from client-side animation
            const elapsed = lastStatusTime > 0 ? (Date.now() - lastStatusTime) / 1000 : 0;
            const estimatedPosition = lastKnownPosition + elapsed;
            const actualDiff = Math.abs(status.currentSeconds - estimatedPosition);

            // Store values for animation
            lastKnownPosition = status.currentSeconds;
            lastKnownTotal = status.totalSeconds;
            lastStatusTime = Date.now();

            // Update total time (only changes when track changes)
            const totalTimeEl = document.getElementById('global-total-time');
            if (totalTimeEl) totalTimeEl.textContent = formatTime(status.totalSeconds);

            const popupTotalTimeEl = document.getElementById('global-popup-total-time');
            if (popupTotalTimeEl) popupTotalTimeEl.textContent = formatTime(status.totalSeconds);

            // Only do immediate UI update if track changed or progress differs by more than 3 seconds
            // (otherwise the animation will smoothly update it)
            if (trackChanged || actualDiff > 3) {
                const progress = (status.currentSeconds / status.totalSeconds) * 100;

                const progressFill = document.getElementById('global-progress-fill');
                const currentTime = document.getElementById('global-current-time');
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (currentTime) currentTime.textContent = formatTime(status.currentSeconds);

                // Sync popup progress
                if (popup && popup.style.display === 'flex') {
                    const popupProgressFill = document.getElementById('global-popup-progress-fill');
                    const popupCurrentTime = document.getElementById('global-popup-current-time');
                    if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
                    if (popupCurrentTime) popupCurrentTime.textContent = formatTime(status.currentSeconds);
                }
            }
        }

        // Stop polling if playback paused/stopped
        if (!globalIsPlaying && status.state === 'pause' && wasPlaying) {
            stopStatusPolling();
        }
    }

    function showNowPlayingBar() {
        if (nowPlayingBar) {
            nowPlayingBar.classList.add('visible');
        }
    }

    function hideNowPlayingBar() {
        if (nowPlayingBar) {
            nowPlayingBar.classList.remove('visible');
        }
    }

    function updatePlayPauseButtons() {
        // Main bar buttons
        const playIcon = document.querySelector('#global-btn-play-pause .global-icon-play');
        const pauseIcon = document.querySelector('#global-btn-play-pause .global-icon-pause');

        if (playIcon && pauseIcon) {
            if (globalIsPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        }

        // Popup buttons
        const popupPlayIcon = document.querySelector('#global-popup-btn-play-pause .global-popup-icon-play');
        const popupPauseIcon = document.querySelector('#global-popup-btn-play-pause .global-popup-icon-pause');

        if (popupPlayIcon && popupPauseIcon) {
            if (globalIsPlaying) {
                popupPlayIcon.style.display = 'none';
                popupPauseIcon.style.display = 'block';
            } else {
                popupPlayIcon.style.display = 'block';
                popupPauseIcon.style.display = 'none';
            }
        }
    }

    // ==================== Playback Controls ====================

    async function sendBluesoundControl(action) {
        if (globalSelectedPlayer.type !== 'bluesound' || !globalSelectedPlayer.ip) {
            return false;
        }

        try {
            const response = await fetch('/Qobuz?handler=BluesoundControl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ip: globalSelectedPlayer.ip,
                    port: globalSelectedPlayer.port || 11000,
                    action: action
                })
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Failed to send Bluesound control:', error);
            return false;
        }
    }

    window.globalTogglePlayPause = async function() {
        if (globalSelectedPlayer.type === 'bluesound') {
            const action = globalIsPlaying ? 'pause' : 'play';
            const success = await sendBluesoundControl(action);
            if (success) {
                globalIsPlaying = !globalIsPlaying;
                updatePlayPauseButtons();

                if (globalIsPlaying) {
                    startStatusPolling();
                } else {
                    stopStatusPolling();
                }
            }
        }
    };

    window.globalPlayPrevious = async function() {
        if (globalSelectedPlayer.type === 'bluesound') {
            await sendBluesoundControl('previous');
        }
    };

    window.globalPlayNext = async function() {
        if (globalSelectedPlayer.type === 'bluesound') {
            await sendBluesoundControl('next');
        }
    };

    // ==================== Now Playing Popup ====================

    window.openGlobalNowPlayingPopup = function() {
        if (!popup || !globalCurrentTrack) return;

        // Sync cover
        const cover = document.getElementById('global-popup-cover');
        const placeholder = document.getElementById('global-popup-cover-placeholder');

        if (globalCurrentTrack.imageUrl) {
            cover.src = globalCurrentTrack.imageUrl;
            cover.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        // Sync track info
        document.getElementById('global-popup-title').textContent = globalCurrentTrack.title || 'Unbekannt';
        document.getElementById('global-popup-artist').textContent = globalCurrentTrack.artist || '-';
        document.getElementById('global-popup-album').textContent = globalCurrentTrack.album || '';

        // Sync progress
        document.getElementById('global-popup-progress-fill').style.width =
            document.getElementById('global-progress-fill').style.width;
        document.getElementById('global-popup-current-time').textContent =
            document.getElementById('global-current-time').textContent;
        document.getElementById('global-popup-total-time').textContent =
            document.getElementById('global-total-time').textContent;

        // Update quality buttons
        updateQualityButtons();

        popup.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeGlobalNowPlayingPopup = function() {
        if (popup) {
            popup.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    // ==================== Quality Settings ====================

    function loadStreamQuality() {
        const creds = getActiveProfileCredentials();
        if (creds?.userId) {
            const saved = localStorage.getItem(`${STORAGE_STREAM_QUALITY}_${creds.userId}`);
            if (saved) {
                globalStreamQuality = parseInt(saved, 10);
            }
        }
    }

    function saveStreamQuality(formatId) {
        const creds = getActiveProfileCredentials();
        if (creds?.userId) {
            localStorage.setItem(`${STORAGE_STREAM_QUALITY}_${creds.userId}`, formatId.toString());
        }
    }

    function updateQualityButtons() {
        document.querySelectorAll('.global-quality-option').forEach(btn => {
            const format = parseInt(btn.dataset.format, 10);
            btn.classList.toggle('active', format === globalStreamQuality);
        });
    }

    window.setGlobalStreamQuality = function(formatId) {
        if (formatId === globalStreamQuality) return;

        globalStreamQuality = formatId;
        saveStreamQuality(formatId);
        updateQualityButtons();

        // Call Qobuz page callback to restart current track with new quality
        if (window.onGlobalQualityChange) {
            window.onGlobalQualityChange(formatId);
        }
    };

    // ==================== Player Selector ====================

    window.openGlobalPlayerSelector = async function() {
        if (!playerSelector) return;

        playerSelector.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Show loading
        const list = document.getElementById('global-player-list');
        list.innerHTML = `
            <div class="global-player-loading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span>Player werden gesucht...</span>
            </div>
        `;

        // Load players
        try {
            const response = await fetch('/Qobuz?handler=Players');
            const data = await response.json();

            if (data.success) {
                globalAvailablePlayers = data.players || [];
                renderPlayerList();
            }
        } catch (error) {
            console.error('Failed to load players:', error);
            list.innerHTML = '<div class="global-player-loading">Fehler beim Laden</div>';
        }
    };

    window.closeGlobalPlayerSelector = function() {
        if (playerSelector) {
            playerSelector.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    function renderPlayerList() {
        const list = document.getElementById('global-player-list');
        if (!list) return;

        const browserSelected = globalSelectedPlayer.type === 'browser';

        let html = `
            <div class="global-player-option ${browserSelected ? 'active' : ''}" onclick="selectGlobalPlayer('browser')">
                <div class="global-player-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="5" y="2" width="14" height="20" rx="2"/>
                        <path d="M12 18h.01"/>
                    </svg>
                </div>
                <div class="global-player-info">
                    <span class="global-player-name">Dieses Gerät</span>
                    <span class="global-player-model">Browser</span>
                </div>
                <svg class="global-player-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        `;

        globalAvailablePlayers.forEach(player => {
            const isSelected = globalSelectedPlayer.type === 'bluesound' && globalSelectedPlayer.id === player.id;
            html += `
                <div class="global-player-option ${isSelected ? 'active' : ''}" onclick="selectGlobalPlayer('bluesound', ${JSON.stringify(player).replace(/"/g, '&quot;')})">
                    <div class="global-player-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="4" y="4" width="16" height="16" rx="2"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </div>
                    <div class="global-player-info">
                        <span class="global-player-name">${escapeHtml(player.name)}</span>
                        <span class="global-player-model">${escapeHtml(player.model || 'Bluesound')}</span>
                    </div>
                    <svg class="global-player-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            `;
        });

        list.innerHTML = html;
    }

    window.selectGlobalPlayer = function(type, player = null) {
        if (type === 'browser') {
            globalSelectedPlayer = { type: 'browser', name: 'Dieses Gerät' };
            stopStatusPolling();
        } else if (type === 'bluesound' && player) {
            globalSelectedPlayer = {
                type: 'bluesound',
                id: player.id,
                name: player.name,
                ip: player.ip,
                port: player.port || 11000,
                model: player.model
            };
            // Check status immediately
            checkCurrentPlayback();
        }

        saveSelectedPlayer();
        updatePlayerDisplay();
        closeGlobalPlayerSelector();
    };

    // ==================== Utilities ====================

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== Public API ====================

    // Allow Qobuz page to update the global player
    window.GlobalPlayer = {
        showBar: showNowPlayingBar,
        hideBar: hideNowPlayingBar,
        updateStatus: updateGlobalStatus,
        startPolling: startStatusPolling,
        stopPolling: stopStatusPolling,
        getSelectedPlayer: () => globalSelectedPlayer,
        getStreamQuality: () => globalStreamQuality,
        setCurrentTrack: (track) => {
            globalCurrentTrack = track;
            if (track) {
                document.getElementById('global-np-title').textContent = track.title || 'Unbekannt';
                document.getElementById('global-np-artist').textContent = track.artistName || track.artist || '-';

                const cover = document.getElementById('global-np-cover');
                const placeholder = document.getElementById('global-np-cover-placeholder');
                if (track.albumCover || track.imageUrl) {
                    cover.src = track.albumCover || track.imageUrl;
                    cover.style.display = 'block';
                    placeholder.style.display = 'none';
                } else {
                    cover.style.display = 'none';
                    placeholder.style.display = 'flex';
                }
            }
        },
        setPlaying: (playing) => {
            globalIsPlaying = playing;
            updatePlayPauseButtons();
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalPlayer);
    } else {
        initGlobalPlayer();
    }
})();
