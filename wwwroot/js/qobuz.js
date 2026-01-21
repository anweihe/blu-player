(function() {
    'use strict';

    // Global player selection storage key (not per-profile)
    const STORAGE_SELECTED_PLAYER = 'qobuz_selected_player';

    // DOM elements - will be re-fetched in initQobuz for SPA compatibility
    let loadingOverlay = null;
    let loginSection = null;
    let loggedInSection = null;
    let playlistDetailSection = null;
    let userMenu = null;
    let errorMessage = null;
    let errorText = null;

    // Function to refresh DOM element references (needed after SPA navigation)
    function refreshDOMElements() {
        loadingOverlay = document.getElementById('loading-overlay');
        loginSection = document.getElementById('login-section');
        loggedInSection = document.getElementById('logged-in-section');
        playlistDetailSection = document.getElementById('playlist-detail-section');
        userMenu = document.getElementById('user-menu');
        errorMessage = document.getElementById('error-message');
        errorText = document.getElementById('error-text');
    }

    // Playback state
    let currentTracks = [];
    let currentTrackIndex = -1;
    let audioPlayer = null;
    let isPlaying = false;

    // Queue source tracking
    let currentSourceType = null; // 'album' or 'playlist'
    let currentSourceId = null;
    let currentSourceName = null;

    // Native Qobuz playback tracking
    // When true, the Bluesound player manages the queue itself
    let usingNativeQobuzPlayback = false;

    // Progress animation state
    let progressAnimationFrame = null;
    let lastKnownPosition = 0;
    let lastKnownTotal = 0;
    let lastStatusTime = 0;
    let lastTrackTitle = null;

    // Helper to get selected player from GlobalPlayer
    function getSelectedPlayer() {
        return window.GlobalPlayer?.getSelectedPlayer() || { type: 'browser', name: 'Dieses Gerät' };
    }

    // Helper to get stream quality from GlobalPlayer
    function getStreamQuality() {
        return window.GlobalPlayer?.getStreamQuality() || 27;
    }

    // Sync Qobuz quality from Bluesound player on page load
    async function syncBluesoundQobuzQuality() {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer?.type !== 'bluesound' || !selectedPlayer.ip) {
            console.log('syncBluesoundQobuzQuality: Not a Bluesound player, skipping sync');
            return;
        }

        console.log('syncBluesoundQobuzQuality: Syncing quality from Bluesound player', selectedPlayer.ip);

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundQobuzQuality&playerIp=${encodeURIComponent(selectedPlayer.ip)}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.formatId) {
                console.log('syncBluesoundQobuzQuality: Got quality from player:', data.quality, '(formatId:', data.formatId, ')');

                // Update GlobalPlayer UI with the quality from the Bluesound player
                if (window.GlobalPlayer && window.GlobalPlayer.setQuality) {
                    window.GlobalPlayer.setQuality(data.formatId);
                }
            } else {
                console.warn('syncBluesoundQobuzQuality: Failed to get quality from player:', data.error);
            }
        } catch (error) {
            console.error('syncBluesoundQobuzQuality: Error fetching quality:', error);
        }
    }

    // Set Qobuz quality on Bluesound player when changed in UI
    async function setBluesoundQobuzQuality(formatId) {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer?.type !== 'bluesound' || !selectedPlayer.ip) {
            return true; // Not a Bluesound player, nothing to do
        }

        console.log('setBluesoundQobuzQuality: Setting quality on Bluesound player', selectedPlayer.ip, 'to formatId:', formatId);

        try {
            const response = await fetch(`/Qobuz?handler=SetBluesoundQobuzQuality&playerIp=${encodeURIComponent(selectedPlayer.ip)}&formatId=${formatId}&port=${selectedPlayer.port || 11000}`, {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log('setBluesoundQobuzQuality: Quality set successfully:', data.quality);
                return true;
            } else {
                console.error('setBluesoundQobuzQuality: Failed to set quality:', data.error);
                return false;
            }
        } catch (error) {
            console.error('setBluesoundQobuzQuality: Error setting quality:', error);
            return false;
        }
    }

    // Get active profile Qobuz credentials
    async function getQobuzCredentials() {
        const activeProfile = await UserProfileManager.getActiveProfile();
        if (!activeProfile) {
            console.log('getQobuzCredentials: No active profile');
            return null;
        }
        if (!activeProfile.qobuz) {
            console.log('getQobuzCredentials: Profile has no Qobuz credentials:', activeProfile.id);
            return null;
        }
        console.log('getQobuzCredentials: Found credentials for profile:', activeProfile.id);
        return activeProfile.qobuz;
    }

    // Save Qobuz credentials to active profile
    async function saveQobuzCredentials(data) {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) {
            console.error('Cannot save Qobuz credentials: No active profile ID');
            return false;
        }

        try {
            await UserProfileManager.updateQobuzCredentials(activeProfileId, {
                userId: data.userId,
                authToken: data.authToken,
                displayName: data.displayName || null,
                avatar: data.avatar || null
            });
            console.log('Qobuz credentials saved for profile:', activeProfileId);
            return true;
        } catch (error) {
            console.error('Failed to save Qobuz credentials:', error);
            return false;
        }
    }

    // Clear Qobuz credentials from active profile
    async function clearQobuzCredentials() {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        await UserProfileManager.clearQobuzCredentials(activeProfileId);
    }

    // Save queue to database
    async function saveQueueToDb(currentIndex) {
        if (!currentTracks || currentTracks.length === 0) return;

        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        const queueData = {
            sourceType: currentSourceType,
            sourceId: currentSourceId,
            sourceName: currentSourceName,
            currentIndex: currentIndex,
            tracks: currentTracks
        };

        try {
            await QueueApi.setQueue(activeProfileId, queueData);

            // Update GlobalPlayer queue
            if (window.GlobalPlayer) {
                window.GlobalPlayer.setQueue(queueData);
            }
        } catch (error) {
            console.error('Failed to save queue:', error);
        }
    }

    // Update queue index in database
    async function updateQueueIndexInDb(currentIndex) {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        try {
            await QueueApi.updateQueueIndex(activeProfileId, currentIndex);

            // Update GlobalPlayer queue index
            if (window.GlobalPlayer) {
                window.GlobalPlayer.updateQueueIndex(currentIndex);
            }
        } catch (error) {
            console.error('Failed to update queue index:', error);
        }
    }

    // Show/hide loading
    function showLoading() {
        loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }

    // Show error message
    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Initialize Qobuz page - can be called on initial load or SPA navigation
    async function initQobuz() {
        console.log('initQobuz: Starting initialization');

        // Refresh DOM element references (needed after SPA navigation)
        refreshDOMElements();

        // Reset setup flags for SPA navigation (DOM elements are new)
        loginFormSetup = false;
        searchSetup = false;

        // Invalidate cache on SPA navigation to ensure fresh profile data
        if (typeof SettingsApi !== 'undefined' && SettingsApi.invalidateCache) {
            SettingsApi.invalidateCache();
        }

        // Initialize profile manager
        if (typeof UserProfileManager !== 'undefined') {
            console.log('initQobuz: Initializing UserProfileManager');
            await UserProfileManager.initialize();
            await updateProfileDisplayQobuz();
        } else {
            console.error('initQobuz: UserProfileManager not defined!');
        }

        // Get credentials from active profile
        console.log('initQobuz: Getting credentials');
        const creds = await getQobuzCredentials();
        const userId = creds?.userId;
        const authToken = creds?.authToken;

        // Use global audio player (persists across page navigation)
        audioPlayer = window.GlobalPlayer?.getAudioPlayer() || new Audio();

        // Remove any existing listeners to prevent duplicates
        audioPlayer.removeEventListener('timeupdate', updateProgress);
        audioPlayer.removeEventListener('ended', playNext);
        audioPlayer.removeEventListener('loadedmetadata', updateTotalTime);

        // Add event listeners for progress updates
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', playNext);
        audioPlayer.addEventListener('loadedmetadata', updateTotalTime);

        // Register playback callbacks with GlobalPlayer
        if (window.GlobalPlayer) {
            window.GlobalPlayer.registerPlaybackCallbacks({
                togglePlayPause: togglePlayPause,
                playPrevious: playPrevious,
                playNext: playNext,
                seek: seekTo,
                onPlayerChange: handlePlayerChange
            });

            // Register queue callback for playing tracks from the popup queue
            window.GlobalPlayer.registerQueueCallback(async (index) => {
                if (index >= 0 && index < currentTracks.length) {
                    await playTrack(index);
                }
            });

            // Register callback for when a track is played from the Bluesound queue
            // This only updates the UI highlight without restarting playback
            window.GlobalPlayer.registerQueueTrackChangedCallback((track) => {
                if (!track || !currentTracks.length) return;

                // Find the track in currentTracks by title match
                const foundIndex = currentTracks.findIndex(t =>
                    t.title === track.title ||
                    t.title === track.artistName // Sometimes title and artist are swapped in queue
                );

                if (foundIndex >= 0) {
                    currentTrackIndex = foundIndex;
                    isPlaying = true;
                    updateTrackHighlight();
                    console.log('Queue track changed - updated highlight to index:', foundIndex, track.title);
                }
            });
        }

        // Setup login form for new DOM elements
        setupLoginForm();

        // Setup search for new DOM elements
        setupSearch();

        if (userId && authToken) {
            console.log('initQobuz: Found credentials, verifying token for user:', userId);
            showLoading();
            try {
                const response = await fetch(`/Qobuz?handler=VerifyToken&userId=${userId}&authToken=${encodeURIComponent(authToken)}`);
                const data = await response.json();

                if (data.success) {
                    console.log('initQobuz: Token verified successfully');
                    // Update stored data in profile
                    await saveQobuzCredentials({
                        userId: data.userId,
                        authToken: data.authToken,
                        displayName: data.displayName,
                        avatar: data.avatar
                    });

                    showLoggedInState(data);
                    await loadPlaylists();

                    // Sync Qobuz quality setting from Bluesound player (if selected)
                    await syncBluesoundQobuzQuality();

                    // Check for pending navigation (from "Go to Album/Playlist" button on other pages)
                    // Only execute after login is verified and playlists are loaded
                    if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.hasPendingNavigation()) {
                        // Small delay to ensure DOM is fully ready
                        setTimeout(() => {
                            GlobalPlayer.executePendingNavigation();
                        }, 150);
                    }
                } else {
                    // Token invalid, clear from profile
                    console.warn('initQobuz: Token verification failed:', data.error);
                    await clearQobuzCredentials();
                    showLoginState();
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                await clearQobuzCredentials();
                showLoginState();
            }
            hideLoading();
        } else {
            // No credentials - show login
            console.log('initQobuz: No credentials found, showing login form');
            showLoginState();

            // Clear any pending navigation since user needs to login first
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.hasPendingNavigation()) {
                try {
                    sessionStorage.removeItem('global_pending_navigation');
                } catch (e) { /* ignore */ }
            }
        }
    }

    // Show login state
    function showLoginState() {
        if (loginSection) loginSection.style.display = 'flex';
        if (loggedInSection) loggedInSection.style.display = 'none';
        if (userMenu) userMenu.style.display = 'none';
    }

    // Make initQobuz available globally for SPA router
    window.initQobuz = initQobuz;

    // Track if event listeners are already setup
    let loginFormSetup = false;
    let searchSetup = false;

    // Setup login form handler
    function setupLoginForm() {
        if (loginFormSetup) return;
        const loginForm = document.getElementById('login-form');
        if (!loginForm) return;
        loginForm.addEventListener('submit', handleLoginSubmit);
        loginFormSetup = true;
    }

    // Check for existing session on page load
    console.log('Qobuz script loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('Qobuz: Adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', initQobuz);
    } else {
        console.log('Qobuz: Calling initQobuz immediately');
        initQobuz();
    }

    // Update profile display in header and menu (Qobuz-specific)
    async function updateProfileDisplayQobuz() {
        const activeProfile = await UserProfileManager.getActiveProfile();
        if (!activeProfile) return;

        const initial = UserProfileManager.getProfileInitial(activeProfile.name);
        const color = UserProfileManager.getProfileColor(activeProfile.id);

        // Update header indicator
        const headerInitial = document.getElementById('header-profile-initial');
        if (headerInitial) {
            headerInitial.textContent = initial;
            headerInitial.parentElement.style.background = color;
        }

        // Update menu profile display
        const menuAvatar = document.getElementById('menu-profile-avatar');
        const menuName = document.getElementById('menu-profile-name');
        if (menuAvatar) {
            menuAvatar.textContent = initial;
            menuAvatar.style.background = color;
        }
        if (menuName) {
            menuName.textContent = activeProfile.name;
        }
    }

    // Login form submission handler
    async function handleLoginSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        showLoading();

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);

            const response = await fetch('/Qobuz?handler=Login', {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Store session data in active profile
                await saveQobuzCredentials({
                    userId: data.userId,
                    authToken: data.authToken,
                    displayName: data.displayName,
                    avatar: data.avatar
                });

                showLoggedInState(data);
                await loadPlaylists();
            } else {
                showError(data.error || 'Login fehlgeschlagen');
            }
        } catch (error) {
            console.error('Login failed:', error);
            showError('Login fehlgeschlagen. Bitte versuche es erneut.');
        }

        hideLoading();
    }

    // Show logged in state
    function showLoggedInState(userData) {
        loginSection.style.display = 'none';
        loggedInSection.style.display = 'block';
        userMenu.style.display = 'flex';
    }

    // Search functionality
    let searchTimeout = null;
    let searchInput = null;
    let searchClear = null;
    let searchResults = null;
    let browseContent = null;

    // Setup search event handlers
    function setupSearch() {
        if (searchSetup) return;

        searchInput = document.getElementById('search-input');
        searchClear = document.getElementById('search-clear');
        searchResults = document.getElementById('search-results');
        browseContent = document.getElementById('browse-content');

        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
            searchInput.addEventListener('keydown', handleSearchKeydown);
            searchSetup = true;
        }
    }

    function handleSearchInput() {
        const query = this.value.trim();
        if (searchClear) searchClear.style.display = query ? 'flex' : 'none';

        // Debounce search
        clearTimeout(searchTimeout);
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => performSearch(query), 300);
        } else if (query.length === 0) {
            hideSearchResults();
        }
    }

    function handleSearchKeydown(e) {
        if (e.key === 'Escape') {
            clearSearch();
        }
    }

    // Perform search
    async function performSearch(query) {
        // Show skeleton loading state (don't block input)
        showSearchSkeleton();

        try {
            const response = await fetch(`/Qobuz?handler=Search&query=${encodeURIComponent(query)}&limit=20`);
            const data = await response.json();

            if (data.success) {
                showSearchResults(data);
            } else {
                hideSearchSkeleton();
                showError(data.error || 'Suche fehlgeschlagen');
            }
        } catch (error) {
            console.error('Search failed:', error);
            hideSearchSkeleton();
            showError('Suche fehlgeschlagen');
        }
    }

    // Show skeleton loading state for search
    function showSearchSkeleton() {
        browseContent.style.display = 'none';
        searchResults.style.display = 'block';

        // Hide all sections except show skeleton
        document.getElementById('search-albums-section').style.display = 'none';
        document.getElementById('search-playlists-section').style.display = 'none';
        document.getElementById('search-tracks-section').style.display = 'none';
        document.getElementById('search-no-results').style.display = 'none';

        // Show skeleton in a temporary container
        let skeletonContainer = document.getElementById('search-skeleton');
        if (!skeletonContainer) {
            skeletonContainer = document.createElement('div');
            skeletonContainer.id = 'search-skeleton';
            skeletonContainer.className = 'search-skeleton';
            searchResults.appendChild(skeletonContainer);
        }

        skeletonContainer.style.display = 'block';
        skeletonContainer.innerHTML = `
            <div class="skeleton-section">
                <div class="skeleton-title"></div>
                <div class="skeleton-grid">
                    ${Array(4).fill('<div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>').join('')}
                </div>
            </div>
            <div class="skeleton-section">
                <div class="skeleton-title"></div>
                <div class="skeleton-list">
                    ${Array(3).fill('<div class="skeleton-track"><div class="skeleton-track-cover"></div><div class="skeleton-track-info"><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></div>').join('')}
                </div>
            </div>
        `;
    }

    // Hide skeleton loading state
    function hideSearchSkeleton() {
        const skeletonContainer = document.getElementById('search-skeleton');
        if (skeletonContainer) {
            skeletonContainer.style.display = 'none';
        }
    }

    // Show search results
    function showSearchResults(data) {
        // Hide skeleton first
        hideSearchSkeleton();

        const hasAlbums = data.albums && data.albums.length > 0;
        const hasPlaylists = data.playlists && data.playlists.length > 0;
        const hasTracks = data.tracks && data.tracks.length > 0;
        const hasAnyResults = hasAlbums || hasPlaylists || hasTracks;

        // Hide browse content, show search results
        browseContent.style.display = 'none';
        searchResults.style.display = 'block';

        // Albums section
        const albumsSection = document.getElementById('search-albums-section');
        const albumsGrid = document.getElementById('search-albums-grid');
        if (hasAlbums) {
            albumsSection.style.display = 'block';
            albumsGrid.innerHTML = data.albums.map(album => `
                <div class="search-card" onclick="selectAlbum('${album.id}')">
                    <div class="search-card-cover">
                        ${album.coverUrl ? `<img src="${album.coverUrl}" alt="" loading="lazy">` : ''}
                        <span class="search-card-type ${album.isSingle ? 'single' : (album.typeLabel === 'EP' ? 'ep' : 'album')}">${album.typeLabel}</span>
                    </div>
                    <div class="search-card-info">
                        <h4 class="search-card-title">${escapeHtml(album.title)}</h4>
                        <p class="search-card-subtitle">${escapeHtml(album.artistName || 'Unbekannt')}</p>
                    </div>
                </div>
            `).join('');
        } else {
            albumsSection.style.display = 'none';
        }

        // Playlists section
        const playlistsSection = document.getElementById('search-playlists-section');
        const playlistsGrid = document.getElementById('search-playlists-grid');
        if (hasPlaylists) {
            playlistsSection.style.display = 'block';
            playlistsGrid.innerHTML = data.playlists.map(playlist => `
                <div class="search-card" onclick="selectPlaylist(${playlist.id})">
                    <div class="search-card-cover">
                        ${playlist.coverUrl ? `<img src="${playlist.coverUrl}" alt="" loading="lazy">` : ''}
                        <span class="search-card-type playlist">Playlist</span>
                    </div>
                    <div class="search-card-info">
                        <h4 class="search-card-title">${escapeHtml(playlist.name)}</h4>
                        <p class="search-card-subtitle">${playlist.tracksCount} Titel</p>
                    </div>
                </div>
            `).join('');
        } else {
            playlistsSection.style.display = 'none';
        }

        // Tracks section
        const tracksSection = document.getElementById('search-tracks-section');
        const tracksList = document.getElementById('search-tracks-list');
        if (hasTracks) {
            tracksSection.style.display = 'block';
            tracksList.innerHTML = data.tracks.map(track => `
                <div class="search-track-item" onclick="playSearchTrack(${track.id}, '${escapeHtml(track.title)}', '${escapeHtml(track.artistName || '')}', '${escapeHtml(track.albumTitle || '')}', '${track.coverUrl || ''}')">
                    <div class="search-track-cover">
                        ${track.coverUrl ? `<img src="${track.coverUrl}" alt="" loading="lazy">` : ''}
                    </div>
                    <div class="search-track-info">
                        <div class="search-track-title">${escapeHtml(track.title)}</div>
                        <div class="search-track-meta">${escapeHtml(track.artistName || 'Unbekannt')} · ${escapeHtml(track.albumTitle || '')}</div>
                    </div>
                    ${track.isHiRes ? '<span class="search-track-badge">Hi-Res</span>' : ''}
                    <span class="search-track-duration">${track.formattedDuration}</span>
                </div>
            `).join('');
        } else {
            tracksSection.style.display = 'none';
        }

        // No results
        document.getElementById('search-no-results').style.display = hasAnyResults ? 'none' : 'block';
    }

    // Hide search results
    function hideSearchResults() {
        searchResults.style.display = 'none';
        browseContent.style.display = 'block';
    }

    // Clear search
    function clearSearch() {
        searchInput.value = '';
        searchClear.style.display = 'none';
        hideSearchResults();
        searchInput.blur();
    }

    // Play a track from search results
    async function playSearchTrack(trackId, title, artistName, albumTitle, coverUrl) {
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!authToken) {
            showError('Bitte melde dich an, um Titel abzuspielen');
            return;
        }

        // Create a temporary track object for playback
        const track = {
            id: trackId,
            title: title,
            artistName: artistName,
            albumTitle: albumTitle,
            albumCover: coverUrl,
            isStreamable: true
        };

        // Set as current track
        currentTracks = [track];
        currentTrackIndex = 0;

        const selectedPlayer = getSelectedPlayer();

        // Check if we should play on Bluesound or browser
        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            await playOnBluesound(track, 0, authToken);
        } else {
            await playOnBrowser(track, 0, authToken);
        }
    }

    // Tab switching
    let currentTab = 'my-playlists';
    let newReleasesLoaded = false;
    let albumChartsLoaded = false;
    let topPlaylistsLoaded = false;
    let recommendationsLoaded = false;

    function switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        currentTab = tabId;

        // Load content if needed
        if (tabId === 'new-releases' && !newReleasesLoaded) {
            loadNewReleases();
        } else if (tabId === 'album-charts' && !albumChartsLoaded) {
            loadAlbumCharts();
        } else if (tabId === 'top-playlists' && !topPlaylistsLoaded) {
            loadTopPlaylists();
        } else if (tabId === 'recommendations' && !recommendationsLoaded) {
            loadRecommendations();
        }
    }

    // Load new releases
    async function loadNewReleases() {
        showLoading();

        try {
            const response = await fetch('?handler=FeaturedAlbums&type=new-releases&limit=50');
            const data = await response.json();

            if (data.success) {
                renderAlbums(data.albums);
                newReleasesLoaded = true;
            } else {
                showError('Neuheiten konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load new releases:', error);
            showError('Neuheiten konnten nicht geladen werden');
        }

        hideLoading();
    }

    // Load album charts (most streamed)
    async function loadAlbumCharts() {
        showLoading();

        try {
            const creds = await getQobuzCredentials();
            const authToken = creds?.authToken || '';
            const response = await fetch(`?handler=MostStreamedAlbums&authToken=${encodeURIComponent(authToken)}&limit=50`);
            const data = await response.json();

            if (data.success) {
                renderChartAlbums(data.albums);
                albumChartsLoaded = true;
            } else {
                showError('Album-Charts konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load album charts:', error);
            showError('Album-Charts konnten nicht geladen werden');
        }

        hideLoading();
    }

    // Render chart albums grid
    function renderChartAlbums(albums) {
        const grid = document.getElementById('charts-grid');
        const emptyState = document.getElementById('charts-empty');

        if (!albums || albums.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        grid.innerHTML = albums.map((album, index) => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    <span class="chart-position">${index + 1}</span>
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escapeHtml(album.title)}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escapeHtml(album.title)}</h3>
                    <div class="playlist-meta">${escapeHtml(album.artistName || 'Unbekannt')}</div>
                </div>
            </div>
        `).join('');
    }

    // Render albums grid
    function renderAlbums(albums) {
        const grid = document.getElementById('albums-grid');
        const emptyState = document.getElementById('albums-empty');

        if (!albums || albums.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        grid.innerHTML = albums.map(album => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escapeHtml(album.title)}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escapeHtml(album.title)}</h3>
                    <div class="playlist-meta">${escapeHtml(album.artistName || 'Unbekannt')}</div>
                </div>
            </div>
        `).join('');
    }

    // Select album - load and show tracks
    // highlightTrackIndex: optional index of track to highlight and scroll to
    async function selectAlbum(albumId, highlightTrackIndex = null) {
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;
        if (!authToken) {
            showError('Bitte melde dich an, um Alben abzuspielen');
            return;
        }

        showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=AlbumTracks&albumId=${albumId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                showAlbumDetail(data.album, data.tracks, highlightTrackIndex);
            } else {
                showError(data.error || 'Album konnte nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load album:', error);
            showError('Album konnte nicht geladen werden');
        }

        hideLoading();
    }

    // Show album detail view
    // highlightTrackIndex: optional index of track to highlight and scroll to
    function showAlbumDetail(album, tracks, highlightTrackIndex = null) {
        currentTracks = tracks || [];

        // Set source tracking for queue
        currentSourceType = 'album';
        currentSourceId = album.id ? album.id.toString() : null;
        currentSourceName = album.title;

        // Update header info
        document.getElementById('detail-name').textContent = album.title;
        document.getElementById('detail-description').textContent = album.artistName || '';
        document.getElementById('detail-tracks-count').textContent = `${album.tracksCount} Titel`;

        // Format duration
        const totalSeconds = album.duration || 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const formattedDuration = hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')} Std.` : `${minutes} Min.`;
        document.getElementById('detail-duration').textContent = formattedDuration;

        // Update cover
        const cover = document.getElementById('detail-cover');
        const placeholder = document.getElementById('detail-cover-placeholder');
        if (album.coverUrl) {
            cover.src = album.coverUrl;
            cover.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        // Render tracks (with optional highlight)
        renderTracks(tracks, highlightTrackIndex);

        // Show detail section, hide logged in section
        loggedInSection.style.display = 'none';
        playlistDetailSection.style.display = 'block';

        // Scroll to top (unless highlighting a track)
        if (highlightTrackIndex === null) {
            window.scrollTo(0, 0);
        }
    }

    // Load top playlists
    async function loadTopPlaylists() {
        showLoading();

        try {
            const response = await fetch('?handler=FeaturedPlaylists&limit=50');
            const data = await response.json();

            if (data.success) {
                renderTopPlaylists(data.playlists);
                topPlaylistsLoaded = true;
            } else {
                showError('Top Playlists konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load top playlists:', error);
            showError('Top Playlists konnten nicht geladen werden');
        }

        hideLoading();
    }

    // Render top playlists grid
    function renderTopPlaylists(playlists) {
        const grid = document.getElementById('top-playlists-grid');
        const emptyState = document.getElementById('top-playlists-empty');

        if (!playlists || playlists.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        grid.innerHTML = playlists.map(playlist => `
            <div class="playlist-card" onclick="selectPlaylist(${playlist.id})">
                <div class="playlist-cover">
                    ${playlist.coverUrl
                        ? `<img src="${playlist.coverUrl}" alt="${escapeHtml(playlist.name)}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9 18V5l12-2v13"/>
                                <circle cx="6" cy="18" r="3"/>
                                <circle cx="18" cy="16" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escapeHtml(playlist.name)}</h3>
                    <div class="playlist-meta">${playlist.tracksCount} Titel · ${playlist.formattedDuration}</div>
                </div>
            </div>
        `).join('');
    }

    // Load favorites
    async function loadRecommendations() {
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!authToken) {
            document.getElementById('recommendations-empty').style.display = 'block';
            return;
        }

        showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=Recommendations&authToken=${encodeURIComponent(authToken)}&limit=50`);
            const data = await response.json();

            if (data.success) {
                renderRecommendations(data);
                recommendationsLoaded = true;
            } else {
                showError('Favoriten konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load favorites:', error);
            showError('Favoriten konnten nicht geladen werden');
        }

        hideLoading();
    }

    // Render recommendations
    function renderRecommendations(data) {
        const albumsSection = document.getElementById('recommendations-albums-section');
        const albumsGrid = document.getElementById('recommendations-albums-grid');
        const playlistsSection = document.getElementById('recommendations-playlists-section');
        const playlistsGrid = document.getElementById('recommendations-playlists-grid');
        const tracksSection = document.getElementById('recommendations-tracks-section');
        const tracksGrid = document.getElementById('recommendations-tracks-grid');
        const emptyState = document.getElementById('recommendations-empty');

        const hasAlbums = data.albums && data.albums.length > 0;
        const hasPlaylists = data.playlists && data.playlists.length > 0;
        const hasTracks = data.tracks && data.tracks.length > 0;

        if (!hasAlbums && !hasPlaylists && !hasTracks) {
            emptyState.style.display = 'block';
            albumsSection.style.display = 'none';
            playlistsSection.style.display = 'none';
            tracksSection.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';

        // Render albums
        if (hasAlbums) {
            albumsSection.style.display = 'block';
            albumsGrid.innerHTML = data.albums.map(album => `
                <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                    <div class="playlist-cover">
                        ${album.coverUrl
                            ? `<img src="${album.coverUrl}" alt="${escapeHtml(album.title)}" loading="lazy">`
                            : `<div class="playlist-cover-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <circle cx="12" cy="12" r="10"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                               </div>`
                        }
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-name">${escapeHtml(album.title)}</h3>
                        <div class="playlist-meta">${escapeHtml(album.artistName || '')}</div>
                        <span class="type-badge type-badge-album">${album.typeLabel || 'Album'}</span>
                    </div>
                </div>
            `).join('');
        } else {
            albumsSection.style.display = 'none';
        }

        // Render playlists
        if (hasPlaylists) {
            playlistsSection.style.display = 'block';
            playlistsGrid.innerHTML = data.playlists.map(playlist => `
                <div class="playlist-card" onclick="selectPlaylist(${playlist.id})">
                    <div class="playlist-cover">
                        ${playlist.coverUrl
                            ? `<img src="${playlist.coverUrl}" alt="${escapeHtml(playlist.name)}" loading="lazy">`
                            : `<div class="playlist-cover-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                </svg>
                               </div>`
                        }
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-name">${escapeHtml(playlist.name)}</h3>
                        <div class="playlist-meta">${playlist.tracksCount} Titel</div>
                        <span class="type-badge type-badge-playlist">Playlist</span>
                    </div>
                </div>
            `).join('');
        } else {
            playlistsSection.style.display = 'none';
        }

        // Render tracks
        if (hasTracks) {
            tracksSection.style.display = 'block';
            tracksGrid.innerHTML = data.tracks.map(track => `
                <div class="playlist-card track-card" onclick="playTrackDirectly(${track.id}, '${escapeHtml(track.title)}', '${escapeHtml(track.artistName || '')}', '${escapeHtml(track.albumTitle || '')}', '${track.coverUrl || ''}')">
                    <div class="playlist-cover">
                        ${track.coverUrl
                            ? `<img src="${track.coverUrl}" alt="${escapeHtml(track.title)}" loading="lazy">`
                            : `<div class="playlist-cover-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                </svg>
                               </div>`
                        }
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-name">${escapeHtml(track.title)}</h3>
                        <div class="playlist-meta">${escapeHtml(track.artistName || '')}${track.formattedDuration ? ' · ' + track.formattedDuration : ''}</div>
                        ${track.isHiRes ? '<span class="hires-badge">Hi-Res</span>' : ''}
                    </div>
                </div>
            `).join('');
        } else {
            tracksSection.style.display = 'none';
        }
    }

    // Load playlists
    async function loadPlaylists() {
        const creds = await getQobuzCredentials();
        const userId = creds?.userId;
        const authToken = creds?.authToken;

        if (!userId || !authToken) return;

        showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=Playlists&userId=${userId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                renderPlaylists(data.playlists);
            } else {
                showError('Playlists konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load playlists:', error);
            showError('Playlists konnten nicht geladen werden');
        }

        hideLoading();
    }

    // Render playlists grid
    function renderPlaylists(playlists) {
        const grid = document.getElementById('playlists-grid');
        const emptyState = document.getElementById('playlists-empty');

        if (!playlists || playlists.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        grid.innerHTML = playlists.map(playlist => `
            <div class="playlist-card" onclick="selectPlaylist(${playlist.id})">
                <div class="playlist-cover">
                    ${playlist.coverUrl
                        ? `<img src="${playlist.coverUrl}" alt="${playlist.name}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9 18V5l12-2v13"/>
                                <circle cx="6" cy="18" r="3"/>
                                <circle cx="18" cy="16" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escapeHtml(playlist.name)}</h3>
                    <div class="playlist-meta">${playlist.tracksCount} Titel · ${playlist.formattedDuration}</div>
                </div>
            </div>
        `).join('');
    }

    // Select playlist - load and show tracks
    // highlightTrackIndex: optional index of track to highlight and scroll to
    async function selectPlaylist(playlistId, highlightTrackIndex = null) {
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;
        if (!authToken) return;

        showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=PlaylistTracks&playlistId=${playlistId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                showPlaylistDetail(data.playlist, data.tracks, highlightTrackIndex);
            } else {
                showError(data.error || 'Playlist konnte nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load playlist:', error);
            showError('Playlist konnte nicht geladen werden');
        }

        hideLoading();
    }

    // Show playlist detail view
    // highlightTrackIndex: optional index of track to highlight and scroll to
    function showPlaylistDetail(playlist, tracks, highlightTrackIndex = null) {
        currentTracks = tracks || [];

        // Set source tracking for queue
        currentSourceType = 'playlist';
        currentSourceId = playlist.id ? playlist.id.toString() : null;
        currentSourceName = playlist.name;

        // Update header info
        document.getElementById('detail-name').textContent = playlist.name;
        document.getElementById('detail-description').textContent = playlist.description || '';
        document.getElementById('detail-tracks-count').textContent = `${playlist.tracksCount} Titel`;
        document.getElementById('detail-duration').textContent = playlist.formattedDuration;

        // Update cover
        const cover = document.getElementById('detail-cover');
        const placeholder = document.getElementById('detail-cover-placeholder');
        if (playlist.coverUrl) {
            cover.src = playlist.coverUrl;
            cover.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            placeholder.style.display = 'flex';
        }

        // Render tracks (with optional highlight)
        renderTracks(tracks, highlightTrackIndex);

        // Show detail section, hide playlists
        loggedInSection.style.display = 'none';
        playlistDetailSection.style.display = 'block';

        // Scroll to top (unless highlighting a track)
        if (highlightTrackIndex === null) {
            window.scrollTo(0, 0);
        }
    }

    // Render tracks list
    // highlightTrackIndex: optional index of track to highlight and scroll to (for "Go to Album/Playlist" feature)
    function renderTracks(tracks, highlightTrackIndex = null) {
        const tracksList = document.getElementById('tracks-list');

        if (!tracks || tracks.length === 0) {
            tracksList.innerHTML = '<div class="empty-state"><p>Diese Playlist enthält keine Titel.</p></div>';
            return;
        }

        // If highlightTrackIndex is provided, set it as current track for highlighting
        if (highlightTrackIndex !== null && highlightTrackIndex >= 0 && highlightTrackIndex < tracks.length) {
            currentTrackIndex = highlightTrackIndex;
        }

        tracksList.innerHTML = tracks.map((track, index) => `
            <div class="track-item${currentTrackIndex === index ? ' playing' : ''}" onclick="playTrack(${index}, event)" data-index="${index}">
                <span class="track-number">${index + 1}</span>
                <button type="button" class="track-play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        ${currentTrackIndex === index && isPlaying
                            ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
                            : '<path d="M8 5v14l11-7z"/>'}
                    </svg>
                </button>
                <div class="track-cover">
                    ${track.albumCover
                        ? `<img src="${track.albumCover}" alt="" loading="lazy">`
                        : ''}
                </div>
                <div class="track-info">
                    <div class="track-title">${escapeHtml(track.title)}</div>
                    <div class="track-artist">${escapeHtml(track.artistName || 'Unbekannt')}</div>
                </div>
                ${track.qualityLabel ? `<span class="track-quality">${track.qualityLabel}</span>` : ''}
                <span class="track-duration">${track.formattedDuration}</span>
            </div>
        `).join('');

        // Scroll to highlighted track after render
        if (highlightTrackIndex !== null && highlightTrackIndex >= 0) {
            setTimeout(() => {
                const playingTrack = tracksList.querySelector('.track-item.playing');
                if (playingTrack) {
                    playingTrack.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }

    // Back to playlists
    function backToPlaylists() {
        playlistDetailSection.style.display = 'none';
        loggedInSection.style.display = 'block';
    }

    // Bluesound status polling
    let bluesoundStatusInterval = null;

    // Play track by index
    async function playTrack(index, event) {
        // Prevent any default behavior and stop propagation
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (index < 0 || index >= currentTracks.length) return;

        const track = currentTracks[index];
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!track.isStreamable) {
            showError('Dieser Titel ist nicht streambar');
            return;
        }

        // Show loading state on the track item instead of full overlay
        const trackItem = document.querySelector(`.track-item[data-index="${index}"]`);
        if (trackItem) {
            trackItem.style.opacity = '0.6';
        }

        const selectedPlayer = getSelectedPlayer();

        try {
            // Check if we should play on Bluesound or browser
            if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
                await playOnBluesound(track, index, authToken);
            } else {
                await playOnBrowser(track, index, authToken);
            }
        } catch (error) {
            console.error('Failed to play track:', error);
            showError('Fehler beim Laden des Streams');
        }

        // Restore track item opacity
        if (trackItem) {
            trackItem.style.opacity = '1';
        }
    }

    // Play track in browser
    async function playOnBrowser(track, index, authToken) {
        // Stop Bluesound status polling if active
        stopBluesoundStatusPolling();

        // Not using native Qobuz playback
        usingNativeQobuzPlayback = false;

        const streamQuality = getStreamQuality();
        const response = await fetch(`/Qobuz?handler=TrackStreamUrl&trackId=${track.id}&authToken=${encodeURIComponent(authToken)}&formatId=${streamQuality}`);
        const data = await response.json();

        if (data.success && data.url) {
            currentTrackIndex = index;

            // Sync playlist with GlobalPlayer for cross-page navigation
            if (window.GlobalPlayer) {
                window.GlobalPlayer.setPlaylist(currentTracks, index);
            }

            // Save queue to database
            await saveQueueToDb(index);

            audioPlayer.src = data.url;
            audioPlayer.play();
            isPlaying = true;

            updateNowPlaying(track);
            updateTrackHighlight();
        } else {
            showError(data.error || 'Stream URL konnte nicht abgerufen werden');
        }
    }

    // Play track on Bluesound player
    // Uses native Qobuz integration when playing from album/playlist context
    // Falls back to stream URL for single tracks (search results)
    async function playOnBluesound(track, index, authToken) {
        // Pause browser playback if active
        if (audioPlayer.src) {
            audioPlayer.pause();
        }

        const selectedPlayer = getSelectedPlayer();

        // Check if we can use native Qobuz integration
        // Native integration works when we have album or playlist context
        const canUseNative = currentSourceType && currentSourceId &&
            (currentSourceType === 'album' || currentSourceType === 'playlist');

        let response;
        let data;

        if (canUseNative) {
            // Use native BluOS Qobuz integration
            // The player manages the queue itself - works even when browser is in background
            console.log(`Using native Qobuz integration: ${currentSourceType} ${currentSourceId}, track index ${index}`);

            const requestBody = {
                ip: selectedPlayer.ip,
                port: selectedPlayer.port || 11000,
                sourceType: currentSourceType,
                sourceId: currentSourceId,
                trackIndex: index
            };

            if (currentSourceType === 'album') {
                requestBody.albumId = currentSourceId;
                requestBody.trackId = track.id; // Required for /ui/prf format
            } else if (currentSourceType === 'playlist') {
                requestBody.playlistId = parseInt(currentSourceId, 10);
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
            // Fall back to stream URL for single tracks (search results)
            console.log('Using stream URL fallback for single track');

            const streamQuality = getStreamQuality();

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
            currentTrackIndex = index;
            isPlaying = true;

            // Track whether we're using native Qobuz playback
            usingNativeQobuzPlayback = !!data.native;

            // Save queue to database (still useful for UI state)
            await saveQueueToDb(index);

            updateNowPlaying(track);
            updateTrackHighlight();

            // Start polling for Bluesound status (for progress display)
            // For native playback, we don't need to poll for auto-advance -
            // the player handles that itself
            startBluesoundStatusPolling();

            // Log if using native mode
            if (data.native) {
                console.log('Native Qobuz playback started - player manages queue');
            }
        } else {
            showError(data.error || 'Wiedergabe auf Bluesound fehlgeschlagen');
        }
    }

    // Start polling Bluesound player status
    function startBluesoundStatusPolling() {
        stopBluesoundStatusPolling(); // Clear any existing interval

        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) return;

        // Start client-side progress animation
        startProgressAnimation();

        // Poll every 5 seconds (reduced from 2 seconds)
        bluesoundStatusInterval = setInterval(async () => {
            const player = getSelectedPlayer();
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

    // Stop polling Bluesound player status
    function stopBluesoundStatusPolling() {
        if (bluesoundStatusInterval) {
            clearInterval(bluesoundStatusInterval);
            bluesoundStatusInterval = null;
        }
        stopProgressAnimation();
    }

    // Start client-side progress bar animation
    function startProgressAnimation() {
        stopProgressAnimation();

        function animateProgress() {
            if (!isPlaying || lastKnownTotal <= 0) {
                progressAnimationFrame = requestAnimationFrame(animateProgress);
                return;
            }

            // Calculate estimated current position based on time elapsed since last status update
            const elapsed = (Date.now() - lastStatusTime) / 1000;
            const estimatedPosition = Math.min(lastKnownPosition + elapsed, lastKnownTotal);
            const progress = (estimatedPosition / lastKnownTotal) * 100;

            // Update global progress bar
            if (window.GlobalPlayer) {
                const progressFill = document.getElementById('global-progress-fill');
                const currentTime = document.getElementById('global-current-time');
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (currentTime) currentTime.textContent = formatTime(estimatedPosition);

                // Update popup progress if open
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

    // Update UI based on Bluesound status
    function updateBluesoundStatus(status, showBar = false) {
        // Update play/pause state
        const wasPlaying = isPlaying;
        isPlaying = status.state === 'play' || status.state === 'stream';

        if (wasPlaying !== isPlaying) {
            updateTrackHighlight();

            // Stop polling if playback paused/stopped (not by us)
            if (!isPlaying && status.state === 'pause') {
                stopBluesoundStatusPolling();
            }
        }

        // Check if track changed (different title)
        const trackChanged = lastTrackTitle !== status.title;

        // Update GlobalPlayer with track info
        if (status.title && window.GlobalPlayer) {
            // Update track info in global player
            window.GlobalPlayer.setCurrentTrack({
                title: status.title,
                artist: status.artist,
                artistName: status.artist,
                album: status.album,
                imageUrl: status.imageUrl,
                albumCover: status.imageUrl
            });

            // Update play state in global player
            window.GlobalPlayer.setPlaying(isPlaying);

            // Show the Now Playing bar if something is playing
            if (showBar && (isPlaying || status.state === 'pause')) {
                window.GlobalPlayer.showBar();
            }

            lastTrackTitle = status.title;
        }

        // Update progress tracking for client-side animation
        if (status.currentSeconds !== undefined && status.totalSeconds !== undefined && status.totalSeconds > 0) {
            // Check if progress significantly differs from our client-side estimate
            const elapsed = (Date.now() - lastStatusTime) / 1000;
            const estimatedPosition = lastKnownPosition + elapsed;
            const actualDiff = Math.abs(status.currentSeconds - estimatedPosition);

            // Update our tracking values
            lastKnownPosition = status.currentSeconds;
            lastKnownTotal = status.totalSeconds;
            lastStatusTime = Date.now();

            // Update total time display (only needs to be done when it changes)
            const totalTimeEl = document.getElementById('global-total-time');
            if (totalTimeEl) totalTimeEl.textContent = formatTime(status.totalSeconds);

            const popupTotalTimeEl = document.getElementById('global-popup-total-time');
            if (popupTotalTimeEl) popupTotalTimeEl.textContent = formatTime(status.totalSeconds);

            // If track changed or progress differs by more than 3 seconds, do an immediate update
            if (trackChanged || actualDiff > 3) {
                const progress = (status.currentSeconds / status.totalSeconds) * 100;
                const progressFill = document.getElementById('global-progress-fill');
                const currentTime = document.getElementById('global-current-time');
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (currentTime) currentTime.textContent = formatTime(status.currentSeconds);

                const popupProgressFill = document.getElementById('global-popup-progress-fill');
                const popupCurrentTime = document.getElementById('global-popup-current-time');
                if (popupProgressFill) popupProgressFill.style.width = `${progress}%`;
                if (popupCurrentTime) popupCurrentTime.textContent = formatTime(status.currentSeconds);
            }
        }

        // Check if playback stopped (track ended)
        if (status.state === 'stop' && wasPlaying) {
            // For native Qobuz playback, don't call playNext() -
            // the player manages the queue itself
            if (usingNativeQobuzPlayback) {
                console.log('Native playback stopped - player handles queue automatically');
                // Just stop polling, the player will continue with next track
                stopBluesoundStatusPolling();
            } else {
                stopBluesoundStatusPolling();
                // Track might have ended, try to play next (stream URL mode)
                playNext();
            }
        }
    }

    // Play all tracks starting from first
    function playAll() {
        if (currentTracks.length > 0) {
            playTrack(0);
        }
    }

    // Play previous track
    function playPrevious() {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            // Send previous command to Bluesound
            sendBluesoundControl('previous');
            // Also try to play the previous track from our list
            if (currentTrackIndex > 0) {
                playTrack(currentTrackIndex - 1);
            }
        } else {
            if (currentTrackIndex > 0) {
                playTrack(currentTrackIndex - 1);
            }
        }
    }

    // Play next track
    function playNext() {
        const selectedPlayer = getSelectedPlayer();
        if (currentTrackIndex < currentTracks.length - 1) {
            playTrack(currentTrackIndex + 1);
        } else {
            // End of playlist
            isPlaying = false;
            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(false);
            if (selectedPlayer.type === 'bluesound') {
                sendBluesoundControl('stop');
                stopBluesoundStatusPolling();
            }
        }
    }

    // Toggle play/pause
    async function togglePlayPause() {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            // Send play/pause command to Bluesound
            const action = isPlaying ? 'pause' : 'play';
            await sendBluesoundControl(action);
            isPlaying = !isPlaying;
            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(isPlaying);
            updateTrackHighlight();

            // Stop polling when paused, start when playing
            if (isPlaying) {
                startBluesoundStatusPolling();
            } else {
                stopBluesoundStatusPolling();
            }
        } else {
            if (!audioPlayer.src) return;

            if (isPlaying) {
                audioPlayer.pause();
                isPlaying = false;
            } else {
                audioPlayer.play();
                isPlaying = true;
            }

            if (window.GlobalPlayer) window.GlobalPlayer.setPlaying(isPlaying);
            updateTrackHighlight();
        }
    }

    // Seek to position in seconds
    function seekTo(seconds) {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer.type === 'browser' && audioPlayer.src) {
            audioPlayer.currentTime = seconds;
        }
        // TODO: Add Bluesound seek support if needed
    }

    // Handle player change - called when user switches between browser and Bluesound
    // Implements handoff: stops playback on old device and continues on new device
    async function handlePlayerChange(previousType, newType, newPlayer, previousPlayer) {
        // Check if something is playing that we can hand off
        const hasTrackToHandoff = currentTrackIndex >= 0 && currentTracks.length > 0;
        const wasPlaying = isPlaying;
        let currentPosition = 0;

        if (previousType === 'browser') {
            // Get current position from browser
            currentPosition = audioPlayer.currentTime || 0;

            // Stop browser playback
            if (audioPlayer.src && !audioPlayer.paused) {
                audioPlayer.pause();
            }
            isPlaying = false;
        } else if (previousType === 'bluesound' && previousPlayer?.ip) {
            // Get current position from Bluesound status (use last known position)
            currentPosition = window.GlobalPlayer?.getLastKnownPosition?.() || 0;

            // Stop Bluesound playback on the OLD player
            await stopBluesoundPlayback(previousPlayer.ip, previousPlayer.port || 11000);
            stopBluesoundStatusPolling();
        }

        // If nothing was playing, just update UI and return
        if (!hasTrackToHandoff || !wasPlaying) {
            updateTrackHighlight();
            return;
        }

        // Hand off to new device
        const track = currentTracks[currentTrackIndex];
        const creds = await getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!track || !authToken) {
            updateTrackHighlight();
            return;
        }

        console.log(`Handoff: ${previousType} → ${newType} at ${Math.round(currentPosition)}s`);

        if (newType === 'bluesound' && newPlayer?.ip) {
            // Start playback on Bluesound
            await playOnBluesound(track, currentTrackIndex, authToken);
            // Note: BluOS doesn't support seeking to a position easily,
            // so the track starts from the beginning
        } else if (newType === 'browser') {
            // Start playback on browser and seek to position
            await playOnBrowser(track, currentTrackIndex, authToken);
            // Seek to the saved position after playback starts
            if (currentPosition > 0) {
                audioPlayer.currentTime = currentPosition;
            }
        }
    }

    // Stop playback on a specific Bluesound player
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

    // Send control command to Bluesound player
    async function sendBluesoundControl(action) {
        const selectedPlayer = getSelectedPlayer();
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

    // Update now playing bar via GlobalPlayer
    function updateNowPlaying(track) {
        // Store track info for quality switching
        currentTrackInfo = track;
        lastTrackTitle = track.title;

        // Reset progress tracking for new track
        lastKnownPosition = 0;
        lastKnownTotal = 0;
        lastStatusTime = Date.now();

        // Reset progress UI elements
        const progressFill = document.getElementById('global-progress-fill');
        const currentTime = document.getElementById('global-current-time');
        const totalTime = document.getElementById('global-total-time');
        if (progressFill) progressFill.style.width = '0%';
        if (currentTime) currentTime.textContent = '0:00';
        if (totalTime) totalTime.textContent = '0:00';

        // Also reset popup progress if open
        const popupProgressFill = document.getElementById('global-popup-progress-fill');
        const popupCurrentTime = document.getElementById('global-popup-current-time');
        const popupTotalTime = document.getElementById('global-popup-total-time');
        if (popupProgressFill) popupProgressFill.style.width = '0%';
        if (popupCurrentTime) popupCurrentTime.textContent = '0:00';
        if (popupTotalTime) popupTotalTime.textContent = '0:00';

        // Update GlobalPlayer
        if (window.GlobalPlayer) {
            window.GlobalPlayer.setCurrentTrack({
                title: track.title,
                artist: track.artistName,
                artistName: track.artistName,
                album: track.albumTitle,
                imageUrl: track.albumCover,
                albumCover: track.albumCover
            });

            window.GlobalPlayer.setPlaying(isPlaying);
        }
    }

    // ==================== Quality Settings (via GlobalPlayer) ====================

    let currentTrackInfo = null; // Store current track info for quality switching

    // Note: Quality selection is now handled by GlobalPlayer popup
    // This function is called when GlobalPlayer quality changes and we need to restart current track
    window.onGlobalQualityChange = async function(formatId) {
        const selectedPlayer = getSelectedPlayer();

        // Sync quality setting to Bluesound player if selected
        if (selectedPlayer?.type === 'bluesound' && selectedPlayer.ip) {
            await setBluesoundQobuzQuality(formatId);
        }

        // If something is playing, restart with new quality
        if (currentTrackInfo && (isPlaying || audioPlayer.currentTime > 0)) {
            const currentTime = selectedPlayer.type === 'browser' ? audioPlayer.currentTime : null;

            showLoading();
            try {
                // Get new stream URL with new quality
                const creds = await getQobuzCredentials();
                if (!creds?.authToken) {
                    hideLoading();
                    return;
                }

                const response = await fetch(`/Qobuz?handler=TrackStreamUrl&trackId=${currentTrackInfo.id}&authToken=${encodeURIComponent(creds.authToken)}&formatId=${formatId}`);
                const data = await response.json();

                if (data.success && data.url) {
                    if (selectedPlayer.type === 'browser') {
                        // Browser playback - restart at position
                        const wasPlaying = isPlaying;
                        audioPlayer.src = data.url;
                        audioPlayer.load();

                        audioPlayer.addEventListener('loadedmetadata', function onLoaded() {
                            if (currentTime) {
                                audioPlayer.currentTime = currentTime;
                            }
                            if (wasPlaying) {
                                audioPlayer.play();
                            }
                            audioPlayer.removeEventListener('loadedmetadata', onLoaded);
                        });
                    } else if (selectedPlayer.type === 'bluesound') {
                        // Bluesound playback - restart with new quality
                        const playResponse = await fetch('?handler=PlayOnBluesound', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                            },
                            body: JSON.stringify({
                                ip: selectedPlayer.ip,
                                port: selectedPlayer.port || 11000,
                                trackId: currentTrackInfo.id,
                                authToken: creds.authToken,
                                formatId: formatId,
                                title: currentTrackInfo.title,
                                artist: currentTrackInfo.artistName,
                                album: currentTrackInfo.albumTitle,
                                imageUrl: currentTrackInfo.albumCover
                            })
                        });

                        const playData = await playResponse.json();
                        if (!playData.success) {
                            throw new Error('Failed to restart on Bluesound');
                        }
                    }
                } else {
                    showError('Qualität konnte nicht geändert werden');
                }
            } catch (error) {
                console.error('Failed to change quality:', error);
                showError('Qualität konnte nicht geändert werden');
            }
            hideLoading();
        }
    };

    // Update track highlight in list
    function updateTrackHighlight() {
        document.querySelectorAll('.track-item').forEach((item, index) => {
            item.classList.toggle('playing', index === currentTrackIndex);

            const btn = item.querySelector('.track-play-btn svg');
            if (index === currentTrackIndex && isPlaying) {
                btn.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
            } else {
                btn.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        });
    }

    // Update progress bar for browser playback (updates GlobalPlayer)
    function updateProgress() {
        if (!audioPlayer.duration) return;

        if (window.GlobalPlayer) {
            window.GlobalPlayer.updateProgress(audioPlayer.currentTime, audioPlayer.duration);
        }
    }

    // Update total time display
    function updateTotalTime() {
        if (window.GlobalPlayer && audioPlayer.duration) {
            window.GlobalPlayer.updateProgress(audioPlayer.currentTime, audioPlayer.duration);
        }
    }

    // Format time as m:ss
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Logout
    async function logout() {
        // Stop playback
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = '';
        }
        isPlaying = false;
        currentTracks = [];
        currentTrackIndex = -1;
        stopBluesoundStatusPolling();

        // Reset global player state (but keep bar visible)
        if (window.GlobalPlayer) {
            window.GlobalPlayer.setPlaying(false);
            window.GlobalPlayer.setCurrentTrack({
                title: 'Kein Titel',
                artist: '-',
                albumCover: null
            });
            window.GlobalPlayer.updateProgress(0, 0);
        }

        await clearSession();
        loginSection.style.display = 'flex';
        loggedInSection.style.display = 'none';
        playlistDetailSection.style.display = 'none';
        userMenu.style.display = 'none';
        document.getElementById('playlists-grid').innerHTML = '';
    }

    // Clear session data (from active profile)
    async function clearSession() {
        await clearQobuzCredentials();
    }

    // ==================== Player Selector (now handled by GlobalPlayer) ====================

    // Open player selector via GlobalPlayer
    async function openPlayerSelector() {
        if (window.openGlobalPlayerSelector) {
            window.openGlobalPlayerSelector();
        }
    }

    // Close player selector (handled by GlobalPlayer)
    function closePlayerSelector() {
        if (window.closeGlobalPlayerSelector) {
            window.closeGlobalPlayerSelector();
        }
    }

    // Note: Player selection and stream quality are now handled by GlobalPlayer

    // Check current playback status on page load (for Qobuz page-specific track list highlighting)
    async function checkCurrentPlayback() {
        const selectedPlayer = getSelectedPlayer();
        if (selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) {
            return;
        }

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundStatus&ip=${selectedPlayer.ip}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status) {
                // Update the Now Playing bar with current status
                updateBluesoundStatus(data.status, true);

                // Start polling if something is playing
                if (data.status.state === 'play' || data.status.state === 'stream') {
                    startBluesoundStatusPolling();
                }
            }
        } catch (error) {
            console.error('Failed to check current playback:', error);
        }
    }

    // Check playback after page is ready
    checkCurrentPlayback();

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose functions globally for onclick handlers
    window.selectAlbum = selectAlbum;
    window.selectPlaylist = selectPlaylist;
    window.playSearchTrack = playSearchTrack;
    window.playTrack = playTrack;
    window.playTrackDirectly = playSearchTrack; // Alias for favorites
    window.switchTab = switchTab;
    window.backToPlaylists = backToPlaylists;
    window.playAll = playAll;
    window.loadPlaylists = loadPlaylists;
    window.loadNewReleases = loadNewReleases;
    window.loadAlbumCharts = loadAlbumCharts;
    window.loadTopPlaylists = loadTopPlaylists;
    window.loadRecommendations = loadRecommendations;
    window.clearSearch = clearSearch;
    window.openPlayerSelector = openPlayerSelector;
    window.closePlayerSelector = closePlayerSelector;
    window.logout = logout;
})();
