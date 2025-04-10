import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * Dialog shown at the end of a single-player game.
 * Displays the final score and allows saving to highscores or restarting.
 * @extends BaseDialog
 */
class SinglePlayerEndDialog extends BaseDialog {
    /**
     * Creates an instance of SinglePlayerEndDialog.
     */
    constructor() {
        super('#endOfGameDialog', 'SinglePlayerEndDialog');

        // Query essential elements
        this.finalScoreElement = this.rootElement.querySelector('#finalScore');
        this.playerNameInput = this.rootElement.querySelector('#playerName');
        this.saveButton = this.rootElement.querySelector('#saveHighscore');
        this.restartButton = this.rootElement.querySelector('#restartGame');
        this.menuButton = this.rootElement.querySelector('#spEndMenuButton'); // Use the correct ID from HTML

        // Verify essential elements exist
        if (!this.finalScoreElement || !this.playerNameInput || !this.saveButton || !this.restartButton || !this.menuButton) {
            const missing = [
                !this.finalScoreElement && '#finalScore',
                !this.playerNameInput && '#playerName',
                !this.saveButton && '#saveHighscore',
                !this.restartButton && '#restartGame',
                !this.menuButton && '#spEndMenuButton'
            ].filter(Boolean).join(', ');
            console.error(`[${this.name}] Could not find all required child elements (${missing}) within ${this.selector}. Dialog cannot function.`);
            throw new Error(`[${this.name}] Missing required child elements within ${this.selector}. Check HTML structure.`);
        }

        this._bindMethods();
        this._boundHandleClose = this._handleDialogClose.bind(this);
        this._addEventListeners();
        this._addGameEventListeners(); // Add listener for game events

        this.currentScore = 0; // Store the score passed via show()
        this.currentGameName = 'Unknown Game';
        this.currentDifficulty = 'Unknown Difficulty';
        this.currentMode = 'single'; // Store game mode, default to single
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleSave = this.handleSave.bind(this);
        this.handleRestart = this.handleRestart.bind(this);
        this.handleMenu = this.handleMenu.bind(this);
        this.handleGameFinished = this.handleGameFinished.bind(this); // Bind game event handler
        this._handleNameInputKeyPress = this._handleNameInputKeyPress.bind(this);
    }

    /** Adds specific DOM event listeners for this dialog. */
    _addEventListeners() {
        this.saveButton.addEventListener('click', this.handleSave);
        this.restartButton.addEventListener('click', this.handleRestart);
        this.menuButton.addEventListener('click', this.handleMenu);
        this.rootElement.addEventListener('close', this._boundHandleClose);

        // Add keypress listener for Enter key on name input
        this.playerNameInput.addEventListener('keypress', this._handleNameInputKeyPress);
    }

    /** Adds listeners for game-related events via eventBus. @private */
    _addGameEventListeners() {
        this.listen(Events.Game.Finished, this.handleGameFinished);
    }

    /**
     * Handles the Game.Finished event to show the dialog if it was a single-player game.
     * @param {object} payload
     * @param {string} payload.mode - The mode of the game that finished.
     * @param {object} payload.results - The results object.
     * @param {number} [payload.results.score] - The final score (specific to single player).
     * @private
     */
    handleGameFinished({ mode, results }) {
        if (mode === 'single') {
            console.log(`[${this.name}] Game.Finished event received for single player. Results:`, results);
            // Store game context along with the score
            this.currentScore = results.score;
            const settings = results.settings || {};
            const sheetIds = settings.sheetIds || [];
            // Store the raw derived game name, potentially including prefix
            this.currentGameName = Array.isArray(sheetIds) ? sheetIds.join(', ') : (sheetIds || 'Unknown Game');
            
            this.currentDifficulty = settings.difficulty || 'Unknown Difficulty';
            this.currentMode = mode; // Store the mode
            
            console.log(`[${this.name}] Stored Raw Game Name: ${this.currentGameName}, Difficulty: ${this.currentDifficulty}, Mode: ${this.currentMode}`);

            this.show(this.currentScore);
        } else {
             console.debug(`[${this.name}] Ignoring Game.Finished event for mode: ${mode}`);
        }
    }

    /**
     * Handles the native 'close' event of the dialog element.
     * Clears the input when dismissed (e.g., via ESC).
     * @private
     */
    _handleDialogClose() {
        this.playerNameInput.value = '';
        console.debug(`[${this.name}] Dialog closed natively, player name input cleared.`);
    }

