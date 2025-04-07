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
        super(dialogId);
        if (!dialogController) throw new Error("SinglePlayerEndDialog requires a DialogController!");
        this.dialogController = dialogController;

        // Get specific elements within this dialog
        this.finalScoreElement = this.querySelector('#finalScore');
        this.playerNameInput = this.querySelector('#playerName');
        this.saveButton = this.querySelector('#saveHighscore');
        this.restartButton = this.querySelector('#restartGame');
        this.menuButton = this.querySelector('.backToMain');
        // New buttons for non-highscore scenario
        this.viewHighscoresButton = this.querySelector('#viewHighscoresButton'); // Added selector
        this.tryAgainButton = this.querySelector('#tryAgainButton'); // Added selector

        if (!this.finalScoreElement || !this.playerNameInput || !this.saveButton || !this.restartButton || !this.menuButton) {
            console.error("SinglePlayerEndDialog: Missing one or more required elements.");
        }

        this._setupEventListeners();
    }

    /** Sets up listeners specific to this dialog's buttons. */
    _setupEventListeners() {
        // Helper to get the actual MainMenuController
        const getMainMenu = () => this.dialogController.mainMenuController;

        // Save Button
        this.saveButton?.addEventListener('click', async () => {
            const playerName = this.playerNameInput.value.trim() || 'Anoniem';
            const currentGame = this.dialogController.mainMenuController.currentGame;

            // *** Check if game exists and has the correct method ***
            if (currentGame && typeof currentGame.getGameNameForHighscore === 'function') {
                try {
                    const gameName = currentGame.getGameNameForHighscore(); // <<< Use the public method
                    const difficulty = currentGame.difficulty || "N.v.t.";
                    const score = parseInt(this.finalScoreElement.textContent || '0');

                    await this.dialogController.mainMenuController.highscoresManager.addScore(
                        gameName,
                        playerName,
                        score,
                        false, // Not multiplayer
                        difficulty
                    );
                    localStorage.setItem('unicornPoepPlayerName', playerName);
                    this.dialogController.mainMenuController.toastNotification.show("Score opgeslagen!");

                } catch (error) {
                     console.error("Error saving high score:", error);
                     this.dialogController.mainMenuController.toastNotification.show("Fout bij opslaan score.");
                } finally {
                    // After saving, go to menu and cleanup
                    this.dialogController.handleCloseAndCleanup();
                }
            } else {
                 console.error("Error saving high score: Could not get game name. currentGame or getGameNameForHighscore missing.");
                 this.dialogController.mainMenuController.toastNotification.show("Fout: Kan spelnaam niet vinden voor opslaan.");
                 // Still cleanup even if save fails
                 this.dialogController.handleCloseAndCleanup();
            }
        });

        // Restart Button
        this.restartButton?.addEventListener('click', () => {
            this.hide();
            const currentGame = this.dialogController.mainMenuController.currentGame;
            if (currentGame && typeof currentGame.restartGame === 'function') {
                currentGame.restartGame();
             } else {
                 console.error("Cannot restart game - currentGame or restartGame method not found.");
                 this.dialogController.handleCloseAndCleanup(); // Fallback to menu
             }
        });

        // Menu Button
        this.menuButton?.addEventListener('click', () => {
            this.dialogController.handleCloseAndCleanup();
        });

        // Optional: Handle ESC close
        this.dialogElement.addEventListener('close', () => {
            // Check if closed programmatically or by ESC (if dialog is not technically open anymore
            // and the active element isn't one of the buttons that closes it)
            const isActiveElementButton = document.activeElement === this.saveButton || document.activeElement === this.restartButton || document.activeElement === this.menuButton;
            if (!this.dialogElement.open && !isActiveElementButton) {
                 console.log("SinglePlayerEndDialog closed via ESC or programmatically, cleaning up.");
                 // Check if cleanup needed (e.g., if game hasn't already been cleaned up by another action)
                 if (this.dialogController.mainMenuController.currentGame) {
                     this.dialogController.handleCloseAndCleanup();
                 }
            }
        });

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
        this.finalScoreElement.textContent = score;
        // Load saved name
        this.playerNameInput.value = localStorage.getItem('unicornPoepPlayerName') || '';
        // Enable/disable save button based on isNewHighScore
        this.saveButton.disabled = !isNewHighScore;
        this.saveButton.title = isNewHighScore ? 'Sla je topscore op!' : 'Score is niet hoog genoeg voor de lijst.';

        super.show(); // Call BaseDialog's show
        // Focus input if new high score
        if (isNewHighScore) {
            this.playerNameInput.focus();
            this.playerNameInput.select();
        }
    }

    /** Handles the Restart and Try Again button clicks. */
    handleRestart() {
        console.log("SinglePlayerEndDialog: Restart/Try Again clicked.");
        this.hide(); // Hide this dialog
        // Trigger restart via the game instance
        this.mainMenuController.currentGame.restartGame();
    }
} 