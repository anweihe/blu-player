/**
 * Qobuz Core Module
 * Contains shared state, DOM elements, helpers, and initialization
 */
(function() {
    'use strict';

    // Create global namespace
    window.QobuzApp = window.QobuzApp || {};

    // ==================== State ====================

    // DOM elements - will be re-fetched in initQobuz for SPA compatibility
    QobuzApp.dom = {
        loadingOverlay: null,
        loginSection: null,
        loggedInSection: null,
        playlistDetailSection: null,
        artistDetailSection: null,
        userMenu: null,
        errorMessage: null,
        errorText: null
    };

    // Playback state
    QobuzApp.playback = {
        currentTracks: [],
        currentTrackIndex: -1,
        audioPlayer: null,
        isPlaying: false,
        currentSourceType: null,
        currentSourceId: null,
        currentSourceName: null,
        usingNativeQobuzPlayback: false,
        currentTrackInfo: null
    };

    // Progress animation state
    QobuzApp.progress = {
        animationFrame: null,
        lastKnownPosition: 0,
        lastKnownTotal: 0,
        lastStatusTime: 0,
        lastTrackTitle: null
    };

    // Tab state
    QobuzApp.tabs = {
        currentTab: 'new-releases',
        newReleasesLoaded: false,
        albumChartsLoaded: false,
        topPlaylistsLoaded: false,
        currentFavoritesSubTab: 'albums',
        favAlbumsLoaded: false,
        favTracksLoaded: false,
        favArtistsLoaded: false,
        // Playlist sub-tabs state
        currentPlaylistsSubTab: 'all',
        playlistsSubTabsLoaded: {},  // { 'all': true, 'popular': false, ... }
        // Genre filter state
        selectedGenres: new Set(),   // Set of genre IDs
        genreFilterExpanded: false
    };

    // Pagination state
    QobuzApp.pagination = {
        albumChartsOffset: 0,
        albumChartsHasMore: true,
        albumChartsLoading: false,
        newReleasesOffset: 0,
        newReleasesHasMore: true,
        newReleasesLoading: false,
        topPlaylistsOffset: 0,
        topPlaylistsHasMore: true,
        topPlaylistsLoading: false,
        // Per-subtab playlist pagination
        playlistsPagination: {}  // { 'all': { offset: 0, hasMore: true, loading: false }, ... }
    };

    // Scroll position tracking
    QobuzApp.savedScrollPosition = 0;

    // Setup flags
    QobuzApp.setup = {
        loginForm: false,
        search: false,
        infiniteScroll: false
    };

    // ==================== DOM Functions ====================

    function refreshDOMElements() {
        QobuzApp.dom.loadingOverlay = document.getElementById('loading-overlay');
        QobuzApp.dom.loginSection = document.getElementById('login-section');
        QobuzApp.dom.loggedInSection = document.getElementById('logged-in-section');
        QobuzApp.dom.playlistDetailSection = document.getElementById('playlist-detail-section');
        QobuzApp.dom.artistDetailSection = document.getElementById('artist-detail-section');
        QobuzApp.dom.userMenu = document.getElementById('user-menu');
        QobuzApp.dom.errorMessage = document.getElementById('error-message');
        QobuzApp.dom.errorText = document.getElementById('error-text');
    }

    // ==================== Helpers ====================

    function getSelectedPlayer() {
        return window.GlobalPlayer?.getSelectedPlayer() || { type: 'browser', name: 'Dieses Gerät' };
    }

    function getStreamQuality() {
        return window.GlobalPlayer?.getStreamQuality() || 27;
    }

    function showLoading() {
        if (QobuzApp.dom.loadingOverlay) {
            QobuzApp.dom.loadingOverlay.classList.add('active');
        }
    }

    function hideLoading() {
        if (QobuzApp.dom.loadingOverlay) {
            QobuzApp.dom.loadingOverlay.classList.remove('active');
        }
    }

    function showError(message) {
        if (QobuzApp.dom.errorText) {
            QobuzApp.dom.errorText.textContent = message;
        }
        if (QobuzApp.dom.errorMessage) {
            QobuzApp.dom.errorMessage.style.display = 'flex';
            setTimeout(() => {
                QobuzApp.dom.errorMessage.style.display = 'none';
            }, 5000);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== Initialization ====================

    async function initQobuz() {
        console.log('initQobuz: Starting initialization');

        // Refresh DOM element references
        refreshDOMElements();

        // Reset setup flags for SPA navigation
        QobuzApp.setup.loginForm = false;
        QobuzApp.setup.search = false;

        // Invalidate cache on SPA navigation
        if (typeof SettingsApi !== 'undefined' && SettingsApi.invalidateCache) {
            SettingsApi.invalidateCache();
        }

        // Initialize profile manager
        if (typeof UserProfileManager !== 'undefined') {
            console.log('initQobuz: Initializing UserProfileManager');
            await UserProfileManager.initialize();
            await QobuzApp.auth.updateProfileDisplayQobuz();
        } else {
            console.error('initQobuz: UserProfileManager not defined!');
        }

        // Get credentials from active profile
        console.log('initQobuz: Getting credentials');
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const userId = creds?.userId;
        const authToken = creds?.authToken;

        // Use global audio player
        QobuzApp.playback.audioPlayer = window.GlobalPlayer?.getAudioPlayer() || new Audio();

        // Setup event listeners
        QobuzApp.playback.audioPlayer.removeEventListener('timeupdate', QobuzApp.playbackFn.updateProgress);
        QobuzApp.playback.audioPlayer.removeEventListener('ended', QobuzApp.playbackFn.playNext);
        QobuzApp.playback.audioPlayer.removeEventListener('loadedmetadata', QobuzApp.playbackFn.updateTotalTime);

        QobuzApp.playback.audioPlayer.addEventListener('timeupdate', QobuzApp.playbackFn.updateProgress);
        QobuzApp.playback.audioPlayer.addEventListener('ended', QobuzApp.playbackFn.playNext);
        QobuzApp.playback.audioPlayer.addEventListener('loadedmetadata', QobuzApp.playbackFn.updateTotalTime);

        // Register playback callbacks with GlobalPlayer
        if (window.GlobalPlayer) {
            window.GlobalPlayer.registerPlaybackCallbacks({
                togglePlayPause: QobuzApp.playbackFn.togglePlayPause,
                playPrevious: QobuzApp.playbackFn.playPrevious,
                playNext: QobuzApp.playbackFn.playNext,
                seek: QobuzApp.playbackFn.seekTo,
                onPlayerChange: QobuzApp.playbackFn.handlePlayerChange
            });

            window.GlobalPlayer.registerQueueCallback(async (index) => {
                if (index >= 0 && index < QobuzApp.playback.currentTracks.length) {
                    await QobuzApp.playbackFn.playTrack(index);
                }
            });

            window.GlobalPlayer.registerQueueTrackChangedCallback((track) => {
                if (!track || !QobuzApp.playback.currentTracks.length) return;

                const foundIndex = QobuzApp.playback.currentTracks.findIndex(t =>
                    t.title === track.title ||
                    t.title === track.artistName
                );

                if (foundIndex >= 0) {
                    QobuzApp.playback.currentTrackIndex = foundIndex;
                    QobuzApp.playback.isPlaying = true;
                    QobuzApp.playbackFn.updateTrackHighlight();
                    console.log('Queue track changed - updated highlight to index:', foundIndex, track.title);
                }
            });
        }

        // Setup login form and search
        QobuzApp.auth.setupLoginForm();
        QobuzApp.search.setupSearch();
        QobuzApp.browse.setupInfiniteScroll();

        if (userId && authToken) {
            console.log('initQobuz: Found credentials, verifying token for user:', userId);
            showLoading();
            try {
                const response = await fetch(`/Qobuz?handler=VerifyToken&userId=${userId}&authToken=${encodeURIComponent(authToken)}`);
                const data = await response.json();

                if (data.success) {
                    console.log('initQobuz: Token verified successfully');
                    await QobuzApp.auth.saveQobuzCredentials({
                        userId: data.userId,
                        authToken: data.authToken,
                        displayName: data.displayName,
                        avatar: data.avatar
                    });

                    QobuzApp.auth.showLoggedInState(data);
                    await QobuzApp.browse.loadPlaylists();

                    if (!QobuzApp.tabs.newReleasesLoaded) {
                        QobuzApp.browse.loadNewReleases();
                    }

                    await QobuzApp.auth.syncBluesoundQobuzQuality();

                    // Check for URL parameters (album, playlist, or artist from history)
                    const urlParams = new URLSearchParams(window.location.search);
                    const albumId = urlParams.get('album');
                    const playlistId = urlParams.get('playlist');
                    const artistId = urlParams.get('artist');

                    if (albumId && typeof window.selectAlbum === 'function') {
                        console.log('initQobuz: Opening album from URL parameter:', albumId);
                        setTimeout(() => window.selectAlbum(albumId), 100);
                    } else if (playlistId && typeof window.selectPlaylist === 'function') {
                        console.log('initQobuz: Opening playlist from URL parameter:', playlistId);
                        setTimeout(() => window.selectPlaylist(playlistId), 100);
                    } else if (artistId && typeof window.showArtistPage === 'function') {
                        console.log('initQobuz: Opening artist from URL parameter:', artistId);
                        setTimeout(() => window.showArtistPage(parseInt(artistId)), 100);
                    } else if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.hasPendingNavigation()) {
                        setTimeout(() => {
                            GlobalPlayer.executePendingNavigation();
                        }, 150);
                    }
                } else {
                    console.warn('initQobuz: Token verification failed:', data.error);
                    await QobuzApp.auth.clearQobuzCredentials();
                    QobuzApp.auth.showLoginState();
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                await QobuzApp.auth.clearQobuzCredentials();
                QobuzApp.auth.showLoginState();
            }
            hideLoading();
        } else {
            console.log('initQobuz: No credentials found, showing login form');
            QobuzApp.auth.showLoginState();

            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.hasPendingNavigation()) {
                try {
                    sessionStorage.removeItem('global_pending_navigation');
                } catch (e) { /* ignore */ }
            }
        }

        // Check current playback status (for Bluesound status bar)
        if (QobuzApp.playbackFn && QobuzApp.playbackFn.checkCurrentPlayback) {
            QobuzApp.playbackFn.checkCurrentPlayback();
        }
    }

    // ==================== Export Functions ====================

    QobuzApp.core = {
        refreshDOMElements,
        getSelectedPlayer,
        getStreamQuality,
        showLoading,
        hideLoading,
        showError,
        escapeHtml,
        formatTime,
        initQobuz
    };

    // Global exports for backwards compatibility
    window.initQobuz = initQobuz;
    window.escapeHtml = escapeHtml;

    // Initialize on load
    console.log('Qobuz core script loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('Qobuz: Adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', initQobuz);
    } else {
        // Delay initialization to ensure all modules are loaded
        setTimeout(initQobuz, 0);
    }

})();
