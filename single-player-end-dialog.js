/**
 * Manages the specific dialog shown at the end of a single-player game.
 * Inherits from BaseDialog.
 */
class SinglePlayerEndDialog extends BaseDialog {
    /**
     * @param {string} dialogId - The HTML ID of the dialog element.
     * @param {DialogController} dialogController - The DialogController instance.
     */
    constructor(dialogId, dialogController) {
        // RE-APPLYING FIX: Ensure dialogId is passed correctly to super()
        super(dialogId, null);
        this.dialogController = dialogController; // Store the actual DialogController

        // Get specific elements within this dialog
        this.finalScoreSpan = this.querySelector('#finalScore');
        this.playerNameInput = this.querySelector('#playerName');
        this.saveScoreButton = this.querySelector('#saveHighscore');
        this.restartButton = this.querySelector('#restartGame');
        this.menuButton = this.querySelector('.backToMain.menuButton');
        // New buttons for non-highscore scenario
        this.viewHighscoresButton = this.querySelector('#viewHighscoresButton'); // Added selector
        this.tryAgainButton = this.querySelector('#tryAgainButton'); // Added selector

        this._setupEventListeners();
    }

    /** Sets up listeners specific to this dialog's buttons. */
    _setupEventListeners() {
        // Helper to get the actual MainMenuController
        const getMainMenu = () => this.dialogController.mainMenuController;

        if (this.saveScoreButton) {
            this.saveScoreButton.addEventListener('click', () => this.handleSave());
        }
        if (this.restartButton) {
            this.restartButton.addEventListener('click', () => this.handleRestart());
        }
        if (this.menuButton) {
            this.menuButton.addEventListener('click', async () => {
                this.hide();
                await getMainMenu().showView('mainMenu', 'backward');
                getMainMenu()._handleEndOfGameCleanup();
            });
        }
        if (this.viewHighscoresButton) {
            this.viewHighscoresButton.addEventListener('click', async () => {
                this.hide();
                await getMainMenu().showView('highscores');
                getMainMenu()._handleEndOfGameCleanup();
            });
        }
        if (this.tryAgainButton) {
            this.tryAgainButton.addEventListener('click', () => this.handleRestart());
        }
    }

    /**
     * Shows the dialog, populates it with the score, and configures buttons based on high score status.
     * @param {number} score - The final score achieved.
     * @param {boolean} isNewHighScore - Whether the score is a new high score.
     */
    show(score, isNewHighScore) {
        if (this.finalScoreSpan) {
            this.finalScoreSpan.textContent = score;
        }

        const nameInputContainer = this.playerNameInput ? this.playerNameInput.closest('.form-group') : null;
        // Assume button containers might be direct children or specific divs
        const getContainer = (btn) => btn ? (btn.closest('div') || btn.parentElement) : null;

        const saveContainer = getContainer(this.saveScoreButton);
        const restartContainer = getContainer(this.restartButton);
        const viewHsContainer = getContainer(this.viewHighscoresButton);
        const tryAgainContainer = getContainer(this.tryAgainButton);
        // Assuming menu button is always visible or handled separately

        // Reset visibility and disabled states
        [this.saveScoreButton, this.restartButton, this.menuButton, this.viewHighscoresButton, this.tryAgainButton].forEach(btn => {
            if(btn) btn.disabled = false;
        });
        [nameInputContainer, saveContainer, restartContainer, viewHsContainer, tryAgainContainer].forEach(cont => {
             if (cont) cont.classList.add('hidden'); // Hide all initially
         });

        const getMainMenu = () => this.dialogController.mainMenuController;

        if (isNewHighScore) {
            console.log("SinglePlayerEndDialog: New high score, showing Save/Restart/Menu.");
            // Show elements for new high score
            if (nameInputContainer) nameInputContainer.classList.remove('hidden');
            if (saveContainer) saveContainer.classList.remove('hidden');
            if (restartContainer) restartContainer.classList.remove('hidden');
            // Assuming menuButton is always visible or its container doesn't need hiding/showing

            if (this.playerNameInput && getMainMenu().currentGame) {
                this.playerNameInput.value = getMainMenu().currentGame.playerName || '';
                requestAnimationFrame(() => this.playerNameInput.focus());
            }
        } else {
            console.log("SinglePlayerEndDialog: Not a new high score, showing ViewScores/TryAgain/Menu.");
            // Show elements for non-highscore
            if (viewHsContainer) viewHsContainer.classList.remove('hidden');
            if (tryAgainContainer) tryAgainContainer.classList.remove('hidden');
            // Assuming menuButton is always visible
        }

        super.show(); // Call BaseDialog's show method
    }

    /** Handles the Save button click. */
    async handleSave() {
        if (!this.playerNameInput) return;
        const name = this.playerNameInput.value;
        const getMainMenu = () => this.dialogController.mainMenuController;

        if (!name.trim()) {
            // Access dialogController directly as it's stored on this
            this.dialogController.showError("Vul je naam in om op te slaan!"); 
            return;
        }

        // Disable buttons during save
        [this.saveScoreButton, this.restartButton, this.menuButton].forEach(btn => {
             if(btn) btn.disabled = true;
         });

        try {
            if (!getMainMenu().currentGame) {
                throw new Error("Current game instance not found.");
            }
            await getMainMenu().currentGame.saveHighscore(name);
            getMainMenu().toastNotification.show("Highscore opgeslagen!");
            this.hide();
            // Await navigation, THEN cleanup
            await getMainMenu().showView('highscores');
            await this.mainMenuController.showView('highscores');
            this.mainMenuController._handleEndOfGameCleanup();
        } catch (error) {
             console.error("SinglePlayerEndDialog: Error during save:", error);
             // Ensure dialogController exists before showing error
             if (this.mainMenuController && this.mainMenuController.dialogController) {
                this.mainMenuController.dialogController.showError(`Fout bij opslaan score: ${error.message || error}`);
             } else {
                 console.error("Cannot show error dialog, mainMenuController or dialogController missing.")
             }
             // Re-enable buttons on error
            [this.saveScoreButton, this.restartButton, this.menuButton].forEach(btn => {
                 if(btn) btn.disabled = false;
             });
        }
    }

    /** Handles the Restart and Try Again button clicks. */
    handleRestart() {
        console.log("SinglePlayerEndDialog: Restart/Try Again clicked.");
        this.hide(); // Hide this dialog
        // Trigger restart via the game instance
        this.mainMenuController.currentGame.restartGame();
    }

    /** Override onClose to ensure buttons are re-enabled if closed via ESC */
    onClose() {
        super.onClose(); // Call base method
        // Re-enable all potentially active buttons
        [this.saveScoreButton, this.restartButton, this.menuButton, this.viewHighscoresButton, this.tryAgainButton].forEach(btn => {
            if(btn) btn.disabled = false;
        });
    }
} 