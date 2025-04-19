import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';
import miscUtils from '../utils/miscUtils.js';  // Import default export


/**
 * Class SinglePlayerEndDialog.
 * 
 * Dialog displayed at the end of a single player game.
 * Displays the final score and allows saving to highscores or restarting.
 * 
 * @extends BaseDialog
 */
class SinglePlayerEndDialog extends BaseDialog {
    static SELECTOR = '#endOfGameDialog';
    static VIEW_NAME = 'SinglePlayerEndDialog';
    
    static SELECTORS = {
        SCORE_DISPLAY: '#finalScore',
        NAME_INPUT: '#playerName',
        NAME_INPUT_CONTAINER: 'div:has(> #playerName)',
        SAVE_BUTTON: '#saveHighscore',
        PLAY_AGAIN_BUTTON: '#restartGame',
        MENU_BUTTON: '#spEndMenuButton',
        REFRESH_NAME_BUTTON: '#refreshNameButton'
    };
    
    // State variables as class properties
    currentGameResults = null;
    gameName = 'default';
    currentDifficulty = 'Unknown Difficulty';
    currentMode = 'single';

    /**
     * Initialize the component with event handlers and DOM elements.
     * 
     * @return {Object} Configuration for event listeners, DOM events, and DOM elements
     */
    initialize() {
        return {
            domEvents: [
                { 
                    selector: SinglePlayerEndDialog.SELECTORS.SAVE_BUTTON, 
                    event: 'click', 
                    handler: this._handleSaveScore 
                },
                { 
                    selector: SinglePlayerEndDialog.SELECTORS.PLAY_AGAIN_BUTTON, 
                    event: 'click', 
                    handler: this._handlePlayAgain 
                },
                { 
                    selector: SinglePlayerEndDialog.SELECTORS.MENU_BUTTON, 
                    event: 'click', 
                    handler: this._handleBackToMenu 
                },
                { 
                    selector: SinglePlayerEndDialog.SELECTORS.REFRESH_NAME_BUTTON, 
                    event: 'click', 
                    handler: this._handleRefreshName 
                }
            ],
            domElements: [
                {
                    name: 'scoreDisplay',
                    selector: SinglePlayerEndDialog.SELECTORS.SCORE_DISPLAY
                },
                {
                    name: 'nameInputContainer',
                    selector: SinglePlayerEndDialog.SELECTORS.NAME_INPUT_CONTAINER
                },
                {
                    name: 'nameInput',
                    selector: SinglePlayerEndDialog.SELECTORS.NAME_INPUT
                },
                {
                    name: 'saveButton',
                    selector: SinglePlayerEndDialog.SELECTORS.SAVE_BUTTON
                },
                {
                    name: 'playAgainButton',
                    selector: SinglePlayerEndDialog.SELECTORS.PLAY_AGAIN_BUTTON
                },
                {
                    name: 'backToMenuButton',
                    selector: SinglePlayerEndDialog.SELECTORS.MENU_BUTTON
                },
                {
                    name: 'refreshNameButton',
                    selector: SinglePlayerEndDialog.SELECTORS.REFRESH_NAME_BUTTON
                }
            ]
        };
    }

    /**
     * Handles the refresh name button click.
     * Generates a random player name and fills the input field.
     * 
     * @return void
     * @private
     */
    _handleRefreshName() {
        if (this.elements.nameInput) {
            const randomName = miscUtils.generateRandomPlayerName();
            this.elements.nameInput.value = randomName;
            console.log(`[${this.name}] Generated random name: ${randomName}`);
        }
    }

