/**
 * User Profile Manager for Multi-User Support
 * Now uses the SettingsApi for server-side persistence
 */

const UserProfileManager = (function() {
    // Cache for synchronous access (updated by async operations)
    let cachedProfiles = [];
    let cachedActiveProfileId = null;
    let initialized = false;

    /**
     * Initialize the profile manager
     * Must be called before using other functions
     * @returns {Promise<Object|null>} The active profile
     */
    async function initialize() {
        if (initialized) {
            const activeProfile = await SettingsApi.getActiveProfile();
            return activeProfile;
        }

        const activeProfile = await SettingsApi.initialize();
        initialized = true;

        // Update cache
        cachedProfiles = await SettingsApi.getAllProfiles();
        cachedActiveProfileId = await SettingsApi.getActiveProfileId();

        return activeProfile;
    }

    /**
     * Get all profiles (async)
     * @returns {Promise<Array>} Array of profile objects
     */
    async function getAllProfiles() {
        const profiles = await SettingsApi.getAllProfiles();
        cachedProfiles = profiles;
        return profiles;
    }

    /**
     * Get all profiles synchronously from cache
     * Use this only when async is not possible
     * @returns {Array} Cached profiles array
     */
    function getAllProfilesSync() {
        return cachedProfiles;
    }

    /**
     * Get the active profile ID (async)
     * @returns {Promise<string|null>}
     */
    async function getActiveProfileId() {
        const id = await SettingsApi.getActiveProfileId();
        cachedActiveProfileId = id;
        return id;
    }

    /**
     * Get active profile ID from cache
     * @returns {string|null}
     */
    function getActiveProfileIdSync() {
        return cachedActiveProfileId;
    }

    /**
     * Set the active profile ID
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function setActiveProfileId(profileId) {
        const success = await SettingsApi.setActiveProfileId(profileId);
        if (success) {
            cachedActiveProfileId = profileId;
        }
        return success;
    }

    /**
     * Get the active profile (async)
     * @returns {Promise<Object|null>}
     */
    async function getActiveProfile() {
        return await SettingsApi.getActiveProfile();
    }

    /**
     * Get a profile by ID (async)
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async function getProfileById(profileId) {
        return await SettingsApi.getProfileById(profileId);
    }

    /**
     * Create a new profile
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async function createProfile(name) {
        const profile = await SettingsApi.createProfile(name);
        if (profile) {
            // Refresh cache
            cachedProfiles = await SettingsApi.getAllProfiles();
        }
        return profile;
    }

    /**
     * Update a profile
     * @param {string} profileId
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async function updateProfile(profileId, updates) {
        const profile = await SettingsApi.updateProfile(profileId, updates);
        if (profile) {
            // Refresh cache
            cachedProfiles = await SettingsApi.getAllProfiles();
        }
        return profile;
    }

    /**
     * Delete a profile
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function deleteProfile(profileId) {
        const success = await SettingsApi.deleteProfile(profileId);
        if (success) {
            // Check if we deleted the active profile
            if (cachedActiveProfileId === profileId) {
                cachedActiveProfileId = null;
            }
            // Refresh cache
            cachedProfiles = await SettingsApi.getAllProfiles();
        }
        return success;
    }

    /**
     * Update Qobuz credentials for a profile
     * @param {string} profileId
     * @param {Object} qobuzData {userId, authToken, displayName?, avatar?}
     * @returns {Promise<Object|null>}
     */
    async function updateQobuzCredentials(profileId, qobuzData) {
        const profile = await SettingsApi.updateQobuzCredentials(profileId, qobuzData);
        if (profile) {
            // Refresh cache
            cachedProfiles = await SettingsApi.getAllProfiles();
        }
        return profile;
    }

    /**
     * Clear Qobuz credentials for a profile
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function clearQobuzCredentials(profileId) {
        const success = await SettingsApi.deleteQobuzCredentials(profileId);
        if (success) {
            cachedProfiles = await SettingsApi.getAllProfiles();
        }
        return success;
    }

    /**
     * Check if a profile has valid Qobuz credentials
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async function hasQobuzCredentials(profileId) {
        return await SettingsApi.hasQobuzCredentials(profileId);
    }

    /**
     * Get Qobuz credentials for a profile
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async function getQobuzCredentials(profileId) {
        return await SettingsApi.getQobuzCredentials(profileId);
    }

    /**
     * Get the initial letter(s) for a profile avatar
     * @param {string} name
     * @returns {string}
     */
    function getProfileInitial(name) {
        return SettingsApi.getProfileInitial(name);
    }

    /**
     * Generate a color based on profile ID
     * @param {string} profileId
     * @returns {string} HSL color
     */
    function getProfileColor(profileId) {
        return SettingsApi.getProfileColor(profileId);
    }

    /**
     * Migrate old data (legacy function, now handled by SettingsApi)
     * @returns {Promise<Object|null>}
     */
    async function migrateOldData() {
        await SettingsApi.migrateFromLocalStorage();
        return await getActiveProfile();
    }

    // Public API
    return {
        initialize,
        getAllProfiles,
        getAllProfilesSync,
        getActiveProfileId,
        getActiveProfileIdSync,
        setActiveProfileId,
        getActiveProfile,
        getProfileById,
        createProfile,
        updateProfile,
        deleteProfile,
        updateQobuzCredentials,
        clearQobuzCredentials,
        hasQobuzCredentials,
        getQobuzCredentials,
        getProfileInitial,
        getProfileColor,
        migrateOldData
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfileManager;
}
