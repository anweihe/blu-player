/**
 * Volume Panel Component
 * Simple volume control for the currently selected player
 */

class VolumePanel {
    constructor() {
        this.isVisible = false;
        this.speakers = [];
        this.selectedPlayerIp = null;
        this.selectedPlayerPort = null;
        this.browserVolume = parseInt(localStorage.getItem('browserVolume')) || 100;
        this.isDragging = false;
        this.activeSlider = null;
        this.isBrowserMode = false;

        this.init();
    }

    init() {
        this.createPanelHTML();
        this.bindEvents();
        // Apply stored browser volume
        this.applyBrowserVolume(this.browserVolume);
    }

    createPanelHTML() {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'volume-panel-backdrop';
        backdrop.id = 'volume-panel-backdrop';
        document.body.appendChild(backdrop);

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'volume-panel';
        panel.id = 'volume-panel';
        panel.innerHTML = `
            <div class="volume-panel-handle"></div>
            <div class="volume-panel-header">
                <div class="volume-panel-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                    <h3>Lautstärke</h3>
                </div>
                <button type="button" class="btn-close-panel" id="btn-close-volume-panel" title="Schließen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="volume-speaker-list" id="volume-speaker-list">
                <!-- Content will be rendered here -->
            </div>
        `;
        document.body.appendChild(panel);

        this.backdrop = backdrop;
        this.panel = panel;
        this.speakerList = panel.querySelector('#volume-speaker-list');
    }

    bindEvents() {
        // Close button
        this.panel.querySelector('#btn-close-volume-panel').addEventListener('click', () => this.hide());

        // Backdrop click
        this.backdrop.addEventListener('click', () => this.hide());

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Global mouse events for slider dragging
        document.addEventListener('mousemove', (e) => this.handleSliderDrag(e));
        document.addEventListener('mouseup', () => this.handleSliderDragEnd());
        document.addEventListener('touchmove', (e) => this.handleSliderDrag(e), { passive: false });
        document.addEventListener('touchend', () => this.handleSliderDragEnd());
    }

    show(playerIp, playerPort, groupData) {
        this.selectedPlayerIp = playerIp;
        this.selectedPlayerPort = playerPort;
        this.isBrowserMode = (playerIp === 'browser' || !playerIp);

        if (this.isBrowserMode) {
            this.renderBrowserOnly();
        } else {
            this.speakers = this.parseSpeakers(groupData);
            this.renderSpeakers();
        }

        this.isVisible = true;
        this.backdrop.classList.add('visible');
        this.panel.classList.add('visible');

        // Update trigger button state
        const trigger = document.getElementById('global-volume-btn');
        if (trigger) trigger.classList.add('active');
    }

    hide() {
        this.isVisible = false;
        this.backdrop.classList.remove('visible');
        this.panel.classList.remove('visible');

        // Update trigger button state
        const trigger = document.getElementById('global-volume-btn');
        if (trigger) trigger.classList.remove('active');
    }

