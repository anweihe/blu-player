/**
 * Qobuz Lightbox Module
 * Handles cover image lightbox with touch gestures
 */
(function() {
    'use strict';

    window.QobuzApp = window.QobuzApp || {};

    // Lightbox state
    let lightbox = null;
    let lightboxImage = null;
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isDragging = false;

    // ==================== Open/Close ====================

    function openCoverLightbox() {
        const coverImg = document.getElementById('detail-cover');
        if (!coverImg || !coverImg.src) return;

        lightbox = document.getElementById('cover-lightbox');
        lightboxImage = document.getElementById('lightbox-image');

        if (!lightbox || !lightboxImage) return;

        lightboxImage.src = coverImg.src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Setup event listeners
        lightbox.addEventListener('click', handleLightboxClick);
        lightbox.addEventListener('touchstart', handleTouchStart, { passive: true });
        lightbox.addEventListener('touchmove', handleTouchMove, { passive: false });
        lightbox.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('keydown', handleLightboxKeydown);
    }

    function closeCoverLightbox() {
        if (!lightbox) return;

        lightbox.classList.remove('active');
        document.body.style.overflow = '';

        // Remove event listeners
        lightbox.removeEventListener('click', handleLightboxClick);
        lightbox.removeEventListener('touchstart', handleTouchStart);
        lightbox.removeEventListener('touchmove', handleTouchMove);
        lightbox.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('keydown', handleLightboxKeydown);

        // Reset image transform
        if (lightboxImage) {
            lightboxImage.style.transform = '';
            lightboxImage.style.opacity = '';
        }
    }

    // ==================== Event Handlers ====================

    function handleLightboxClick(e) {
        // Close if clicking on the background (not the image)
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeCoverLightbox();
        }
    }

    function handleLightboxKeydown(e) {
        if (e.key === 'Escape') {
            closeCoverLightbox();
        }
    }

    // ==================== Touch Gestures ====================

    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDragging = true;
    }

    function handleTouchMove(e) {
        if (!isDragging || !lightboxImage) return;

        touchCurrentY = e.touches[0].clientY;
        const deltaY = touchCurrentY - touchStartY;

        // Only allow downward swipe to close
        if (deltaY > 0) {
            e.preventDefault();
            const progress = Math.min(deltaY / 200, 1);
            lightboxImage.style.transform = `translateY(${deltaY}px) scale(${1 - progress * 0.1})`;
            lightboxImage.style.opacity = 1 - progress * 0.5;
        }
    }

    function handleTouchEnd() {
        if (!isDragging || !lightboxImage) return;

        const deltaY = touchCurrentY - touchStartY;

        // Close if swiped down more than 100px
        if (deltaY > 100) {
            closeCoverLightbox();
        } else {
            // Snap back
            lightboxImage.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            lightboxImage.style.transform = '';
            lightboxImage.style.opacity = '';
            setTimeout(() => {
                if (lightboxImage) {
                    lightboxImage.style.transition = '';
                }
            }, 300);
        }

        isDragging = false;
    }

    // ==================== Export Functions ====================

    QobuzApp.lightbox = {
        openCoverLightbox,
        closeCoverLightbox
    };

    // Global exports
    window.openCoverLightbox = openCoverLightbox;
    window.closeCoverLightbox = closeCoverLightbox;

})();
