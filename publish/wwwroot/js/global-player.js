// ==================== Global Player Controller ====================
// Handles playback status and controls across all pages

(function() {
    'use strict';

    // Constants
    const STORAGE_PLAYBACK_STATE = 'global_playback_state';

    // State
    let globalSelectedPlayer = { type: 'browser', name: 'Dieses Gerät' };
    let globalIsPlaying = false;
    let globalCurrentTrack = null;
    let globalStreamQuality = 27; // Default: Hi-Res Max
    let globalStatusInterval = null;
    let globalAvailablePlayers = [];
    let settingsInitialized = false;

    // Progress animation state
    let progressAnimationFrame = null;
    let lastKnownPosition = 0;
    let lastKnownTotal = 0;
    let lastStatusTime = 0;
    let lastTrackTitle = null;

    // Callbacks for page-specific playback control (set by Qobuz page)
    let onTogglePlayPause = null;
    let onPlayPrevious = null;
    let onPlayNext = null;
    let onSeek = null;
    let onPlayerChange = null;

    // DOM Elements (initialized after DOM ready)
    let nowPlayingBar = null;
    let popup = null;
    let playerSelector = null;
    let globalAudioPlayer = null;

    // Browser playback state
    let currentPlaylist = [];
    let currentTrackIndex = -1;

    // Queue state
    let currentQueue = null; // { sourceType, sourceId, sourceName, currentIndex, tracks }
    let onPlayQueueTrack = null; // Callback for playing a queue track
    let onQueueTrackChanged = null; // Callback for when queue track changes (just UI update, no playback)

    // Pending navigation state (for cross-page "Go to Album/Playlist" feature)
    // Stored in sessionStorage to survive page navigation
    const STORAGE_PENDING_NAVIGATION = 'global_pending_navigation';
    let pendingNavigation = null; // { type: 'album'|'playlist', id: string, trackIndex: number }

    // ==================== Playback State Persistence ====================

    function savePlaybackState() {
        if (!globalAudioPlayer || !globalAudioPlayer.src || globalSelectedPlayer.type !== 'browser') {
            return;
        }

        const state = {
            src: globalAudioPlayer.src,
            currentTime: globalAudioPlayer.currentTime,
            wasPlaying: globalIsPlaying,
            track: globalCurrentTrack,
            timestamp: Date.now()
        };

        try {
            sessionStorage.setItem(STORAGE_PLAYBACK_STATE, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save playback state:', e);
        }
    }

    function restorePlaybackState() {
        if (!globalAudioPlayer || globalSelectedPlayer.type !== 'browser') {
            return;
        }

        try {
            const saved = sessionStorage.getItem(STORAGE_PLAYBACK_STATE);
            if (!saved) return;

            const state = JSON.parse(saved);

            // Only restore if saved recently (within last 30 seconds)
            if (Date.now() - state.timestamp > 30000) {
                sessionStorage.removeItem(STORAGE_PLAYBACK_STATE);
                return;
            }

            // Restore track info
            if (state.track) {
                setCurrentTrackInfo(state.track);
            }

            // Restore audio
            if (state.src) {
                globalAudioPlayer.src = state.src;
                globalAudioPlayer.currentTime = state.currentTime || 0;

                if (state.wasPlaying) {
                    globalAudioPlayer.play().catch(e => {
                        // Autoplay might be blocked, that's okay
                        console.log('Autoplay prevented:', e);
                    });
                }
            }

            // Clear the saved state
            sessionStorage.removeItem(STORAGE_PLAYBACK_STATE);
        } catch (e) {
            console.error('Failed to restore playback state:', e);
        }
    }

    // ==================== Initialization ====================

    async function initGlobalPlayer() {
        // Get DOM elements
        nowPlayingBar = document.getElementById('global-now-playing-bar');
        popup = document.getElementById('global-np-popup');
        playerSelector = document.getElementById('global-player-selector');
        globalAudioPlayer = document.getElementById('global-audio-player');

        if (!nowPlayingBar) return;

        // Initialize global audio player
        if (globalAudioPlayer) {
            globalAudioPlayer.addEventListener('timeupdate', handleAudioTimeUpdate);
            globalAudioPlayer.addEventListener('ended', handleAudioEnded);
            globalAudioPlayer.addEventListener('loadedmetadata', handleAudioMetadata);
            globalAudioPlayer.addEventListener('play', () => {
                globalIsPlaying = true;
                updatePlayPauseButtons();
            });
            globalAudioPlayer.addEventListener('pause', () => {
                globalIsPlaying = false;
                updatePlayPauseButtons();
            });
        }

        // Load saved player and stream quality from server
        await loadSettingsFromServer();

        // Restore playback state from previous page
        restorePlaybackState();

        // Check if user is logged in (has profile)
        const hasProfile = await hasActiveProfileAsync();
        if (hasProfile) {
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

        // Setup progress bar click-to-seek
        setupProgressBarSeek();

        // Setup go-to-source button
        initGotoSourceButton();

        // Save playback state before page unload
        window.addEventListener('beforeunload', savePlaybackState);

        settingsInitialized = true;
    }

    // Load settings from server
    async function loadSettingsFromServer() {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (!activeProfileId) return;

            // Load player selection
            const playerSelection = await SettingsApi.getPlayerSelection(activeProfileId);
            if (playerSelection) {
                globalSelectedPlayer = {
                    type: playerSelection.type || 'browser',
                    name: playerSelection.name || 'Dieses Gerät',
                    ip: playerSelection.ip,
                    port: playerSelection.port,
                    model: playerSelection.model
                };
                updatePlayerDisplay();
            }

            // Load streaming quality
            const quality = await SettingsApi.getStreamingQuality(activeProfileId);
            globalStreamQuality = quality || 27;
        } catch (e) {
            console.error('Failed to load settings from server:', e);
        }
    }

    // ==================== Global Audio Player Events ====================

    function handleAudioTimeUpdate() {
        if (!globalAudioPlayer || !globalAudioPlayer.duration) return;

        const current = globalAudioPlayer.currentTime;
        const total = globalAudioPlayer.duration;
        const progress = (current / total) * 100;

        // Update progress UI
        const progressFill = document.getElementById('global-progress-fill');
        const currentTime = document.getElementById('global-current-time');
        const totalTime = document.getElementById('global-total-time');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (currentTime) currentTime.textContent = formatTime(current);
        if (totalTime) totalTime.textContent = formatTime(total);

        // Update popup if open
        if (popup && popup.style.display === 'flex') {
            const popupProgressFill = document.getElementById('global-popup-progress-fill');
            const popupCurrentTime = document.getElementById('global-popup-current-time');
            const popupTotalTime = document.getElementById('global-popup-total-time');

            if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
            if (popupCurrentTime) popupCurrentTime.textContent = formatTime(current);
            if (popupTotalTime) popupTotalTime.textContent = formatTime(total);
        }

        // Store for seek calculations
        lastKnownPosition = current;
        lastKnownTotal = total;
        lastStatusTime = Date.now();
    }

    function handleAudioEnded() {
        // Play next track if available
        if (onPlayNext) {
            onPlayNext();
        } else if (currentPlaylist.length > 0 && currentTrackIndex < currentPlaylist.length - 1) {
            playTrackAtIndex(currentTrackIndex + 1);
        } else {
            globalIsPlaying = false;
            updatePlayPauseButtons();
        }
    }

    function handleAudioMetadata() {
        if (!globalAudioPlayer) return;
        const totalTime = document.getElementById('global-total-time');
        const popupTotalTime = document.getElementById('global-popup-total-time');
        if (totalTime) totalTime.textContent = formatTime(globalAudioPlayer.duration);
        if (popupTotalTime) popupTotalTime.textContent = formatTime(globalAudioPlayer.duration);
        lastKnownTotal = globalAudioPlayer.duration;
    }

    // Play a track from the current playlist
    async function playTrackAtIndex(index) {
        if (index < 0 || index >= currentPlaylist.length) return;

        const track = currentPlaylist[index];
        currentTrackIndex = index;

        // Update UI with track info
        setCurrentTrackInfo(track);

        // Get stream URL and play
        if (track.streamUrl) {
            globalAudioPlayer.src = track.streamUrl;
            globalAudioPlayer.play();
            globalIsPlaying = true;
            updatePlayPauseButtons();
        }
    }

    function setCurrentTrackInfo(track) {
        globalCurrentTrack = track;

        document.getElementById('global-np-title').textContent = track.title || 'Unbekannt';
        document.getElementById('global-np-artist').textContent = track.artist || track.artistName || '-';

        const cover = document.getElementById('global-np-cover');
        const placeholder = document.getElementById('global-np-cover-placeholder');
        if (track.imageUrl || track.albumCover) {
            cover.src = track.imageUrl || track.albumCover;
            cover.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        lastTrackTitle = track.title;
    }

    // ==================== Progress Bar Seek ====================

    function setupProgressBarSeek() {
        // Main bar progress
        const progressBar = document.getElementById('global-progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', handleProgressBarClick);
        }

        // Popup progress bar
        const popupProgressBar = document.getElementById('global-popup-progress-bar');
        if (popupProgressBar) {
            popupProgressBar.addEventListener('click', handleProgressBarClick);
        }
    }

    function handleProgressBarClick(e) {
        // Get duration from audio player if available, fallback to lastKnownTotal
        const duration = (globalAudioPlayer && globalAudioPlayer.duration) || lastKnownTotal;
        if (!duration || duration <= 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const seekTime = percentage * duration;

        // Direct seek on global audio player (takes priority)
        if (globalSelectedPlayer.type === 'browser' && globalAudioPlayer && globalAudioPlayer.src) {
            globalAudioPlayer.currentTime = seekTime;
        } else if (onSeek) {
            // Use page callback for non-browser playback
            onSeek(seekTime);
        }

        // Update UI immediately for responsiveness
        lastKnownPosition = seekTime;
        lastKnownTotal = duration;
        lastStatusTime = Date.now();

        const progress = percentage * 100;
        const progressFill = document.getElementById('global-progress-fill');
        const currentTime = document.getElementById('global-current-time');
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (currentTime) currentTime.textContent = formatTime(seekTime);

        // Update popup if open
        if (popup && popup.style.display === 'flex') {
            const popupProgressFill = document.getElementById('global-popup-progress-fill');
            const popupCurrentTime = document.getElementById('global-popup-current-time');
            if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
            if (popupCurrentTime) popupCurrentTime.textContent = formatTime(seekTime);
        }
    }

    // ==================== Profile Check ====================

    async function hasActiveProfileAsync() {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            return !!activeProfileId;
        } catch (e) {
            return false;
        }
    }

    // Synchronous check for backwards compatibility
    function hasActiveProfile() {
        // Use cached value from UserProfileManager
        return !!UserProfileManager.getActiveProfileIdSync();
    }

    async function getActiveProfileCredentialsAsync() {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (!activeProfileId) return null;

            const credentials = await SettingsApi.getQobuzCredentials(activeProfileId);
            return credentials;
        } catch (e) {
            return null;
        }
    }

    // Sync version for quick checks (uses cached data)
    function getActiveProfileCredentials() {
        const activeProfile = UserProfileManager.getAllProfilesSync()
            .find(p => p.id === UserProfileManager.getActiveProfileIdSync());
        return activeProfile?.qobuz || null;
    }

    // ==================== Player Selection ====================

    async function loadSavedPlayer() {
        // Settings are now loaded in loadSettingsFromServer()
        // This function is kept for backwards compatibility
    }

    async function saveSelectedPlayer() {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (!activeProfileId) return;

            await SettingsApi.updatePlayerSelection(activeProfileId, {
                type: globalSelectedPlayer.type,
                name: globalSelectedPlayer.name,
                ip: globalSelectedPlayer.ip,
                port: globalSelectedPlayer.port,
                model: globalSelectedPlayer.model
            });
        } catch (e) {
            console.error('Failed to save player selection:', e);
        }
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
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: globalSelectedPlayer.ip,
                    port: globalSelectedPlayer.port || 11000,
                    action: action
                })
            });

            if (!response.ok) {
                console.error('Bluesound control failed:', response.status, response.statusText);
                return false;
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Failed to send Bluesound control:', error);
            return false;
        }
    }

    window.globalTogglePlayPause = async function() {
        // Use page callback if available (for browser playback)
        if (onTogglePlayPause) {
            onTogglePlayPause();
            return;
        }

        // Browser playback via global audio player
        if (globalSelectedPlayer.type === 'browser' && globalAudioPlayer && globalAudioPlayer.src) {
            if (globalIsPlaying) {
                globalAudioPlayer.pause();
            } else {
                globalAudioPlayer.play();
            }
            return;
        }

        // Fallback for Bluesound when no page callback
        if (globalSelectedPlayer.type === 'bluesound' && globalSelectedPlayer.ip) {
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
        // Use page callback if available
        if (onPlayPrevious) {
            onPlayPrevious();
            return;
        }

        // Browser playback - previous track
        if (globalSelectedPlayer.type === 'browser' && currentPlaylist.length > 0 && currentTrackIndex > 0) {
            playTrackAtIndex(currentTrackIndex - 1);
            return;
        }

        // Fallback for Bluesound
        if (globalSelectedPlayer.type === 'bluesound' && globalSelectedPlayer.ip) {
            await sendBluesoundControl('previous');
        }
    };

    window.globalPlayNext = async function() {
        // Use page callback if available
        if (onPlayNext) {
            onPlayNext();
            return;
        }

        // Browser playback - next track
        if (globalSelectedPlayer.type === 'browser' && currentPlaylist.length > 0 && currentTrackIndex < currentPlaylist.length - 1) {
            playTrackAtIndex(currentTrackIndex + 1);
            return;
        }

        // Fallback for Bluesound
        if (globalSelectedPlayer.type === 'bluesound' && globalSelectedPlayer.ip) {
            await sendBluesoundControl('next');
        }
    };

    // ==================== Now Playing Popup ====================

    window.openGlobalNowPlayingPopup = async function() {
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

        // Update go-to-source button (uses existing currentQueue if available)
        updateGotoSourceButton();

        popup.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    window.closeGlobalNowPlayingPopup = function() {
        if (popup) {
            popup.style.display = 'none';
            document.body.style.overflow = '';
        }
    };

    // ==================== Queue Functions ====================

    // Make loadAndRenderQueue globally accessible
    window.loadAndRenderQueue = async function() {
        const queueSection = document.getElementById('global-queue-section');
        const queueList = document.getElementById('global-queue-list');
        const queueSource = document.getElementById('global-queue-source');

        if (!queueSection || !queueList) return;

        // Show skeleton while loading
        showQueueSkeleton();
        queueSection.style.display = 'block';

        // For Bluesound players, fetch queue directly from the player
        if (globalSelectedPlayer.type === 'bluesound' && globalSelectedPlayer.ip) {
            const queue = await fetchBluesoundQueue();
            if (queue && queue.tracks && queue.tracks.length > 0) {
                currentQueue = queue;
                renderQueueInPopup(queue);
                return;
            }
        }

        // If we have a current queue in memory, use it (for browser playback)
        if (currentQueue && currentQueue.tracks && currentQueue.tracks.length > 0) {
            renderQueueInPopup(currentQueue);
            return;
        }

        // Otherwise, try to load from server (database queue)
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (!activeProfileId) {
                queueSection.style.display = 'none';
                return;
            }

            const queueDto = await QueueApi.getQueue(activeProfileId);
            if (queueDto && queueDto.tracks && queueDto.tracks.length > 0) {
                currentQueue = QueueApi.mapQueueDtoToUi(queueDto);
                renderQueueInPopup(currentQueue);
            } else {
                queueSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load queue:', error);
            queueSection.style.display = 'none';
        }
    }

    // Show skeleton loader while loading queue
    function showQueueSkeleton() {
        const queueList = document.getElementById('global-queue-list');
        if (!queueList) return;

        queueList.innerHTML = Array(8).fill(0).map(() => `
            <div class="global-queue-item skeleton">
                <div class="global-queue-item-position skeleton-box"></div>
                <div class="global-queue-item-cover skeleton-box"></div>
                <div class="global-queue-item-info">
                    <div class="skeleton-text" style="width: 70%"></div>
                    <div class="skeleton-text" style="width: 50%"></div>
                </div>
                <div class="skeleton-text" style="width: 40px"></div>
            </div>
        `).join('');
    }

    // Fetch queue directly from Bluesound player
    async function fetchBluesoundQueue() {
        if (globalSelectedPlayer.type !== 'bluesound' || !globalSelectedPlayer.ip) {
            return null;
        }

        try {
            const ip = globalSelectedPlayer.ip || globalSelectedPlayer.ipAddress;
            const port = globalSelectedPlayer.port || 11000;
            const response = await fetch(`/Qobuz?handler=BluesoundQueue&ip=${ip}&port=${port}`);
            const data = await response.json();

            // Debug logging for currentIndex issue
            console.log('Bluesound Queue Response:', data);
            console.log('currentIndex from server:', data.currentIndex, 'total items:', data.items?.length);

            if (!data.success) {
                console.error('Failed to fetch Bluesound queue:', data.error);
                return null;
            }

            return {
                sourceType: 'bluesound',
                sourceId: data.queueId,
                sourceName: 'Bluesound Queue',
                currentIndex: data.currentIndex ?? 0,
                tracks: data.items.map(item => ({
                    title: item.title,
                    artistName: item.artist,
                    albumTitle: item.album,
                    albumCover: item.imageUrl,
                    formattedDuration: item.duration,
                    qualityLabel: item.quality?.toUpperCase(),
                    queueId: item.queueId // Bluesound queue ID for /Play?id=X
                }))
            };
        } catch (error) {
            console.error('Error fetching Bluesound queue:', error);
            return null;
        }
    }

    // Make renderQueueInPopup globally accessible
    window.renderQueueInPopup = function(queue) {
        const queueSection = document.getElementById('global-queue-section');
        const queueList = document.getElementById('global-queue-list');
        const queueSource = document.getElementById('global-queue-source');

        if (!queueList) return;

        if (!queue || !queue.tracks || queue.tracks.length === 0) {
            queueList.innerHTML = `
                <div class="global-queue-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <p>Keine Warteschlange</p>
                </div>
            `;
            return;
        }

        // Update source label
        if (queueSource && queue.sourceName) {
            const sourceLabel = queue.sourceType === 'playlist' ? 'Playlist' : 'Album';
            queueSource.textContent = `${sourceLabel}: ${queue.sourceName}`;
        } else if (queueSource) {
            queueSource.textContent = '';
        }

        const currentIndex = queue.currentIndex || 0;

        // Render all track items (scrollable list)
        let html = '';
        for (let i = 0; i < queue.tracks.length; i++) {
            const track = queue.tracks[i];
            const isCurrent = i === currentIndex;

            html += `
                <div class="global-queue-item ${isCurrent ? 'playing' : ''}"
                     data-index="${i}"
                     onclick="playQueueTrackAtIndex(${i})">
                    <span class="global-queue-item-position">${isCurrent ? '' : (i + 1)}</span>
                    <div class="global-queue-item-cover">
                        ${track.albumCover
                            ? `<img src="${escapeHtml(track.albumCover)}" alt="" loading="lazy">`
                            : `<div class="global-queue-item-cover-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                </svg>
                               </div>`
                        }
                    </div>
                    <div class="global-queue-item-info">
                        <div class="global-queue-item-title">${escapeHtml(track.title)}</div>
                        <div class="global-queue-item-artist">${escapeHtml(track.artistName || 'Unbekannt')}</div>
                    </div>
                    <span class="global-queue-item-duration">${track.formattedDuration || ''}</span>
                </div>
            `;
        }

        queueList.innerHTML = html;

        // Scroll current track into view
        setTimeout(() => {
            const currentItem = queueList.querySelector('.global-queue-item.playing');
            if (currentItem) {
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    // Play a track from the queue at the given index
    window.playQueueTrackAtIndex = async function(index) {
        if (!currentQueue || !currentQueue.tracks || index < 0 || index >= currentQueue.tracks.length) {
            return;
        }

        // Update queue index
        currentQueue.currentIndex = index;

        // For Bluesound players with Bluesound queue, play directly on the player
        if (globalSelectedPlayer.type === 'bluesound' &&
            globalSelectedPlayer.ip &&
            currentQueue.sourceType === 'bluesound') {
            try {
                const ip = globalSelectedPlayer.ip || globalSelectedPlayer.ipAddress;
                const port = globalSelectedPlayer.port || 11000;
                const track = currentQueue.tracks[index];

                // Use the Bluesound queue ID if available, otherwise fall back to index
                const playId = track.queueId ?? index;
                console.log('Playing Bluesound queue item:', { index, queueId: track.queueId, playId });

                // Call Bluesound /Play?id=X endpoint via backend
                await fetch('/Qobuz?handler=BluesoundControl', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                    },
                    body: JSON.stringify({
                        ip: ip,
                        port: port,
                        action: `play_id_${playId}`
                    })
                });

                // Update Now Playing Bar with new track info
                if (track) {
                    globalCurrentTrack = {
                        title: track.title,
                        artist: track.artistName,
                        album: track.albumTitle,
                        imageUrl: track.albumCover
                    };

                    // Update main bar
                    document.getElementById('global-np-title').textContent = track.title || 'Unbekannt';
                    document.getElementById('global-np-artist').textContent = track.artistName || '-';

                    const cover = document.getElementById('global-np-cover');
                    const placeholder = document.getElementById('global-np-cover-placeholder');
                    if (track.albumCover) {
                        cover.src = track.albumCover;
                        cover.style.display = 'block';
                        placeholder.style.display = 'none';
                    } else {
                        cover.style.display = 'none';
                        placeholder.style.display = 'flex';
                    }

                    // Update popup if open
                    if (popup && popup.style.display === 'flex') {
                        document.getElementById('global-popup-title').textContent = track.title || 'Unbekannt';
                        document.getElementById('global-popup-artist').textContent = track.artistName || '-';
                        document.getElementById('global-popup-album').textContent = track.albumTitle || '';

                        const popupCover = document.getElementById('global-popup-cover');
                        const popupPlaceholder = document.getElementById('global-popup-cover-placeholder');
                        if (track.albumCover) {
                            popupCover.src = track.albumCover;
                            popupCover.style.display = 'block';
                            popupPlaceholder.style.display = 'none';
                        } else {
                            popupCover.style.display = 'none';
                            popupPlaceholder.style.display = 'flex';
                        }
                    }

                    lastTrackTitle = track.title;
                }

                // Set playing state and start status polling
                globalIsPlaying = true;
                updatePlayPauseButtons();
                startStatusPolling();

                // Re-render the queue to show the new current track
                renderQueueInPopup(currentQueue);

                // Notify page about track change (just UI update, doesn't restart playback)
                if (onQueueTrackChanged && track) {
                    onQueueTrackChanged(track);
                }

                // Reload queue from Bluesound after a short delay to get the correct current track
                setTimeout(async () => {
                    const updatedQueue = await fetchBluesoundQueue();
                    if (updatedQueue) {
                        currentQueue = updatedQueue;
                        renderQueueInPopup(currentQueue);
                    }
                }, 500);

                return;
            } catch (error) {
                console.error('Failed to play queue track on Bluesound:', error);
            }
        }

        // Use page callback if available (for browser playback or Qobuz native playback)
        if (onPlayQueueTrack) {
            onPlayQueueTrack(index);
        }

        // Re-render the queue to show the new current track
        renderQueueInPopup(currentQueue);

        // Update queue index in database (only for non-Bluesound queues)
        if (currentQueue.sourceType !== 'bluesound') {
            updateQueueIndexInDb(index);
        }
    };

    async function updateQueueIndexInDb(index) {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (activeProfileId) {
                await QueueApi.updateQueueIndex(activeProfileId, index);
            }
        } catch (error) {
            console.error('Failed to update queue index:', error);
        }
    }

    // ==================== Go to Source Button ====================

    function updateGotoSourceButton() {
        const gotoSourceBtn = document.getElementById('global-popup-goto-source');
        if (!gotoSourceBtn) return;

        if (!currentQueue || !currentQueue.sourceId) {
            gotoSourceBtn.style.display = 'none';
            return;
        }

        gotoSourceBtn.style.display = 'flex';

        // Update title based on source type
        if (currentQueue.sourceType === 'playlist') {
            gotoSourceBtn.title = 'Playlist anzeigen';
        } else {
            gotoSourceBtn.title = 'Album anzeigen';
        }
    }

    function handleGotoSourceClick() {
        if (!currentQueue?.sourceId) return;

        // Close popup first
        closeGlobalNowPlayingPopup();

        // Save navigation intent
        pendingNavigation = {
            type: currentQueue.sourceType,
            id: currentQueue.sourceId,
            trackIndex: currentQueue.currentIndex || 0
        };

        // Check if actually on Qobuz page (not just if functions exist - they might be loaded globally)
        const isOnQobuzPage = window.location.pathname.toLowerCase() === '/qobuz';
        if (isOnQobuzPage && (typeof window.selectPlaylist === 'function' || typeof window.selectAlbum === 'function')) {
            executePendingNavigation();
        } else {
            // Save to sessionStorage for cross-page navigation (survives page reload)
            try {
                sessionStorage.setItem(STORAGE_PENDING_NAVIGATION, JSON.stringify(pendingNavigation));
            } catch (e) {
                console.error('Failed to save pending navigation:', e);
            }
            // Navigate to Qobuz page - pending navigation will be executed on load
            window.location.href = '/Qobuz';
        }
    }

    // Execute pending navigation (called after page load or immediately if already on Qobuz)
    function executePendingNavigation() {
        // Check memory first, then sessionStorage
        let nav = pendingNavigation;
        if (!nav) {
            try {
                const stored = sessionStorage.getItem(STORAGE_PENDING_NAVIGATION);
                if (stored) {
                    nav = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Failed to read pending navigation:', e);
            }
        }

        if (!nav) return;

        // Clear both memory and sessionStorage
        pendingNavigation = null;
        try {
            sessionStorage.removeItem(STORAGE_PENDING_NAVIGATION);
        } catch (e) { /* ignore */ }

        const { type, id, trackIndex } = nav;

        if (type === 'playlist' && typeof window.selectPlaylist === 'function') {
            window.selectPlaylist(parseInt(id, 10), trackIndex);
        } else if (type === 'album' && typeof window.selectAlbum === 'function') {
            window.selectAlbum(id, trackIndex);
        }
    }

    // Check if there's a pending navigation (in memory or sessionStorage)
    function hasPendingNavigation() {
        if (pendingNavigation) return true;
        try {
            return !!sessionStorage.getItem(STORAGE_PENDING_NAVIGATION);
        } catch (e) {
            return false;
        }
    }

    // Initialize go-to-source button click handler
    function initGotoSourceButton() {
        const gotoSourceBtn = document.getElementById('global-popup-goto-source');
        if (gotoSourceBtn) {
            gotoSourceBtn.addEventListener('click', handleGotoSourceClick);
        }
    }

    // ==================== Quality Settings ====================

    async function loadStreamQuality() {
        // Quality is now loaded in loadSettingsFromServer()
        // This function is kept for backwards compatibility
    }

    async function saveStreamQuality(formatId) {
        try {
            const activeProfileId = await SettingsApi.getActiveProfileId();
            if (!activeProfileId) return;

            await SettingsApi.updateStreamingQuality(activeProfileId, formatId);
        } catch (e) {
            console.error('Failed to save stream quality:', e);
        }
    }

    // Make updateQualityButtons globally accessible
    window.updateQualityButtons = function() {
        document.querySelectorAll('.global-quality-option').forEach(btn => {
            const format = parseInt(btn.dataset.format, 10);
            btn.classList.toggle('active', format === globalStreamQuality);
        });
    }

    window.setGlobalStreamQuality = async function(formatId) {
        if (formatId === globalStreamQuality) return;

        globalStreamQuality = formatId;
        await saveStreamQuality(formatId);
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
            const response = await fetch('/Qobuz?handler=Players&refreshStatus=true');
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

    // ==================== Volume Panel ====================

    window.openGlobalVolumePanel = async function() {
        // Initialize volume panel if needed
        if (typeof initVolumePanel === 'function') {
            const panel = initVolumePanel();

            // Build group data from current selected player and available players
            let groupData = null;

            if (globalSelectedPlayer.type === 'bluesound') {
                // Find the selected player in available players
                const selectedPlayer = globalAvailablePlayers.find(p =>
                    p.id === globalSelectedPlayer.id ||
                    p.ipAddress === globalSelectedPlayer.ipAddress ||
                    p.ip === globalSelectedPlayer.ipAddress
                );

                if (selectedPlayer) {
                    // Use ipAddress or ip field (backward compatibility)
                    const playerIp = selectedPlayer.ipAddress || selectedPlayer.ip;

                    groupData = {
                        master: {
                            ipAddress: playerIp,
                            port: selectedPlayer.port || 11000,
                            name: selectedPlayer.name,
                            brand: selectedPlayer.brand,
                            modelName: selectedPlayer.model || selectedPlayer.modelName,
                            volume: selectedPlayer.volume ?? 50,
                            isFixedVolume: selectedPlayer.isFixedVolume ?? false,
                            isStereoPaired: selectedPlayer.isStereoPaired ?? false,
                            channelMode: selectedPlayer.channelMode
                        },
                        // Include group members if available
                        members: (selectedPlayer.members || []).map(m => ({
                            ipAddress: m.ipAddress || m.ip,
                            port: m.port || 11000,
                            name: m.name,
                            brand: m.brand,
                            modelName: m.modelName || m.model,
                            volume: m.volume ?? 50,
                            isFixedVolume: m.isFixedVolume ?? false,
                            isStereoPaired: m.isStereoPaired ?? false,
                            channelMode: m.channelMode
                        }))
                    };
                }
            }

            panel.toggle(
                globalSelectedPlayer.ipAddress || 'browser',
                globalSelectedPlayer.port || 0,
                groupData
            );

            // Update button state
            const btn = document.getElementById('global-volume-btn');
            if (btn) {
                btn.classList.toggle('active', panel.isVisible);
            }
        } else {
            console.warn('Volume panel not initialized');
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

    window.selectGlobalPlayer = async function(type, player = null) {
        const previousPlayer = { ...globalSelectedPlayer };
        const previousType = globalSelectedPlayer.type;

        if (type === 'browser') {
            globalSelectedPlayer = { type: 'browser', name: 'Dieses Gerät' };
            stopStatusPolling();
        } else if (type === 'bluesound' && player) {
            // Support both ip and ipAddress fields
            const playerIp = player.ipAddress || player.ip;
            globalSelectedPlayer = {
                type: 'bluesound',
                id: player.id,
                name: player.name,
                ip: playerIp,
                ipAddress: playerIp,
                port: player.port || 11000,
                model: player.model
            };
            // Check status immediately
            checkCurrentPlayback();
        }

        await saveSelectedPlayer();
        updatePlayerDisplay();
        closeGlobalPlayerSelector();

        // Notify page about player change (pass old player info for handoff)
        if (onPlayerChange) {
            onPlayerChange(previousType, globalSelectedPlayer.type, globalSelectedPlayer, previousPlayer);
        }
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
        getCurrentTrack: () => globalCurrentTrack,
        getStreamQuality: () => globalStreamQuality,
        getLastKnownPosition: () => lastKnownPosition,
        getLastKnownTotal: () => lastKnownTotal,
        isPlaying: () => globalIsPlaying,
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
        },
        // Register callbacks for page-specific playback control
        registerPlaybackCallbacks: (callbacks) => {
            if (callbacks.togglePlayPause) onTogglePlayPause = callbacks.togglePlayPause;
            if (callbacks.playPrevious) onPlayPrevious = callbacks.playPrevious;
            if (callbacks.playNext) onPlayNext = callbacks.playNext;
            if (callbacks.seek) onSeek = callbacks.seek;
            if (callbacks.onPlayerChange) onPlayerChange = callbacks.onPlayerChange;
        },
        // Unregister callbacks (when leaving page)
        unregisterPlaybackCallbacks: () => {
            onTogglePlayPause = null;
            onPlayPrevious = null;
            onPlayNext = null;
            onSeek = null;
            onPlayerChange = null;
        },
        // Update progress bar
        updateProgress: (currentSeconds, totalSeconds) => {
            if (totalSeconds > 0) {
                lastKnownPosition = currentSeconds;
                lastKnownTotal = totalSeconds;
                lastStatusTime = Date.now();

                const progress = (currentSeconds / totalSeconds) * 100;
                const progressFill = document.getElementById('global-progress-fill');
                const currentTime = document.getElementById('global-current-time');
                const totalTime = document.getElementById('global-total-time');

                if (progressFill) progressFill.style.width = `${progress}%`;
                if (currentTime) currentTime.textContent = formatTime(currentSeconds);
                if (totalTime) totalTime.textContent = formatTime(totalSeconds);

                // Update popup if open
                if (popup && popup.style.display === 'flex') {
                    const popupProgressFill = document.getElementById('global-popup-progress-fill');
                    const popupCurrentTime = document.getElementById('global-popup-current-time');
                    const popupTotalTime = document.getElementById('global-popup-total-time');

                    if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
                    if (popupCurrentTime) popupCurrentTime.textContent = formatTime(currentSeconds);
                    if (popupTotalTime) popupTotalTime.textContent = formatTime(totalSeconds);
                }
            }
        },
        // Play a track directly on the global audio player
        playTrack: (streamUrl, track) => {
            if (!globalAudioPlayer) return false;
            if (globalSelectedPlayer.type !== 'browser') return false;

            // Set track info
            setCurrentTrackInfo(track);

            // Play the stream
            globalAudioPlayer.src = streamUrl;
            globalAudioPlayer.play();
            globalIsPlaying = true;
            updatePlayPauseButtons();
            return true;
        },
        // Set playlist for navigation
        setPlaylist: (tracks, startIndex = 0) => {
            currentPlaylist = tracks || [];
            currentTrackIndex = startIndex;
        },
        // Get current track index
        getCurrentTrackIndex: () => currentTrackIndex,
        // Set current track index (for sync with page)
        setCurrentTrackIndex: (index) => {
            currentTrackIndex = index;
        },
        // Get audio player reference (for direct access)
        getAudioPlayer: () => globalAudioPlayer,
        // Check if audio is currently playing
        isPlaying: () => globalIsPlaying,
        // Reload settings from server (called when profile changes)
        reloadSettings: loadSettingsFromServer,
        // ==================== Queue API ====================
        // Set the current queue (called by Qobuz page when starting playback)
        setQueue: (queue) => {
            currentQueue = queue;
            // Update go-to-source button
            updateGotoSourceButton();
            // Update the popup if it's open
            if (popup && popup.style.display === 'flex') {
                renderQueueInPopup(queue);
            }
        },
        // Get the current queue
        getQueue: () => currentQueue,
        // Update the current index in the queue
        updateQueueIndex: (index) => {
            if (currentQueue) {
                currentQueue.currentIndex = index;
                // Update the popup if it's open
                if (popup && popup.style.display === 'flex') {
                    renderQueueInPopup(currentQueue);
                }
            }
        },
        // Clear the queue
        clearQueue: () => {
            currentQueue = null;
            const queueSection = document.getElementById('global-queue-section');
            if (queueSection) queueSection.style.display = 'none';
        },
        // Register callback for playing a queue track
        registerQueueCallback: (callback) => {
            onPlayQueueTrack = callback;
        },
        // Unregister queue callback
        unregisterQueueCallback: () => {
            onPlayQueueTrack = null;
        },
        // Register callback for when queue track changes (UI update only, no playback restart)
        registerQueueTrackChangedCallback: (callback) => {
            onQueueTrackChanged = callback;
        },
        // Unregister queue track changed callback
        unregisterQueueTrackChangedCallback: () => {
            onQueueTrackChanged = null;
        },
        // ==================== Pending Navigation API ====================
        // Execute pending navigation (for cross-page "Go to Album/Playlist")
        executePendingNavigation: executePendingNavigation,
        // Check if there's a pending navigation (in memory or sessionStorage)
        hasPendingNavigation: hasPendingNavigation
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalPlayer);
    } else {
        initGlobalPlayer();
    }
})();