    toggle(playerIp, playerPort, groupData) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(playerIp, playerPort, groupData);
        }
    }

    parseSpeakers(groupData) {
        const speakers = [];

        if (!groupData) return speakers;

        // Add master
        if (groupData.master) {
            speakers.push({
                ip: groupData.master.ipAddress,
                port: groupData.master.port,
                name: groupData.master.name,
                model: `${groupData.master.brand || ''} ${groupData.master.modelName || ''}`.trim(),
                volume: groupData.master.volume,
                isFixedVolume: groupData.master.isFixedVolume,
                isMaster: true,
                isStereo: groupData.master.isStereoPaired,
                channelMode: groupData.master.channelMode
            });
        }

        // Add members/slaves
        if (groupData.members && groupData.members.length > 0) {
            groupData.members.forEach(member => {
                speakers.push({
                    ip: member.ipAddress,
                    port: member.port,
                    name: member.name,
                    model: member.isStereoPaired ? 'Stereo Pair' : `${member.brand || ''} ${member.modelName || ''}`.trim(),
                    volume: member.volume,
                    isFixedVolume: member.isFixedVolume,
                    isMaster: false,
                    isStereo: member.isStereoPaired,
                    channelMode: member.channelMode
                });
            });
        }

        return speakers;
    }

    renderBrowserOnly() {
        this.speakerList.innerHTML = `
            <div class="volume-speaker-item" data-speaker-ip="browser" data-speaker-port="0">
                <div class="volume-speaker-row">
                    <div class="volume-speaker-icon is-browser">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                    </div>
                    <div class="volume-speaker-info">
                        <span class="volume-speaker-name">Dieses Gerät</span>
                        <span class="volume-speaker-model">Browser Audio</span>
                    </div>
                    <div class="volume-value-display" data-volume-display>
                        ${this.browserVolume}%
                    </div>
                </div>
                <div class="volume-slider-row">
                    <button type="button" class="btn-vol btn-vol-down" data-action="decrease" data-ip="browser" data-port="0" title="Leiser">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                    <div class="volume-slider-container" data-slider data-ip="browser" data-port="0">
                        <div class="volume-slider-track">
                            <div class="volume-slider-fill" style="width: ${this.browserVolume}%"></div>
                        </div>
                        <div class="volume-slider-thumb" style="left: ${this.browserVolume}%"></div>
                    </div>
                    <button type="button" class="btn-vol btn-vol-up" data-action="increase" data-ip="browser" data-port="0" title="Lauter">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        this.bindSliderEvents();
    }

    renderSpeakers() {
        // Check if we have any adjustable speakers
        const adjustableSpeakers = this.speakers.filter(s => !s.isFixedVolume);
        const allFixed = adjustableSpeakers.length === 0;

        let html = '';

        if (allFixed) {
            // All speakers are fixed volume
            html = `
                <div class="volume-all-fixed">
                    <div class="volume-all-fixed-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                            <line x1="23" y1="9" x2="17" y2="15"/>
                            <line x1="17" y1="9" x2="23" y2="15"/>
                        </svg>
                    </div>
                    <h4>Fixed Volume</h4>
                    <p>Die Lautstärke wird über einen externen Verstärker gesteuert</p>
                </div>
            `;
        } else {
            // Show only adjustable speakers
            adjustableSpeakers.forEach(speaker => {
                html += this.renderSpeakerItem(speaker);
            });
        }

        this.speakerList.innerHTML = html;
        this.bindSliderEvents();
    }

    renderSpeakerItem(speaker) {
        const volumePercent = Math.max(0, Math.min(100, speaker.volume));

        // Determine icon and styling
        let iconClass = '';
        let iconSvg = '<rect x="6" y="4" width="12" height="16" rx="2"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7" r="1"/>';

        if (speaker.isStereo) {
            iconClass = 'is-stereo';
            iconSvg = '<rect x="4" y="6" width="6" height="12" rx="1"/><rect x="14" y="6" width="6" height="12" rx="1"/>';
        }

        // Badge
        let badge = '';
        if (speaker.isStereo) {
            badge = '<span class="volume-speaker-badge badge-stereo">Stereo</span>';
        }

        return `
            <div class="volume-speaker-item" data-speaker-ip="${speaker.ip}" data-speaker-port="${speaker.port}">
                <div class="volume-speaker-row">
                    <div class="volume-speaker-icon ${iconClass}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvg}</svg>
                    </div>
                    <div class="volume-speaker-info">
                        <span class="volume-speaker-name">
                            ${this.escapeHtml(speaker.name)}
                            ${badge}
                        </span>
                        <span class="volume-speaker-model">${this.escapeHtml(speaker.model)}</span>
                    </div>
                    <div class="volume-value-display" data-volume-display>
                        ${volumePercent}%
                    </div>
                </div>
                <div class="volume-slider-row">
                    <button type="button" class="btn-vol btn-vol-down" data-action="decrease" data-ip="${speaker.ip}" data-port="${speaker.port}" title="Leiser">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                    <div class="volume-slider-container" data-slider data-ip="${speaker.ip}" data-port="${speaker.port}">
                        <div class="volume-slider-track">
                            <div class="volume-slider-fill" style="width: ${volumePercent}%"></div>
                        </div>
                        <div class="volume-slider-thumb" style="left: ${volumePercent}%"></div>
                    </div>
                    <button type="button" class="btn-vol btn-vol-up" data-action="increase" data-ip="${speaker.ip}" data-port="${speaker.port}" title="Lauter">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    bindSliderEvents() {
        // Volume buttons
        this.speakerList.querySelectorAll('.btn-vol').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const ip = btn.dataset.ip;
                const port = btn.dataset.port;
                const delta = action === 'increase' ? 2 : -2;
                this.adjustVolume(ip, port, delta);
            });
        });

        // Slider interactions
        this.speakerList.querySelectorAll('[data-slider]').forEach(slider => {
            slider.addEventListener('mousedown', (e) => this.handleSliderStart(e, slider));
            slider.addEventListener('touchstart', (e) => this.handleSliderStart(e, slider), { passive: false });

            // Click on track
            slider.querySelector('.volume-slider-track').addEventListener('click', (e) => {
                const rect = slider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                this.setVolume(slider.dataset.ip, slider.dataset.port, Math.round(percent));
            });
        });
    }

    handleSliderStart(e, slider) {
        e.preventDefault();
        this.isDragging = true;
        this.activeSlider = slider;
    }

    handleSliderDrag(e) {
        if (!this.isDragging || !this.activeSlider) return;

        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = this.activeSlider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

        // Update UI immediately
        const fill = this.activeSlider.querySelector('.volume-slider-fill');
        const thumb = this.activeSlider.querySelector('.volume-slider-thumb');
        const item = this.activeSlider.closest('.volume-speaker-item');
        const display = item.querySelector('[data-volume-display]');

        if (fill) fill.style.width = percent + '%';
        if (thumb) thumb.style.left = percent + '%';
        if (display) display.textContent = Math.round(percent) + '%';
    }

    handleSliderDragEnd() {
        if (!this.isDragging || !this.activeSlider) return;

        const slider = this.activeSlider;
        const fill = slider.querySelector('.volume-slider-fill');
        const volume = Math.round(parseFloat(fill.style.width));

        this.setVolume(slider.dataset.ip, slider.dataset.port, volume);

        this.isDragging = false;
        this.activeSlider = null;
    }

    adjustVolume(ip, port, delta) {
        const item = this.speakerList.querySelector(`[data-speaker-ip="${ip}"][data-speaker-port="${port}"]`);
        if (!item) return;

        const display = item.querySelector('[data-volume-display]');
        const fill = item.querySelector('.volume-slider-fill');
        const thumb = item.querySelector('.volume-slider-thumb');

        const currentVolume = parseInt(display.textContent) || 0;
        const newVolume = Math.max(0, Math.min(100, currentVolume + delta));

        // Update UI
        if (display) display.textContent = newVolume + '%';
        if (fill) fill.style.width = newVolume + '%';
        if (thumb) thumb.style.left = newVolume + '%';

        this.setVolume(ip, port, newVolume);
    }

    async setVolume(ip, port, volume) {
        // Handle browser volume
        if (ip === 'browser') {
            this.browserVolume = volume;
            this.applyBrowserVolume(volume);
            localStorage.setItem('browserVolume', volume);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('playerIp', ip);
            formData.append('playerPort', port);
            formData.append('volume', volume);

            const response = await fetch('/Players?handler=Volume', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'RequestVerificationToken': document.querySelector('input[name="__RequestVerificationToken"]')?.value || ''
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Update speaker data
                const speaker = this.speakers.find(s => s.ip === ip && s.port == port);
                if (speaker) {
                    speaker.volume = data.volume;
                }
            }
        } catch (error) {
            console.error('Volume adjustment failed:', error);
        }
    }

    applyBrowserVolume(volume) {
        // Apply to any audio/video elements on the page
        document.querySelectorAll('audio, video').forEach(el => {
            el.volume = volume / 100;
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize global instance
let volumePanel = null;

function initVolumePanel() {
    if (!volumePanel) {
        volumePanel = new VolumePanel();
    }
    return volumePanel;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVolumePanel);
} else {
    initVolumePanel();
}

// Export for use in other scripts
window.VolumePanel = VolumePanel;
window.volumePanel = volumePanel;
window.initVolumePanel = initVolumePanel;
