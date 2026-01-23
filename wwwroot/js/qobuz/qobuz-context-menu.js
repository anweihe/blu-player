/**
 * Qobuz Context Menu Module
 * Handles track context menu with artist navigation
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    let activeMenu = null;

    /**
     * Creates the HTML for a context menu button
     * @param {number|string} artistId - The artist ID
     * @param {string} artistName - The artist name for display
     * @returns {string} HTML string for the button
     */
    function createMenuButton(artistId, artistName) {
        if (!artistId) return '';

        const escapedName = (artistName || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `
            <button type="button" class="track-menu-btn"
                    data-artist-id="${artistId}"
                    data-artist-name="${escapedName}"
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
     * Toggle the context menu open/closed
     * @param {Event} event - Click event
     * @param {HTMLElement} button - The menu button element
     */
    function toggleMenu(event, button) {
        event.stopPropagation();
        event.preventDefault();

        const artistId = button.dataset.artistId;
        const artistName = button.dataset.artistName;

        // Close any existing menu
        closeMenu();

        // Create new menu
        const menu = document.createElement('div');
        menu.className = 'track-context-menu';
        menu.innerHTML = `
            <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToArtist(event, ${artistId})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Zur Künstlerseite</span>
            </button>
        `;

        // Position the menu
        const rect = button.getBoundingClientRect();
        const menuWidth = 200;
        const menuHeight = 48;

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
     * Toggle artist menu for album header button
     * @param {Event} event - Click event
     * @param {HTMLElement} button - The menu button element
     */
    function toggleAlbumArtistMenu(event, button) {
        event.stopPropagation();
        event.preventDefault();

        const artistId = button.dataset.artistId;
        const artistName = button.dataset.artistName;

        if (!artistId) return;

        // Close any existing menu
        closeMenu();

        // Create new menu
        const menu = document.createElement('div');
        menu.className = 'track-context-menu';
        menu.innerHTML = `
            <button type="button" class="track-context-menu-item" onclick="QobuzApp.contextMenu.goToArtist(event, ${artistId})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Zur Künstlerseite</span>
            </button>
        `;

        // Position the menu
        const rect = button.getBoundingClientRect();
        const menuWidth = 200;
        const menuHeight = 48;

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
        toggleMenu,
        toggleAlbumArtistMenu,
        closeMenu,
        goToArtist
    };

    // Global exports
    window.toggleAlbumArtistMenu = toggleAlbumArtistMenu;

})();
