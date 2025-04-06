/**
 * Manages the specific dialog shown at the end of a single-player game.
 * Inherits from BaseDialog.
 */
class SinglePlayerEndDialog extends BaseDialog {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        super('endOfGameDialog', mainMenuController); // Call parent constructor with ID

        // Get specific elements within this dialog
        this.finalScoreSpan = this.querySelector('#finalScore');
        this.playerNameInput = this.querySelector('#playerName');
        this.saveScoreButton = this.querySelector('#saveHighscore');
        this.restartButton = this.querySelector('#restartGame');
        this.menuButton = this.querySelector('.backToMain.menuButton');

        this._setupEventListeners();
    }

    /** Sets up listeners specific to this dialog's buttons. */
    _setupEventListeners() {
        this.saveScoreButton.addEventListener('click', () => this.handleSave());
        this.restartButton.addEventListener('click', () => this.handleRestart());
        this.menuButton.addEventListener('click', () => {
            this.hide(); // Close dialog
            this.mainMenuController.showView('mainMenu', 'backward'); // Navigate back with direction
        });
    }

    /**
     * Shows the dialog and populates it with the final score and player name.
     * @param {number} score - The final score achieved.
     */
    show(score) {
        if (this.finalScoreSpan) {
            this.finalScoreSpan.textContent = score;
        }
        if (this.playerNameInput && this.mainMenuController.currentGame) {
             // Pre-fill name from the current game instance via the mainMenuController
             this.playerNameInput.value = this.mainMenuController.currentGame.playerName || '';
        }
        // Reset button states
        if(this.saveScoreButton) this.saveScoreButton.disabled = false;
        if(this.restartButton) this.restartButton.disabled = false;
        if(this.menuButton) this.menuButton.disabled = false;

        super.show(); // Call BaseDialog's show method
    }

    /** Handles the Save button click. */
    async handleSave() {
        if (!this.playerNameInput) return;
        const name = this.playerNameInput.value;
        if (!name.trim()) {
            // Delegate error showing to the main controller or a dedicated error dialog instance
            this.mainMenuController.dialogController.showError("Vul je naam in om op te slaan!");
            return;
        }

        // Disable buttons
        if(this.saveScoreButton) this.saveScoreButton.disabled = true;
        if(this.restartButton) this.restartButton.disabled = true;
        if(this.menuButton) this.menuButton.disabled = true;

        try {
            // Update name and trigger save via the game instance
            if (!this.mainMenuController.currentGame) {
                throw new Error("Current game instance not found.");
            }
            await this.mainMenuController.currentGame.saveHighscore(name); // Await save
            console.log("SinglePlayerEndDialog: game.saveHighscore finished successfully.");

            this.mainMenuController.toastNotification.show("Highscore opgeslagen!");
            this.hide(); // Hide this dialog
            // Navigate via the main controller AFTER successful save
            this.mainMenuController.showView('mainMenu', 'backward'); // Use backward for returning
            console.log("SinglePlayerEndDialog: Navigated to main menu.");

        } catch (error) {
             console.error("SinglePlayerEndDialog: Error during save:", error);
             this.mainMenuController.dialogController.showError(`Fout bij opslaan score: ${error.message || error}`);
             // Re-enable buttons on error
             if(this.saveScoreButton) this.saveScoreButton.disabled = false;
             if(this.restartButton) this.restartButton.disabled = false;
             if(this.menuButton) this.menuButton.disabled = false;
        }
    }

    /** Handles the Restart button click. */
    handleRestart() {
        console.log("SinglePlayerEndDialog: Restart clicked.");
        this.hide(); // Hide this dialog
        // Trigger restart via the game instance
        this.mainMenuController.currentGame.restartGame();
    }

    /** Override onClose to ensure buttons are re-enabled if closed via ESC */
    onClose() {
        super.onClose(); // Call base method
        // Re-enable buttons in case dialog was closed via ESC during save attempt etc.
        if (this.saveScoreButton) this.saveScoreButton.disabled = false;
        if (this.restartButton) this.restartButton.disabled = false;
        if (this.menuButton) this.menuButton.disabled = false;
    }
} 