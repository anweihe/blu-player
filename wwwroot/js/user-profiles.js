/**
 * User Profile Manager for Multi-User Support
 * Handles profile CRUD operations and localStorage migration
 */

const UserProfileManager = (function() {
    // LocalStorage keys
    const STORAGE_PROFILES = 'bluesound_user_profiles';
    const STORAGE_ACTIVE_PROFILE = 'bluesound_active_profile_id';

    // Old storage keys (for migration)
    const OLD_STORAGE_USER_ID = 'qobuz_user_id';
    const OLD_STORAGE_AUTH_TOKEN = 'qobuz_auth_token';
    const OLD_STORAGE_USER_NAME = 'qobuz_user_name';
    const OLD_STORAGE_USER_AVATAR = 'qobuz_user_avatar';

    /**
     * Generate a unique profile ID
     */
    function generateProfileId() {
        return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all profiles from localStorage
     * @returns {Array} Array of profile objects
     */
    function getAllProfiles() {
        try {
            const profiles = localStorage.getItem(STORAGE_PROFILES);
            return profiles ? JSON.parse(profiles) : [];
        } catch (e) {
            console.error('Error reading profiles:', e);
            return [];
        }
    }

    /**
     * Save all profiles to localStorage
     * @param {Array} profiles - Array of profile objects
     */
    function saveAllProfiles(profiles) {
        try {
            localStorage.setItem(STORAGE_PROFILES, JSON.stringify(profiles));
        } catch (e) {
            console.error('Error saving profiles:', e);
        }
    }

    /**
     * Get the active profile ID
     * @returns {string|null} Active profile ID or null
     */
    function getActiveProfileId() {
        return localStorage.getItem(STORAGE_ACTIVE_PROFILE);
    }

    /**
     * Set the active profile ID
     * @param {string} profileId - Profile ID to set as active
     */
    function setActiveProfileId(profileId) {
        if (profileId) {
            localStorage.setItem(STORAGE_ACTIVE_PROFILE, profileId);
        } else {
            localStorage.removeItem(STORAGE_ACTIVE_PROFILE);
        }
    }

    /**
     * Get the active profile
     * @returns {Object|null} Active profile object or null
     */
    function getActiveProfile() {
        const activeId = getActiveProfileId();
        if (!activeId) return null;

        const profiles = getAllProfiles();
        return profiles.find(p => p.id === activeId) || null;
    }

    /**
     * Get a profile by ID
     * @param {string} profileId - Profile ID
     * @returns {Object|null} Profile object or null
     */
    function getProfileById(profileId) {
        const profiles = getAllProfiles();
        return profiles.find(p => p.id === profileId) || null;
    }

    /**
     * Create a new profile
     * @param {string} name - Profile name
     * @returns {Object} The created profile
     */
    function createProfile(name) {
        const profiles = getAllProfiles();

        const newProfile = {
            id: generateProfileId(),
            name: name || 'Neuer Benutzer',
            createdAt: new Date().toISOString(),
            qobuz: null  // Will be populated after Qobuz login
        };

        profiles.push(newProfile);
        saveAllProfiles(profiles);

        return newProfile;
    }

    /**
     * Update a profile
     * @param {string} profileId - Profile ID to update
     * @param {Object} updates - Object with properties to update
     * @returns {Object|null} Updated profile or null if not found
     */
    function updateProfile(profileId, updates) {
        const profiles = getAllProfiles();
        const index = profiles.findIndex(p => p.id === profileId);

        if (index === -1) return null;

        profiles[index] = { ...profiles[index], ...updates };
        saveAllProfiles(profiles);

        return profiles[index];
    }

    /**
     * Delete a profile
     * @param {string} profileId - Profile ID to delete
     * @returns {boolean} True if deleted, false if not found
     */
    function deleteProfile(profileId) {
        const profiles = getAllProfiles();
        const index = profiles.findIndex(p => p.id === profileId);

        if (index === -1) return false;

        profiles.splice(index, 1);
        saveAllProfiles(profiles);

        // If we deleted the active profile, clear the active selection
        if (getActiveProfileId() === profileId) {
            setActiveProfileId(null);
        }

        return true;
    }

    /**
     * Update Qobuz credentials for a profile
     * @param {string} profileId - Profile ID
     * @param {Object} qobuzData - Qobuz credentials {userId, authToken, displayName, avatar}
     * @returns {Object|null} Updated profile or null if not found
     */
    function updateQobuzCredentials(profileId, qobuzData) {
        return updateProfile(profileId, {
            qobuz: qobuzData ? {
                userId: qobuzData.userId,
                authToken: qobuzData.authToken,
                displayName: qobuzData.displayName || null,
                avatar: qobuzData.avatar || null
            } : null
        });
    }

    /**
     * Clear Qobuz credentials for a profile (logout)
     * @param {string} profileId - Profile ID
     * @returns {Object|null} Updated profile or null
     */
    function clearQobuzCredentials(profileId) {
        return updateProfile(profileId, { qobuz: null });
    }

    /**
     * Check if a profile has valid Qobuz credentials
     * @param {string} profileId - Profile ID
     * @returns {boolean} True if has valid credentials
     */
    function hasQobuzCredentials(profileId) {
        const profile = getProfileById(profileId);
        return profile?.qobuz?.userId && profile?.qobuz?.authToken;
    }

    /**
     * Get Qobuz credentials for a profile
     * @param {string} profileId - Profile ID
     * @returns {Object|null} Qobuz credentials or null
     */
    function getQobuzCredentials(profileId) {
        const profile = getProfileById(profileId);
        return profile?.qobuz || null;
    }

    /**
     * Migrate old localStorage data to the new profile system
     * This handles users who were logged in before the multi-user feature
     * @returns {Object|null} Migrated profile or null if no data to migrate
     */
    function migrateOldData() {
        // Check if we already have profiles (migration already done)
        const existingProfiles = getAllProfiles();
        if (existingProfiles.length > 0) {
            return null;
        }

        // Check for old Qobuz credentials
        const oldUserId = localStorage.getItem(OLD_STORAGE_USER_ID);
        const oldAuthToken = localStorage.getItem(OLD_STORAGE_AUTH_TOKEN);

        if (!oldUserId && !oldAuthToken) {
            // No old data to migrate
            return null;
        }

        // Create a profile with the migrated data
        const oldUserName = localStorage.getItem(OLD_STORAGE_USER_NAME);
        const oldAvatar = localStorage.getItem(OLD_STORAGE_USER_AVATAR);

        const migratedProfile = {
            id: generateProfileId(),
            name: oldUserName || 'Migriertes Profil',
            createdAt: new Date().toISOString(),
            qobuz: oldUserId && oldAuthToken ? {
                userId: parseInt(oldUserId, 10) || oldUserId,
                authToken: oldAuthToken,
                displayName: oldUserName || null,
                avatar: oldAvatar || null
            } : null
        };

        // Save the migrated profile
        saveAllProfiles([migratedProfile]);

        // Set it as the active profile
        setActiveProfileId(migratedProfile.id);

        // Clean up old localStorage keys
        localStorage.removeItem(OLD_STORAGE_USER_ID);
        localStorage.removeItem(OLD_STORAGE_AUTH_TOKEN);
        localStorage.removeItem(OLD_STORAGE_USER_NAME);
        localStorage.removeItem(OLD_STORAGE_USER_AVATAR);

        console.log('Migrated old Qobuz session to new profile system:', migratedProfile.name);

        return migratedProfile;
    }

    /**
     * Initialize the profile system
     * Performs migration if needed and ensures there's an active profile
     * @returns {Object} The active profile (created if none exists)
     */
    function initialize() {
        // Try to migrate old data first
        migrateOldData();

        // Return the active profile if one exists
        const activeProfile = getActiveProfile();
        if (activeProfile) {
            return activeProfile;
        }

        // If there are profiles but none is active, use the first one
        const profiles = getAllProfiles();
        if (profiles.length > 0) {
            setActiveProfileId(profiles[0].id);
            return profiles[0];
        }

        // No profiles exist - return null (user will create one on homepage)
        return null;
    }

    /**
     * Get the initial letter(s) for a profile avatar
     * @param {string} name - Profile name
     * @returns {string} Initial letter(s)
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
     * Generate a color based on profile name/id for consistent avatar colors
     * @param {string} profileId - Profile ID
     * @returns {string} HSL color string
     */
    function getProfileColor(profileId) {
        // Generate a consistent hue based on the profile ID
        let hash = 0;
        for (let i = 0; i < profileId.length; i++) {
            hash = profileId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 60%, 45%)`;
    }

    // Public API
    return {
        getAllProfiles,
        getActiveProfileId,
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
        migrateOldData,
        initialize,
        getProfileInitial,
        getProfileColor
    };
})();

// Export for ES modules if supported
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserProfileManager;
}
