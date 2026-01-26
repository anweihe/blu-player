/**
 * Qobuz Scroll Module
 * Manages scroll position saving and restoration for browser navigation
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // Map to store scroll positions keyed by URL
    const scrollPositions = new Map();

    /**
     * Save the current scroll position
     * @param {string} [key] - Optional URL key, defaults to current URL
     */
    function save(key) {
        key = key || window.location.href;
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        scrollPositions.set(key, scrollY);
        console.log('QobuzApp.scroll.save:', key, scrollY);
    }

    /**
     * Restore scroll position for a given key
     * @param {string} [key] - Optional URL key, defaults to current URL
     * @param {number} [delay=100] - Delay in ms before scrolling
     * @returns {boolean} - Whether a position was restored
     */
    function restore(key, delay = 100) {
        key = key || window.location.href;
        const y = scrollPositions.get(key);
        if (y !== undefined) {
            console.log('QobuzApp.scroll.restore:', key, y);
            setTimeout(() => window.scrollTo(0, y), delay);
            return true;
        }
        return false;
    }

    /**
     * Clear stored position for a key
     * @param {string} [key] - Optional URL key, defaults to current URL
     */
    function clear(key) {
        key = key || window.location.href;
        scrollPositions.delete(key);
    }

    /**
     * Clear all stored scroll positions
     */
    function clearAll() {
        scrollPositions.clear();
    }

    // Export
    QobuzApp.scroll = {
        save,
        restore,
        clear,
        clearAll
    };

})();
