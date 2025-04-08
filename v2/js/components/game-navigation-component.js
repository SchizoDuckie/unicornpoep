import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * @class GameNavigationComponent
 * @extends BaseComponent
 * Manages navigation controls within the game area, primarily the 'Leave Game' button.
 */
export default class GameNavigationComponent extends BaseComponent {
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

        this._bindEvents();
        this.hide(); // Start hidden, show when game starts
        console.log(`[${this.name}] Initialized`);

        // Listen for game start/end to show/hide controls
        this.listen(Events.Game.Started, this.show);
        this.listen(Events.Game.Finished, this.hide);
        // Also hide if game is aborted prematurely
        this.listen(Events.Game.Aborted, this.hide); // Assuming Aborted event exists
    }

    /** Binds DOM event listeners. @private */
    _bindEvents() {
        this.nextButton?.addEventListener('click', () => {
            if (!this.nextButton.disabled) {
                console.log(`[${this.name}] Next button clicked.`);
                eventBus.emit(Events.UI.GameArea.NextQuestionClicked);
                this.nextButton.disabled = true; // Disable after click
            }
        });

        // Add listener to the globally found stop button
        this.stopButton?.addEventListener('click', () => {
            console.log(`[${this.name}] Stop button clicked.`);
            // Removed confirm() wrapper - Directly emit the event.
            // If confirmation is needed, GameCoordinator should handle showing a custom dialog.
            eventBus.emit(Events.UI.GameArea.LeaveGameClicked);
        });
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this.nextButton?.removeEventListener('click', () => {
            if (!this.nextButton.disabled) {
                console.log(`[${this.name}] Next button clicked.`);
                eventBus.emit(Events.UI.GameArea.NextQuestionClicked);
                this.nextButton.disabled = true; // Disable after click
            }
        });

        this.stopButton?.removeEventListener('click', () => {
            console.log(`[${this.name}] Stop button clicked.`);
            // Removed confirm() wrapper - Corresponding removal in unbind
            eventBus.emit(Events.UI.GameArea.LeaveGameClicked);
        });
    }

    // Removed enable/disable next button logic

    // show/hide are inherited from BaseComponent and triggered by listeners

    // Override destroy to clean up listeners
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
} 