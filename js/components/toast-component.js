import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

const DEFAULT_DURATION = 3000; // Default display time in ms

/**
 * Component managing the toast notification display (#toastNotification).
 * Listens for ShowFeedback events.
 */
export default class ToastComponent extends RefactoredBaseComponent {
    static SELECTOR = '#toastNotification';
    static VIEW_NAME = 'ToastComponent';

    static SELECTORS = {
        MESSAGE: '#toastMessage'
    };

    hideTimeout = null;
    
    /**
     * Initializes component using the declarative pattern.
     * @returns {Object} Configuration object with events and domElements
     */
    initialize() {
        return {
            events: [
                { 
                    eventName: Events.System.ShowFeedback, 
                    callback: this._handleShowFeedback 
                }
            ],
            domElements: [
                {
                    name: 'messageElement',
                    selector: ToastComponent.SELECTORS.MESSAGE
                }
            ],
        };
    }

    /**
     * Handles the ShowFeedback event.
     * @param {object} payload
     * @param {string} payload.message
     * @param {'info'|'success'|'warn'|'error'} [payload.level='info']
     * @param {number} [payload.duration]
     * @event Events.System.ShowFeedback
     */
    _handleShowFeedback({ message, level = 'info', duration }) {
        console.log(`[ToastComponent] _handleShowFeedback`, message, level, duration);
        if (!message) return;

        // Clear any existing timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.elements.messageElement.textContent = message;
        
        // Update styling
        this.rootElement.classList.remove('info', 'success', 'warn', 'error');
        this.rootElement.classList.add(level);

        this.show();

        const displayDuration = typeof duration === 'number' ? duration : DEFAULT_DURATION;
        if (displayDuration > 0) {
            this.hideTimeout = setTimeout(() => {
                this.hide();
                this.hideTimeout = null;
            }, displayDuration);
        }
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