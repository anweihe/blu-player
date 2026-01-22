/**
 * Qobuz Browse Module
 * Handles tabs, albums, playlists, favorites, and content loading
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    const escapeHtml = () => QobuzApp.core.escapeHtml;

    // ==================== Infinite Scroll ====================

    function setupInfiniteScroll() {
        if (QobuzApp.setup.infiniteScroll) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;

            if (scrollTop + clientHeight >= scrollHeight - 500) {
                const tabs = QobuzApp.tabs;
                const pagination = QobuzApp.pagination;

                if (tabs.currentTab === 'album-charts' && pagination.albumChartsHasMore && !pagination.albumChartsLoading) {
                    loadMoreAlbumCharts();
                } else if (tabs.currentTab === 'new-releases' && pagination.newReleasesHasMore && !pagination.newReleasesLoading) {
                    loadMoreNewReleases();
                } else if (tabs.currentTab === 'top-playlists' && pagination.topPlaylistsHasMore && !pagination.topPlaylistsLoading) {
                    loadMoreTopPlaylists();
                }
            }
        });

        QobuzApp.setup.infiniteScroll = true;
    }

    // ==================== Tab Switching ====================

    function switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        QobuzApp.tabs.currentTab = tabId;

        if (tabId === 'new-releases' && !QobuzApp.tabs.newReleasesLoaded) {
            loadNewReleases();
        } else if (tabId === 'album-charts' && !QobuzApp.tabs.albumChartsLoaded) {
            loadAlbumCharts();
        } else if (tabId === 'top-playlists' && !QobuzApp.tabs.topPlaylistsLoaded) {
            loadTopPlaylists();
        } else if (tabId === 'recommendations') {
            loadCurrentFavoritesSubTab();
        }
    }

    // ==================== Favorites Sub-Tabs ====================

    function switchFavoritesSubTab(subTab) {
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === subTab);
        });

        document.querySelectorAll('.favorites-content').forEach(content => {
            content.classList.toggle('active', content.id === `favorites-${subTab}`);
        });

        QobuzApp.tabs.currentFavoritesSubTab = subTab;
        loadCurrentFavoritesSubTab();
    }

    function loadCurrentFavoritesSubTab() {
        const tabs = QobuzApp.tabs;
        if (tabs.currentFavoritesSubTab === 'albums' && !tabs.favAlbumsLoaded) {
            loadFavoriteAlbums();
        } else if (tabs.currentFavoritesSubTab === 'tracks' && !tabs.favTracksLoaded) {
            loadFavoriteTracks();
        } else if (tabs.currentFavoritesSubTab === 'artists' && !tabs.favArtistsLoaded) {
            loadFavoriteArtists();
        }
    }

    function refreshCurrentFavoritesSubTab() {
        const tabs = QobuzApp.tabs;
        if (tabs.currentFavoritesSubTab === 'albums') {
            tabs.favAlbumsLoaded = false;
            loadFavoriteAlbums();
        } else if (tabs.currentFavoritesSubTab === 'tracks') {
            tabs.favTracksLoaded = false;
            loadFavoriteTracks();
        } else if (tabs.currentFavoritesSubTab === 'artists') {
            tabs.favArtistsLoaded = false;
            loadFavoriteArtists();
        }
    }

    // ==================== New Releases ====================

    async function loadNewReleases(append = false) {
        const pagination = QobuzApp.pagination;
        if (pagination.newReleasesLoading) return;
        if (append && !pagination.newReleasesHasMore) return;

        pagination.newReleasesLoading = true;

        if (!append) {
            QobuzApp.core.showLoading();
            pagination.newReleasesOffset = 0;
            pagination.newReleasesHasMore = true;
        }

        try {
            const creds = await QobuzApp.auth.getQobuzCredentials();
            const authToken = creds?.authToken || '';
            const response = await fetch(`?handler=NewReleases&authToken=${encodeURIComponent(authToken)}&offset=${pagination.newReleasesOffset}&limit=50`);
            const data = await response.json();

            if (data.success) {
                if (append) {
                    appendNewReleases(data.albums, pagination.newReleasesOffset);
                } else {
                    renderAlbums(data.albums);
                }
                pagination.newReleasesOffset += data.albums.length;
                pagination.newReleasesHasMore = data.hasMore;
                QobuzApp.tabs.newReleasesLoaded = true;
            } else if (!append) {
                QobuzApp.core.showError('Neuheiten konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load new releases:', error);
            if (!append) {
                QobuzApp.core.showError('Neuheiten konnten nicht geladen werden');
            }
        }

        pagination.newReleasesLoading = false;
        if (!append) {
            QobuzApp.core.hideLoading();
        }
    }

    function loadMoreNewReleases() {
        if (QobuzApp.tabs.currentTab === 'new-releases' && QobuzApp.pagination.newReleasesHasMore && !QobuzApp.pagination.newReleasesLoading) {
            loadNewReleases(true);
        }
    }

    function appendNewReleases(albums, startIndex) {
        const grid = document.getElementById('albums-grid');
        if (!grid || !albums || albums.length === 0) return;

        const escape = QobuzApp.core.escapeHtml;
        const html = albums.map(album => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escape(album.title)}" loading="lazy">`
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
                    <h3 class="playlist-name">${escape(album.title)}</h3>
                    <div class="playlist-meta">${escape(album.artistName || '')}</div>
                </div>
            </div>
        `).join('');

        grid.insertAdjacentHTML('beforeend', html);
    }

    function renderAlbums(albums) {
        const grid = document.getElementById('albums-grid');
        const emptyState = document.getElementById('albums-empty');

        if (!albums || albums.length === 0) {
            if (grid) grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const escape = QobuzApp.core.escapeHtml;
        grid.innerHTML = albums.map(album => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escape(album.title)}" loading="lazy">`
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
                    <h3 class="playlist-name">${escape(album.title)}</h3>
                    <div class="playlist-meta">${escape(album.artistName || '')}</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== Album Charts ====================

    async function loadAlbumCharts(append = false) {
        const pagination = QobuzApp.pagination;
        if (pagination.albumChartsLoading) return;
        if (append && !pagination.albumChartsHasMore) return;

        pagination.albumChartsLoading = true;

        if (!append) {
            QobuzApp.core.showLoading();
            pagination.albumChartsOffset = 0;
            pagination.albumChartsHasMore = true;
        }

        try {
            const creds = await QobuzApp.auth.getQobuzCredentials();
            const authToken = creds?.authToken || '';
            const response = await fetch(`?handler=MostStreamedAlbums&authToken=${encodeURIComponent(authToken)}&offset=${pagination.albumChartsOffset}&limit=50`);
            const data = await response.json();

            if (data.success) {
                if (append) {
                    appendAlbumCharts(data.albums, pagination.albumChartsOffset);
                } else {
                    renderAlbumCharts(data.albums);
                }
                pagination.albumChartsOffset += data.albums.length;
                pagination.albumChartsHasMore = data.hasMore;
                QobuzApp.tabs.albumChartsLoaded = true;
            } else if (!append) {
                QobuzApp.core.showError('Album-Charts konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load album charts:', error);
            if (!append) {
                QobuzApp.core.showError('Album-Charts konnten nicht geladen werden');
            }
        }

        pagination.albumChartsLoading = false;
        if (!append) {
            QobuzApp.core.hideLoading();
        }
    }

    function loadMoreAlbumCharts() {
        if (QobuzApp.tabs.currentTab === 'album-charts' && QobuzApp.pagination.albumChartsHasMore && !QobuzApp.pagination.albumChartsLoading) {
            loadAlbumCharts(true);
        }
    }

    function appendAlbumCharts(albums, startIndex) {
        const grid = document.getElementById('charts-grid');
        if (!grid || !albums || albums.length === 0) return;

        const escape = QobuzApp.core.escapeHtml;
        const html = albums.map((album, idx) => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    <span class="chart-position">${startIndex + idx + 1}</span>
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escape(album.title)}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escape(album.title)}</h3>
                    <div class="playlist-meta">${escape(album.artistName || '')}</div>
                </div>
            </div>
        `).join('');

        grid.insertAdjacentHTML('beforeend', html);
    }

    function renderAlbumCharts(albums) {
        const grid = document.getElementById('charts-grid');
        const emptyState = document.getElementById('charts-empty');

        if (!albums || albums.length === 0) {
            if (grid) grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const escape = QobuzApp.core.escapeHtml;
        grid.innerHTML = albums.map((album, idx) => `
            <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                <div class="playlist-cover">
                    <span class="chart-position">${idx + 1}</span>
                    ${album.coverUrl
                        ? `<img src="${album.coverUrl}" alt="${escape(album.title)}" loading="lazy">`
                        : `<div class="playlist-cover-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escape(album.title)}</h3>
                    <div class="playlist-meta">${escape(album.artistName || '')}</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== Genre Filter ====================

    // Ensure selectedGenres is initialized
    function ensureGenreState() {
        if (!QobuzApp.tabs.selectedGenres || !(QobuzApp.tabs.selectedGenres instanceof Set)) {
            QobuzApp.tabs.selectedGenres = new Set();
        }
    }

    function toggleGenreFilter() {
        try {
            const toggle = document.getElementById('genreToggle');
            const wrapper = document.getElementById('genreWrapper');

            QobuzApp.tabs.genreFilterExpanded = !QobuzApp.tabs.genreFilterExpanded;

            if (toggle) toggle.classList.toggle('expanded', QobuzApp.tabs.genreFilterExpanded);
            if (wrapper) wrapper.classList.toggle('expanded', QobuzApp.tabs.genreFilterExpanded);
        } catch (error) {
            console.error('Error in toggleGenreFilter:', error);
        }
    }

    function toggleGenre(chipElement) {
        try {
            ensureGenreState();
            const genreId = chipElement.dataset.genre;
            const selectedGenres = QobuzApp.tabs.selectedGenres;

            if (selectedGenres.has(genreId)) {
                selectedGenres.delete(genreId);
                chipElement.classList.remove('selected');
            } else {
                selectedGenres.add(genreId);
                chipElement.classList.add('selected');
            }

            updateGenreFilterState();

            // Reset pagination and reload playlists (skip global loading overlay)
            resetPlaylistsPagination();
            loadTopPlaylists(false, true);
        } catch (error) {
            console.error('Error in toggleGenre:', error);
        }
    }

    function clearGenreFilter() {
        try {
            ensureGenreState();
            QobuzApp.tabs.selectedGenres.clear();

            // Remove selected class from all chips
            document.querySelectorAll('.genre-chip').forEach(chip => {
                chip.classList.remove('selected');
            });

            updateGenreFilterState();

            // Reset pagination and reload playlists (skip global loading overlay)
            resetPlaylistsPagination();
            loadTopPlaylists(false, true);
        } catch (error) {
            console.error('Error in clearGenreFilter:', error);
        }
    }

    function updateGenreFilterState() {
        try {
            ensureGenreState();
            const count = QobuzApp.tabs.selectedGenres.size;
            const toggle = document.getElementById('genreToggle');
            const badge = document.getElementById('genreBadge');
            const clearBtn = document.getElementById('genreClear');
            const clearBtnInline = document.getElementById('genreClearInline');

            // Update badge
            if (badge) badge.textContent = count;

            // Update toggle style
            if (toggle) {
                toggle.classList.toggle('has-selection', count > 0);
            }

            // Show/hide clear button (inside expanded panel)
            if (clearBtn) {
                clearBtn.classList.toggle('visible', count > 0);
            }

            // Show/hide inline clear button (next to toggle, always visible when filters active)
            if (clearBtnInline) {
                clearBtnInline.classList.toggle('visible', count > 0);
            }
        } catch (error) {
            console.error('Error in updateGenreFilterState:', error);
        }
    }

    function getGenreIdsParam() {
        try {
            ensureGenreState();
            const selectedGenres = QobuzApp.tabs.selectedGenres;
            if (!selectedGenres || selectedGenres.size === 0) return '';
            return Array.from(selectedGenres).join(',');
        } catch (error) {
            console.error('Error in getGenreIdsParam:', error);
            return '';
        }
    }

    function resetPlaylistsPagination() {
        try {
            // Clear all pagination states since filters changed
            QobuzApp.pagination.playlistsPagination = {};
            QobuzApp.tabs.playlistsSubTabsLoaded = {};

            // Show loading skeleton in grid instead of full-page loading overlay
            const grid = document.getElementById('top-playlists-grid');
            if (grid) {
                grid.innerHTML = '<div class="grid-loading"><div class="loading-spinner-small"></div></div>';
            }

            // Hide empty state
            const emptyState = document.getElementById('top-playlists-empty');
            if (emptyState) emptyState.style.display = 'none';
        } catch (error) {
            console.error('Error in resetPlaylistsPagination:', error);
        }
    }

    // ==================== Playlists Sub-Tabs ====================

    function switchPlaylistsSubTab(subTab) {
        try {
            // Update button styles
            document.querySelectorAll('.playlists-sub-nav .sub-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.subtab === subTab);
            });

            QobuzApp.tabs.currentPlaylistsSubTab = subTab;

            // Show loading in grid (not global overlay)
            const grid = document.getElementById('top-playlists-grid');
            if (grid) {
                grid.innerHTML = '<div class="grid-loading"><div class="loading-spinner-small"></div></div>';
            }

            // Hide empty state
            const emptyState = document.getElementById('top-playlists-empty');
            if (emptyState) emptyState.style.display = 'none';

            // Reset pagination for this sub-tab since we're switching
            const paginationKey = getPaginationKey();
            QobuzApp.pagination.playlistsPagination[paginationKey] = null;

            // Load playlists (skip global loading overlay)
            loadTopPlaylists(false, true);
        } catch (error) {
            console.error('Error in switchPlaylistsSubTab:', error);
        }
    }

    function refreshCurrentPlaylistsSubTab() {
        try {
            const paginationKey = getPaginationKey();
            const pagination = QobuzApp.pagination.playlistsPagination[paginationKey];
            if (pagination) {
                pagination.offset = 0;
                pagination.hasMore = true;
            }
            QobuzApp.tabs.playlistsSubTabsLoaded[paginationKey] = false;

            // Show loading in grid (not global overlay)
            const grid = document.getElementById('top-playlists-grid');
            if (grid) {
                grid.innerHTML = '<div class="grid-loading"><div class="loading-spinner-small"></div></div>';
            }

            loadTopPlaylists(false, true);
        } catch (error) {
            console.error('Error in refreshCurrentPlaylistsSubTab:', error);
        }
    }

    function getPaginationKey() {
        try {
            // Create a unique key based on current sub-tab and genre selection
            const subTab = QobuzApp.tabs.currentPlaylistsSubTab || 'all';
            const genreIds = getGenreIdsParam();
            return genreIds ? `${subTab}_${genreIds}` : subTab;
        } catch (error) {
            console.error('Error in getPaginationKey:', error);
            return 'all';
        }
    }

    // ==================== Top Playlists ====================

    async function loadTopPlaylists(append = false, skipGlobalLoading = false) {
        const subTab = QobuzApp.tabs.currentPlaylistsSubTab;
        const apiTag = subTab === 'all' ? '' : subTab;
        const genreIds = getGenreIdsParam();
        const paginationKey = getPaginationKey();

        // Initialize per-subtab pagination if not exists
        if (!QobuzApp.pagination.playlistsPagination[paginationKey]) {
            QobuzApp.pagination.playlistsPagination[paginationKey] = {
                offset: 0,
                hasMore: true,
                loading: false
            };
        }
        const pagination = QobuzApp.pagination.playlistsPagination[paginationKey];

        if (pagination.loading) return;
        if (append && !pagination.hasMore) return;

        pagination.loading = true;

        if (!append) {
            // Only show global loading on initial load, not on filter changes
            if (!skipGlobalLoading) {
                QobuzApp.core.showLoading();
            }
            pagination.offset = 0;
            pagination.hasMore = true;
        }

        try {
            const creds = await QobuzApp.auth.getQobuzCredentials();
            const authToken = creds?.authToken || '';
            const response = await fetch(`?handler=DiscoverPlaylists&authToken=${encodeURIComponent(authToken)}&offset=${pagination.offset}&limit=50&tags=${encodeURIComponent(apiTag)}&genreIds=${encodeURIComponent(genreIds)}`);
            const data = await response.json();

            if (data.success) {
                if (append) {
                    appendTopPlaylists(data.playlists, pagination.offset);
                } else {
                    renderTopPlaylists(data.playlists);
                }
                pagination.offset += data.playlists.length;
                pagination.hasMore = data.hasMore;
                QobuzApp.tabs.playlistsSubTabsLoaded[paginationKey] = true;
                QobuzApp.tabs.topPlaylistsLoaded = true;
            } else if (!append) {
                QobuzApp.core.showError('Playlists konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load playlists:', error);
            if (!append) {
                QobuzApp.core.showError('Playlists konnten nicht geladen werden');
            }
        }

        pagination.loading = false;
        if (!append && !skipGlobalLoading) {
            QobuzApp.core.hideLoading();
        }
    }

    function loadMoreTopPlaylists() {
        const paginationKey = getPaginationKey();
        const pagination = QobuzApp.pagination.playlistsPagination[paginationKey];
        if (QobuzApp.tabs.currentTab === 'top-playlists' && pagination && pagination.hasMore && !pagination.loading) {
            loadTopPlaylists(true);
        }
    }

    function appendTopPlaylists(playlists, startIndex) {
        const grid = document.getElementById('top-playlists-grid');
        if (!grid || !playlists || playlists.length === 0) return;

        const escape = QobuzApp.core.escapeHtml;
        const html = playlists.map(playlist => `
            <div class="playlist-card" onclick="selectPlaylist(${playlist.id})">
                <div class="playlist-cover">
                    ${playlist.coverUrl
                        ? `<img src="${playlist.coverUrl}" alt="${escape(playlist.name)}" loading="lazy">`
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
                    <h3 class="playlist-name">${escape(playlist.name)}</h3>
                    <div class="playlist-meta">${playlist.tracksCount} Titel</div>
                </div>
            </div>
        `).join('');

        grid.insertAdjacentHTML('beforeend', html);
    }

    function renderTopPlaylists(playlists) {
        const grid = document.getElementById('top-playlists-grid');
        const emptyState = document.getElementById('top-playlists-empty');

        if (!playlists || playlists.length === 0) {
            if (grid) grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const escape = QobuzApp.core.escapeHtml;
        grid.innerHTML = playlists.map(playlist => `
            <div class="playlist-card" onclick="selectPlaylist(${playlist.id})">
                <div class="playlist-cover">
                    ${playlist.coverUrl
                        ? `<img src="${playlist.coverUrl}" alt="${escape(playlist.name)}" loading="lazy">`
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
                    <h3 class="playlist-name">${escape(playlist.name)}</h3>
                    <div class="playlist-meta">${playlist.tracksCount} Titel</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== Favorite Albums ====================

    async function loadFavoriteAlbums() {
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;
        const grid = document.getElementById('favorites-albums-grid');
        const emptyState = document.getElementById('favorites-albums-empty');

        if (!authToken) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=FavoriteAlbums&authToken=${encodeURIComponent(authToken)}&limit=500`);
            const data = await response.json();

            if (data.success) {
                if (data.albums && data.albums.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    const escape = QobuzApp.core.escapeHtml;
                    grid.innerHTML = data.albums.map(album => `
                        <div class="playlist-card" onclick="selectAlbum('${album.id}')">
                            <div class="playlist-cover">
                                ${album.coverUrl
                                    ? `<img src="${album.coverUrl}" alt="${escape(album.title)}" loading="lazy">`
                                    : `<div class="playlist-cover-placeholder">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <circle cx="12" cy="12" r="10"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                       </div>`
                                }
                            </div>
                            <div class="playlist-info">
                                <h3 class="playlist-name">${escape(album.title)}</h3>
                                <div class="playlist-meta">${escape(album.artistName || '')}</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    grid.innerHTML = '';
                    if (emptyState) emptyState.style.display = 'block';
                }
                QobuzApp.tabs.favAlbumsLoaded = true;
            } else {
                QobuzApp.core.showError('Alben konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load favorite albums:', error);
            QobuzApp.core.showError('Alben konnten nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    // ==================== Favorite Tracks ====================

    async function loadFavoriteTracks() {
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;
        const list = document.getElementById('favorites-tracks-list');
        const emptyState = document.getElementById('favorites-tracks-empty');

        if (!authToken) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=FavoriteTracks&authToken=${encodeURIComponent(authToken)}&limit=500`);
            const data = await response.json();

            if (data.success) {
                if (data.tracks && data.tracks.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    const escape = QobuzApp.core.escapeHtml;
                    list.innerHTML = data.tracks.map((track, index) => `
                        <div class="track-item" onclick="playFavoriteTrack(${index})">
                            <span class="track-number">${index + 1}</span>
                            <button type="button" class="track-play-btn">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            </button>
                            <div class="track-cover">
                                ${track.coverUrl
                                    ? `<img src="${track.coverUrl}" alt="${escape(track.title)}" loading="lazy">`
                                    : ''
                                }
                            </div>
                            <div class="track-info">
                                <div class="track-title">${escape(track.title)}</div>
                                <div class="track-artist">${escape(track.artistName || '')}${track.albumTitle ? ' · ' + escape(track.albumTitle) : ''}</div>
                            </div>
                            ${track.isHiRes ? '<span class="track-quality">Hi-Res</span>' : ''}
                            <span class="track-duration">${track.formattedDuration || ''}</span>
                        </div>
                    `).join('');

                    window.favoriteTracks = data.tracks;
                } else {
                    list.innerHTML = '';
                    if (emptyState) emptyState.style.display = 'block';
                }
                QobuzApp.tabs.favTracksLoaded = true;
            } else {
                QobuzApp.core.showError('Titel konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load favorite tracks:', error);
            QobuzApp.core.showError('Titel konnten nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    // ==================== Favorite Artists ====================

    async function loadFavoriteArtists() {
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;
        const grid = document.getElementById('favorites-artists-grid');
        const emptyState = document.getElementById('favorites-artists-empty');

        if (!authToken) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=FavoriteArtists&authToken=${encodeURIComponent(authToken)}&limit=100`);
            const data = await response.json();

            if (data.success) {
                if (data.artists && data.artists.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    const escape = QobuzApp.core.escapeHtml;
                    grid.innerHTML = data.artists.map(artist => `
                        <div class="artist-card" onclick="searchArtist('${escape(artist.name)}')">
                            <div class="artist-avatar">
                                ${artist.imageUrl
                                    ? `<img src="${artist.imageUrl}" alt="${escape(artist.name)}" loading="lazy">`
                                    : `<div class="artist-avatar-placeholder">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                       </div>`
                                }
                            </div>
                            <h3 class="artist-name">${escape(artist.name)}</h3>
                            <div class="artist-meta">${artist.albumsCount || 0} Alben</div>
                        </div>
                    `).join('');
                } else {
                    grid.innerHTML = '';
                    if (emptyState) emptyState.style.display = 'block';
                }
                QobuzApp.tabs.favArtistsLoaded = true;
            } else {
                QobuzApp.core.showError('Künstler konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load favorite artists:', error);
            QobuzApp.core.showError('Künstler konnten nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    async function playFavoriteTrack(index) {
        if (!window.favoriteTracks || index < 0 || index >= window.favoriteTracks.length) return;

        const track = window.favoriteTracks[index];
        await QobuzApp.search.playSearchTrack(track.id, track.title, track.artistName || '', track.albumTitle || '', track.coverUrl || '');
    }

    // Legacy function
    function loadRecommendations() {
        loadCurrentFavoritesSubTab();
    }

    // ==================== Playlists ====================

    async function loadPlaylists() {
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const userId = creds?.userId;
        const authToken = creds?.authToken;

        if (!userId || !authToken) return;

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=Playlists&userId=${userId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                renderPlaylists(data.playlists);
            } else {
                QobuzApp.core.showError('Playlists konnten nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load playlists:', error);
            QobuzApp.core.showError('Playlists konnten nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    function renderPlaylists(playlists) {
        const grid = document.getElementById('playlists-grid');
        const emptyState = document.getElementById('playlists-empty');

        if (!playlists || playlists.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        const escape = QobuzApp.core.escapeHtml;
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
                    <h3 class="playlist-name">${escape(playlist.name)}</h3>
                    <div class="playlist-meta">${playlist.tracksCount} Titel · ${playlist.formattedDuration}</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== Select Album/Playlist ====================

    async function selectAlbum(albumId, highlightTrackIndex = null) {
        QobuzApp.savedScrollPosition = window.scrollY || document.documentElement.scrollTop;

        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;
        if (!authToken) return;

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=AlbumTracks&albumId=${albumId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                showAlbumDetail(data.album, data.tracks, highlightTrackIndex);
            } else {
                QobuzApp.core.showError(data.error || 'Album konnte nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load album:', error);
            QobuzApp.core.showError('Album konnte nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    async function selectPlaylist(playlistId, highlightTrackIndex = null) {
        QobuzApp.savedScrollPosition = window.scrollY || document.documentElement.scrollTop;

        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;
        if (!authToken) return;

        QobuzApp.core.showLoading();

        try {
            const response = await fetch(`/Qobuz?handler=PlaylistTracks&playlistId=${playlistId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                showPlaylistDetail(data.playlist, data.tracks, highlightTrackIndex);
            } else {
                QobuzApp.core.showError(data.error || 'Playlist konnte nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load playlist:', error);
            QobuzApp.core.showError('Playlist konnte nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    function showAlbumDetail(album, tracks, highlightTrackIndex = null) {
        const playback = QobuzApp.playback;
        playback.currentTracks = tracks || [];
        playback.currentSourceType = 'album';
        playback.currentSourceId = album.id;
        playback.currentSourceName = album.title;

        document.getElementById('detail-name').textContent = album.title;
        document.getElementById('detail-description').textContent = album.artistName || '';
        document.getElementById('detail-tracks-count').textContent = `${album.tracksCount} Titel`;
        document.getElementById('detail-duration').textContent = album.formattedDuration || '';

        const cover = document.getElementById('detail-cover');
        const placeholder = document.getElementById('detail-cover-placeholder');

        if (album.coverUrl) {
            cover.src = album.coverUrl;
            cover.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        }

        renderDetailTracks(tracks, highlightTrackIndex);

        QobuzApp.dom.loggedInSection.style.display = 'none';
        QobuzApp.dom.playlistDetailSection.style.display = 'block';

        if (highlightTrackIndex !== null) {
            setTimeout(() => {
                const trackItem = document.querySelector(`.track-item[data-index="${highlightTrackIndex}"]`);
                if (trackItem) {
                    trackItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        } else {
            window.scrollTo(0, 0);
        }
    }

    function showPlaylistDetail(playlist, tracks, highlightTrackIndex = null) {
        const playback = QobuzApp.playback;
        playback.currentTracks = tracks || [];
        playback.currentSourceType = 'playlist';
        playback.currentSourceId = playlist.id ? playlist.id.toString() : null;
        playback.currentSourceName = playlist.name;

        document.getElementById('detail-name').textContent = playlist.name;
        document.getElementById('detail-description').textContent = playlist.description || '';
        document.getElementById('detail-tracks-count').textContent = `${playlist.tracksCount} Titel`;
        document.getElementById('detail-duration').textContent = playlist.formattedDuration;

        const cover = document.getElementById('detail-cover');
        const placeholder = document.getElementById('detail-cover-placeholder');

        if (playlist.coverUrl) {
            cover.src = playlist.coverUrl;
            cover.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            cover.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
        }

        renderDetailTracks(tracks, highlightTrackIndex);

        QobuzApp.dom.loggedInSection.style.display = 'none';
        QobuzApp.dom.playlistDetailSection.style.display = 'block';

        if (highlightTrackIndex !== null) {
            setTimeout(() => {
                const trackItem = document.querySelector(`.track-item[data-index="${highlightTrackIndex}"]`);
                if (trackItem) {
                    trackItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        } else {
            window.scrollTo(0, 0);
        }
    }

    function renderDetailTracks(tracks, highlightTrackIndex = null) {
        const list = document.getElementById('tracks-list');
        const escape = QobuzApp.core.escapeHtml;

        list.innerHTML = tracks.map((track, index) => `
            <div class="track-item${!track.isStreamable ? ' unavailable' : ''}${index === highlightTrackIndex ? ' highlighted' : ''}" data-index="${index}" onclick="playTrack(${index}, event)">
                <span class="track-number">${index + 1}</span>
                <button type="button" class="track-play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <div class="track-cover">
                    ${track.albumCover ? `<img src="${track.albumCover}" alt="${escape(track.title)}" loading="lazy">` : ''}
                </div>
                <div class="track-info">
                    <div class="track-title">${escape(track.title)}</div>
                    <div class="track-artist">${escape(track.artistName || '')}</div>
                </div>
                ${track.isHiRes ? '<span class="track-quality">Hi-Res</span>' : ''}
                <span class="track-duration">${track.formattedDuration}</span>
            </div>
        `).join('');
    }

    function backToPlaylists() {
        QobuzApp.dom.playlistDetailSection.style.display = 'none';
        QobuzApp.dom.loggedInSection.style.display = 'block';

        setTimeout(() => {
            window.scrollTo(0, QobuzApp.savedScrollPosition);
        }, 50);
    }

    function playAll() {
        if (QobuzApp.playback.currentTracks.length > 0) {
            QobuzApp.playbackFn.playTrack(0);
        }
    }

    // ==================== Export Functions ====================

    QobuzApp.browse = {
        setupInfiniteScroll,
        switchTab,
        switchFavoritesSubTab,
        refreshCurrentFavoritesSubTab,
        switchPlaylistsSubTab,
        refreshCurrentPlaylistsSubTab,
        toggleGenreFilter,
        toggleGenre,
        clearGenreFilter,
        loadNewReleases,
        loadAlbumCharts,
        loadTopPlaylists,
        loadFavoriteAlbums,
        loadFavoriteTracks,
        loadFavoriteArtists,
        loadRecommendations,
        loadPlaylists,
        selectAlbum,
        selectPlaylist,
        backToPlaylists,
        playAll
    };

    // Global exports
    window.switchTab = switchTab;
    window.switchFavoritesSubTab = switchFavoritesSubTab;
    window.refreshCurrentFavoritesSubTab = refreshCurrentFavoritesSubTab;
    window.switchPlaylistsSubTab = switchPlaylistsSubTab;
    window.refreshCurrentPlaylistsSubTab = refreshCurrentPlaylistsSubTab;
    window.toggleGenreFilter = toggleGenreFilter;
    window.toggleGenre = toggleGenre;
    window.clearGenreFilter = clearGenreFilter;
    window.loadNewReleases = loadNewReleases;
    window.loadAlbumCharts = loadAlbumCharts;
    window.loadTopPlaylists = loadTopPlaylists;
    window.loadFavoriteAlbums = loadFavoriteAlbums;
    window.loadFavoriteTracks = loadFavoriteTracks;
    window.loadFavoriteArtists = loadFavoriteArtists;
    window.loadRecommendations = loadRecommendations;
    window.loadPlaylists = loadPlaylists;
    window.selectAlbum = selectAlbum;
    window.selectPlaylist = selectPlaylist;
    window.backToPlaylists = backToPlaylists;
    window.playAll = playAll;
    window.playFavoriteTrack = playFavoriteTrack;

})();