    /**
     * Handles the save score button click.
     * Validates input and emits save event.
     * 
     * @return void
     * @event Events.UI.EndDialog.SaveScoreClicked
     * @private
     */
    _handleSaveScore() {
        
        // Use element references from elements object
        const playerName = this.elements.nameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('hsErrorNameEmpty'));
            return;
        }
        if (playerName.length > 40) { // Match validation from NamePrompt
             this._showError(getTextTemplate('hsErrorNameTooLong'));
             return;
         }

        // Save player name to localStorage using consistent key
        try {
            localStorage.setItem('unicornPoepUserName', playerName);
            console.log(`[${this.name}] Saved player name to localStorage: ${playerName}`);
        } catch (e) {
            console.warn(`[${this.name}] Could not save name to localStorage:`, e);
        }

        if (this.currentGameResults && this.currentGameResults.score !== undefined) {
            console.log(`[${this.name}] Save score clicked. Name: ${playerName}, Score: ${this.currentGameResults.score}`);
            eventBus.emit(Events.UI.Dialog.SaveScoreClicked, { 
                name: playerName, 
                score: this.currentGameResults.score,
                gameName: this.gameName, 
                mode: this.currentMode,
                difficulty: this.currentDifficulty 
            });
             this.hide(); 
        } else {
            console.error(`[${this.name}] Cannot save score, results data missing.`);
            this._showError(getTextTemplate('hsErrorSaveFailed'));
            this.hide(); 
        }
    }

    /**
     * Handles the play again button click.
     * Emits event and hides dialog.
     * 
     * @return void
     * @event Events.UI.EndDialog.PlayAgainClicked
     * @private
     */
    _handlePlayAgain() {
        console.log("[SinglePlayerEndDialog] Play again clicked.");
        // Emit PlayAgainClicked with mode context
        eventBus.emit(Events.UI.EndDialog.PlayAgainClicked, { mode: this.currentMode }); 
        this.hide();
    }

    /**
     * Handles the back to menu button click.
     * Emits event and hides dialog.
     * 
     * @return void
     * @event Events.UI.EndDialog.ReturnToMenuClicked
     * @private
     */
    _handleBackToMenu() {
        console.log("[SinglePlayerEndDialog] Back to menu clicked.");
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }
    
    /**
     * Shows an error message using the feedback system.
     * 
     * @param {string} message Error message to display
     * @return void
     * @event Events.System.ShowFeedback
     * @private
     */
    _showError(message) {
        console.warn(`[${this.name}] Showing error via feedback event: ${message}`);
        eventBus.emit(Events.System.ShowFeedback, { message: message, level: 'warn', duration: 3000 });
    }

    /**
     * Shows the dialog and displays the score.
     * 
     * @param {Object} results The game results
     * @param {number} results.score The final score
     * @param {string} results.gameName Name of the game/sheets played
     * @param {string} results.difficulty Game difficulty
     * @param {string} results.mode Game mode ('single')
     * @param {boolean} results.eligibleForHighscore Whether the score qualifies
     * @return void
     */
    show(results) {
        this.currentGameResults = results;
        // Expect top-level properties provided by GameCoordinator
        this.gameName = results.gameName || 'Unknown Game'; 
        this.currentDifficulty = results.difficulty || 'Unknown';
        this.currentMode = results.mode || 'single';

        // Use elements object
        if (this.elements.scoreDisplay) {
             // Use textContent for security, assuming score is just a number
             // Add check for results itself before accessing score
             this.elements.scoreDisplay.textContent = (results.score !== undefined) ? results.score : '?'; 
        }

        // Show/hide save score section using the elements object
        // Add check for results itself before accessing eligibleForHighscore
        if (results.eligibleForHighscore) { 
            if (this.elements.nameInputContainer) this.elements.nameInputContainer.classList.remove('hidden');
            if (this.elements.nameInput) {
                // Pre-fill with stored name using consistent key
                const storedName = localStorage.getItem('unicornPoepUserName');
                this.elements.nameInput.value = storedName || '';
                console.log(`[${this.name}] Pre-filled player name from localStorage: ${storedName || '(empty)'}`);
            }
        } else {
            if (this.elements.nameInputContainer) this.elements.nameInputContainer.classList.add('hidden');
        }
        
        super.show(results);
    }
}

export default SinglePlayerEndDialog; 