/**
 * Hamburger Menu and Profile Switcher functionality
 * Shared across all pages with the hamburger menu
 */

// Menu state
let menuOpen = false;
let profileSwitcherOpen = false;

/**
 * Toggle the hamburger menu
 */
function toggleMenu() {
    if (menuOpen) {
        closeMenu();
    } else {
        openMenu();
    }
}

/**
 * Open the hamburger menu
 */
function openMenu() {
    const overlay = document.getElementById('menu-overlay');
    const panel = document.getElementById('menu-panel');

    if (overlay && panel) {
        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
        menuOpen = true;
    }
}

/**
 * Close the hamburger menu
 */
function closeMenu() {
    const overlay = document.getElementById('menu-overlay');
    const panel = document.getElementById('menu-panel');

    if (overlay && panel) {
        overlay.classList.remove('active');
        panel.classList.remove('active');
        document.body.style.overflow = '';
        menuOpen = false;
    }
}

/**
 * Show the profile switcher modal
 */
async function showProfileSwitcher() {
    closeMenu();

    const overlay = document.getElementById('profile-switcher-overlay');
    if (overlay) {
        await renderProfileList();
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        profileSwitcherOpen = true;
    }
}

/**
 * Close the profile switcher modal
 * @param {Event} event - Optional click event
 */
function closeProfileSwitcher(event) {
    if (event && event.target !== event.currentTarget) return;

    const overlay = document.getElementById('profile-switcher-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        profileSwitcherOpen = false;
    }
}

/**
 * Render the list of profiles in the profile switcher
 */
async function renderProfileList() {
    if (typeof UserProfileManager === 'undefined') return;

    const list = document.getElementById('profile-switcher-list');
    if (!list) return;

    // Show loading state
    list.innerHTML = '<div class="no-profiles">Laden...</div>';

    const profiles = await UserProfileManager.getAllProfiles();
    const activeProfileId = await UserProfileManager.getActiveProfileId();

    if (profiles.length === 0) {
        list.innerHTML = '<div class="no-profiles">Keine Profile vorhanden</div>';
        return;
    }

    list.innerHTML = profiles.map(profile => {
        const initial = UserProfileManager.getProfileInitial(profile.name);
        const color = UserProfileManager.getProfileColor(profile.id);
        const isActive = profile.id === activeProfileId;
        const hasQobuz = profile.qobuz && profile.qobuz.userId;

        return `
            <div class="profile-option ${isActive ? 'active' : ''}" onclick="switchToProfile('${profile.id}')">
                <div class="profile-option-avatar" style="background: ${color}">${initial}</div>
                <div class="profile-option-info">
                    <span class="profile-option-name">${escapeHtml(profile.name)}</span>
                    ${hasQobuz ? '<span class="profile-option-status">Qobuz verbunden</span>' : '<span class="profile-option-status">Nicht eingeloggt</span>'}
                </div>
                ${isActive ? '<svg class="profile-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
                <button type="button" class="profile-delete-btn" onclick="confirmDeleteProfile(event, '${profile.id}')" title="Profil löschen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Switch to a different profile
 * @param {string} profileId - The profile ID to switch to
 */
async function switchToProfile(profileId) {
    if (typeof UserProfileManager === 'undefined') return;

    const profile = await UserProfileManager.getProfileById(profileId);
    if (!profile) return;

    await UserProfileManager.setActiveProfileId(profileId);

    // Update UI displays
    await updateProfileDisplay();

    // Close the profile switcher
    closeProfileSwitcher();

    // Reload global player settings for the new profile
    if (typeof GlobalPlayer !== 'undefined' && GlobalPlayer.reloadSettings) {
        await GlobalPlayer.reloadSettings();
    }

    // Use SPA navigation to reload the current page content
    // This preserves audio playback while updating the profile context
    if (typeof navigateTo === 'function') {
        navigateTo(window.location.pathname, false);
    } else {
        // Fallback to full page reload
        window.location.reload();
    }
}

/**
 * Create a new profile
 */
async function createNewProfile() {
    const name = prompt('Name für das neue Profil:');
    if (!name || !name.trim()) return;

    if (typeof UserProfileManager === 'undefined') return;

    const newProfile = await UserProfileManager.createProfile(name.trim());
    if (!newProfile) return;

    // Set as active and switch to it
    await UserProfileManager.setActiveProfileId(newProfile.id);

    closeProfileSwitcher();

    // Redirect to home to let user configure the profile
    // Use SPA navigation to preserve audio playback
    if (typeof navigateTo === 'function') {
        navigateTo('/');
    } else {
        window.location.href = '/';
    }
}

/**
 * Confirm and delete a profile
 * @param {Event} event - Click event
 * @param {string} profileId - Profile ID to delete
 */
async function confirmDeleteProfile(event, profileId) {
    event.stopPropagation();

    if (typeof UserProfileManager === 'undefined') return;

    const profiles = await UserProfileManager.getAllProfiles();
    if (profiles.length <= 1) {
        alert('Du kannst das letzte Profil nicht löschen.');
        return;
    }

    const profile = await UserProfileManager.getProfileById(profileId);
    if (!profile) return;

    if (confirm(`Möchtest du das Profil "${profile.name}" wirklich löschen?`)) {
        const currentActiveId = await UserProfileManager.getActiveProfileId();
        const wasActive = currentActiveId === profileId;

        await UserProfileManager.deleteProfile(profileId);

        if (wasActive) {
            // Switch to the first available profile
            const remainingProfiles = await UserProfileManager.getAllProfiles();
            if (remainingProfiles.length > 0) {
                await UserProfileManager.setActiveProfileId(remainingProfiles[0].id);
            }
        }

        // Refresh the profile list
        await renderProfileList();
        await updateProfileDisplay();

        if (wasActive) {
            window.location.reload();
        }
    }
}

/**
 * Update profile display in header and menu
 */
async function updateProfileDisplay() {
    if (typeof UserProfileManager === 'undefined') return;

    const activeProfile = await UserProfileManager.getActiveProfile();
    if (!activeProfile) return;

    const initial = UserProfileManager.getProfileInitial(activeProfile.name);
    const color = UserProfileManager.getProfileColor(activeProfile.id);

    // Update header indicator
    const headerInitial = document.getElementById('header-profile-initial');
    if (headerInitial) {
        headerInitial.textContent = initial;
        headerInitial.parentElement.style.background = color;
    }

    // Update menu profile display
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

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close menu on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (profileSwitcherOpen) {
            closeProfileSwitcher();
        } else if (menuOpen) {
            closeMenu();
        }
    }
});

// Close menu on SPA navigation
document.addEventListener('spa:pageload', function() {
    closeMenu();
    closeProfileSwitcher();
    // Re-initialize profile display after navigation
    if (typeof UserProfileManager !== 'undefined') {
        updateProfileDisplay();
    }
});

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize UserProfileManager if available
    if (typeof UserProfileManager !== 'undefined') {
        await UserProfileManager.initialize();
        await updateProfileDisplay();
    }
});
