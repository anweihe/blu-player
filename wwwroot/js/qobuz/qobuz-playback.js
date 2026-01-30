/**
 * Qobuz Playback Module
 * Handles playback controls, Bluesound integration, and progress tracking
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // Bluesound status polling interval
    let bluesoundStatusInterval = null;

    // ==================== Track Playback ====================

    async function playTrack(index, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const playback = QobuzApp.playback;
        if (index < 0 || index >= playback.currentTracks.length) return;

        const track = playback.currentTracks[index];
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!track.isStreamable) {
            QobuzApp.core.showError('Dieser Titel ist nicht streambar');
            return;
        }

        const trackItem = document.querySelector(`.track-item[data-index="${index}"]`);
        if (trackItem) {
            trackItem.style.opacity = '0.6';
        }

        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        try {
            if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
                await playOnBluesound(track, index, authToken);
            } else {
                await playOnBrowser(track, index, authToken);
            }
        } catch (error) {
            console.error('Failed to play track:', error);
            QobuzApp.core.showError('Fehler beim Laden des Streams');
        }

        if (trackItem) {
            trackItem.style.opacity = '1';
        }
    }

    // ==================== Browser Playback ====================

    async function playOnBrowser(track, index, authToken) {
        stopBluesoundStatusPolling();

        const playback = QobuzApp.playback;
        playback.usingNativeQobuzPlayback = false;

        const streamQuality = QobuzApp.core.getStreamQuality();
        const response = await fetch(`/Qobuz?handler=TrackStreamUrl&trackId=${track.id}&authToken=${encodeURIComponent(authToken)}&formatId=${streamQuality}`);
        const data = await response.json();

        if (data.success && data.url) {
            playback.currentTrackIndex = index;

            if (window.GlobalPlayer) {
                window.GlobalPlayer.setPlaylist(playback.currentTracks, index);
            }

            await QobuzApp.auth.saveQueueToDb(index);

            playback.audioPlayer.src = data.url;
            playback.audioPlayer.play();
            playback.isPlaying = true;

            updateNowPlaying(track);
            updateTrackHighlight();

            // Save to listening history (once per source)
            saveToHistoryOnce(track);
        } else {
            QobuzApp.core.showError(data.error || 'Stream URL konnte nicht abgerufen werden');
        }
    }

    // ==================== Bluesound Playback ====================

    async function playOnBluesound(track, index, authToken) {
        const playback = QobuzApp.playback;

        if (playback.audioPlayer.src) {
            playback.audioPlayer.pause();
        }

        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        const canUseNative = playback.currentSourceType && playback.currentSourceId &&
            (playback.currentSourceType === 'album' || playback.currentSourceType === 'playlist');

        let response;
        let data;

        if (canUseNative) {
            console.log(`Using native Qobuz integration: ${playback.currentSourceType} ${playback.currentSourceId}, track index ${index}`);

            const requestBody = {
                ip: selectedPlayer.ip,
                port: selectedPlayer.port || 11000,
                sourceType: playback.currentSourceType,
                sourceId: playback.currentSourceId,
                trackIndex: index
            };

            if (playback.currentSourceType === 'album') {
                requestBody.albumId = playback.currentSourceId;
                requestBody.trackId = track.id;
            } else if (playback.currentSourceType === 'playlist') {
                requestBody.playlistId = parseInt(playback.currentSourceId, 10);
                requestBody.trackId = track.id;
            }

            response = await fetch('?handler=PlayNativeOnBluesound', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify(requestBody)
            });

            data = await response.json();
        } else {
            console.log('Using stream URL fallback for single track');

            const streamQuality = QobuzApp.core.getStreamQuality();

            response = await fetch('?handler=PlayOnBluesound', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: selectedPlayer.ip,
                    port: selectedPlayer.port || 11000,
                    trackId: track.id,
                    authToken: authToken,
                    formatId: streamQuality,
                    title: track.title,
                    artist: track.artistName,
                    album: track.albumTitle,
                    imageUrl: track.albumCover
                })
            });

            data = await response.json();
        }

        if (data.success) {
            playback.currentTrackIndex = index;
            playback.isPlaying = true;
            playback.usingNativeQobuzPlayback = !!data.native;

            await QobuzApp.auth.saveQueueToDb(index);

            updateNowPlaying(track);
            updateTrackHighlight();

            startBluesoundStatusPolling();

            if (data.native) {
                console.log('Native Qobuz playback started - player manages queue');
            }

            // Save to listening history (once per source)
            saveToHistoryOnce(track);
        } else {
            QobuzApp.core.showError(data.error || 'Wiedergabe auf Bluesound fehlgeschlagen');
        }
    }

    // ==================== Save to History ====================

    // Track which source we've already saved to avoid duplicates
    let lastSavedHistorySourceId = null;

    function saveToHistoryOnce(track) {
        const playback = QobuzApp.playback;
        const currentSourceKey = `${playback.currentSourceType}-${playback.currentSourceId}`;

        // Only save if we haven't saved this source yet
        if (lastSavedHistorySourceId !== currentSourceKey) {
            lastSavedHistorySourceId = currentSourceKey;
            saveToHistory(track);
        }
    }

    // Reset history tracking when source changes (called from qobuz-browse.js)
    function resetHistoryTracking() {
        lastSavedHistorySourceId = null;
    }

    async function saveToHistory(track) {
        const playback = QobuzApp.playback;

        try {
            const profileId = await SettingsApi.getActiveProfileId();
            if (!profileId) {
                console.warn('No active profile, cannot save to history');
                return;
            }

            if (playback.currentSourceType === 'album' && playback.currentSourceId) {
                // Save album to history
                await fetch('/Qobuz?handler=SaveAlbumHistory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                    },
                    body: JSON.stringify({
                        profileId: profileId,
                        albumId: playback.currentSourceId,
                        albumName: track.albumTitle || playback.currentSourceName || 'Unknown Album',
                        artist: track.artistName,
                        coverUrl: track.albumCover
                    })
                });
            } else if (playback.currentSourceType === 'playlist' && playback.currentSourceId) {
                // Save playlist to history with first 10 tracks
                const tracks = playback.currentTracks.slice(0, 10).map((t, i) => ({
                    trackId: String(t.id),
                    title: t.title,
                    artist: t.artistName
                }));

                await fetch('/Qobuz?handler=SavePlaylistHistory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                    },
                    body: JSON.stringify({
                        profileId: profileId,
                        playlistId: playback.currentSourceId,
                        playlistName: playback.currentSourceName || 'Unknown Playlist',
                        coverUrl: track.albumCover,
                        tracks: tracks
                    })
                });
            }
        } catch (error) {
            console.error('Failed to save to history:', error);
        }
    }

    // ==================== Bluesound Status Polling ====================

    function startBluesoundStatusPolling() {
        stopBluesoundStatusPolling();

        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) return;

        startProgressAnimation();

        bluesoundStatusInterval = setInterval(async () => {
            const player = QobuzApp.core.getSelectedPlayer();
            if (player.type !== 'bluesound' || !player.ip) {
                stopBluesoundStatusPolling();
                return;
            }

            try {
                const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${player.ip}&port=${player.port || 11000}`);
                const data = await response.json();

                if (data.success && data.status) {
                    updateBluesoundStatus(data.status);
                }
            } catch (error) {
                console.error('Failed to get Bluesound status:', error);
            }
        }, 5000);
    }

    function stopBluesoundStatusPolling() {
        if (bluesoundStatusInterval) {
            clearInterval(bluesoundStatusInterval);
            bluesoundStatusInterval = null;
        }
        stopProgressAnimation();
    }

    // ==================== Progress Animation ====================

    function startProgressAnimation() {
        stopProgressAnimation();

        const progress = QobuzApp.progress;
        const playback = QobuzApp.playback;

        function animateProgress() {
            if (!playback.isPlaying || progress.lastKnownTotal <= 0) {
                progress.animationFrame = requestAnimationFrame(animateProgress);
                return;
            }

            const elapsed = (Date.now() - progress.lastStatusTime) / 1000;
            const estimatedPosition = Math.min(progress.lastKnownPosition + elapsed, progress.lastKnownTotal);
            const progressPercent = (estimatedPosition / progress.lastKnownTotal) * 100;

            if (window.GlobalPlayer) {
                // Desktop progress bar
                const desktopProgressFill = document.getElementById('global-np-progress-fill-desktop');
                const desktopCurrentTime = document.getElementById('global-np-time-current-desktop');
                if (desktopProgressFill) desktopProgressFill.style.width = `${progressPercent}%`;
                if (desktopCurrentTime) desktopCurrentTime.textContent = QobuzApp.core.formatTime(estimatedPosition);

                // Popup progress bar
                const popupProgressFill = document.getElementById('global-popup-progress-fill');
                const popupCurrentTime = document.getElementById('global-popup-current-time');
                if (popupProgressFill) popupProgressFill.style.width = `${progressPercent}%`;
                if (popupCurrentTime) popupCurrentTime.textContent = QobuzApp.core.formatTime(estimatedPosition);
            }

            progress.animationFrame = requestAnimationFrame(animateProgress);
        }

        progress.animationFrame = requestAnimationFrame(animateProgress);
    }

    function stopProgressAnimation() {
        const progress = QobuzApp.progress;
        if (progress.animationFrame) {
            cancelAnimationFrame(progress.animationFrame);
            progress.animationFrame = null;
        }
    }

    // ==================== Bluesound Status Update ====================

    function updateBluesoundStatus(status, showBar = false) {
        const playback = QobuzApp.playback;
        const progress = QobuzApp.progress;

        const wasPlaying = playback.isPlaying;
        playback.isPlaying = status.state === 'play' || status.state === 'stream';

        if (wasPlaying !== playback.isPlaying) {
            updateTrackHighlight();

            if (!playback.isPlaying && status.state === 'pause') {
                stopBluesoundStatusPolling();
            }
        }

        const trackChanged = progress.lastTrackTitle !== status.title;

        // Update currentTrackIndex when track changes (e.g., auto-advancement or app was in background)
        if (trackChanged && status.title && playback.currentTracks.length > 0) {
            const newIndex = findTrackIndex(status.title, status.artist);
            if (newIndex !== -1 && newIndex !== playback.currentTrackIndex) {
                playback.currentTrackIndex = newIndex;
                updateTrackHighlight();
            }
        }

        if (status.title && window.GlobalPlayer) {
            window.GlobalPlayer.setCurrentTrack({
                title: status.title,
                artist: status.artist,
                artistName: status.artist,
                album: status.album,
                imageUrl: status.imageUrl,
                albumCover: status.imageUrl
            });

            window.GlobalPlayer.setPlaying(playback.isPlaying);

            if (showBar && (playback.isPlaying || status.state === 'pause')) {
                window.GlobalPlayer.showBar();
            }

            progress.lastTrackTitle = status.title;
        }

        if (status.currentSeconds !== undefined && status.totalSeconds !== undefined && status.totalSeconds > 0) {
            const elapsed = (Date.now() - progress.lastStatusTime) / 1000;
            const estimatedPosition = progress.lastKnownPosition + elapsed;
            const actualDiff = Math.abs(status.currentSeconds - estimatedPosition);

            progress.lastKnownPosition = status.currentSeconds;
            progress.lastKnownTotal = status.totalSeconds;
            progress.lastStatusTime = Date.now();

            // Desktop total time
            const desktopTotalTimeEl = document.getElementById('global-np-time-total-desktop');
            if (desktopTotalTimeEl) desktopTotalTimeEl.textContent = QobuzApp.core.formatTime(status.totalSeconds);

            // Popup total time
            const popupTotalTimeEl = document.getElementById('global-popup-total-time');
            if (popupTotalTimeEl) popupTotalTimeEl.textContent = QobuzApp.core.formatTime(status.totalSeconds);

            if (trackChanged || actualDiff > 3) {
                const progressPercent = (status.currentSeconds / status.totalSeconds) * 100;

                // Desktop progress bar
                const desktopProgressFill = document.getElementById('global-np-progress-fill-desktop');
                const desktopCurrentTime = document.getElementById('global-np-time-current-desktop');
                if (desktopProgressFill) desktopProgressFill.style.width = `${progressPercent}%`;
                if (desktopCurrentTime) desktopCurrentTime.textContent = QobuzApp.core.formatTime(status.currentSeconds);

                // Popup progress bar
                const popupProgressFill = document.getElementById('global-popup-progress-fill');
                const popupCurrentTime = document.getElementById('global-popup-current-time');
                if (popupProgressFill) popupProgressFill.style.width = `${progressPercent}%`;
                if (popupCurrentTime) popupCurrentTime.textContent = QobuzApp.core.formatTime(status.currentSeconds);
            }
        }

        if (status.state === 'stop' && wasPlaying) {
            if (playback.usingNativeQobuzPlayback) {
                console.log('Native playback stopped - player handles queue automatically');
                stopBluesoundStatusPolling();
            } else {
                stopBluesoundStatusPolling();
                playNext();
            }
        }
    }

    // ==================== Playback Controls ====================

    function playAll() {
        if (QobuzApp.playback.currentTracks.length > 0) {
            playTrack(0);
        }
    }

    function playPrevious() {
        const playback = QobuzApp.playback;
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            sendBluesoundControl('previous');
            if (playback.currentTrackIndex > 0) {
                playTrack(playback.currentTrackIndex - 1);
            }
        } else {
            if (playback.currentTrackIndex > 0) {
                playTrack(playback.currentTrackIndex - 1);
            }
        }
    }

    function playNext() {
        const playback = QobuzApp.playback;
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (playback.currentTrackIndex < playback.currentTracks.length - 1) {
            playTrack(playback.currentTrackIndex + 1);
        } else {
            playback.isPlaying = false;
            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(false);
            if (selectedPlayer.type === 'bluesound') {
                sendBluesoundControl('stop');
                stopBluesoundStatusPolling();
            }
        }
    }

    async function togglePlayPause() {
        const playback = QobuzApp.playback;
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            const action = playback.isPlaying ? 'pause' : 'play';
            await sendBluesoundControl(action);
            playback.isPlaying = !playback.isPlaying;
            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(playback.isPlaying);
            updateTrackHighlight();

            if (playback.isPlaying) {
                startBluesoundStatusPolling();
            } else {
                stopBluesoundStatusPolling();
            }
        } else {
            if (!playback.audioPlayer.src) return;

            if (playback.isPlaying) {
                playback.audioPlayer.pause();
                playback.isPlaying = false;
            } else {
                playback.audioPlayer.play();
                playback.isPlaying = true;
            }

            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(playback.isPlaying);
            updateTrackHighlight();
        }
    }

    function seekTo(seconds) {
        const playback = QobuzApp.playback;
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (selectedPlayer.type === 'browser' && playback.audioPlayer.src) {
            playback.audioPlayer.currentTime = seconds;
        }
    }

    // ==================== Bluesound Control ====================

    async function sendBluesoundControl(action) {
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (!selectedPlayer.ip) return;

        try {
            const response = await fetch('?handler=BluesoundControl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: selectedPlayer.ip,
                    port: selectedPlayer.port || 11000,
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

    async function stopBluesoundPlayback(ip, port) {
        if (!ip) return;

        try {
            await fetch('?handler=BluesoundControl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: ip,
                    port: port || 11000,
                    action: 'stop'
                })
            });
        } catch (error) {
            console.error('Failed to stop Bluesound:', error);
        }
    }

    // ==================== Player Change Handler ====================

    async function handlePlayerChange(previousType, newType, newPlayer, previousPlayer) {
        const playback = QobuzApp.playback;
        const hasTrackToHandoff = playback.currentTrackIndex >= 0 && playback.currentTracks.length > 0;
        const wasPlaying = playback.isPlaying;
        let currentPosition = 0;

        if (previousType === 'browser') {
            currentPosition = playback.audioPlayer.currentTime || 0;

            if (playback.audioPlayer.src && !playback.audioPlayer.paused) {
                playback.audioPlayer.pause();
            }
            playback.isPlaying = false;
        } else if (previousType === 'bluesound' && previousPlayer?.ip) {
            currentPosition = window.GlobalPlayer?.getLastKnownPosition?.() || 0;

            await stopBluesoundPlayback(previousPlayer.ip, previousPlayer.port || 11000);
            stopBluesoundStatusPolling();
        }

        if (!hasTrackToHandoff || !wasPlaying) {
            updateTrackHighlight();
            return;
        }

        const track = playback.currentTracks[playback.currentTrackIndex];
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!track || !authToken) {
            updateTrackHighlight();
            return;
        }

        console.log(`Handoff: ${previousType} → ${newType} at ${Math.round(currentPosition)}s`);

        if (newType === 'bluesound' && newPlayer?.ip) {
            await playOnBluesound(track, playback.currentTrackIndex, authToken);
        } else if (newType === 'browser') {
            await playOnBrowser(track, playback.currentTrackIndex, authToken);
            if (currentPosition > 0) {
                playback.audioPlayer.currentTime = currentPosition;
            }
        }
    }

    // ==================== UI Updates ====================

    function updateNowPlaying(track) {
        const playback = QobuzApp.playback;
        const progress = QobuzApp.progress;

        playback.currentTrackInfo = track;
        progress.lastTrackTitle = track.title;

        progress.lastKnownPosition = 0;
        progress.lastKnownTotal = 0;
        progress.lastStatusTime = Date.now();

        // Desktop progress bar
        const desktopProgressFill = document.getElementById('global-np-progress-fill-desktop');
        const desktopCurrentTime = document.getElementById('global-np-time-current-desktop');
        const desktopTotalTime = document.getElementById('global-np-time-total-desktop');
        if (desktopProgressFill) desktopProgressFill.style.width = '0%';
        if (desktopCurrentTime) desktopCurrentTime.textContent = '0:00';
        if (desktopTotalTime) desktopTotalTime.textContent = '0:00';

        // Popup progress bar
        const popupProgressFill = document.getElementById('global-popup-progress-fill');
        const popupCurrentTime = document.getElementById('global-popup-current-time');
        const popupTotalTime = document.getElementById('global-popup-total-time');
        if (popupProgressFill) popupProgressFill.style.width = '0%';
        if (popupCurrentTime) popupCurrentTime.textContent = '0:00';
        if (popupTotalTime) popupTotalTime.textContent = '0:00';

        if (window.GlobalPlayer) {
            window.GlobalPlayer.setCurrentTrack({
                title: track.title,
                artist: track.artistName,
                artistName: track.artistName,
                artistId: track.artistId,
                album: track.albumTitle,
                imageUrl: track.albumCover,
                albumCover: track.albumCover
            });

            window.GlobalPlayer.setPlaying(playback.isPlaying);
        }
    }

    function updateTrackHighlight() {
        const playback = QobuzApp.playback;

        document.querySelectorAll('.track-item').forEach((item, index) => {
            item.classList.toggle('playing', index === playback.currentTrackIndex);

            const btn = item.querySelector('.track-play-btn svg');
            if (btn) {
                if (index === playback.currentTrackIndex && playback.isPlaying) {
                    btn.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
                } else {
                    btn.innerHTML = '<path d="M8 5v14l11-7z"/>';
                }
            }
        });
    }

    /**
     * Find the index of a track in the current playlist by title and artist.
     * Used when the Bluesound player advances to the next track automatically.
     */
    function findTrackIndex(title, artist) {
        const playback = QobuzApp.playback;
        if (!title || playback.currentTracks.length === 0) return -1;

        const normalizedTitle = title.toLowerCase().trim();
        const normalizedArtist = artist ? artist.toLowerCase().trim() : '';

        // Try exact match first
        for (let i = 0; i < playback.currentTracks.length; i++) {
            const track = playback.currentTracks[i];
            const trackTitle = (track.title || '').toLowerCase().trim();
            const trackArtist = (track.artistName || '').toLowerCase().trim();

            if (trackTitle === normalizedTitle && trackArtist === normalizedArtist) {
                return i;
            }
        }

        // If no exact match, try title-only match (some services may format artist differently)
        for (let i = 0; i < playback.currentTracks.length; i++) {
            const track = playback.currentTracks[i];
            const trackTitle = (track.title || '').toLowerCase().trim();

            if (trackTitle === normalizedTitle) {
                return i;
            }
        }

        return -1;
    }

    function updateProgress() {
        const playback = QobuzApp.playback;
        if (!playback.audioPlayer.duration) return;

        if (window.GlobalPlayer) {
            window.GlobalPlayer.updateProgress(playback.audioPlayer.currentTime, playback.audioPlayer.duration);
        }
    }

    function updateTotalTime() {
        const playback = QobuzApp.playback;
        if (window.GlobalPlayer && playback.audioPlayer.duration) {
            window.GlobalPlayer.updateProgress(playback.audioPlayer.currentTime, playback.audioPlayer.duration);
        }
    }

    // ==================== Quality Change ====================

    window.onGlobalQualityChange = async function(formatId) {
        const playback = QobuzApp.playback;
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (selectedPlayer?.type === 'bluesound' && selectedPlayer.ip) {
            await QobuzApp.auth.setBluesoundQobuzQuality(formatId);
        }

        if (playback.currentTrackInfo && (playback.isPlaying || playback.audioPlayer.currentTime > 0)) {
            const currentTime = selectedPlayer.type === 'browser' ? playback.audioPlayer.currentTime : null;

            QobuzApp.core.showLoading();
            try {
                const creds = await QobuzApp.auth.getQobuzCredentials();
                if (!creds?.authToken) {
                    QobuzApp.core.hideLoading();
                    return;
                }

                const response = await fetch(`/Qobuz?handler=TrackStreamUrl&trackId=${playback.currentTrackInfo.id}&authToken=${encodeURIComponent(creds.authToken)}&formatId=${formatId}`);
                const data = await response.json();

                if (data.success && data.url) {
                    if (selectedPlayer.type === 'browser') {
                        const wasPlaying = playback.isPlaying;
                        playback.audioPlayer.src = data.url;
                        playback.audioPlayer.load();

                        playback.audioPlayer.addEventListener('loadedmetadata', function onLoaded() {
                            if (currentTime) {
                                playback.audioPlayer.currentTime = currentTime;
                            }
                            if (wasPlaying) {
                                playback.audioPlayer.play();
                            }
                            playback.audioPlayer.removeEventListener('loadedmetadata', onLoaded);
                        });
                    } else if (selectedPlayer.type === 'bluesound') {
                        const playResponse = await fetch('?handler=PlayOnBluesound', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                            },
                            body: JSON.stringify({
                                ip: selectedPlayer.ip,
                                port: selectedPlayer.port || 11000,
                                trackId: playback.currentTrackInfo.id,
                                authToken: creds.authToken,
                                formatId: formatId,
                                title: playback.currentTrackInfo.title,
                                artist: playback.currentTrackInfo.artistName,
                                album: playback.currentTrackInfo.albumTitle,
                                imageUrl: playback.currentTrackInfo.albumCover
                            })
                        });

                        const playData = await playResponse.json();
                        if (!playData.success) {
                            throw new Error('Failed to restart on Bluesound');
                        }
                    }
                } else {
                    QobuzApp.core.showError('Qualität konnte nicht geändert werden');
                }
            } catch (error) {
                console.error('Failed to change quality:', error);
                QobuzApp.core.showError('Qualität konnte nicht geändert werden');
            }
            QobuzApp.core.hideLoading();
        }
    };

    // ==================== Check Current Playback ====================

    async function checkCurrentPlayback() {
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) {
            return;
        }

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${selectedPlayer.ip}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status) {
                updateBluesoundStatus(data.status, true);

                if (data.status.state === 'play' || data.status.state === 'stream') {
                    startBluesoundStatusPolling();
                }
            }
        } catch (error) {
            console.error('Failed to check current playback:', error);
        }
    }

    // Note: checkCurrentPlayback() is called from qobuz-core.js after initialization

    // ==================== Sync Track with Player ====================

    /**
     * Syncs the current track index with the Bluesound player status.
     * Called when opening an album/playlist or when app returns to foreground.
     */
    async function syncCurrentTrackWithPlayer() {
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) {
            return;
        }

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${selectedPlayer.ip}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status && data.status.title) {
                const playback = QobuzApp.playback;
                const newIndex = findTrackIndex(data.status.title, data.status.artist);

                if (newIndex !== -1 && newIndex !== playback.currentTrackIndex) {
                    playback.currentTrackIndex = newIndex;
                    playback.isPlaying = data.status.state === 'play' || data.status.state === 'stream';
                    updateTrackHighlight();
                }
            }
        } catch (error) {
            console.error('Failed to sync track with player:', error);
        }
    }

    // ==================== Visibility Change Handler ====================

    // Handle app returning to foreground (important for mobile)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            const selectedPlayer = QobuzApp.core?.getSelectedPlayer?.();
            if (selectedPlayer?.type === 'bluesound' && selectedPlayer.ip) {
                // Immediately sync track status when app becomes visible
                syncCurrentTrackWithPlayer();

                // Restart polling if we were playing
                if (QobuzApp.playback?.isPlaying) {
                    startBluesoundStatusPolling();
                }
            }
        }
    });

    // ==================== Export Functions ====================

    QobuzApp.playbackFn = {
        playTrack,
        playOnBrowser,
        playOnBluesound,
        playPrevious,
        playNext,
        togglePlayPause,
        seekTo,
        handlePlayerChange,
        updateTrackHighlight,
        updateProgress,
        updateTotalTime,
        checkCurrentPlayback,
        resetHistoryTracking,
        syncCurrentTrackWithPlayer,
        findTrackIndex
    };

    // Global exports
    window.playTrack = playTrack;

})();
