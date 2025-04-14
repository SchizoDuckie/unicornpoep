import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * @class GameNavigationComponent
 * @extends BaseComponent
 * Manages navigation controls within the game area, primarily the 'Leave Game' button.
 */
export default class GameNavigationComponent extends BaseComponent {
    static SELECTOR = '#gameNavigation'; // Assuming this is the container ID
    static VIEW_NAME = 'GameNavigation';

    /**
     * Creates an instance of GameNavigationComponent.
     * @param {string} elementSelector - CSS selector for the component's root element (e.g., '#gameNavigation').
     */
    constructor(elementSelector = '#gameNavigation') {
        super(elementSelector, 'GameNavigationComponent');

        // Find buttons
        this.nextButton = this.rootElement.querySelector('#nextButton');
        // ** Find the stop button globally within the document **
        this.stopButton = document.querySelector('#stopGame'); 

        if (!this.nextButton) {
            console.warn(`[${this.name}] Could not find #nextButton within #gameNavigation.`);
        }
        if (!this.stopButton) {
            // This warning should no longer trigger if #stopGame exists in the document
            console.warn(`[${this.name}] Could not find #stopGame button in the document.`);
        } else {
             console.debug(`[${this.name}] Found #stopGame button globally.`);
        }

        this._bindMethods();
        this.hide(); // Start hidden, show when game starts
        console.log(`[${this.name}] Initialized`);

        // Listen for game start/end to show/hide controls
        this.listen(Events.Game.Started, this.show);
        this.listen(Events.Game.Finished, this.hide);
        // Also hide if game is aborted prematurely
        this.listen(Events.Game.Aborted, this.hide); // Assuming Aborted event exists
    }

    _bindMethods() {
        this.handleStopClick = this.handleStopClick.bind(this);
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.stopButton) {
            this.stopButton.addEventListener('click', this.handleStopClick);
        }
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.stopButton) {
            this.stopButton.removeEventListener('click', this.handleStopClick);
            }
    }

    /** Handles the stop button click */
    handleStopClick() {
            console.log(`[${this.name}] Stop button clicked.`);
            // Removed confirm() wrapper - Directly emit the event.
            // If confirmation is needed, GameCoordinator should handle showing a custom dialog.
            eventBus.emit(Events.UI.GameArea.LeaveGameClicked);
    }

    // Removed enable/disable next button logic

    // show/hide are inherited from BaseComponent and triggered by listeners

    // Override destroy to clean up listeners
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners();
        super.destroy();
    }
} 