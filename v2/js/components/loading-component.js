import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Component managing the global loading indicator (#loading).
 */
export default class LoadingComponent extends BaseComponent {
    /**
     * Initializes the LoadingComponent.
     */
    constructor() {
        super('#loading', Views.Loading);
        
        // Unlike other views, Loading might start visible in the HTML,
        // BaseComponent constructor correctly detects initial state.

        this.listenForEvents();
        console.log("[LoadingComponent] Initialized. Initial visibility: ", this.isVisible);
    }

    /**
     * Listens for events that should show/hide the loading indicator.
     * @private
     */
    listenForEvents() {
        // Listen for explicit loading events
        this.listen(Events.System.LoadingStart, this.handleLoadingStart);
        this.listen(Events.System.LoadingEnd, this.handleLoadingEnd);
    }

    /** Handles the LoadingStart event. @private */
    handleLoadingStart = (payload = {}) => {
        // Optionally display a message if provided in payload
        const message = payload.message || getTextTemplate('loadingDefault');
        if (this.rootElement) {
            // Example: Update a text element within the loading indicator if it exists
            const textElement = this.rootElement.querySelector('h1'); // Assuming an h1 for text
            if (textElement) {
                textElement.textContent = message;
            }
        }
        console.debug(`[${this.name}] Showing loading indicator. Message: ${message}`);
        this.show();
    }

    /** Handles the LoadingEnd event. @private */
    handleLoadingEnd = () => {
        console.debug(`[${this.name}] Hiding loading indicator.`);
        this.hide();
    }

    // BaseComponent show/hide methods are sufficient for this component.
} 