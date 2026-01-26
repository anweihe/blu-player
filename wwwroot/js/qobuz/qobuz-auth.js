/**
 * Qobuz Auth Module
 * Handles login, logout, credentials, and profile management
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // ==================== Auth-State-Caching ====================

    let cachedAuthState = {
        verified: false,
        timestamp: 0,
        data: null  // { userId, authToken, displayName, avatar }
    };
    const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    function isAuthCacheValid() {
        return cachedAuthState.verified &&
               (Date.now() - cachedAuthState.timestamp < AUTH_CACHE_TTL);
    }

    function setCachedAuth(data) {
        cachedAuthState = { verified: true, timestamp: Date.now(), data };
        // Set hint for immediate flicker prevention on page load
        try {
            sessionStorage.setItem('qobuz_auth_hint', 'true');
            document.documentElement.classList.add('qobuz-has-auth');
        } catch(e) {}
    }

    function getCachedAuth() {
        return isAuthCacheValid() ? cachedAuthState.data : null;
    }

    function clearAuthCache() {
        cachedAuthState = { verified: false, timestamp: 0, data: null };
        // Clear hint
        try {
            sessionStorage.removeItem('qobuz_auth_hint');
            document.documentElement.classList.remove('qobuz-has-auth');
        } catch(e) {}
    }

    // ==================== Credentials Management ====================

    async function getQobuzCredentials() {
        const activeProfile = await UserProfileManager.getActiveProfile();
        if (!activeProfile) {
            console.log('getQobuzCredentials: No active profile');
            return null;
        }
        if (!activeProfile.qobuz) {
            console.log('getQobuzCredentials: Profile has no Qobuz credentials:', activeProfile.id);
            return null;
        }
        console.log('getQobuzCredentials: Found credentials for profile:', activeProfile.id);
        return activeProfile.qobuz;
    }

    async function saveQobuzCredentials(data) {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) {
            console.error('Cannot save Qobuz credentials: No active profile ID');
            return false;
        }

        try {
            await UserProfileManager.updateQobuzCredentials(activeProfileId, {
                userId: data.userId,
                authToken: data.authToken,
                displayName: data.displayName || null,
                avatar: data.avatar || null
            });
            console.log('Qobuz credentials saved for profile:', activeProfileId);
            return true;
        } catch (error) {
            console.error('Failed to save Qobuz credentials:', error);
            return false;
        }
    }

    async function clearQobuzCredentials() {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        await UserProfileManager.clearQobuzCredentials(activeProfileId);
    }

    // ==================== Queue Persistence ====================

    async function saveQueueToDb(currentIndex) {
        const playback = QobuzApp.playback;
        if (!playback.currentTracks || playback.currentTracks.length === 0) return;

        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        const queueData = {
            sourceType: playback.currentSourceType,
            sourceId: playback.currentSourceId,
            sourceName: playback.currentSourceName,
            currentIndex: currentIndex,
            tracks: playback.currentTracks
        };

        try {
            await QueueApi.setQueue(activeProfileId, queueData);

            if (window.GlobalPlayer) {
                window.GlobalPlayer.setQueue(queueData);
            }
        } catch (error) {
            console.error('Failed to save queue:', error);
        }
    }

    async function updateQueueIndexInDb(currentIndex) {
        const activeProfileId = await UserProfileManager.getActiveProfileId();
        if (!activeProfileId) return;

        try {
            await QueueApi.updateQueueIndex(activeProfileId, currentIndex);

            if (window.GlobalPlayer) {
                window.GlobalPlayer.updateQueueIndex(currentIndex);
            }
        } catch (error) {
            console.error('Failed to update queue index:', error);
        }
    }

    // ==================== Bluesound Quality Sync ====================

    async function syncBluesoundQobuzQuality() {
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (selectedPlayer?.type !== 'bluesound' || !selectedPlayer.ip) {
            console.log('syncBluesoundQobuzQuality: Not a Bluesound player, skipping sync');
            return;
        }

        console.log('syncBluesoundQobuzQuality: Syncing quality from Bluesound player', selectedPlayer.ip);

        try {
            const response = await fetch(`/Qobuz?handler=BluesoundQobuzQuality&playerIp=${encodeURIComponent(selectedPlayer.ip)}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.formatId) {
                console.log('syncBluesoundQobuzQuality: Got quality from player:', data.quality, '(formatId:', data.formatId, ')');

                if (window.GlobalPlayer && window.GlobalPlayer.setQuality) {
                    window.GlobalPlayer.setQuality(data.formatId);
                }
            } else {
                console.warn('syncBluesoundQobuzQuality: Failed to get quality from player:', data.error);
            }
        } catch (error) {
            console.error('syncBluesoundQobuzQuality: Error fetching quality:', error);
        }
    }

    async function setBluesoundQobuzQuality(formatId) {
        const selectedPlayer = QobuzApp.core.getSelectedPlayer();
        if (selectedPlayer?.type !== 'bluesound' || !selectedPlayer.ip) {
            return true;
        }

        console.log('setBluesoundQobuzQuality: Setting quality on Bluesound player', selectedPlayer.ip, 'to formatId:', formatId);

        try {
            const response = await fetch(`/Qobuz?handler=SetBluesoundQobuzQuality&playerIp=${encodeURIComponent(selectedPlayer.ip)}&formatId=${formatId}&port=${selectedPlayer.port || 11000}`, {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log('setBluesoundQobuzQuality: Quality set successfully:', data.quality);
                return true;
            } else {
                console.error('setBluesoundQobuzQuality: Failed to set quality:', data.error);
                return false;
            }
        } catch (error) {
            console.error('setBluesoundQobuzQuality: Error setting quality:', error);
            return false;
        }
    }

    // ==================== Profile Display ====================

    async function updateProfileDisplayQobuz() {
        const activeProfile = await UserProfileManager.getActiveProfile();
        if (!activeProfile) return;

        const initial = UserProfileManager.getProfileInitial(activeProfile.name);
        const color = UserProfileManager.getProfileColor(activeProfile.id);

        const headerInitial = document.getElementById('header-profile-initial');
        if (headerInitial) {
            headerInitial.textContent = initial;
            headerInitial.parentElement.style.background = color;
        }

        const menuAvatar = document.getElementById('menu-profile-avatar');
        const menuName = document.getElementById('menu-profile-name');
        if (menuAvatar) {
            menuAvatar.textContent = initial;
            menuAvatar.style.background = color;
        }
        if (menuName) {
            menuName.textContent = activeProfile.name;
        }
    }

    // ==================== Login Form ====================

    function setupLoginForm() {
        if (QobuzApp.setup.loginForm) return;
        const loginForm = document.getElementById('login-form');
        if (!loginForm) return;
        loginForm.addEventListener('submit', handleLoginSubmit);
        QobuzApp.setup.loginForm = true;
    }

    async function handleLoginSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        QobuzApp.core.showLoading();

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);

            const response = await fetch('/Qobuz?handler=Login', {
                method: 'POST',
                headers: {
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                await saveQobuzCredentials({
                    userId: data.userId,
                    authToken: data.authToken,
                    displayName: data.displayName,
                    avatar: data.avatar
                });

                showLoggedInState(data);
                await QobuzApp.browse.loadPlaylists();

                if (!QobuzApp.tabs.newReleasesLoaded) {
                    QobuzApp.browse.loadNewReleases();
                }
            } else {
                QobuzApp.core.showError(data.error || 'Login fehlgeschlagen');
            }
        } catch (error) {
            console.error('Login failed:', error);
            QobuzApp.core.showError('Login fehlgeschlagen. Bitte versuche es erneut.');
        }

        QobuzApp.core.hideLoading();
    }

    // ==================== State Management ====================

    function showLoginState() {
        // Don't show login during restoration if auth is cached
        if (QobuzApp.navigation?.isRestoring && isAuthCacheValid()) {
            return;
        }

        // Clear auth hint since we're showing login
        try {
            sessionStorage.removeItem('qobuz_auth_hint');
            document.documentElement.classList.remove('qobuz-has-auth');
        } catch(e) {}

        if (QobuzApp.dom.loginSection) QobuzApp.dom.loginSection.style.display = 'flex';
        if (QobuzApp.dom.loggedInSection) QobuzApp.dom.loggedInSection.style.display = 'none';
        if (QobuzApp.dom.userMenu) QobuzApp.dom.userMenu.style.display = 'none';
    }

    function showLoggedInState(userData) {
        // Set auth hint for flicker prevention
        try {
            sessionStorage.setItem('qobuz_auth_hint', 'true');
            document.documentElement.classList.add('qobuz-has-auth');
        } catch(e) {}

        if (QobuzApp.dom.loginSection) QobuzApp.dom.loginSection.style.display = 'none';
        if (QobuzApp.dom.loggedInSection) QobuzApp.dom.loggedInSection.style.display = 'block';
        if (QobuzApp.dom.userMenu) QobuzApp.dom.userMenu.style.display = 'flex';
    }

    // ==================== Logout ====================

    async function logout() {
        // Stop playback
        const playback = QobuzApp.playback;
        if (playback.audioPlayer) {
            playback.audioPlayer.pause();
            playback.audioPlayer.src = '';
        }
        playback.isPlaying = false;
        playback.currentTracks = [];
        playback.currentTrackIndex = -1;

        // Hide now playing bar
        if (window.GlobalPlayer) {
            window.GlobalPlayer.setPlaying(false);
            window.GlobalPlayer.hideBar();
        }

        // Clear auth cache
        clearAuthCache();

        // Clear credentials from profile
        await clearQobuzCredentials();

        // Reset tab states
        QobuzApp.tabs.newReleasesLoaded = false;
        QobuzApp.tabs.albumChartsLoaded = false;
        QobuzApp.tabs.topPlaylistsLoaded = false;
        QobuzApp.tabs.favAlbumsLoaded = false;
        QobuzApp.tabs.favTracksLoaded = false;
        QobuzApp.tabs.favArtistsLoaded = false;

        // Show login state
        showLoginState();
    }

    // ==================== Player Selector ====================

    function openPlayerSelector() {
        document.getElementById('player-selector-overlay').style.display = 'block';
    }

    function closePlayerSelector() {
        document.getElementById('player-selector-overlay').style.display = 'none';
    }

    // ==================== Export Functions ====================

    QobuzApp.auth = {
        getQobuzCredentials,
        saveQobuzCredentials,
        clearQobuzCredentials,
        saveQueueToDb,
        updateQueueIndexInDb,
        syncBluesoundQobuzQuality,
        setBluesoundQobuzQuality,
        updateProfileDisplayQobuz,
        setupLoginForm,
        showLoginState,
        showLoggedInState,
        logout,
        openPlayerSelector,
        closePlayerSelector,
        // Auth cache functions
        isAuthCacheValid,
        setCachedAuth,
        getCachedAuth,
        clearAuthCache
    };

    // Global exports
    window.logout = logout;
    window.openPlayerSelector = openPlayerSelector;
    window.closePlayerSelector = closePlayerSelector;

})();
