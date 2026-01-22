(function() {
    'use strict';

    // DOM elements - will be re-fetched in initTuneIn for SPA compatibility
    let loadingOverlay = null;
    let noPlayerSection = null;
    let browseSection = null;
    let categoryGrid = null;
    let itemsList = null;
    let sectionsContainer = null;
    let emptyState = null;
    let breadcrumbBack = null;
    let breadcrumbPath = null;
    let errorMessage = null;
    let errorText = null;

    // Navigation state
    let navigationStack = []; // Stack of { uri, title } for breadcrumb
    let currentItems = []; // Current browse items
    let currentSections = []; // Current sections (for sub-pages)

    // Playback state
    let isPlaying = false;
    let bluesoundStatusInterval = null;

    // Function to refresh DOM element references (needed after SPA navigation)
    function refreshDOMElements() {
        loadingOverlay = document.getElementById('loading-overlay');
        noPlayerSection = document.getElementById('no-player-section');
        browseSection = document.getElementById('browse-section');
        categoryGrid = document.getElementById('category-grid');
        itemsList = document.getElementById('items-list');
        sectionsContainer = document.getElementById('sections-container');
        emptyState = document.getElementById('empty-state');
        breadcrumbBack = document.getElementById('breadcrumb-back');
        breadcrumbPath = document.getElementById('breadcrumb-path');
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

    // Initialize TuneIn page
    async function initTuneIn() {
        console.log('initTuneIn: Starting initialization');

        // Refresh DOM element references (needed after SPA navigation)
        refreshDOMElements();

        // Initialize profile manager
        if (typeof UserProfileManager !== 'undefined') {
            console.log('initTuneIn: Initializing UserProfileManager');
            await UserProfileManager.initialize();
            await updateProfileDisplayTuneIn();
        }

        // Register playback callbacks with GlobalPlayer
        if (window.GlobalPlayer) {
            window.GlobalPlayer.registerPlaybackCallbacks({
                togglePlayPause: togglePlayPause,
                playPrevious: () => {}, // TuneIn doesn't have previous/next
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
            await loadMainMenu();
        }

        // Check current playback status
        await checkCurrentPlayback();
    }

    // Make initTuneIn available globally for SPA router
    window.initTuneIn = initTuneIn;

    // Update profile display in header and menu
    async function updateProfileDisplayTuneIn() {
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
        if (browseSection) browseSection.style.display = 'none';
    }

    // Show browse state
    function showBrowseState() {
        if (noPlayerSection) noPlayerSection.style.display = 'none';
        if (browseSection) browseSection.style.display = 'block';
    }

    // Handle player change
    async function handlePlayerChange(previousType, newType, newPlayer, previousPlayer) {
        console.log('TuneIn: Player changed from', previousType, 'to', newType);

        // Stop any existing status polling
        stopBluesoundStatusPolling();

        if (newType === 'bluesound' && newPlayer?.ip) {
            // New Bluesound player selected - reload main menu
            await loadMainMenu();
        } else {
            // No Bluesound player - show no player state
            showNoPlayerState();
        }
    }

    // Load main menu (categories)
    async function loadMainMenu() {
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) {
            showNoPlayerState();
            return;
        }

        showLoading();
        showBrowseState();

        // Reset navigation
        navigationStack = [];
        updateBreadcrumb();

        try {
            const response = await fetch(`/TuneIn?handler=Menu&playerIp=${encodeURIComponent(selectedPlayer.ip)}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success) {
                currentItems = data.items || [];
                renderCategories(currentItems);
            } else {
                showError(data.error || 'TuneIn-Menu konnte nicht geladen werden');
                renderCategories([]);
            }
        } catch (error) {
            console.error('Failed to load TuneIn menu:', error);
            showError('TuneIn-Menu konnte nicht geladen werden');
            renderCategories([]);
        }

        hideLoading();
    }

    // Browse a category or subcategory
    async function browseCategory(uri, title) {
        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) {
            showNoPlayerState();
            return;
        }

        showLoading();

        // Add current state to navigation stack before navigating
        navigationStack.push({ uri, title });
        updateBreadcrumb();

        try {
            const response = await fetch(`/TuneIn?handler=Browse&playerIp=${encodeURIComponent(selectedPlayer.ip)}&port=${selectedPlayer.port || 11000}&uri=${encodeURIComponent(uri)}`);
            const data = await response.json();

            if (data.success) {
                currentItems = data.items || [];
                currentSections = data.sections || [];

                // Use sections rendering if we have multiple sections or sections with titles
                if (data.hasMultipleSections && currentSections.length > 0) {
                    renderSections(currentSections);
                } else {
                    renderItems(currentItems);
                }
            } else {
                showError(data.error || 'Kategorie konnte nicht geladen werden');
                renderItems([]);
            }
        } catch (error) {
            console.error('Failed to browse TuneIn:', error);
            showError('Kategorie konnte nicht geladen werden');
            renderItems([]);
        }

        hideLoading();
    }

    // Navigate back
    function navigateBack() {
        if (navigationStack.length === 0) return;

        // Remove current level
        navigationStack.pop();

        if (navigationStack.length === 0) {
            // Back to main menu
            loadMainMenu();
        } else {
            // Go to previous level
            const previous = navigationStack[navigationStack.length - 1];
            // Pop it because browseCategory will push it again
            navigationStack.pop();
            browseCategory(previous.uri, previous.title);
        }
    }

    // Update breadcrumb display
    function updateBreadcrumb() {
        if (!breadcrumbPath || !breadcrumbBack) return;

        const showBack = navigationStack.length > 0;
        breadcrumbBack.style.display = showBack ? 'flex' : 'none';

        // Build breadcrumb path
        let html = '<span class="breadcrumb-item' + (navigationStack.length === 0 ? ' active' : '') + '" onclick="loadMainMenu()">TuneIn</span>';

        navigationStack.forEach((item, index) => {
            const isLast = index === navigationStack.length - 1;
            html += '<span class="breadcrumb-separator">/</span>';
            html += `<span class="breadcrumb-item${isLast ? ' active' : ''}" ${!isLast ? `onclick="navigateToLevel(${index})"` : ''}>${escapeHtml(item.title)}</span>`;
        });

        breadcrumbPath.innerHTML = html;
    }

    // Navigate to a specific breadcrumb level
    function navigateToLevel(level) {
        // Remove all levels after the target
        while (navigationStack.length > level + 1) {
            navigationStack.pop();
        }

        const target = navigationStack[level];
        // Pop it because browseCategory will push it again
        navigationStack.pop();
        browseCategory(target.uri, target.title);
    }

    // Render main menu categories as cards
    function renderCategories(items) {
        if (!categoryGrid || !itemsList || !emptyState) return;

        // Hide sections container when showing category grid
        if (sectionsContainer) sectionsContainer.style.display = 'none';

        if (!items || items.length === 0) {
            categoryGrid.innerHTML = '';
            categoryGrid.style.display = 'none';
            itemsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        itemsList.style.display = 'none';
        categoryGrid.style.display = 'grid';

        categoryGrid.innerHTML = items.map((item, index) => `
            <div class="category-card" onclick="handleItemClick(${index})">
                <div class="category-icon">
                    ${item.imageUrl
                        ? `<img src="${item.imageUrl}" alt="" loading="lazy">`
                        : getCategoryIcon(item.title)}
                </div>
                <div class="category-info">
                    <h3 class="category-title">${escapeHtml(item.title)}</h3>
                    ${item.subtitle ? `<p class="category-subtitle">${escapeHtml(item.subtitle)}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Render browse items (stations and subcategories) - flat list view
    function renderItems(items) {
        if (!categoryGrid || !itemsList || !emptyState) return;

        // Hide sections container if visible
        if (sectionsContainer) sectionsContainer.style.display = 'none';

        if (!items || items.length === 0) {
            categoryGrid.style.display = 'none';
            itemsList.innerHTML = '';
            itemsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        categoryGrid.style.display = 'none';
        itemsList.style.display = 'block';

        itemsList.innerHTML = items.map((item, index) => renderItemRow(item, index)).join('');
    }

    // Render sections with headers and view-all buttons
    function renderSections(sections) {
        if (!categoryGrid || !emptyState) return;

        // Hide other containers
        categoryGrid.style.display = 'none';
        if (itemsList) itemsList.style.display = 'none';

        if (!sections || sections.length === 0) {
            if (sectionsContainer) sectionsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Use sections container if available, otherwise fall back to itemsList
        const container = sectionsContainer || itemsList;
        if (!container) return;

        container.style.display = 'block';

        // Build global items array for click handling
        currentItems = [];
        let globalIndex = 0;

        let html = '';

        sections.forEach((section, sectionIndex) => {
            const sectionItems = Array.isArray(section.items) ? section.items : [];

            // Check if this looks like a podcast detail page (first section with single item that has large image)
            const isPodcastHero = sectionIndex === 0 &&
                sectionItems.length === 1 &&
                sectionItems[0].imageUrl &&
                !section.title;

            if (isPodcastHero) {
                // Render podcast hero
                const item = sectionItems[0];
                const itemIndex = globalIndex++;
                currentItems.push(item);

                html += `
                    <div class="podcast-hero">
                        <div class="podcast-hero-image">
                            ${item.imageUrl
                                ? `<img src="${item.imageUrl}" alt="" loading="lazy">`
                                : getPodcastIcon()}
                        </div>
                        <div class="podcast-hero-info">
                            <h2 class="podcast-hero-title">${escapeHtml(item.title)}</h2>
                            ${item.subtitle ? `<p class="podcast-hero-meta">${escapeHtml(item.subtitle)}</p>` : ''}
                            ${item.isPlayable ? `
                                <button type="button" class="btn-play-latest" onclick="playStation(${itemIndex})">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                    <span>Neueste abspielen</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                // Render regular section
                html += `<div class="tunein-section">`;

                // Section header (if section has a title)
                if (section.title) {
                    html += `
                        <div class="section-header">
                            <h3 class="section-title">${escapeHtml(section.title)}</h3>
                            ${section.viewAllUri ? `
                                <button type="button" class="btn-view-all" onclick="browseCategory('${escapeHtml(section.viewAllUri)}', '${escapeHtml(section.title)}')">
                                    Alle anzeigen
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 18l6-6-6-6"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }

                // Section items
                html += `<div class="section-items">`;
                sectionItems.forEach(item => {
                    const itemIndex = globalIndex++;
                    currentItems.push(item);
                    html += renderItemRow(item, itemIndex);
                });
                html += `</div></div>`;
            }
        });

        container.innerHTML = html;
    }

    // Render a single item row (shared between renderItems and renderSections)
    function renderItemRow(item, index) {
        const isPlayable = item.isPlayable || item.actionType === 'player-link';

        return `
            <div class="item-row ${isPlayable ? 'station' : 'subcategory'}" onclick="handleItemClick(${index})">
                <div class="item-image">
                    ${item.imageUrl
                        ? `<img src="${item.imageUrl}" alt="" loading="lazy">`
                        : (isPlayable ? getStationIcon() : getFolderIcon())}
                </div>
                <div class="item-info">
                    <h4 class="item-title">${escapeHtml(item.title)}</h4>
                    ${item.subtitle ? `<p class="item-subtitle">${escapeHtml(item.subtitle)}</p>` : ''}
                </div>
                <div class="item-action">
                    ${isPlayable
                        ? `<button type="button" class="btn-play-station" onclick="event.stopPropagation(); playStation(${index})">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                           </button>`
                        : `<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                           </svg>`}
                </div>
            </div>
        `;
    }

    // Get podcast icon SVG
    function getPodcastIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    }

    // Handle item click
    function handleItemClick(index) {
        const item = currentItems[index];
        if (!item) return;

        // Check actionType first, then fallback to isPlayable/isBrowsable
        if (item.actionType === 'player-link' || item.isPlayable) {
            playStation(index);
        } else if ((item.actionType === 'browse' || item.isBrowsable) && item.actionUri) {
            browseCategory(item.actionUri, item.title);
        }
    }

    // Play a station
    async function playStation(index) {
        const item = currentItems[index];
        // For player-link actions, the URI contains the play URL
        const playUrl = item?.actionUrl || item?.actionUri;
        if (!item || !playUrl) {
            showError('Station kann nicht abgespielt werden');
            return;
        }

        const selectedPlayer = getSelectedPlayer();
        if (!selectedPlayer?.ip) {
            showError('Kein Bluesound Player ausgewahlt');
            return;
        }

        showLoading();

        try {
            const response = await fetch('/TuneIn?handler=PlayStation', {
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
                saveToHistory(item.title, item.imageUrl, playUrl);
            } else {
                showError(data.error || 'Station konnte nicht abgespielt werden');
            }
        } catch (error) {
            console.error('Failed to play station:', error);
            showError('Station konnte nicht abgespielt werden');
        }

        hideLoading();
    }

    // Save station to listening history
    async function saveToHistory(title, imageUrl, actionUrl) {
        try {
            await fetch('/TuneIn?handler=SaveHistory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: JSON.stringify({
                    title: title,
                    imageUrl: imageUrl,
                    actionUrl: actionUrl
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
                artist: 'TuneIn Radio',
                artistName: 'TuneIn Radio',
                album: item.subtitle || '',
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
            const response = await fetch('/TuneIn?handler=BluesoundControl', {
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
                const response = await fetch(`/TuneIn?handler=BluesoundStatus&ip=${player.ip}&port=${player.port || 11000}`);
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
                artist: status.artist || 'TuneIn Radio',
                artistName: status.artist || 'TuneIn Radio',
                album: status.album || '',
                imageUrl: status.imageUrl,
                albumCover: status.imageUrl,
                isLive: !status.totalSeconds || status.totalSeconds <= 0
            });

            if (showBar && (isPlaying || status.state === 'pause')) {
                window.GlobalPlayer.showBar();
            }
        }

        // Update progress if available (some streams have duration)
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
            const response = await fetch(`/TuneIn?handler=BluesoundStatus&ip=${selectedPlayer.ip}&port=${selectedPlayer.port || 11000}`);
            const data = await response.json();

            if (data.success && data.status) {
                // Check if TuneIn is playing
                if (data.status.service === 'TuneIn') {
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

    // Get category icon SVG based on title
    function getCategoryIcon(title) {
        const lowerTitle = (title || '').toLowerCase();

        if (lowerTitle.includes('local') || lowerTitle.includes('lokal')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
        }
        if (lowerTitle.includes('music') || lowerTitle.includes('musik')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
        }
        if (lowerTitle.includes('sport')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20 10 10 0 0 0 0-20"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
        }
        if (lowerTitle.includes('news') || lowerTitle.includes('nachrichten') || lowerTitle.includes('talk')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
        }
        if (lowerTitle.includes('podcast')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
        }
        if (lowerTitle.includes('trending') || lowerTitle.includes('popular') || lowerTitle.includes('beliebt')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
        }
        if (lowerTitle.includes('location') || lowerTitle.includes('standort') || lowerTitle.includes('language') || lowerTitle.includes('sprache')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
        }
        if (lowerTitle.includes('favorit') || lowerTitle.includes('favorite') || lowerTitle.includes('for you')) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        }

        // Default radio icon
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 0 1 8 0"/><path d="M6 12a6 6 0 0 1 12 0"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
    }

    // Get station icon SVG
    function getStationIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
    }

    // Get folder icon SVG
    function getFolderIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    }

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize on page load
    console.log('TuneIn script loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('TuneIn: Adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', initTuneIn);
    } else {
        console.log('TuneIn: Calling initTuneIn immediately');
        initTuneIn();
    }

    // Expose functions globally for onclick handlers
    window.loadMainMenu = loadMainMenu;
    window.browseCategory = browseCategory;
    window.navigateBack = navigateBack;
    window.navigateToLevel = navigateToLevel;
    window.handleItemClick = handleItemClick;
    window.playStation = playStation;
})();
