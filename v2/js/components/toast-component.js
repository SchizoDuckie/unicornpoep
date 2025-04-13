import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


const DEFAULT_DURATION = 3000; // Default display time in ms

/**
 * Component managing the toast notification display (#toastNotification).
 * Listens for ShowFeedback events.
 */
export default class ToastComponent extends BaseComponent {
    static SELECTOR = '#toastNotification';
    static VIEW_NAME = 'ToastComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[ToastComponent] Constructed (via BaseComponent).");
    }
    
    initialize() {
        this.messageElement = this.rootElement.querySelector('#toastMessage');
        this.hideTimeout = null;

        if (!this.messageElement) {
            console.error("[ToastComponent] Missing #toastMessage. Cannot display messages.");
        }
        
        // --- Bind Handlers Here --- 
        this._handleShowFeedback = this._handleShowFeedback.bind(this);
        
        console.log("[ToastComponent] Initialized.");
    }

    /** Registers eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        
        // eventBus Listeners
        this.listen(Events.System.ShowFeedback, this._handleShowFeedback); 
    }

    /**
     * Handles the ShowFeedback event.
     * @param {object} payload
     * @param {string} payload.message
     * @param {'info'|'success'|'warn'|'error'} [payload.level='info']
     * @param {number} [payload.duration]
     * @private
     */
    _handleShowFeedback({ message, level = 'info', duration }) {
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
        console.log(`[${this.name}] Destroyed.`);
    }
} 