import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * @class PracticeEndDialog
 * @extends BaseDialog
 * Dialog shown at the end of a practice session.
 */
class PracticeEndDialog extends BaseDialog {
    /**
     * Creates an instance of PracticeEndDialog.
     */
    constructor() {
        super('#practiceEndDialog', 'PracticeEndDialog');

        this.tryAgainButton = this.rootElement.querySelector('#practiceTryAgainButton');
        this.menuButton = this.rootElement.querySelector('#practiceMenuButton');

        if (!this.tryAgainButton || !this.menuButton) {
            throw new Error(`[${this.name}] Missing required child elements: #practiceTryAgainButton or #practiceMenuButton.`);
        }

        this._bindMethods();
        this._addEventListeners();

        // Listen for the game to finish
        this.listen(Events.Game.Finished, this.handleGameFinished);

        console.log(`[${this.name}] Initialized.`);
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleGameFinished = this.handleGameFinished.bind(this);
        this.handleTryAgainClick = this.handleTryAgainClick.bind(this);
        this.handleMenuClick = this.handleMenuClick.bind(this);
    }

    /** Adds DOM event listeners. */
    _addEventListeners() {
        this.tryAgainButton.addEventListener('click', this.handleTryAgainClick);
        this.menuButton.addEventListener('click', this.handleMenuClick);
    }

    /** Removes DOM event listeners. */
    _removeEventListeners() {
        // Assuming elements exist because constructor throws if they don't
        this.tryAgainButton.removeEventListener('click', this.handleTryAgainClick);
        this.menuButton.removeEventListener('click', this.handleMenuClick);
    }

    /**
     * Handles the Game.Finished event.
     * If the mode is 'practice', shows the dialog.
     * @param {object} payload - Event payload.
     * @param {'single' | 'multiplayer' | 'practice'} payload.mode
     * @private
     */
    handleGameFinished({ mode }) {
        if (mode === 'practice') {
            console.log(`[${this.name}] Practice finished, showing dialog.`);
            this.show(); // Show the dialog
        }
    }

    /** Handles the try again button click. */
    handleTryAgainClick() {
        console.log(`[${this.name}] Try again clicked.`);
        // Emit PlayAgainClicked with mode context
        eventBus.emit(Events.UI.EndDialog.PlayAgainClicked, { mode: 'practice' }); 
        this.hide(); // Close the dialog
    }

    /** Handles the return to menu button click. */
    handleMenuClick() {
        console.log(`[${this.name}] Return to menu clicked.`);
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide(); // Close the dialog
    }

    // Override destroy to ensure listeners are removed
    destroy() {
         console.log(`[${this.name}] Destroying...`);
         this._removeEventListeners(); 
         super.destroy();
    }
}

// Event constants (like Events.UI.EndDialog.PlayAgainClicked) are now defined centrally
// in v2/js/core/event-constants.js

export default PracticeEndDialog; 