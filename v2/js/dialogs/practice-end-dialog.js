import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * @class PracticeEndDialog
 * @extends BaseDialog
 * Dialog displayed at the end of a practice game.
 */
class PracticeEndDialog extends BaseDialog {
    static SELECTOR = '#practiceEndDialog';
    static VIEW_NAME = 'PracticeEndDialog';

    /** Initializes component elements. */
    initialize() {
        // this.scoreDisplay = this.rootElement.querySelector('#practiceFinalScore'); // Removed, no matching element
        this.restartButton = this.rootElement.querySelector('#practiceTryAgainButton'); // Corrected ID
        this.backToMenuButton = this.rootElement.querySelector('#practiceMenuButton'); // Corrected ID

        // if (!this.scoreDisplay) console.error(`[${this.name}] Missing #practiceFinalScore.`); // Removed check
        if (!this.restartButton) console.error(`[${this.name}] Missing #practiceTryAgainButton.`); // Corrected ID
        if (!this.backToMenuButton) console.error(`[${this.name}] Missing #practiceMenuButton.`); // Corrected ID

        this._bindMethods();
        // Listeners added by registerListeners
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this.handleRestart = this.handleRestart.bind(this);
        this.handleBackToMenu = this.handleBackToMenu.bind(this);
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.restartButton) this.restartButton.addEventListener('click', this.handleRestart);
        if (this.backToMenuButton) this.backToMenuButton.addEventListener('click', this.handleBackToMenu);
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.restartButton) this.restartButton.removeEventListener('click', this.handleRestart);
        if (this.backToMenuButton) this.backToMenuButton.removeEventListener('click', this.handleBackToMenu);
    }

    /** Handles the restart button click */
    handleRestart() {
        console.log("[PracticeEndDialog] Restart clicked.");
        eventBus.emit(Events.UI.EndDialog.RestartPracticeClicked);
        this.hide();
    }

    /** Handles the back to menu button click */
    handleBackToMenu() {
        console.log("[PracticeEndDialog] Back to menu clicked.");
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }

    /**
     * Shows the dialog.
     * @param {object} results - The game results (score is ignored).
     */
    show(results) {
        // Score display removed as element doesn't exist
        // if (this.scoreDisplay) {
        //     this.scoreDisplay.textContent = `Your Score: ${results.score}`; 
        // }
        super.show();
    }

    // Override destroy to ensure listeners are removed
    destroy() {
         console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners();
         super.destroy();
    }
}

// Event constants (like Events.UI.EndDialog.PlayAgainClicked) are now defined centrally
// in v2/js/core/event-constants.js

export default PracticeEndDialog; 