    /**
     * Handles the save highscore button click.
     * Validates the player name and emits an event to request saving the score.
     */
    handleSave() {
        const playerName = this.playerNameInput.value.trim();
        if (playerName && this.currentScore !== null) { // Check against null (set if score was invalid)
            console.debug(`[${this.name}] Save highscore requested: Name='${playerName}', Score=${this.currentScore}, Game='${this.currentGameName}', Difficulty='${this.currentDifficulty}', Mode='${this.currentMode}'`);
            
            // Update last used name in localStorage
            try {
                localStorage.setItem('unicornPoepPlayerName', playerName);
            } catch (e) {
                console.warn(`[${this.name}] Failed to save player name to localStorage:`, e);
            }

            // Emit the specific event defined in the plan, including game context
            eventBus.emit(Events.UI.EndDialog.SaveScoreClicked, { 
                name: playerName, 
                score: this.currentScore, 
                gameName: this.currentGameName, 
                mode: this.currentMode, // Add mode here
                difficulty: this.currentDifficulty 
            });
            this.hide();
        } else if (!playerName) {
            console.warn(`[${this.name}] Save attempt failed: Player name is empty.`);
            this.playerNameInput.focus();
            // Use template for feedback message
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('spEndErrorSaveName'), level: 'warn' });
        } else {
             console.warn(`[${this.name}] Save attempt failed: Score is invalid (${this.currentScore}). Cannot save.`);
             // Disable button maybe? Or just rely on the initial check in show().
        }
    }

    /**
     * Handles the restart game button click.
     * Emits an event indicating the user wants to play again (same mode).
     */
    handleRestart() {
        console.debug(`[${this.name}] Restart game clicked.`);
        // Emit the specific event defined in the plan
        eventBus.emit(Events.UI.EndDialog.PlayAgainClicked, { mode: 'single' }); // Specify the mode
        this.hide();
    }

    /**
     * Handles the return to menu button click.
     * Emits an event indicating the user wants to go back to the main menu.
     */
    handleMenu() {
        console.debug(`[${this.name}] Return to menu clicked.`);
         // Emit the specific event defined in the plan
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }

    /**
     * Shows the dialog, updates the displayed score, and prepares the input field.
     * @param {number} score - The final score to display.
     */
    show(score) {
        // Validate score input
        if (typeof score !== 'number' || isNaN(score)) {
            console.error(`[${this.name}] Invalid score provided to show():`, score);
            // Use template for score error display
            this.finalScoreElement.textContent = getTextTemplate('spEndErrorScore'); 
            this.currentScore = null; // Indicate invalid score state
            this.saveButton.disabled = true; // Disable saving invalid score
            this.playerNameInput.disabled = true; // Disable input if score is invalid
            this.playerNameInput.value = ''; // Clear input if score invalid
        } else {
            this.currentScore = score;
            this.finalScoreElement.textContent = this.currentScore.toString(); // Display the score
            this.saveButton.disabled = false; // Enable saving valid score
            this.playerNameInput.disabled = false; // Enable name input
            // Load default name from localStorage
            try {
                const defaultName = localStorage.getItem('unicornPoepPlayerName') || '';
                this.playerNameInput.value = defaultName;
            } catch (e) {
                console.warn(`[${this.name}] Failed to load player name from localStorage:`, e);
                this.playerNameInput.value = ''; // Fallback to empty
            }
        }

        // Clear previous name input - MOVED into conditional logic above
        // this.playerNameInput.value = ''; 

        super.show(); // Call BaseDialog showModal

        // Focus the player name input after the dialog is shown
        requestAnimationFrame(() => {
            // Check dialog is still open before focusing
             if (this.rootElement.open && !this.playerNameInput.disabled) {
                this.playerNameInput.focus();
                // Select text if default name was loaded
                if (this.playerNameInput.value) {
                    this.playerNameInput.select();
                }
             }
        });
    }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        console.debug(`[${this.name}] Destroying...`);
        this._removeEventListeners();
        // Note: BaseDialog/BaseComponent handles removing eventBus listeners added via this.listen()
        this._boundHandleClose = null; // Clear bound reference
        super.destroy(); // Call base class destroy
    }

    /** Removes specific DOM event listeners attached by this component. */
    _removeEventListeners() {
        // No need for defensive checks here, constructor guarantees elements exist
        this.saveButton.removeEventListener('click', this.handleSave);
        this.restartButton.removeEventListener('click', this.handleRestart);
        this.menuButton.removeEventListener('click', this.handleMenu);
        this.rootElement.removeEventListener('close', this._boundHandleClose);
        // Remove keypress listener (important to avoid duplicates if dialog is reused)
        this.playerNameInput.removeEventListener('keypress', this._handleNameInputKeyPress);
    }

    /**
     * Handles keypress events on the player name input field.
     * @param {KeyboardEvent} event - The keypress event.
     */
    _handleNameInputKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleSave();
        }
    }
}

export default SinglePlayerEndDialog; 