/**
 * Manages a simple toast notification element for displaying brief messages.
 */
class ToastNotification {
    /**
     * Initializes the ToastNotification controller.
     * @param {string} [elementId='toastNotification'] - The ID of the toast container element.
     */
    constructor(elementId = 'toastNotification') {
        this.element = document.getElementById(elementId);
        this.timeoutId = null;

        if (!this.element) {
            console.warn(`ToastNotification: Element with ID "${elementId}" not found.`);
        }
    }

    /**
     * Shows a message in the toast notification.
     * @param {string} message - The message to display.
     * @param {number} [duration=3000] - How long to display the message in milliseconds.
     */
    show(message, duration = 3000) {
        if (!this.element) return;

        console.log(`Toast: ${message}`); // Log toast message for debugging
        this.element.textContent = message;
        this.element.classList.remove('hidden');

        // Clear any previous timeout to prevent premature hiding
        clearTimeout(this.timeoutId);

        // Set a new timeout to hide the toast
        this.timeoutId = setTimeout(() => {
            this.hide();
        }, duration);
    }

    /**
     * Immediately hides the toast notification.
     */
    hide() {
        if (!this.element) return;

        this.element.classList.add('hidden');
        clearTimeout(this.timeoutId); // Clear timeout if hidden manually
    }
} 