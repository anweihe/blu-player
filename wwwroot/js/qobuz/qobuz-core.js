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

    // Navigation state for browser history
    QobuzApp.navigation = {
        initialized: false,
        artistStack: []  // For Artist→Artist navigation
    };

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

    // ==================== Browser History Navigation ====================

    /**
     * Build URL from navigation state
     */
    function buildUrl(view, id, options = {}) {
        const base = '/Qobuz';
        const params = new URLSearchParams();

        switch (view) {
            case 'album':
                params.set('album', id);
                break;
            case 'playlist':
                params.set('playlist', id);
                break;
            case 'artist':
                params.set('artist', id);
                break;
            case 'discography':
                params.set('artist', id);
                params.set('discography', '1');
                if (options.releaseType) {
                    params.set('type', options.releaseType);
                }
                break;
            case 'browse':
            default:
                return base;
        }

        return `${base}?${params.toString()}`;
    }

    /**
     * Push a new state to browser history
     */
    function pushState(view, id, options = {}) {
        const state = {
            view: view,
            id: id,
            scrollY: window.scrollY || document.documentElement.scrollTop,
            artistStack: [...QobuzApp.navigation.artistStack],
            ...options
        };

        const url = buildUrl(view, id, options);
        history.pushState(state, '', url);
        console.log('pushState:', view, id, url);
    }

    /**
     * Replace current state (used for initial page load)
     */
    function replaceState(view, id, options = {}) {
        const state = {
            view: view,
            id: id,
            scrollY: 0,
            artistStack: [...QobuzApp.navigation.artistStack],
            ...options
        };

        const url = buildUrl(view, id, options);
        history.replaceState(state, '', url);
        console.log('replaceState:', view, id, url);
    }

    /**
     * Restore view from state (called on popstate)
     */
    async function restoreState(state) {
        if (!state) {
            // No state - go to browse view
            showBrowseView();
            return;
        }

        console.log('restoreState:', state.view, state.id);

        // Restore artist stack from state
        if (state.artistStack) {
            QobuzApp.navigation.artistStack = [...state.artistStack];
        }

        switch (state.view) {
            case 'album':
                if (typeof window.selectAlbum === 'function') {
                    await window.selectAlbum(state.id, null, true); // skipHistory=true
                }
                break;

            case 'playlist':
                if (typeof window.selectPlaylist === 'function') {
                    await window.selectPlaylist(state.id, null, true); // skipHistory=true
                }
                break;

            case 'artist':
                if (typeof window.showArtistPage === 'function') {
                    await window.showArtistPage(parseInt(state.id), true); // skipHistory=true
                }
                break;

            case 'discography':
                if (typeof window.showDiscographyPage === 'function') {
                    await window.showDiscographyPage(
                        parseInt(state.id),
                        state.artistName || '',
                        state.releaseType || null,
                        true // skipHistory=true
                    );
                }
                break;

            case 'browse':
            default:
                showBrowseView();
                break;
        }

        // Restore scroll position after a short delay
        if (state.scrollY) {
            setTimeout(() => {
                window.scrollTo(0, state.scrollY);
            }, 100);
        }
    }

    /**
     * Show the main browse view
     */
    function showBrowseView() {
        // Hide all detail sections
        if (QobuzApp.dom.playlistDetailSection) {
            QobuzApp.dom.playlistDetailSection.style.display = 'none';
        }
        if (QobuzApp.dom.artistDetailSection) {
            QobuzApp.dom.artistDetailSection.style.display = 'none';
        }
        const discographyPage = document.getElementById('artist-discography-page');
        if (discographyPage) {
            discographyPage.style.display = 'none';
        }

        // Show browse section
        if (QobuzApp.dom.loggedInSection) {
            QobuzApp.dom.loggedInSection.style.display = 'block';
        }

        // Restore scroll position
        setTimeout(() => {
            window.scrollTo(0, QobuzApp.savedScrollPosition || 0);
        }, 50);
    }

    /**
     * Initialize browser history navigation
     */
    function initNavigation() {
        if (QobuzApp.navigation.initialized) return;

        // Handle popstate event (browser back/forward)
        window.addEventListener('popstate', async (event) => {
            console.log('popstate event:', event.state);
            await restoreState(event.state);
        });

        // Set initial state based on current URL
        const urlParams = new URLSearchParams(window.location.search);
        const albumId = urlParams.get('album');
        const playlistId = urlParams.get('playlist');
        const artistId = urlParams.get('artist');
        const isDiscography = urlParams.get('discography') === '1';

        let initialView = 'browse';
        let initialId = null;

        if (albumId) {
            initialView = 'album';
            initialId = albumId;
        } else if (playlistId) {
            initialView = 'playlist';
            initialId = playlistId;
        } else if (artistId && isDiscography) {
            initialView = 'discography';
            initialId = artistId;
        } else if (artistId) {
            initialView = 'artist';
            initialId = artistId;
        }

        // Replace current history entry with proper state
        replaceState(initialView, initialId);

        QobuzApp.navigation.initialized = true;
        console.log('Navigation initialized, initial view:', initialView);
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

        // Initialize browser history navigation
        initNavigation();

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

                    // Check for URL parameters (album, playlist, artist, or discography from history)
                    const urlParams = new URLSearchParams(window.location.search);
                    const albumId = urlParams.get('album');
                    const playlistId = urlParams.get('playlist');
                    const artistId = urlParams.get('artist');
                    const isDiscography = urlParams.get('discography') === '1';
                    const releaseType = urlParams.get('type');

                    if (albumId && typeof window.selectAlbum === 'function') {
                        console.log('initQobuz: Opening album from URL parameter:', albumId);
                        // skipHistory=true since we're restoring from URL
                        setTimeout(() => window.selectAlbum(albumId, null, true), 100);
                    } else if (playlistId && typeof window.selectPlaylist === 'function') {
                        console.log('initQobuz: Opening playlist from URL parameter:', playlistId);
                        setTimeout(() => window.selectPlaylist(playlistId, null, true), 100);
                    } else if (artistId && isDiscography && typeof window.showDiscographyPage === 'function') {
                        console.log('initQobuz: Opening discography from URL parameter:', artistId);
                        setTimeout(() => window.showDiscographyPage(parseInt(artistId), '', releaseType, true), 100);
                    } else if (artistId && typeof window.showArtistPage === 'function') {
                        console.log('initQobuz: Opening artist from URL parameter:', artistId);
                        setTimeout(() => window.showArtistPage(parseInt(artistId), true), 100);
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
        initQobuz,
        // Navigation functions
        pushState,
        replaceState,
        restoreState,
        showBrowseView,
        initNavigation
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
