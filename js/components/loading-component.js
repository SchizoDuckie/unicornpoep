import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Manages the loading indicator display.
 */
export default class LoadingComponent extends RefactoredBaseComponent {
    static SELECTOR = '#loading';
    static VIEW_NAME = 'LoadingComponent';
    
    static SELECTORS = {
        TEXT: 'h1'
    };

    /**
     * Initializes the component using the declarative pattern.
     * @returns {Object} Configuration object with events and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.System.LoadingStart,
                    callback: this._handleLoadingStart
                },
                {
                    eventName: Events.System.LoadingEnd,
                    callback: this._handleLoadingEnd
                }
            ],
            domElements: [
                {
                    name: 'textElement',
                    selector: LoadingComponent.SELECTORS.TEXT
                }
            ],
            domEvents: []
        };
    }

    /**
     * Handles showing the loading indicator with optional message.
     * @event Events.System.LoadingStart
     * @param {Object} payload - Optional configuration
     * @param {string} [payload.message] - Optional message to display
     */
    _handleLoadingStart(payload = {}) {
        const message = payload.message || getTextTemplate('loadingDefault');
        if (this.elements.textElement) {
            this.elements.textElement.textContent = message;
        }
        this.show();
    }

    /**
     * Handles hiding the loading indicator.
     * @event Events.System.LoadingEnd
     */
    _handleLoadingEnd() {
        this.hide();
    }
} 