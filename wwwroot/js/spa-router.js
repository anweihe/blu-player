/**
 * SPA Router - Enables partial page navigation without full page reloads
 * This allows the audio player to continue playing during page navigation
 */
(function() {
    'use strict';

    // Current page scripts cleanup functions
    let currentPageCleanup = null;

    /**
     * Navigate to a URL via AJAX, replacing only the main content
     * @param {string} url - The URL to navigate to
     * @param {boolean} pushState - Whether to push to browser history (default: true)
     */
    async function navigateTo(url, pushState = true) {
        try {
            // Show loading state
            showNavigationLoading();

            // Fetch the page fragment
            const response = await fetch(url + (url.includes('?') ? '&' : '?') + 'handler=Fragment');

            if (!response.ok) {
                // Fallback to full page navigation on error
                window.location.href = url;
                return;
            }

            const html = await response.text();

            // Cleanup current page scripts
            if (currentPageCleanup) {
                try {
                    currentPageCleanup();
                } catch (e) {
                    console.warn('Page cleanup error:', e);
                }
                currentPageCleanup = null;
            }

            // Replace main content
            const mainElement = document.querySelector('main[role="main"]');
            if (mainElement) {
                mainElement.innerHTML = html;

                // Execute any inline scripts in the loaded content
                executeScripts(mainElement);
            }

            // Update browser history
            if (pushState) {
                history.pushState({ url: url }, '', url);
            }

            // Initialize page-specific JavaScript
            initializePage(url);

            // Update active menu item
            updateActiveMenuItem(url);

            // Hide loading state
            hideNavigationLoading();

            // Scroll to top
            window.scrollTo(0, 0);

        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback to full page navigation
            window.location.href = url;
        }
    }

    /**
     * Execute scripts in loaded content
     * When using innerHTML, scripts are not executed automatically
     * @param {HTMLElement} container - The container with the new HTML
     */
    function executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');

            // Copy attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            // Copy inline content
            newScript.textContent = oldScript.textContent;

            // Replace the old script with the new one (this triggers execution)
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    /**
     * Show loading indicator during navigation
     */
    function showNavigationLoading() {
        // Add a subtle loading indicator class to body
        document.body.classList.add('spa-navigating');
    }

    /**
     * Hide loading indicator
     */
    function hideNavigationLoading() {
        document.body.classList.remove('spa-navigating');
    }

    /**
     * Initialize page-specific JavaScript after navigation
     * @param {string} url - The navigated URL
     */
    function initializePage(url) {
        const path = new URL(url, window.location.origin).pathname.toLowerCase();

        // Page-specific cleanup registration
        // Note: Page scripts handle their own initialization via executeScripts()
        if (path === '/' || path === '/index') {
            initializeIndexPage();
        } else if (path === '/qobuz') {
            initializeQobuzPage();
        } else if (path === '/tunein') {
            initializeTuneInPage();
        } else if (path === '/radioparadise') {
            initializeRadioParadisePage();
        } else if (path === '/players') {
            initializePlayersPage();
        }

        // Dispatch custom event for page initialization
        document.dispatchEvent(new CustomEvent('spa:pageload', {
            detail: { url: url, path: path }
        }));
    }

    /**
     * Initialize Index (Home) page
     * Note: Most initialization is handled by the page's own script via executeScripts()
     */
    function initializeIndexPage() {
        // Register cleanup function
        currentPageCleanup = function() {
            // No specific cleanup needed for index page
        };

        // The page's inline script should have already run via executeScripts()
        // But as a fallback, call initIndexPage after a frame to ensure DOM is ready
        requestAnimationFrame(() => {
            if (typeof window.initIndexPage === 'function') {
                window.initIndexPage();
            }
        });
    }

    /**
     * Initialize Qobuz page
     * Note: Most initialization is handled by the page's own script via executeScripts()
     */
    function initializeQobuzPage() {
        // Register cleanup function
        currentPageCleanup = function() {
            // Unregister playback callbacks
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.unregisterPlaybackCallbacks) {
                GlobalPlayer.unregisterPlaybackCallbacks();
            }
        };

        // Call initQobuz directly since external scripts may not re-execute on SPA navigation
        // Use setTimeout to ensure DOM is fully ready and scripts have loaded
        setTimeout(() => {
            if (typeof window.initQobuz === 'function') {
                window.initQobuz();
            }
        }, 0);
    }

    /**
     * Initialize TuneIn page
     * Note: Most initialization is handled by the page's own script via executeScripts()
     */
    function initializeTuneInPage() {
        // Register cleanup function
        currentPageCleanup = function() {
            // Unregister playback callbacks
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.unregisterPlaybackCallbacks) {
                GlobalPlayer.unregisterPlaybackCallbacks();
            }
        };

        // Call initTuneIn directly since external scripts may not re-execute on SPA navigation
        // Use setTimeout to ensure DOM is fully ready and scripts have loaded
        setTimeout(() => {
            if (typeof window.initTuneIn === 'function') {
                window.initTuneIn();
            }
        }, 0);
    }

    /**
     * Initialize Radio Paradise page
     * Note: Most initialization is handled by the page's own script via executeScripts()
     */
    function initializeRadioParadisePage() {
        // Register cleanup function
        currentPageCleanup = function() {
            // Unregister playback callbacks
            if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.unregisterPlaybackCallbacks) {
                GlobalPlayer.unregisterPlaybackCallbacks();
            }
        };

        // Call initRadioParadise directly since external scripts may not re-execute on SPA navigation
        // Use setTimeout to ensure DOM is fully ready and scripts have loaded
        setTimeout(() => {
            if (typeof window.initRadioParadise === 'function') {
                window.initRadioParadise();
            }
        }, 0);
    }

    /**
     * Initialize Players page
     * Note: Most initialization is handled by the page's own script via executeScripts()
     */
    function initializePlayersPage() {
        // Register cleanup function
        currentPageCleanup = function() {
            // Clear any status polling intervals
            if (typeof playbackRefreshInterval !== 'undefined' && playbackRefreshInterval) {
                clearInterval(playbackRefreshInterval);
            }
        };
    }

    /**
     * Update active menu item based on current URL
     * @param {string} url - The current URL
     */
    function updateActiveMenuItem(url) {
        const path = new URL(url, window.location.origin).pathname.toLowerCase();

        // Update menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href) {
                const itemPath = href.toLowerCase();
                const isActive = itemPath === path ||
                    (path === '/' && itemPath === '/') ||
                    (path.startsWith(itemPath) && itemPath !== '/');

                item.classList.toggle('active', isActive);
            }
        });
    }

    /**
     * Handle browser back/forward navigation
     */
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.url) {
            navigateTo(event.state.url, false);
        } else {
            // If no state, navigate to current URL
            navigateTo(window.location.href, false);
        }
    });

    /**
     * Initialize SPA on page load
     */
    function initSPA() {
        // Store current URL in history state
        history.replaceState({ url: window.location.href }, '', window.location.href);

        // Initialize current page
        initializePage(window.location.href);
    }

    // Expose navigation function globally
    window.navigateTo = navigateTo;
    window.spaRouter = {
        navigateTo: navigateTo,
        initializePage: initializePage,
        registerCleanup: function(fn) {
            currentPageCleanup = fn;
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSPA);
    } else {
        initSPA();
    }
})();
