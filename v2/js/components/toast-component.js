import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


const DEFAULT_DURATION = 3000; // Default display time in ms

/**
 * Component managing the toast notification display (#toastNotification).
 * Listens for ShowFeedback events.
 */
export default class ToastComponent extends BaseComponent {
    /**
     * Initializes the ToastComponent.
     */
    constructor() {
        super('#toastNotification', 'Toast');
        // BaseComponent constructor now throws if rootElement is null

        this.messageElement = this.rootElement.querySelector('#toastMessage'); // Assume an inner element for the message
        this.hideTimeout = null;

        // Keep the check for the essential child element
        if (!this.messageElement) {
            console.error("[ToastComponent] Missing required child element (#toastMessage). Component cannot display messages.");
            // Allow component to exist but log error
        }

        this.listenForEvents();
        this.hide(); // Start hidden
        console.log("[ToastComponent] Initialized.");
    }

    /**
     * Listens for ShowFeedback events.
     * @private
     */
    listenForEvents() {
        this.listen(Events.System.ShowFeedback, this.handleShowFeedback);
    }

    /**
     * Handles the ShowFeedback event.
     * @param {object} payload
     * @param {string} payload.message
     * @param {'info'|'success'|'warn'|'error'} [payload.level='info']
     * @param {number} [payload.duration]
     * @private
     */
    handleShowFeedback({ message, level = 'info', duration }) {
        if (!message) return;

        console.log(`[ToastComponent] Show Feedback: [${level}] ${message}`);

        // Clear any existing timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Set message and level class
        if (this.messageElement) {
            this.messageElement.textContent = message;
        }
        if (this.rootElement) {
            // Remove previous level classes
            this.rootElement.classList.remove('info', 'success', 'warn', 'error');
            // Add current level class
            this.rootElement.classList.add(level);
        }

        // Show the toast
        this.show(); // BaseComponent show just removes 'hidden'

        // Set timeout to hide
        const displayDuration = typeof duration === 'number' ? duration : DEFAULT_DURATION;
        if (displayDuration > 0) {
            this.hideTimeout = setTimeout(() => {
                this.hide();
                this.hideTimeout = null;
            }, displayDuration);
        }
        // If duration is 0 or less, it stays visible until next message or manual hide.
    }

    /**
     * Override hide to clear the timeout as well.
     */
    hide() {
        super.hide();
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        // Optionally clear text/level class when hidden explicitly
        // if (this.messageElement) this.messageElement.textContent = '';
        // if (this.rootElement) this.rootElement.className = 'hidden'; // Reset classes
    }

    /**
     * Override destroy to ensure timeout is cleared.
     */
    destroy() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        super.destroy();
    }
} 