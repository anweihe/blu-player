/**
 * Qobuz Search Module
 * Handles search functionality and search results display
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // Search state
    let searchTimeout = null;
    let searchInput = null;
    let searchClear = null;
    let searchResults = null;
    let browseContent = null;

    // ==================== Setup ====================

    function setupSearch() {
        if (QobuzApp.setup.search) return;

        searchInput = document.getElementById('search-input');
        searchClear = document.getElementById('search-clear');
        searchResults = document.getElementById('search-results');
        browseContent = document.getElementById('browse-content');

        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
            searchInput.addEventListener('keydown', handleSearchKeydown);
            QobuzApp.setup.search = true;
        }
    }

    // ==================== Event Handlers ====================

    function handleSearchInput() {
        const query = this.value.trim();
        if (searchClear) searchClear.style.display = query ? 'flex' : 'none';

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

    // ==================== Search Execution ====================

    async function performSearch(query) {
        showSearchSkeleton();

        try {
            const response = await fetch(`/Qobuz?handler=Search&query=${encodeURIComponent(query)}&limit=20`);
            const data = await response.json();

            if (data.success) {
                showSearchResults(data);
            } else {
                hideSearchSkeleton();
                QobuzApp.core.showError(data.error || 'Suche fehlgeschlagen');
            }
        } catch (error) {
            console.error('Search failed:', error);
            hideSearchSkeleton();
            QobuzApp.core.showError('Suche fehlgeschlagen');
        }
    }

    // ==================== Skeleton Loading ====================

    function showSearchSkeleton() {
        browseContent.style.display = 'none';
        searchResults.style.display = 'block';

        document.getElementById('search-albums-section').style.display = 'none';
        document.getElementById('search-playlists-section').style.display = 'none';
        document.getElementById('search-tracks-section').style.display = 'none';
        document.getElementById('search-no-results').style.display = 'none';

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

    function hideSearchSkeleton() {
        const skeletonContainer = document.getElementById('search-skeleton');
        if (skeletonContainer) {
            skeletonContainer.style.display = 'none';
        }
    }

    // ==================== Results Display ====================

    function showSearchResults(data) {
        hideSearchSkeleton();

        const escapeHtml = QobuzApp.core.escapeHtml;
        const hasAlbums = data.albums && data.albums.length > 0;
        const hasPlaylists = data.playlists && data.playlists.length > 0;
        const hasTracks = data.tracks && data.tracks.length > 0;
        const hasAnyResults = hasAlbums || hasPlaylists || hasTracks;

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
                        ${QobuzApp.contextMenu?.createAlbumMenuButton(album.artistId, album.artistName, album.id) || ''}
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
                    ${QobuzApp.contextMenu ? QobuzApp.contextMenu.createMenuButton(track.artistId, track.artistName, track.albumId, track.albumTitle) : ''}
                </div>
            `).join('');
        } else {
            tracksSection.style.display = 'none';
        }

        document.getElementById('search-no-results').style.display = hasAnyResults ? 'none' : 'block';
    }

    function hideSearchResults() {
        searchResults.style.display = 'none';
        browseContent.style.display = 'block';
    }

    function clearSearch() {
        searchInput.value = '';
        searchClear.style.display = 'none';
        hideSearchResults();
        searchInput.blur();
    }

    // ==================== Search Track Playback ====================

    async function playSearchTrack(trackId, title, artistName, albumTitle, coverUrl) {
        const creds = await QobuzApp.auth.getQobuzCredentials();
        const authToken = creds?.authToken;

        if (!authToken) {
            QobuzApp.core.showError('Bitte melde dich an, um Titel abzuspielen');
            return;
        }

        const track = {
            id: trackId,
            title: title,
            artistName: artistName,
            albumTitle: albumTitle,
            albumCover: coverUrl,
            isStreamable: true
        };

        QobuzApp.playback.currentTracks = [track];
        QobuzApp.playback.currentTrackIndex = 0;

        const selectedPlayer = QobuzApp.core.getSelectedPlayer();

        if (selectedPlayer.type === 'bluesound' && selectedPlayer.ip) {
            await QobuzApp.playbackFn.playOnBluesound(track, 0, authToken);
        } else {
            await QobuzApp.playbackFn.playOnBrowser(track, 0, authToken);
        }
    }

    // Search for artist (triggers search from favorites)
    function searchArtist(artistName) {
        const input = document.getElementById('search-input');
        if (input) {
            input.value = artistName;
            performSearch(artistName);
        }
    }

    // ==================== Export Functions ====================

    QobuzApp.search = {
        setupSearch,
        performSearch,
        clearSearch,
        playSearchTrack,
        searchArtist
    };

    // Global exports
    window.playSearchTrack = playSearchTrack;
    window.playTrackDirectly = playSearchTrack;
    window.clearSearch = clearSearch;
    window.searchArtist = searchArtist;

})();
