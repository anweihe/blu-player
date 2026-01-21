// ==================== Queue API Client ====================
// Handles communication with the Queue API

window.QueueApi = (function() {
    'use strict';

    const API_BASE = '/Api/Queue';

    /**
     * Get the playback queue for a profile
     * @param {string} profileId - The profile ID
     * @returns {Promise<Object|null>} The queue data or null if not found
     */
    async function getQueue(profileId) {
        try {
            const response = await fetch(`${API_BASE}?handler=get&profileId=${encodeURIComponent(profileId)}`);
            const result = await response.json();

            if (result.success) {
                return result.data;
            }
            console.error('Failed to get queue:', result.error);
            return null;
        } catch (error) {
            console.error('Error fetching queue:', error);
            return null;
        }
    }

    /**
     * Set the playback queue for a profile (replaces existing queue)
     * @param {string} profileId - The profile ID
     * @param {Object} queueData - The queue data
     * @param {string} queueData.sourceType - "playlist" or "album"
     * @param {string} queueData.sourceId - Qobuz Playlist/Album ID
     * @param {string} queueData.sourceName - Display name
     * @param {number} queueData.currentIndex - Current position in queue
     * @param {Array} queueData.tracks - Array of track objects
     * @returns {Promise<Object|null>} The saved queue data or null on error
     */
    async function setQueue(profileId, queueData) {
        try {
            const response = await fetch(`${API_BASE}?handler=set&profileId=${encodeURIComponent(profileId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceType: queueData.sourceType,
                    sourceId: queueData.sourceId,
                    sourceName: queueData.sourceName,
                    currentIndex: queueData.currentIndex,
                    tracks: queueData.tracks.map(mapTrackToDto)
                })
            });
            const result = await response.json();

            if (result.success) {
                return result.data;
            }
            console.error('Failed to set queue:', result.error);
            return null;
        } catch (error) {
            console.error('Error setting queue:', error);
            return null;
        }
    }

    /**
     * Update the current index in the queue
     * @param {string} profileId - The profile ID
     * @param {number} currentIndex - The new current index
     * @returns {Promise<boolean>} True if successful
     */
    async function updateQueueIndex(profileId, currentIndex) {
        try {
            const response = await fetch(`${API_BASE}?handler=index&profileId=${encodeURIComponent(profileId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentIndex })
            });
            const result = await response.json();

            if (result.success) {
                return true;
            }
            console.error('Failed to update queue index:', result.error);
            return false;
        } catch (error) {
            console.error('Error updating queue index:', error);
            return false;
        }
    }

    /**
     * Clear the playback queue for a profile
     * @param {string} profileId - The profile ID
     * @returns {Promise<boolean>} True if successful
     */
    async function clearQueue(profileId) {
        try {
            const response = await fetch(`${API_BASE}?handler=clear&profileId=${encodeURIComponent(profileId)}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                return true;
            }
            console.error('Failed to clear queue:', result.error);
            return false;
        } catch (error) {
            console.error('Error clearing queue:', error);
            return false;
        }
    }

    /**
     * Map a track object to the DTO format expected by the API
     * @param {Object} track - The track object from the UI
     * @returns {Object} The track DTO
     */
    function mapTrackToDto(track) {
        return {
            position: track.position || 0,
            id: track.id,
            title: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            albumCover: track.albumCover,
            duration: track.duration || 0,
            formattedDuration: track.formattedDuration,
            isHiRes: track.isHiRes || false,
            qualityLabel: track.qualityLabel,
            isStreamable: track.isStreamable !== false,
            trackNumber: track.trackNumber || 0,
            mediaNumber: track.mediaNumber || 0
        };
    }

    /**
     * Map a track DTO from the API to the UI format
     * @param {Object} dto - The track DTO from the API
     * @returns {Object} The track object for the UI
     */
    function mapDtoToTrack(dto) {
        return {
            id: dto.id,
            title: dto.title,
            artistName: dto.artistName,
            albumTitle: dto.albumTitle,
            albumCover: dto.albumCover,
            duration: dto.duration,
            formattedDuration: dto.formattedDuration,
            isHiRes: dto.isHiRes,
            qualityLabel: dto.qualityLabel,
            isStreamable: dto.isStreamable,
            trackNumber: dto.trackNumber,
            mediaNumber: dto.mediaNumber
        };
    }

    /**
     * Convert queue DTO from API to UI format
     * @param {Object} dto - The queue DTO from the API
     * @returns {Object} The queue object for the UI
     */
    function mapQueueDtoToUi(dto) {
        if (!dto) return null;
        return {
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            sourceName: dto.sourceName,
            currentIndex: dto.currentIndex,
            updatedAt: dto.updatedAt,
            tracks: (dto.tracks || []).map(mapDtoToTrack)
        };
    }

    // Public API
    return {
        getQueue,
        setQueue,
        updateQueueIndex,
        clearQueue,
        mapQueueDtoToUi,
        mapDtoToTrack
    };
})();
