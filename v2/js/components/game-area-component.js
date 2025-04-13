import BaseComponent from './base-component.js';
import Views from '../core/view-constants.js'; // Import Views constant
import eventBus from '../core/event-bus.js'; // Import eventBus
import Events from '../core/event-constants.js'; // Import Events
// Removed imports for sub-components as they are managed by UIManager
// Removed eventBus/Events import as they are not directly used here anymore

/**
 * Component managing the main Game Area view (#gameArea).
 * Acts primarily as a container whose visibility is controlled by UIManager.
 * Sub-components within this container manage their own state based on events.
 * ALSO handles the Stop button within the game area.
 */
export default class GameAreaComponent extends BaseComponent {
    static SELECTOR = '#gameArea';
    static VIEW_NAME = Views.GameArea;

    /**
     * Initializes the GameAreaComponent.
     */
    constructor() {
        super('#gameArea', Views.GameArea);
        this.stopButton = null; // Initialize property
        this._handleStopClick = this._handleStopClick.bind(this); // Bind handler
    }

    /** 
     * Initializes component elements and binds methods/listeners (if any).
     * Called by BaseComponent constructor.
     */
    initialize() {
        // Find the stop button within the root element
        this.stopButton = this.rootElement.querySelector('#stopGame');
        if (!this.stopButton) {
            console.error(`[${this.name}] Could not find the #stopGame button!`);
        }
        console.log(`[${this.name}] Initialized.`);
    }

    /** 
     * Registers DOM event listeners (if any for the container itself).
     * Called by BaseComponent constructor.
     */
    registerListeners() {
        if (this.stopButton) {
            this.stopButton.addEventListener('click', this._handleStopClick);
            console.log(`[${this.name}] Registered Stop button listener.`);
        } else {
            console.warn(`[${this.name}] Stop button not found, listener not registered.`);
        }
    }

    /** Removes DOM event listeners */
    unregisterListeners() {
        if (this.stopButton && this._handleStopClick) {
            this.stopButton.removeEventListener('click', this._handleStopClick);
            console.log(`[${this.name}] Unregistered Stop button listener.`);
        }
    }

    /** 
     * Handles the click event on the Stop button. 
     * Emits the LeaveGameClicked event.
     * @private 
     */
    _handleStopClick() {
        console.log(`[${this.name}] Stop button clicked. Emitting LeaveGameClicked.`);
        eventBus.emit(Events.UI.GameArea.LeaveGameClicked);
    }

    /**
     * Override show - Log when shown.
     */
    show() {
        super.show();
        console.log("[GameAreaComponent] Shown");
    }

    /**
     * Override hide - Log when hidden.
     */
    hide() {
        super.hide();
        console.log("[GameAreaComponent] Hidden");
    }

    /**
     * Override destroy - Log destruction.
     * No sub-components to destroy here anymore.
     */
    destroy() {
        super.destroy(); // Call base cleanup
        console.log("[GameAreaComponent] Destroyed.");
    }
} 