/**
 * Qobuz Ratings Module
 * Fetches album ratings from Mistral AI and displays them on album cards
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // Global rating cache (session-based)
    const ratingsCache = new Map();

    // Debounce timer for batching requests
    let fetchDebounceTimer = null;
    let pendingAlbums = [];

    /**
     * Fetch ratings for a list of albums
     * Called after album rendering
     * @param {Array} albums - Array of album objects with id, artistName, title
     */
    async function fetchRatingsForAlbums(albums) {
        if (!albums || albums.length === 0) return;

        // Filter: only albums without cache entry
        const uncachedAlbums = albums.filter(a => a && a.id && !ratingsCache.has(a.id));
        if (uncachedAlbums.length === 0) return;

        // Add to pending queue
        pendingAlbums.push(...uncachedAlbums);

        // Debounce: wait for more albums before making the request
        if (fetchDebounceTimer) {
            clearTimeout(fetchDebounceTimer);
        }

        fetchDebounceTimer = setTimeout(async () => {
            const albumsToFetch = [...pendingAlbums];
            pendingAlbums = [];

            if (albumsToFetch.length === 0) return;

            // Deduplicate
            const uniqueAlbums = [];
            const seenIds = new Set();
            for (const album of albumsToFetch) {
                if (!seenIds.has(album.id)) {
                    seenIds.add(album.id);
                    uniqueAlbums.push(album);
                }
            }

            try {
                const response = await fetch('/api/ratings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        albums: uniqueAlbums.map(a => ({
                            albumId: a.id,
                            artist: a.artistName || '',
                            title: a.title || ''
                        }))
                    })
                });

                const data = await response.json();
                if (data.success && data.data) {
                    data.data.forEach(rating => {
                        ratingsCache.set(rating.albumId, rating);
                        updateAlbumCardRating(rating.albumId, rating);
                    });
                }
            } catch (error) {
                console.error('Failed to fetch ratings:', error);
            }
        }, 300); // 300ms debounce
    }

    /**
     * Update album card UI with rating badge
     * @param {string} albumId - The album ID
     * @param {Object} rating - Rating object with userScore and criticsScore
     */
    function updateAlbumCardRating(albumId, rating) {
        // Find all cards with this album ID
        const cards = document.querySelectorAll(`.playlist-card[data-album-id="${albumId}"]`);

        cards.forEach(card => {
            const coverEl = card.querySelector('.playlist-cover');
            if (!coverEl) return;

            // Check if badge already exists
            let badge = coverEl.querySelector('.album-rating-badge');
            if (badge) {
                // Update existing badge
                updateBadgeContent(badge, rating);
            } else {
                // Create new badge
                badge = createRatingBadge(rating);
                coverEl.appendChild(badge);
            }
        });
    }

    /**
     * Create rating badge element
     * @param {Object} rating - Rating object
     * @returns {HTMLElement} Badge element
     */
    function createRatingBadge(rating) {
        const badge = document.createElement('div');
        badge.className = 'album-rating-badge';

        updateBadgeContent(badge, rating);

        return badge;
    }

    /**
     * Update badge content with scores
     * @param {HTMLElement} badge - Badge element
     * @param {Object} rating - Rating object
     */
    function updateBadgeContent(badge, rating) {
        const userDisplay = (rating.userScore !== null && rating.userScore !== undefined)
            ? rating.userScore
            : '-';
        const criticsDisplay = (rating.criticsScore !== null && rating.criticsScore !== undefined)
            ? rating.criticsScore
            : '-';

        badge.innerHTML = `<span class="rating-score rating-user" title="User Score">${userDisplay}</span>` +
                          `<span class="rating-score rating-critics" title="Critics Score">${criticsDisplay}</span>`;

        // Badge is always displayed
        badge.style.display = 'flex';
    }

    /**
     * Get cached rating for an album
     * @param {string} albumId - Album ID
     * @returns {Object|null} Cached rating or null
     */
    function getCachedRating(albumId) {
        return ratingsCache.get(albumId) || null;
    }

    /**
     * Clear the ratings cache
     */
    function clearCache() {
        ratingsCache.clear();
    }

    // Export functions
    QobuzApp.ratings = {
        fetchRatingsForAlbums,
        updateAlbumCardRating,
        getCachedRating,
        clearCache
    };

    // Global export for direct calls
    window.fetchRatingsForAlbums = fetchRatingsForAlbums;

})();
