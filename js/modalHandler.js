export function showModal(selector, options = {}) {
    const $modal = (typeof selector === 'string') ? $(selector) : selector;
    if (!$modal || $modal.length === 0) return;

    $('body').css('overflow', 'hidden');
    $modal.addClass('show').attr('aria-hidden', 'false').show();

    const $focusableElements = $modal.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const $firstFocusable = $focusableElements.first();
    const $lastFocusable = $focusableElements.last();

    setTimeout(() => {
        if ($firstFocusable.length) $firstFocusable.focus();
    }, 100);

    $modal.off('keydown.focusTrap').on('keydown.focusTrap', function (e) {
        if (e.key === 'Tab' || e.keyCode === 9) {
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === $firstFocusable[0]) {
                    $lastFocusable.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === $lastFocusable[0]) {
                    $firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }
    });

    if (calendar && $modal.find('#calendar').length) {
        setTimeout(() => { try { calendar.render(); } catch (e) {} }, 60);
    }

    $modal.off('click.modalOverlay').on('click.modalOverlay', function (evt) {
        if (evt.target === this && !(options && options.disableOverlayClose)) hideModal($modal);
    });
}

export function hideModal(selector) {
    const $modal = (typeof selector === 'string') ? $(selector) : selector;
    if (!$modal || $modal.length === 0) return;

    $('body').css('overflow', '');
    $modal.removeClass('show').attr('aria-hidden', 'true').hide();
    $modal.off('click.modalOverlay');
    $modal.off('keydown.focusTrap');
}