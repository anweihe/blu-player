/**
 * Qobuz Artist Module
 * Handles artist page display, biography, discography, and similar artists
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // State
    let currentArtistData = null;
    let currentDiscographyType = 'album';
    let biographyExpanded = false;
    let topTracksExpanded = false;
    let previousScrollPosition = 0;
    let previousView = 'favorites'; // 'favorites' or 'artist' (for nested navigation)
    let artistNavigationStack = []; // Stack for back navigation between artists
    const TOP_TRACKS_INITIAL_COUNT = 5;

    // ==================== Show Artist Page ====================

    async function showArtistPage(artistId) {
        // Save current scroll position to global state
        QobuzApp.savedScrollPosition = window.scrollY || document.documentElement.scrollTop;
        previousScrollPosition = QobuzApp.savedScrollPosition;

        // If we're already on an artist page, push it to the stack
        if (currentArtistData) {
            artistNavigationStack.push({
                artistId: currentArtistData.artist.id,
                scrollPosition: previousScrollPosition
            });
            previousView = 'artist';
        } else {
            previousView = 'favorites';
            artistNavigationStack = [];
        }

        QobuzApp.core.showLoading();

        try {
            const creds = await QobuzApp.auth.getQobuzCredentials();
            const authToken = creds?.authToken || '';

            const response = await fetch(`/Qobuz?handler=ArtistPage&artistId=${artistId}&authToken=${encodeURIComponent(authToken)}`);
            const data = await response.json();

            if (data.success) {
                currentArtistData = data;
                renderArtistPage(data);
            } else {
                QobuzApp.core.showError(data.error || 'Künstler konnte nicht geladen werden');
            }
        } catch (error) {
            console.error('Failed to load artist page:', error);
            QobuzApp.core.showError('Künstler konnte nicht geladen werden');
        }

        QobuzApp.core.hideLoading();
    }

    // ==================== Render Artist Page ====================

    function renderArtistPage(data) {
        const artist = data.artist;

        // Reset state
        biographyExpanded = false;
        topTracksExpanded = false;
        currentDiscographyType = 'album';

        // Set portrait image
        const portraitImg = document.getElementById('artist-portrait-img');
        const portraitPlaceholder = document.getElementById('artist-portrait-placeholder');
        const portraitContainer = document.getElementById('artist-portrait');

        if (artist.portraitUrl) {
            portraitImg.src = artist.portraitUrl;
            portraitImg.style.display = 'block';
            if (portraitPlaceholder) portraitPlaceholder.style.display = 'none';
            // Make portrait clickable to open lightbox
            if (portraitContainer) {
                portraitContainer.style.cursor = 'pointer';
                portraitContainer.onclick = () => openImageLightbox(artist.portraitUrl);
            }
        } else {
            portraitImg.style.display = 'none';
            if (portraitPlaceholder) portraitPlaceholder.style.display = 'flex';
            if (portraitContainer) {
                portraitContainer.style.cursor = 'default';
                portraitContainer.onclick = null;
            }
        }

        // Set artist name and category
        document.getElementById('artist-name-display').textContent = artist.name || '';

        const categoryEl = document.getElementById('artist-category');
        if (artist.category) {
            categoryEl.textContent = artist.category;
            categoryEl.style.display = 'inline-block';
        } else {
            categoryEl.style.display = 'none';
        }

        // Render biography
        renderBiography(artist.biography);

        // Render top tracks
        renderTopTracks(data.topTracks);

        // Render discography
        renderDiscography(data.releases);

        // Render similar artists
        renderSimilarArtists(data.similarArtists);

        // Render appears on
        renderAppearsOn(data.appearsOn);

        // Show artist section, hide others
        if (QobuzApp.dom.loggedInSection) QobuzApp.dom.loggedInSection.style.display = 'none';
        if (QobuzApp.dom.playlistDetailSection) QobuzApp.dom.playlistDetailSection.style.display = 'none';

        const artistSection = document.getElementById('artist-detail-section');
        if (artistSection) artistSection.style.display = 'block';

        // Scroll to top
        window.scrollTo(0, 0);
    }

    // ==================== Biography ====================

    function renderBiography(biography) {
        const section = document.getElementById('artist-biography');
        const content = document.getElementById('biography-content');
        const expandBtn = document.getElementById('btn-expand-bio');

        if (!biography || !biography.trim()) {
            section.style.display = 'none';
            return;
        }

        // Clean up HTML tags from biography
        const cleanBio = biography
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .trim();

        content.textContent = cleanBio;
        section.style.display = 'block';

        // Reset expanded state
        biographyExpanded = false;
        content.classList.remove('expanded');
        expandBtn.querySelector('span').textContent = 'Mehr anzeigen';
        expandBtn.querySelector('svg').style.transform = '';

        // Only show expand button if content is long enough
        setTimeout(() => {
            if (content.scrollHeight > content.clientHeight + 20) {
                expandBtn.style.display = 'flex';
            } else {
                expandBtn.style.display = 'none';
            }
        }, 10);
    }

    function toggleBiography() {
        const content = document.getElementById('biography-content');
        const expandBtn = document.getElementById('btn-expand-bio');

        biographyExpanded = !biographyExpanded;

        if (biographyExpanded) {
            content.classList.add('expanded');
            expandBtn.querySelector('span').textContent = 'Weniger anzeigen';
            expandBtn.querySelector('svg').style.transform = 'rotate(180deg)';
        } else {
            content.classList.remove('expanded');
            expandBtn.querySelector('span').textContent = 'Mehr anzeigen';
            expandBtn.querySelector('svg').style.transform = '';
        }
    }

    // ==================== Top Tracks ====================

    function renderTopTracks(tracks) {
        const section = document.getElementById('artist-top-tracks-section');
        const container = document.getElementById('artist-top-tracks');

        if (!tracks || tracks.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const escape = QobuzApp.core.escapeHtml;
        const hasMore = tracks.length > TOP_TRACKS_INITIAL_COUNT;
        const visibleTracks = topTracksExpanded ? tracks : tracks.slice(0, TOP_TRACKS_INITIAL_COUNT);

        const tracksHtml = visibleTracks.map((track, index) => `
            <div class="track-item${!track.isStreamable ? ' unavailable' : ''}" data-track-index="${index}">
                <span class="track-number">${index + 1}</span>
                <button type="button" class="track-play-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <div class="track-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${escape(track.title)}" loading="lazy">` : ''}
                </div>
                <div class="track-info">
                    <div class="track-title">${escape(track.title)}</div>
                    <div class="track-artist">${escape(track.albumTitle || '')}</div>
                </div>
                ${track.isHiRes ? '<span class="track-quality">Hi-Res</span>' : ''}
                <span class="track-duration">${track.formattedDuration || ''}</span>
                ${QobuzApp.contextMenu ? QobuzApp.contextMenu.createMenuButton(track.artistId, track.artistName) : ''}
            </div>
        `).join('');

        // Add "show more/less" button if there are more than 5 tracks
        const expandBtnHtml = hasMore ? `
            <button type="button" class="btn-expand-tracks" id="btn-expand-tracks" onclick="toggleTopTracks()">
                <span>${topTracksExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${topTracksExpanded ? 'transform: rotate(180deg)' : ''}">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </button>
        ` : '';

        container.innerHTML = tracksHtml + expandBtnHtml;

        // Add click handlers for tracks
        container.querySelectorAll('.track-item').forEach(item => {
            item.onclick = function() {
                const index = parseInt(this.dataset.trackIndex);
                if (!isNaN(index)) playArtistTrack(index);
            };
        });
    }

    function toggleTopTracks() {
        topTracksExpanded = !topTracksExpanded;
        if (currentArtistData?.topTracks) {
            renderTopTracks(currentArtistData.topTracks);
        }
    }

    async function playArtistTrack(index) {
        if (!currentArtistData?.topTracks || index < 0 || index >= currentArtistData.topTracks.length) return;

        const track = currentArtistData.topTracks[index];
        await QobuzApp.search.playSearchTrack(
            track.id,
            track.title,
            track.artistName || currentArtistData.artist.name || '',
            track.albumTitle || '',
            track.coverUrl || ''
        );
    }

    // ==================== Discography ====================

    function renderDiscography(releases) {
        const section = document.getElementById('artist-discography-section');
        const navContainer = document.getElementById('discography-sub-nav');
        const grid = document.getElementById('discography-grid');

        if (!releases || releases.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Type labels in German
        const typeLabels = {
            'album': 'Alben',
            'single': 'Singles',
            'ep': 'EPs',
            'epSingle': 'EPs & Singles',
            'ep-single': 'EPs & Singles',
            'ep_single': 'EPs & Singles',
            'live': 'Live',
            'compilation': 'Compilations',
            'soundtrack': 'Soundtracks',
            'awardedRelease': 'Ausgezeichnet',
            'awardedReleases': 'Ausgezeichnet',
            'awarded_release': 'Ausgezeichnet',
            'awarded_releases': 'Ausgezeichnet',
            'awarded-release': 'Ausgezeichnet',
            'awarded-releases': 'Ausgezeichnet',
            'other': 'Andere'
        };

        // Build sub-navigation tabs with "Alles" button at the end
        const escapedName = (currentArtistData?.artist?.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
        const tabsHtml = releases.map((release, index) => {
            const label = typeLabels[release.type] || release.type;
            const isActive = index === 0 || release.type === currentDiscographyType;
            return `<button type="button" class="sub-tab-btn${isActive ? ' active' : ''}"
                    data-release-type="${release.type}"
                    onclick="switchDiscographyType('${release.type}')">${label}</button>`;
        }).join('');

        // Add "Alles" button that navigates to full discography page
        const allesBtn = `<button type="button" class="discography-all-btn"
                onclick="showDiscographyPage(${currentArtistData?.artist?.id}, '${escapedName}')">
            Alles
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        </button>`;

        navContainer.innerHTML = tabsHtml + allesBtn;

        // Set initial type
        if (releases.length > 0) {
            currentDiscographyType = releases[0].type;
        }

        // Render initial grid
        renderDiscographyGrid(releases);
    }

    function switchDiscographyType(type) {
        currentDiscographyType = type;

        // Update tab styles
        document.querySelectorAll('#discography-sub-nav .sub-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.releaseType === type);
        });

        // Re-render grid
        if (currentArtistData?.releases) {
            renderDiscographyGrid(currentArtistData.releases);
        }
    }

    function renderDiscographyGrid(releases) {
        const grid = document.getElementById('discography-grid');
        const currentRelease = releases.find(r => r.type === currentDiscographyType);

        if (!currentRelease?.items || currentRelease.items.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>Keine Veröffentlichungen in dieser Kategorie</p></div>';
            return;
        }

        const escape = QobuzApp.core.escapeHtml;
        const escapedName = (currentArtistData?.artist?.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

        let html = currentRelease.items.map(album => `
            <div class="playlist-card" data-album-id="${album.id}" onclick="selectAlbum('${album.id}')">
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
                    <div class="playlist-meta">${formatReleaseYear(album.releasedAt)}</div>
                </div>
            </div>
        `).join('');

        // Add "Mehr" card if there are more items (hasMore flag from API)
        if (currentRelease.hasMore) {
            html += `
                <div class="discography-more-card"
                     onclick="showDiscographyPage(${currentArtistData?.artist?.id}, '${escapedName}', '${currentDiscographyType}')">
                    <div class="more-card-content">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <span>Mehr</span>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;

        // Fetch ratings in background
        if (typeof fetchRatingsForAlbums === 'function') {
            fetchRatingsForAlbums(currentRelease.items);
        }
    }

    function formatReleaseYear(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.getFullYear().toString();
    }

    // ==================== Similar Artists ====================

    function renderSimilarArtists(artists) {
        const section = document.getElementById('similar-artists-section');
        const container = document.getElementById('similar-artists-scroll');

        if (!artists || artists.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const escape = QobuzApp.core.escapeHtml;

        container.innerHTML = artists.map(artist => `
            <div class="similar-artist-card" onclick="showArtistPage(${artist.id})">
                <div class="similar-artist-avatar">
                    ${artist.imageUrl
                        ? `<img src="${artist.imageUrl}" alt="${escape(artist.name)}" loading="lazy">`
                        : `<div class="similar-artist-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                           </div>`
                    }
                </div>
                <span class="similar-artist-name">${escape(artist.name)}</span>
            </div>
        `).join('');
    }

    // ==================== Appears On ====================

    function renderAppearsOn(tracks) {
        const section = document.getElementById('appears-on-section');
        const grid = document.getElementById('appears-on-grid');

        if (!tracks || tracks.length === 0) {
            section.style.display = 'none';
            return;
        }

        // Get unique albums from tracks
        const albumMap = new Map();
        tracks.forEach(track => {
            if (track.albumId && !albumMap.has(track.albumId)) {
                albumMap.set(track.albumId, {
                    id: track.albumId,
                    title: track.albumTitle,
                    coverUrl: track.coverUrl,
                    artistName: track.artistName
                });
            }
        });

        const albums = Array.from(albumMap.values());
        if (albums.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const escape = QobuzApp.core.escapeHtml;

        grid.innerHTML = albums.map(album => `
            <div class="playlist-card" data-album-id="${album.id}" onclick="selectAlbum('${album.id}')">
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
    }

    // ==================== Navigation ====================

    function backFromArtist() {
        const artistSection = document.getElementById('artist-detail-section');
        if (artistSection) artistSection.style.display = 'none';

        // Check if we have artists in the navigation stack
        if (artistNavigationStack.length > 0) {
            const previousArtist = artistNavigationStack.pop();
            // Navigate back to previous artist
            currentArtistData = null; // Clear current data so we don't push it again
            showArtistPage(previousArtist.artistId);
            return;
        }

        // Otherwise go back to main view
        currentArtistData = null;
        artistNavigationStack = [];

        if (QobuzApp.dom.loggedInSection) {
            QobuzApp.dom.loggedInSection.style.display = 'block';
        }

        // Restore scroll position
        setTimeout(() => {
            window.scrollTo(0, QobuzApp.savedScrollPosition || 0);
        }, 50);
    }

    // ==================== Export Functions ====================

    QobuzApp.artist = {
        showArtistPage,
        backFromArtist,
        toggleBiography,
        toggleTopTracks,
        switchDiscographyType,
        playArtistTrack
    };

    // Global exports
    window.showArtistPage = showArtistPage;
    window.backFromArtist = backFromArtist;
    window.toggleBiography = toggleBiography;
    window.toggleTopTracks = toggleTopTracks;
    window.switchDiscographyType = switchDiscographyType;
    window.playArtistTrack = playArtistTrack;

})();
