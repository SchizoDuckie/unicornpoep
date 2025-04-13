import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * Dialog displayed at the end of a single player game.
 * Displays the final score and allows saving to highscores or restarting.
 * @extends BaseDialog
 */
class SinglePlayerEndDialog extends BaseDialog {
    static SELECTOR = '#endOfGameDialog';
    static VIEW_NAME = 'SinglePlayerEndDialog';

    /** Initializes component elements. */
    initialize() {
        // Elements specific to this dialog using corrected IDs from HTML
        this.scoreDisplay = this.rootElement.querySelector('#finalScore'); // Corrected ID
        // Find the div containing the name input indirectly
        this.nameInputContainer = this.rootElement.querySelector('div:has(> #playerName)'); 
        this.nameInput = this.rootElement.querySelector('#playerName'); // Corrected ID
        this.saveButton = this.rootElement.querySelector('#saveHighscore'); // Corrected ID
        // this.saveErrorDisplay is removed as the element doesn't exist in HTML
        this.playAgainButton = this.rootElement.querySelector('#restartGame'); // Corrected ID
        this.backToMenuButton = this.rootElement.querySelector('#spEndMenuButton'); // Corrected ID

        // Add checks - Updated IDs and removed saveErrorDisplay check
        if (!this.scoreDisplay) console.error(`[${this.name}] Missing #finalScore`);
        if (!this.nameInputContainer) console.error(`[${this.name}] Missing container for #playerName`);
        if (!this.nameInput) console.error(`[${this.name}] Missing #playerName`);
        if (!this.saveButton) console.error(`[${this.name}] Missing #saveHighscore`);
        if (!this.playAgainButton) console.error(`[${this.name}] Missing #restartGame`);
        if (!this.backToMenuButton) console.error(`[${this.name}] Missing #spEndMenuButton`);

        // Store game results temporarily
        this.currentGameResults = null;
        this.gameName = 'default'; // Store game name for saving highscore
        this.currentDifficulty = 'Unknown Difficulty'; // Store difficulty for saving
        this.currentMode = 'single'; // Store game mode

        this._bindMethods();
        // Listeners added by registerListeners
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this.handleSaveScore = this.handleSaveScore.bind(this);
        this.handlePlayAgain = this.handlePlayAgain.bind(this);
        this.handleBackToMenu = this.handleBackToMenu.bind(this);
        // No need to bind _clearError if it only emits events now
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        // Use updated element references
        if (this.saveButton) this.saveButton.addEventListener('click', this.handleSaveScore);
        if (this.playAgainButton) this.playAgainButton.addEventListener('click', this.handlePlayAgain);
        if (this.backToMenuButton) this.backToMenuButton.addEventListener('click', this.handleBackToMenu);
        // Optionally clear errors on input - maybe less relevant now? Keep for now.
        // if (this.nameInput) this.nameInput.addEventListener('input', this._clearError); 
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        // Use updated element references
        if (this.saveButton) this.saveButton.removeEventListener('click', this.handleSaveScore);
        if (this.playAgainButton) this.playAgainButton.removeEventListener('click', this.handlePlayAgain);
        if (this.backToMenuButton) this.backToMenuButton.removeEventListener('click', this.handleBackToMenu);
        // if (this.nameInput) this.nameInput.removeEventListener('input', this._clearError);
    }

    /** Handles the save score button click */
    handleSaveScore() {
        // Use updated element references
        const playerName = this.nameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('hsErrorNameEmpty'));
            return;
        }
        if (playerName.length > 40) { // Match validation from NamePrompt?
             this._showError(getTextTemplate('hsErrorNameTooLong'));
             return;
         }

        if (this.currentGameResults && this.currentGameResults.score !== undefined) {
            console.log(`[${this.name}] Save score clicked. Name: ${playerName}, Score: ${this.currentGameResults.score}`);
            eventBus.emit(Events.UI.EndDialog.SaveScoreClicked, { 
                name: playerName, 
                score: this.currentGameResults.score,
                gameName: this.gameName, 
                mode: this.currentMode,
                difficulty: this.currentDifficulty 
            });
             // UIManager handles navigation after save attempt
        } else {
            console.error(`[${this.name}] Cannot save score, results data missing.`);
            this._showError(getTextTemplate('hsErrorSaveFailed'));
        }
    }

    /** Handles the play again button click */
    handlePlayAgain() {
        console.log("[SinglePlayerEndDialog] Play again clicked.");
        // Emit PlayAgainClicked with mode context
        eventBus.emit(Events.UI.EndDialog.PlayAgainClicked, { mode: this.currentMode }); 
        this.hide();
    }

    /** Handles the back to menu button click */
    handleBackToMenu() {
        console.log("[SinglePlayerEndDialog] Back to menu clicked.");
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }

    /** Clears the save error message - Now does nothing as element removed */
    _clearError() {
       // Element removed, maybe clear feedback elsewhere if needed?
       // For now, this method can be empty or removed.
       console.debug(`[${this.name}] _clearError called, but no specific error element exists.`);
    }
    
    /** Shows a save error message - Now emits a feedback event */
    _showError(message) {
        console.warn(`[${this.name}] Showing error via feedback event: ${message}`);
        eventBus.emit(Events.System.ShowFeedback, { message: message, level: 'warn', duration: 3000 });
    }

    /**
     * Shows the dialog and displays the score.
     * @param {object} results - The game results.
     * @param {number} results.score - The final score.
     * @param {string} results.gameName - Name of the game/sheets played.
     * @param {string} results.difficulty - Game difficulty.
     * @param {string} results.mode - Game mode ('single').
     * @param {boolean} results.eligibleForHighscore - Whether the score qualifies.
     */
    show(results) {
        this.currentGameResults = results;
        this.gameName = results.gameName || 'Unknown Game';
        this.currentDifficulty = results.difficulty || 'Unknown';
        this.currentMode = results.mode || 'single';

        // Use updated element references
        if (this.scoreDisplay) {
             // Use textContent for security, assuming score is just a number
             this.scoreDisplay.textContent = results.score !== undefined ? results.score : '?';
        }

        // Show/hide save score section using the indirectly found container
        if (results.eligibleForHighscore) {
            if (this.nameInputContainer) this.nameInputContainer.classList.remove('hidden');
            if (this.nameInput) {
                // Pre-fill with stored name?
                 const storedName = localStorage.getItem('unicornPoepPlayerName');
                 this.nameInput.value = storedName || '';
                 // this._clearError(); // May not be necessary
            }
        } else {
            if (this.nameInputContainer) this.nameInputContainer.classList.add('hidden');
        }
        
        super.show();
    }

    // Override destroy to ensure listeners are removed
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners();
        super.destroy();
    }
}

export default SinglePlayerEndDialog; 