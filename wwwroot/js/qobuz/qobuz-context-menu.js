/**
 * Qobuz Context Menu Module
 * Handles track context menu with artist navigation
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    let activeMenu = null;

    /**
     * Creates the HTML for a context menu button (for track rows)
     * @param {number|string} artistId - The artist ID
     * @param {string} artistName - The artist name for display
     * @param {number|string} albumId - The album ID (optional)
     * @param {string} albumTitle - The album title for display (optional)
     * @returns {string} HTML string for the button
     */
    function createMenuButton(artistId, artistName, albumId, albumTitle) {
        if (!artistId && !albumId) return '';

        const escapedArtistName = (artistName || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const escapedAlbumTitle = (albumTitle || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `
            <button type="button" class="track-menu-btn"
                    data-artist-id="${artistId || ''}"
                    data-artist-name="${escapedArtistName}"
                    data-album-id="${albumId || ''}"
                    data-album-title="${escapedAlbumTitle}"
                    onclick="QobuzApp.contextMenu.toggleMenu(event, this)"
                    title="Mehr Optionen">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="12" cy="19" r="2"/>
                </svg>
            </button>
        `;
    }

    /**
     * Creates the HTML for an album card menu button
     * @param {number|string} artistId - The artist ID
     * @param {string} artistName - The artist name for display
     * @param {number|string} albumId - The album ID (optional)
     * @returns {string} HTML string for the button
     */
    function createAlbumMenuButton(artistId, artistName, albumId) {
        if (!artistId && !albumId) return '';

        const escapedName = (artistName || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `<button type="button" class="album-menu-btn"
                data-artist-id="${artistId || ''}"
                data-artist-name="${escapedName}"
                data-album-id="${albumId || ''}"
                onclick="event.stopPropagation(); QobuzApp.contextMenu.toggleAlbumArtistMenu(event, this)"
                title="Mehr Optionen">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
            </svg>
        </button>`;
    }

    /**
     * Toggle the context menu open/closed
     * @param {Event} event - Click event
     * @param {HTMLElement} button - The menu button element
     */
    function toggleMenu(event, button) {
        event.stopPropagation();
        event.preventDefault();

        const artistId = button.dataset.artistId;
        const albumId = button.dataset.albumId;

        // Close any existing menu
        closeMenu();

        // Build menu items based on available data
        let menuItems = '';

        if (albumId) {
            menuItems += `
                <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToAlbum(event, '${albumId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>Zum Album</span>
                </button>
            `;
        }

        if (artistId) {
            menuItems += `
                <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToArtist(event, ${artistId})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Zur Künstlerseite</span>
                </button>
            `;
        }

        // Create new menu
        const menu = document.createElement('div');
        menu.className = 'track-context-menu';
        menu.innerHTML = menuItems;

        // Position the menu
        const rect = button.getBoundingClientRect();
        const menuWidth = 200;
        const itemCount = (albumId ? 1 : 0) + (artistId ? 1 : 0);
        const menuHeight = itemCount * 44; // ~44px per item

        // Check if menu would overflow right edge
        let left = rect.right - menuWidth;
        if (left < 10) {
            left = 10;
        }

        // Check if menu would overflow bottom edge (considering mini player)
        let top = rect.bottom + 4;
        const bottomSpace = window.innerHeight - rect.bottom - 100; // 100px for mini player
        if (bottomSpace < menuHeight) {
            top = rect.top - menuHeight - 4;
        }

        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.zIndex = '1001';

        document.body.appendChild(menu);
        activeMenu = menu;

        // Add animation class after append
        requestAnimationFrame(() => {
            menu.classList.add('active');
        });

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('scroll', closeMenu, { capture: true });
        }, 0);
    }

    /**
     * Handle clicks outside the menu
     * @param {Event} event - Click event
     */
    function handleOutsideClick(event) {
        if (activeMenu && !activeMenu.contains(event.target)) {
            closeMenu();
        }
    }

    /**
     * Close the active context menu
     */
    function closeMenu() {
        if (activeMenu) {
            activeMenu.classList.remove('active');
            setTimeout(() => {
                if (activeMenu && activeMenu.parentNode) {
                    activeMenu.parentNode.removeChild(activeMenu);
                }
                activeMenu = null;
            }, 150);
        }
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('scroll', closeMenu, { capture: true });
    }

    /**
     * Navigate to artist page
     * @param {Event} event - Click event
     * @param {number} artistId - The artist ID
     */
    function goToArtist(event, artistId) {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (artistId && typeof showArtistPage === 'function') {
            showArtistPage(artistId);
        }
    }

    /**
     * Navigate to album page
     * @param {Event} event - Click event
     * @param {string} albumId - The album ID
     */
    function goToAlbum(event, albumId) {
        event.stopPropagation();
        event.preventDefault();
        closeMenu();

        if (albumId && typeof selectAlbum === 'function') {
            selectAlbum(albumId);
        }
    }

    /**
     * Toggle artist menu for album card button
     * @param {Event} event - Click event
     * @param {HTMLElement} button - The menu button element
     */
    function toggleAlbumArtistMenu(event, button) {
        event.stopPropagation();
        event.preventDefault();

        const artistId = button.dataset.artistId;
        const albumId = button.dataset.albumId;

        if (!artistId && !albumId) return;

        // Close any existing menu
        closeMenu();

        // Build menu items based on available data
        let menuItems = '';

        if (albumId) {
            menuItems += `
                <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToAlbum(event, '${albumId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>Zum Album</span>
                </button>
            `;
        }

        if (artistId) {
            menuItems += `
                <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToArtist(event, ${artistId})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Zur Künstlerseite</span>
                </button>
            `;
        }

        // Create new menu
        const menu = document.createElement('div');
        menu.className = 'track-context-menu';
        menu.innerHTML = menuItems;

        // Position the menu
        const rect = button.getBoundingClientRect();
        const menuWidth = 200;
        const itemCount = (albumId ? 1 : 0) + (artistId ? 1 : 0);
        const menuHeight = itemCount * 44;

        // Position below the button, aligned right
        let left = rect.right - menuWidth;
        if (left < 10) {
            left = 10;
        }

        let top = rect.bottom + 8;
        const bottomSpace = window.innerHeight - rect.bottom - 100;
        if (bottomSpace < menuHeight) {
            top = rect.top - menuHeight - 8;
        }

        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.zIndex = '1001';

        document.body.appendChild(menu);
        activeMenu = menu;

        // Add animation class after append
        requestAnimationFrame(() => {
            menu.classList.add('active');
        });

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('scroll', closeMenu, { capture: true });
        }, 0);
    }

    // Export functions
    QobuzApp.contextMenu = {
        createMenuButton,
        createAlbumMenuButton,
        toggleMenu,
        toggleAlbumArtistMenu,
        closeMenu,
        goToArtist,
        goToAlbum
    };

    // Global exports
    window.toggleAlbumArtistMenu = toggleAlbumArtistMenu;

})();
