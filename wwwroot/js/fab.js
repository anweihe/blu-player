/**
 * Floating Action Button (FAB) - Expandable menu for quick navigation
 * Material Design 3 inspired implementation
 */
(function() {
    'use strict';

    const container = document.getElementById('fab-container');
    if (!container) return;

    const mainFab = container.querySelector('.fab-main');
    const overlay = container.querySelector('.fab-overlay');
    const actions = container.querySelectorAll('.fab-mini');

    /**
     * Toggle FAB open/closed state
     */
    function toggle() {
        container.classList.toggle('open');

        // Update aria-expanded for accessibility
        const isOpen = container.classList.contains('open');
        mainFab.setAttribute('aria-expanded', isOpen);

        // Prevent body scroll when FAB is open
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    /**
     * Close the FAB menu
     */
    function close() {
        container.classList.remove('open');
        mainFab.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    /**
     * Navigate to a URL using SPA router if available
     * @param {string} url - The URL to navigate to
     */
    function navigate(url) {
        // Check if SPA router's navigateTo function is available
        if (typeof window.navigateTo === 'function') {
            window.navigateTo(url);
        } else {
            // Fallback to regular navigation
            window.location.href = url;
        }
    }

    /**
     * Open the player selector modal
     */
    function openPlayerSelector() {
        // Check if the global player selector function exists
        if (typeof window.openGlobalPlayerSelector === 'function') {
            window.openGlobalPlayerSelector();
        } else {
            console.warn('Player selector not available');
        }
    }

    /**
     * Handle FAB mini button actions
     * @param {string} action - The action identifier
     */
    function handleAction(action) {
        close();

        // Small delay to let the close animation start
        setTimeout(() => {
            switch (action) {
                case 'player-selector':
                    openPlayerSelector();
                    break;
                case 'qobuz':
                    navigate('/Qobuz');
                    break;
                case 'radio-paradise':
                    navigate('/RadioParadise');
                    break;
                case 'tunein':
                    navigate('/TuneIn');
                    break;
                default:
                    console.warn('Unknown FAB action:', action);
            }
        }, 100);
    }

    // Event listeners
    if (mainFab) {
        mainFab.addEventListener('click', toggle);
    }

    if (overlay) {
        overlay.addEventListener('click', close);
    }

    actions.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action) {
                handleAction(action);
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && container.classList.contains('open')) {
            close();
        }
    });

    // Expose close function globally so other scripts can close the FAB if needed
    window.closeFabMenu = close;
})();
