/**
 * Settings API Client
 * Provides methods to interact with the server-side settings API
 */
const SettingsApi = (function() {
    'use strict';

    const API_BASE = '/Api/Settings';

    // Local cache for profiles (reduces API calls)
    let profilesCache = null;
    let activeProfileIdCache = null;
    let cacheTimestamp = 0;
    const CACHE_TTL = 5000; // 5 seconds

    // Migration state
    let migrationAttempted = false;

    /**
     * Make an API request
     */
    async function apiRequest(method, handler, params = {}, body = null) {
        const url = new URL(API_BASE, window.location.origin);
        url.searchParams.set('handler', handler);

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body !== null) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), options);
        return response.json();
    }

    /**
     * Invalidate cache
     */
    function invalidateCache() {
        profilesCache = null;
        activeProfileIdCache = null;
        cacheTimestamp = 0;
    }

    /**
     * Check if cache is valid
     */
    function isCacheValid() {
        return profilesCache !== null && (Date.now() - cacheTimestamp) < CACHE_TTL;
    }

    // ==================== Profile Operations ====================

    /**
     * Get all profiles
     * @returns {Promise<Array>} Array of profile objects
     */
    async function getAllProfiles() {
        if (isCacheValid()) {
            return profilesCache;
        }

        const result = await apiRequest('GET', 'profiles');
        if (result.success) {
            profilesCache = result.data || [];
            cacheTimestamp = Date.now();
            return profilesCache;
        }
        console.error('Failed to get profiles:', result.error);
        return [];
    }

    /**
     * Get a profile by ID
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async function getProfileById(profileId) {
        // Check cache first
        if (isCacheValid() && profilesCache) {
            const cached = profilesCache.find(p => p.id === profileId);
            if (cached) return cached;
        }

        const result = await apiRequest('GET', 'profile', { id: profileId });
        if (result.success) {
            return result.data;
        }
        return null;
    }

    /**
     * Create a new profile
     * @param {string} name
     * @returns {Promise<Object|null>}
     */
    async function createProfile(name) {
        const result = await apiRequest('POST', 'profile', {}, { name });
        if (result.success) {
            invalidateCache();
            return result.data;
        }
        console.error('Failed to create profile:', result.error);
        return null;
    }

    /**
     * Update a profile
     * @param {string} profileId
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async function updateProfile(profileId, updates) {
        const result = await apiRequest('PUT', 'profile', { id: profileId }, updates);
        if (result.success) {
            invalidateCache();
            return result.data;
        }
        console.error('Failed to update profile:', result.error);
        return null;
    }

    /**
     * Delete a profile
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function deleteProfile(profileId) {
        const result = await apiRequest('DELETE', 'profile', { id: profileId });
        if (result.success) {
            // If deleted profile was the active one, clear from localStorage
            const activeId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
            if (activeId === profileId) {
                localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
                activeProfileIdCache = null;
            }
            invalidateCache();
            return true;
        }
        console.error('Failed to delete profile:', result.error);
        return false;
    }

    // ==================== Active Profile ====================

    const ACTIVE_PROFILE_STORAGE_KEY = 'bluesound_active_profile_id';

    /**
     * Get the active profile ID from localStorage
     * Validates that the profile still exists in the backend
     * @returns {Promise<string|null>}
     */
    async function getActiveProfileId() {
        // Return from cache if valid
        if (activeProfileIdCache !== null && isCacheValid()) {
            return activeProfileIdCache;
        }

        // Read from localStorage
        const storedId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);

        if (storedId) {
            // Verify profile still exists
            const profiles = await getAllProfiles();
            if (profiles.some(p => p.id === storedId)) {
                activeProfileIdCache = storedId;
                return storedId;
            }
            // Profile no longer exists, clear localStorage
            localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
        }

        activeProfileIdCache = null;
        return null;
    }

    /**
     * Set the active profile ID in localStorage
     * @param {string|null} profileId
     * @returns {Promise<boolean>}
     */
    async function setActiveProfileId(profileId) {
        if (profileId) {
            localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
        } else {
            localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
        }
        activeProfileIdCache = profileId;
        return true;
    }

    /**
     * Get the active profile
     * @returns {Promise<Object|null>}
     */
    async function getActiveProfile() {
        const activeId = await getActiveProfileId();
        if (!activeId) return null;

        const profiles = await getAllProfiles();
        return profiles.find(p => p.id === activeId) || null;
    }

    // ==================== Qobuz Credentials ====================

    /**
     * Update Qobuz credentials for a profile
     * @param {string} profileId
     * @param {Object} credentials {userId, authToken, displayName?, avatar?}
     * @returns {Promise<Object|null>}
     */
    async function updateQobuzCredentials(profileId, credentials) {
        const result = await apiRequest('PUT', 'qobuz', { id: profileId }, credentials);
        if (result.success) {
            invalidateCache();
            return result.data;
        }
        console.error('Failed to update Qobuz credentials:', result.error);
        return null;
    }

    /**
     * Delete Qobuz credentials for a profile
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function deleteQobuzCredentials(profileId) {
        const result = await apiRequest('DELETE', 'qobuz', { id: profileId });
        if (result.success) {
            invalidateCache();
            return true;
        }
        console.error('Failed to delete Qobuz credentials:', result.error);
        return false;
    }

    /**
     * Check if a profile has valid Qobuz credentials
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function hasQobuzCredentials(profileId) {
        const profile = await getProfileById(profileId);
        return !!(profile?.qobuz?.userId && profile?.qobuz?.authToken);
    }

    /**
     * Get Qobuz credentials for a profile
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async function getQobuzCredentials(profileId) {
        const profile = await getProfileById(profileId);
        return profile?.qobuz || null;
    }

    // ==================== Settings ====================

    /**
     * Update streaming quality for a profile
     * @param {string} profileId
     * @param {number} formatId
     * @returns {Promise<Object|null>}
     */
    async function updateStreamingQuality(profileId, formatId) {
        const result = await apiRequest('PUT', 'quality', { id: profileId }, { formatId });
        if (result.success) {
            invalidateCache();
            return result.data;
        }
        console.error('Failed to update streaming quality:', result.error);
        return null;
    }

    /**
     * Update player selection for a profile
     * @param {string} profileId
     * @param {Object} playerData {type, name?, ip?, port?, model?}
     * @returns {Promise<Object|null>}
     */
    async function updatePlayerSelection(profileId, playerData) {
        const result = await apiRequest('PUT', 'player', { id: profileId }, playerData);
        if (result.success) {
            invalidateCache();
            return result.data;
        }
        console.error('Failed to update player selection:', result.error);
        return null;
    }

    /**
     * Get streaming quality for a profile
     * @param {string} profileId
     * @returns {Promise<number>}
     */
    async function getStreamingQuality(profileId) {
        const profile = await getProfileById(profileId);
        return profile?.settings?.streamingQualityFormatId ?? 27;
    }

    /**
     * Get player selection for a profile
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async function getPlayerSelection(profileId) {
        const profile = await getProfileById(profileId);
        if (!profile?.settings?.selectedPlayerType) {
            return { type: 'browser', name: 'Dieses Gerät' };
        }
        return {
            type: profile.settings.selectedPlayerType,
            name: profile.settings.selectedPlayerName,
            ip: profile.settings.selectedPlayerIp,
            port: profile.settings.selectedPlayerPort,
            model: profile.settings.selectedPlayerModel
        };
    }

    // ==================== Migration ====================

    /**
     * Migrate localStorage data to the server
     * @returns {Promise<boolean>} True if migration was performed
     */
    async function migrateFromLocalStorage() {
        if (migrationAttempted) {
            return false;
        }
        migrationAttempted = true;

        // Check for old localStorage data
        const oldProfiles = localStorage.getItem('bluesound_user_profiles');
        const oldActiveProfileId = localStorage.getItem('bluesound_active_profile_id');
        const oldSelectedPlayer = localStorage.getItem('bluesound_selected_player');

        // Also check for very old single-user data
        const oldQobuzUserId = localStorage.getItem('qobuz_user_id');
        const oldQobuzAuthToken = localStorage.getItem('qobuz_auth_token');

        if (!oldProfiles && !oldQobuzUserId) {
            // No data to migrate
            return false;
        }

        try {
            let profilesToMigrate = [];

            if (oldProfiles) {
                // Parse existing profiles
                const parsed = JSON.parse(oldProfiles);
                profilesToMigrate = parsed.map(p => ({
                    id: p.id,
                    name: p.name,
                    createdAt: p.createdAt,
                    qobuz: p.qobuz ? {
                        userId: parseInt(p.qobuz.userId, 10) || p.qobuz.userId,
                        authToken: p.qobuz.authToken,
                        displayName: p.qobuz.displayName,
                        avatar: p.qobuz.avatar
                    } : null,
                    settings: {
                        streamingQualityFormatId: 27,
                        selectedPlayerType: null,
                        selectedPlayerName: null,
                        selectedPlayerIp: null,
                        selectedPlayerPort: null,
                        selectedPlayerModel: null
                    }
                }));

                // Try to load player selection from localStorage
                if (oldSelectedPlayer) {
                    try {
                        const player = JSON.parse(oldSelectedPlayer);
                        // Apply to all profiles (or just the active one)
                        profilesToMigrate.forEach(p => {
                            p.settings.selectedPlayerType = player.type;
                            p.settings.selectedPlayerName = player.name;
                            p.settings.selectedPlayerIp = player.ip;
                            p.settings.selectedPlayerPort = player.port;
                            p.settings.selectedPlayerModel = player.model;
                        });
                    } catch (e) {
                        console.warn('Failed to parse old player selection:', e);
                    }
                }

                // Load streaming quality per user
                profilesToMigrate.forEach(p => {
                    if (p.qobuz?.userId) {
                        const qualityKey = `qobuz_stream_quality_${p.qobuz.userId}`;
                        const quality = localStorage.getItem(qualityKey);
                        if (quality) {
                            p.settings.streamingQualityFormatId = parseInt(quality, 10) || 27;
                        }
                    }
                });

            } else if (oldQobuzUserId && oldQobuzAuthToken) {
                // Migrate single-user legacy data
                const oldUserName = localStorage.getItem('qobuz_user_name');
                const oldAvatar = localStorage.getItem('qobuz_user_avatar');

                const migratedProfile = {
                    id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: oldUserName || 'Migriertes Profil',
                    createdAt: new Date().toISOString(),
                    qobuz: {
                        userId: parseInt(oldQobuzUserId, 10) || oldQobuzUserId,
                        authToken: oldQobuzAuthToken,
                        displayName: oldUserName,
                        avatar: oldAvatar
                    },
                    settings: {
                        streamingQualityFormatId: 27,
                        selectedPlayerType: null,
                        selectedPlayerName: null,
                        selectedPlayerIp: null,
                        selectedPlayerPort: null,
                        selectedPlayerModel: null
                    }
                };

                profilesToMigrate = [migratedProfile];
            }

            if (profilesToMigrate.length === 0) {
                return false;
            }

            // Send migration request (profiles only, active profile is stored in localStorage)
            const result = await apiRequest('POST', 'migrate', {}, {
                profiles: profilesToMigrate,
                activeProfileId: null // No longer used, but keep for backwards compatibility
            });

            if (result.success && result.migrated) {
                // Migrate active profile ID to localStorage (keep it there, don't remove)
                // If oldActiveProfileId exists, it stays in localStorage
                // If not, set the first profile as active
                if (!oldActiveProfileId && profilesToMigrate.length > 0) {
                    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profilesToMigrate[0].id);
                }

                // Clear old localStorage data (but keep active profile id)
                localStorage.removeItem('bluesound_user_profiles');
                localStorage.removeItem('bluesound_selected_player');
                localStorage.removeItem('qobuz_user_id');
                localStorage.removeItem('qobuz_auth_token');
                localStorage.removeItem('qobuz_user_name');
                localStorage.removeItem('qobuz_user_avatar');

                // Clear per-user quality settings
                profilesToMigrate.forEach(p => {
                    if (p.qobuz?.userId) {
                        localStorage.removeItem(`qobuz_stream_quality_${p.qobuz.userId}`);
                    }
                });

                console.log('Successfully migrated localStorage data to server');
                invalidateCache();
                return true;
            }

            return false;
        } catch (e) {
            console.error('Migration failed:', e);
            return false;
        }
    }

    // ==================== Initialization ====================

    /**
     * Initialize the settings API and perform migration if needed
     * @returns {Promise<Object|null>} The active profile
     */
    async function initialize() {
        // Try to migrate old data first
        await migrateFromLocalStorage();

        // Get or create active profile
        let activeProfile = await getActiveProfile();

        if (activeProfile) {
            return activeProfile;
        }

        // Check if there are any profiles
        const profiles = await getAllProfiles();
        if (profiles.length > 0) {
            // Use the first profile
            await setActiveProfileId(profiles[0].id);
            return profiles[0];
        }

        // No profiles exist - return null (user will create one)
        return null;
    }

    // ==================== Utility Functions ====================

    /**
     * Get the initial letter(s) for a profile avatar
     * @param {string} name
     * @returns {string}
     */
    function getProfileInitial(name) {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    }

    /**
     * Generate a color based on profile ID
     * @param {string} profileId
     * @returns {string} HSL color
     */
    function getProfileColor(profileId) {
        if (!profileId) return 'hsl(0, 0%, 45%)'; // Default gray for undefined
        let hash = 0;
        for (let i = 0; i < profileId.length; i++) {
            hash = profileId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 60%, 45%)`;
    }

    // Public API
    return {
        // Profile operations
        getAllProfiles,
        getProfileById,
        createProfile,
        updateProfile,
        deleteProfile,

        // Active profile
        getActiveProfileId,
        setActiveProfileId,
        getActiveProfile,

        // Qobuz credentials
        updateQobuzCredentials,
        deleteQobuzCredentials,
        hasQobuzCredentials,
        getQobuzCredentials,

        // Settings
        updateStreamingQuality,
        updatePlayerSelection,
        getStreamingQuality,
        getPlayerSelection,

        // Migration & init
        migrateFromLocalStorage,
        initialize,

        // Utilities
        getProfileInitial,
        getProfileColor,
        invalidateCache
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsApi;
}
