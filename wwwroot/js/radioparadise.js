(function() {
    'use strict';

    // DOM elements - will be re-fetched in initRadioParadise for SPA compatibility
    let loadingOverlay = null;
    let noPlayerSection = null;
    let channelsSection = null;
    let sectionsContainer = null;
    let emptyState = null;
    let errorMessage = null;
    let errorText = null;

    // State
    let currentItems = []; // All items flat for click handling
    let currentSections = []; // Current sections (MQA, CD Quality)
    let isPlaying = false;
    let bluesoundStatusInterval = null;

    // Function to refresh DOM element references (needed after SPA navigation)
    function refreshDOMElements() {
        loadingOverlay = document.getElementById('loading-overlay');
        noPlayerSection = document.getElementById('no-player-section');
        channelsSection = document.getElementById('channels-section');
        sectionsContainer = document.getElementById('sections-container');
        emptyState = document.getElementById('empty-state');
        errorMessage = document.getElementById('error-message');
        errorText = document.getElementById('error-text');
    }

    // Helper to get selected player from GlobalPlayer
    function getSelectedPlayer() {
        return window.GlobalPlayer?.getSelectedPlayer() || null;
    }

    // Show/hide loading
    function showLoading() {
        if (loadingOverlay) loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }

    // Show error message
    function showError(message) {
        if (errorText) errorText.textContent = message;
        if (errorMessage) {
            errorMessage.style.display = 'flex';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Initialize Radio Paradise page
    async function initRadioParadise() {
        console.log('initRadioParadise: Starting initialization');

        // Refresh DOM element references (needed after SPA navigation)
        refreshDOMElements();

        // Initialize profile manager
        if (typeof UserProfileManager !== 'undefined') {
            console.log('initRadioParadise: Initializing UserProfileManager');
            await UserProfileManager.initialize();
            await updateProfileDisplayRadioParadise();
        }

        // Register playback callbacks with GlobalPlayer
        if (window.GlobalPlayer) {
            window.GlobalPlayer.registerPlaybackCallbacks({
                togglePlayPause: togglePlayPause,
                playPrevious: () => {}, // Radio Paradise doesn't have previous/next
                playNext: () => {},
                seek: () => {},
                onPlayerChange: handlePlayerChange
            });
        }

        // Check if a Bluesound player is selected
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer || selectedPlayer.type !== 'bluesound' || !selectedPlayer.ip) {
            showNoPlayerState();
        } else {
            await loadChannels();
        }

        // Check current playback status
        await checkCurrentPlayback();
    }

    // Make initRadioParadise available globally for SPA router
    window.initRadioParadise = initRadioParadise;

    // Update profile display in header and menu
    async function updateProfileDisplayRadioParadise() {
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

    // Show no player state
    function showNoPlayerState() {
        if (noPlayerSection) noPlayerSection.style.display = 'flex';
        if (channelsSection) channelsSection.style.display = 'none';
    }

    // Show channels state
    function showChannelsState() {
        if (noPlayerSection) noPlayerSection.style.display = 'none';
        if (channelsSection) channelsSection.style.display = 'block';
    }

    // Handle player change
    async function handlePlayerChange(previousType, newType, newPlayer, previousPlayer) {
        console.log('Radio Paradise: Player changed from', previousType, 'to', newType);

        // Stop any existing status polling
        stopBluesoundStatusPolling();

        if (newType === 'bluesound' && newPlayer?.ip) {
            // New Bluesound player selected - reload channels
            await loadChannels();
        } else {
            // No Bluesound player - show no player state
            showNoPlayerState();
        }
    }

    // Load Radio Paradise channels
    async function loadChannels() {
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) {
            showNoPlayerState();
            return;
        }

        showLoading();
        showChannelsState();

        try {
            const response = await fetch(`/RadioParadise?handler=Menu&playerIp=${encodeURIComponent(selectedPlayer.ip)}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success) {
                currentSections = data.sections || [];
                renderSections(currentSections);
            } else {
                showError(data.error || 'Radio Paradise konnte nicht geladen werden');
                renderSections([]);
            }
        } catch (error) {
            console.error('Failed to load Radio Paradise menu:', error);
            showError('Radio Paradise konnte nicht geladen werden');
            renderSections([]);
        }

        hideLoading();
    }

    // Render sections (MQA, CD Quality)
    function renderSections(sections) {
        if (!sectionsContainer || !emptyState) return;

        if (!sections || sections.length === 0) {
            sectionsContainer.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Build global items array for click handling
        currentItems = [];
        let globalIndex = 0;

        let html = '';

        sections.forEach((section) => {
            const sectionItems = Array.isArray(section.items) ? section.items : [];

            html += `<div class="rp-section">`;

            // Section header
            if (section.title) {
                const qualityBadge = getQualityBadge(section.title);
                html += `
                    <div class="section-header">
                        <h3 class="section-title">${escapeHtml(section.title)}</h3>
                        ${qualityBadge}
                    </div>
                `;
            }

            // Section items (channels)
            html += `<div class="channel-grid">`;
            sectionItems.forEach(item => {
                const itemIndex = globalIndex++;
                currentItems.push(item);
                html += renderChannelCard(item, itemIndex);
            });
            html += `</div></div>`;
        });

        sectionsContainer.innerHTML = html;
    }

    // Get quality badge HTML based on section title
    function getQualityBadge(title) {
        if (title && title.toLowerCase().includes('mqa')) {
            return '<span class="quality-badge mqa">MQA</span>';
        } else if (title && (title.toLowerCase().includes('cd') || title.toLowerCase().includes('flac'))) {
            return '<span class="quality-badge cd">FLAC</span>';
        }
        return '';
    }

    // Render a single channel card
    function renderChannelCard(item, index) {
        const channelIcon = getChannelIcon(item.title);

        return `
            <div class="channel-card" onclick="handleChannelClick(${index})">
                <div class="channel-image">
                    ${item.imageUrl
                        ? `<img src="${item.imageUrl}" alt="" loading="lazy">`
                        : channelIcon}
                </div>
                <div class="channel-info">
                    <h4 class="channel-title">${escapeHtml(item.title)}</h4>
                    ${item.subtitle ? `<p class="channel-subtitle">${escapeHtml(item.subtitle)}</p>` : ''}
                </div>
                <button type="button" class="btn-play-channel" onclick="event.stopPropagation(); playChannel(${index})">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // Get channel icon based on name
    function getChannelIcon(title) {
        const lowerTitle = (title || '').toLowerCase();

        if (lowerTitle.includes('main')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
        }
        if (lowerTitle.includes('mellow')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        }
        if (lowerTitle.includes('rock')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
        }
        if (lowerTitle.includes('global')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
        }

        // Default music icon
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    }

    // Handle channel click
    function handleChannelClick(index) {
        playChannel(index);
    }

    // Play a channel
    async function playChannel(index) {
        const item = currentItems[index];
        const playUrl = item?.actionUrl || item?.actionUri;
        if (!item || !playUrl) {
            showError('Kanal kann nicht abgespielt werden');
            return;
        }

        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) {
            showError('Kein Bluesound Player ausgewahlt');
            return;
        }

        showLoading();

        try {
            const response = await fetch('/RadioParadise?handler=PlayStation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: selectedPlayer.ip,
                    port: selectedPlayer.port || 11000,
                    playUrl: playUrl,
                    title: item.title,
                    imageUrl: item.imageUrl
                })
            });

            const data = await response.json();

            if (data.success) {
                isPlaying = true;
                updateNowPlaying(item);
                startBluesoundStatusPolling();

                // Save to listening history
                saveToHistory(item.title, item.imageUrl, playUrl, item.subtitle);
            } else {
                showError(data.error || 'Kanal konnte nicht abgespielt werden');
            }
        } catch (error) {
            console.error('Failed to play channel:', error);
            showError('Kanal konnte nicht abgespielt werden');
        }

        hideLoading();
    }

    // Save channel to listening history (per user profile)
    async function saveToHistory(title, imageUrl, actionUrl, quality) {
        try {
            const profileId = await SettingsApi.getActiveProfileId();
            if (!profileId) {
                console.warn('No active profile, cannot save to history');
                return;
            }

            await fetch('/RadioParadise?handler=SaveHistory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    profileId: profileId,
                    title: title,
                    imageUrl: imageUrl,
                    actionUrl: actionUrl,
                    quality: quality
                })
            });
        } catch (error) {
            console.error('Failed to save to history:', error);
        }
    }

    // Update now playing bar
    function updateNowPlaying(item) {
        if (window.GlobalPlayer) {
            window.GlobalPlayer.setCurrentTrack({
                title: item.title,
                artist: 'Radio Paradise',
                artistName: 'Radio Paradise',
                album: item.subtitle || 'Eclectic Mix',
                imageUrl: item.imageUrl,
                albumCover: item.imageUrl,
                isLive: true
            });
            window.GlobalPlayer.setPlaying(true);
        }
    }

    // Toggle play/pause
    async function togglePlayPause() {
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) return;

        const action = isPlaying ? 'pause' : 'play';

        try {
            const response = await fetch('/RadioParadise?handler=BluesoundControl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    ip: selectedPlayer.ip,
                    port: selectedPlayer.port || 11000,
                    action: action
                })
            });

            const data = await response.json();
            if (data.success) {
                isPlaying = !isPlaying;
                if (window.GlobalPlayer) {
                    window.GlobalPlayer.setPlaying(isPlaying);
                }

                if (isPlaying) {
                    startBluesoundStatusPolling();
                } else {
                    stopBluesoundStatusPolling();
                }
            }
        } catch (error) {
            console.error('Failed to toggle playback:', error);
        }
    }

    // Start polling Bluesound status
    function startBluesoundStatusPolling() {
        stopBluesoundStatusPolling();

        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) return;

        // Poll every 5 seconds
        bluesoundStatusInterval = setInterval(async () => {
            const player = getSelectedPlayer();
            if (!player?.ip) {
                stopBluesoundStatusPolling();
                return;
            }

            try {
                const response = await fetch(`/RadioParadise?handler=BluesoundStatus&ip=${player.ip}&port=${player.port || 11000}`);
                const data = await response.json();

                if (data.success && data.status) {
                    updateBluesoundStatus(data.status);
                }
            } catch (error) {
                console.error('Failed to get Bluesound status:', error);
            }
        }, 5000);
    }

    // Stop polling
    function stopBluesoundStatusPolling() {
        if (bluesoundStatusInterval) {
            clearInterval(bluesoundStatusInterval);
            bluesoundStatusInterval = null;
        }
    }

    // Update UI based on Bluesound status
    function updateBluesoundStatus(status, showBar = false) {
        const wasPlaying = isPlaying;
        isPlaying = status.state === 'play' || status.state === 'stream';

        if (wasPlaying !== isPlaying && window.GlobalPlayer) {
            window.GlobalPlayer.setPlaying(isPlaying);
        }

        // Update track info in GlobalPlayer
        if (status.title && window.GlobalPlayer) {
            window.GlobalPlayer.setCurrentTrack({
                title: status.title,
                artist: status.artist || 'Radio Paradise',
                artistName: status.artist || 'Radio Paradise',
                album: status.album || 'Eclectic Mix',
                imageUrl: status.imageUrl,
                albumCover: status.imageUrl,
                isLive: !status.totalSeconds || status.totalSeconds <= 0
            });

            if (showBar && (isPlaying || status.state === 'pause')) {
                window.GlobalPlayer.showBar();
            }
        }

        // Update progress if available
        if (status.currentSeconds !== undefined && status.totalSeconds > 0) {
            if (window.GlobalPlayer) {
                window.GlobalPlayer.updateProgress(status.currentSeconds, status.totalSeconds);
            }
        }
    }

    // Check current playback on page load
    async function checkCurrentPlayback() {
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) return;

        try {
            const response = await fetch(`/RadioParadise?handler=BluesoundStatus&ip=${selectedPlayer.ip}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status) {
                // Check if Radio Paradise is playing
                if (data.status.service === 'RadioParadise') {
                    updateBluesoundStatus(data.status, true);
                    if (data.status.state === 'play' || data.status.state === 'stream') {
                        startBluesoundStatusPolling();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check current playback:', error);
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize on page load
    console.log('Radio Paradise script loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('Radio Paradise: Adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', initRadioParadise);
    } else {
        console.log('Radio Paradise: Calling initRadioParadise immediately');
        initRadioParadise();
    }

    // Expose functions globally for onclick handlers
    window.loadChannels = loadChannels;
    window.handleChannelClick = handleChannelClick;
    window.playChannel = playChannel;
})();
