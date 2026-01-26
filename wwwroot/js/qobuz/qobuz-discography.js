/**
 * Qobuz Discography Module
 * Full discography page with filtering, sorting, and endless scrolling
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // State
    let currentArtistId = null;
    let currentArtistName = '';
    let currentReleaseType = null;  // null = all
    let currentSort = 'release_date';
    let currentOffset = 0;
    let hasMore = false;
    let isLoading = false;
    let scrollObserver = null;
    const PAGE_SIZE = 20;

    // Valid API release_type values: album, epSingle, live, compilation, other
    const releaseTypes = [
        { value: null, label: 'Alle' },
        { value: 'album', label: 'Alben' },
        { value: 'epSingle', label: 'EPs & Singles' },
        { value: 'live', label: 'Live' },
        { value: 'compilation', label: 'Compilations' },
        { value: 'other', label: 'Andere' }
    ];

    // Map artist page release types to valid API parameters
    function mapReleaseType(type) {
        if (!type) return null;
        const typeMap = {
            'single': 'epSingle',
            'ep': 'epSingle',
            'ep-single': 'epSingle',
            'ep_single': 'epSingle',
            'epSingle': 'epSingle',
            'album': 'album',
            'live': 'live',
            'compilation': 'compilation',
            'other': 'other'
        };
        return typeMap[type] || type;
    }

    // ==================== Endless Scrolling ====================

    function setupScrollObserver() {
        const sentinel = document.getElementById('discography-scroll-sentinel');
        if (!sentinel) return;

        // Cleanup existing observer
        if (scrollObserver) {
            scrollObserver.disconnect();
        }

        scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadDiscography(false);  // append mode
            }
        }, { rootMargin: '200px' });  // Trigger 200px before reaching end

        scrollObserver.observe(sentinel);
    }

    function cleanupScrollObserver() {
        if (scrollObserver) {
            scrollObserver.disconnect();
            scrollObserver = null;
        }
    }

    // ==================== Main Functions ====================

    async function showDiscographyPage(artistId, artistName, initialType = null, skipHistory = false) {
        currentArtistId = artistId;
        currentArtistName = artistName;
        // Map the initial type to a valid API parameter
        currentReleaseType = mapReleaseType(initialType);
        currentOffset = 0;
        hasMore = true;
        currentSort = 'release_date';

        // Push state to browser history (unless restoring from popstate)
        if (!skipHistory && QobuzApp.core?.pushState) {
            QobuzApp.core.pushState('discography', artistId, {
                artistName: artistName,
                releaseType: currentReleaseType
            });
        }

        // Delayed loading - only visible on slow requests (>150ms)
        const isRestoring = QobuzApp.navigation?.isRestoring;
        if (!isRestoring) {
            QobuzApp.core.showLoadingDelayed(150);
        }

        try {
            // Prepare all content BEFORE showing the view
            prepareDiscographyContent(artistName);
            renderFilters();
            clearGrid();
            await loadDiscography(true);  // replace mode
            setupScrollObserver();

            // Disable animations during view switch (only if not already in navigation mode)
            const wasNavigating = document.body.classList.contains('qobuz-navigating');
            if (!wasNavigating) {
                document.body.classList.add('qobuz-navigating');
            }

            // THEN switch view (content already rendered)
            switchToDiscographyView();

            // Re-enable animations (only if we added the class)
            if (!wasNavigating) {
                document.body.classList.remove('qobuz-navigating');
            }
        } finally {
            if (!isRestoring) {
                QobuzApp.core.hideLoadingDelayed();
            }
        }
    }

    /**
     * Prepare discography page content WITHOUT switching views.
     */
    function prepareDiscographyContent(artistName) {
        // Set title and artist name
        const titleEl = document.getElementById('discography-page-title');
        const artistNameEl = document.getElementById('discography-artist-name');
        if (titleEl) titleEl.textContent = 'Diskografie';
        if (artistNameEl) artistNameEl.textContent = artistName;

        // Reset sort dropdown
        const sortSelect = document.getElementById('discography-sort-select');
        if (sortSelect) sortSelect.value = currentSort;
    }

    /**
     * Switch to discography view.
     * Call this AFTER content has been prepared.
     * Animation is disabled globally via qobuz-navigating class.
     */
    function switchToDiscographyView() {
        // Show discography page, hide others
        showSection('artist-discography-page');
        window.scrollTo(0, 0);
    }

    function showSection(sectionId) {
        const sections = [
            'logged-in-section',
            'playlist-detail-section',
            'artist-detail-section',
            'artist-discography-page'
        ];

        // FIRST: Show target section (while others may still be visible - overlap prevents gap)
        const targetEl = document.getElementById(sectionId);
        if (targetEl) {
            targetEl.style.display = 'block';
        }

        // THEN: Hide other sections
        sections.forEach(id => {
            if (id !== sectionId) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }
        });
    }

    async function loadDiscography(replace = false) {
        if (isLoading || (!hasMore && !replace)) return;

        isLoading = true;
        // Show inline loading indicator for subsequent loads (append mode)
        // Initial load is handled by showDiscographyPage's delayed loading
        if (!replace) {
            showLoading(true);
        }

        try {
            const creds = await QobuzApp.auth.getQobuzCredentials();
            const params = new URLSearchParams({
                artistId: currentArtistId,
                sort: currentSort,
                offset: replace ? 0 : currentOffset,
                limit: PAGE_SIZE
            });

            if (creds?.authToken) {
                params.append('authToken', creds.authToken);
            }
            if (currentReleaseType) {
                params.append('releaseType', currentReleaseType);
            }

            const response = await fetch(`/Qobuz?handler=ArtistDiscography&${params}`);
            const data = await response.json();

            if (data.success) {
                renderAlbums(data.albums, replace);
                hasMore = data.hasMore;
                currentOffset = replace ? PAGE_SIZE : currentOffset + PAGE_SIZE;
            } else {
                console.error('Failed to load discography:', data.error);
            }
        } catch (error) {
            console.error('Failed to load discography:', error);
        }

        isLoading = false;
        if (!replace) {
            showLoading(false);
        }
    }

    // ==================== Rendering ====================

    function renderFilters() {
        const container = document.getElementById('discography-filters');
        if (!container) return;

        container.innerHTML = releaseTypes.map(type => `
            <button type="button"
                    class="discography-filter-btn${type.value === currentReleaseType ? ' active' : ''}"
                    data-type="${type.value || ''}"
                    onclick="changeDiscographyFilter(${type.value === null ? 'null' : "'" + type.value + "'"})">
                ${type.label}
            </button>
        `).join('');
    }

    function updateFilterButtons() {
        const buttons = document.querySelectorAll('.discography-filter-btn');
        buttons.forEach(btn => {
            const type = btn.dataset.type || null;
            const isActive = type === (currentReleaseType || '');
            btn.classList.toggle('active', isActive);
        });
    }

    function renderAlbums(albums, replace = false) {
        const grid = document.getElementById('discography-page-grid');
        if (!grid) return;

        const escape = QobuzApp.core?.escapeHtml || (s => s);

        const html = albums.map(album => `
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
                    ${album.isHiRes ? '<span class="album-hires-badge">Hi-Res</span>' : ''}
                </div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${escape(album.title)}</h3>
                    <div class="playlist-meta">${formatReleaseYear(album.releasedAt)}</div>
                </div>
            </div>
        `).join('');

        if (replace) {
            grid.innerHTML = html;
        } else {
            grid.insertAdjacentHTML('beforeend', html);
        }

        // Fetch ratings in background
        if (typeof fetchRatingsForAlbums === 'function') {
            fetchRatingsForAlbums(albums);
        }
    }

    function clearGrid() {
        const grid = document.getElementById('discography-page-grid');
        if (grid) grid.innerHTML = '';
    }

    function showLoading(show) {
        const loadingEl = document.getElementById('discography-loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
        }
    }

    function formatReleaseYear(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.getFullYear().toString();
    }

    // ==================== Filter & Sort Handlers ====================

    function changeFilter(type) {
        const mappedType = mapReleaseType(type);
        if (currentReleaseType === mappedType) return;

        currentReleaseType = mappedType;
        currentOffset = 0;
        hasMore = true;
        updateFilterButtons();
        clearGrid();
        loadDiscography(true);
    }

    function changeSort(sort) {
        if (currentSort === sort) return;

        currentSort = sort;
        currentOffset = 0;
        hasMore = true;
        clearGrid();
        loadDiscography(true);
    }

    // ==================== Navigation ====================

    function backFromDiscography() {
        cleanupScrollObserver();
        // Use browser history for navigation
        history.back();
    }

    // ==================== Exports ====================

    QobuzApp.discography = {
        showDiscographyPage,
        backFromDiscography,
        changeFilter,
        changeSort
    };

    // Global exports for onclick handlers
    window.showDiscographyPage = function(artistId, artistName, initialType, skipHistory = false) {
        // Save current scroll position before navigating
        QobuzApp.discographyScrollPosition = window.scrollY || document.documentElement.scrollTop;
        showDiscographyPage(artistId, artistName, initialType, skipHistory);
    };
    window.backFromDiscography = backFromDiscography;
    window.changeDiscographySort = changeSort;
    window.changeDiscographyFilter = changeFilter;

})();
