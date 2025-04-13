import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Manages the loading indicator display.
 */
export default class LoadingComponent extends BaseComponent {
    static SELECTOR = '#loading';
    static VIEW_NAME = 'LoadingComponent';

    /**
     * Initializes the LoadingComponent.
     */
    constructor() {
        super();
        console.log("[LoadingComponent] Constructed (via BaseComponent).");
    }
    
    // Initialize can be empty if no specific elements needed beyond root
    initialize() {
        // Query for the text element if needed for messages
        this.textElement = this.rootElement.querySelector('h1');
        console.log(`[${this.name}] Initialized.`);
    }

    /** 
     * Registers DOM and eventBus event listeners.
     * Called by BaseComponent constructor.
     */
    registerListeners() {
        // Bind handlers
        this._handleLoadingStart = this._handleLoadingStart.bind(this);
        this._handleLoadingEnd = this._handleLoadingEnd.bind(this);
        
        // Listen for explicit loading events
        this.listen(Events.System.LoadingStart, this._handleLoadingStart);
        this.listen(Events.System.LoadingEnd, this._handleLoadingEnd);
        
        console.log(`[${this.name}] Listeners registered.`);
    }

    // Define handlers as regular methods
    _handleLoadingStart(payload = {}) {
        const message = payload.message || getTextTemplate('loadingDefault');
        if (this.textElement) { // Use queried element
            this.textElement.textContent = message;
        }
        console.debug(`[${this.name}] Showing loading indicator. Message: ${message}`);
        this.show();
    }

    _handleLoadingEnd() {
        console.debug(`[${this.name}] Hiding loading indicator.`);
        this.hide();
    }

    // BaseComponent show/hide methods are sufficient.
    // No specific destroy logic needed beyond BaseComponent.
} 