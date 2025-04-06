/**
 * Manages instances of specific dialog classes.
 * Acts as a facade to show/hide different dialogs.
 */
class DialogController {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        this.mainMenuController = mainMenuController;

        // --- Instantiate Specific Dialog Handlers ---
        try {
            this.singlePlayerEndDialog = new SinglePlayerEndDialog(mainMenuController);
            this.multiplayerEndDialog = new MultiplayerEndDialog(mainMenuController);
            this.disconnectionDialog = new DisconnectionDialog(mainMenuController);
            this.errorDialog = new ErrorDialog(mainMenuController); // Instantiate ErrorDialog
            this.namePromptDialog = new NamePromptDialog(mainMenuController); // Instantiate NamePromptDialog

            // Store instances for hideAll
            this.dialogInstances = [
                this.singlePlayerEndDialog,
                this.multiplayerEndDialog,
                this.disconnectionDialog,
                this.errorDialog,
                this.namePromptDialog
            ].filter(instance => instance); // Filter out any potentially failed instantiations

        } catch (error) {
            console.error("DialogController FATAL: Failed to instantiate dialog classes.", error);
            this.dialogInstances = [];
             alert("FATAL ERROR: Could not initialize application dialogs.");
        }
        // --- End Instantiation ---
    }

    /**
     * Checks if any managed dialog instance is currently open.
     * @returns {boolean} True if any dialog is open, false otherwise.
     */
    isDialogVisible() {
        return this.dialogInstances.some(instance => instance.isOpen());
    }

    /**
     * Hides all managed dialog instances.
     */
    hideAll() {
        console.log("DialogController: Hiding all managed dialog instances.");
        this.dialogInstances.forEach(instance => instance.hide());
    }

    // --- Facade Methods ---

    /**
     * Shows the end-of-game dialog for single player.
     * @param {number} score - The final score.
     */
    showSinglePlayerEnd(score) {
        this.hideAll();
        this.singlePlayerEndDialog?.show(score);
    }

    /**
     * Shows the end-of-game dialog for multiplayer matches.
     * @param {string} hostName, @param {number} hostScore, @param {string} clientName, @param {number} clientScore
     */
    showMultiplayerEndDialog(hostName, hostScore, clientName, clientScore) {
        this.hideAll();
        this.multiplayerEndDialog?.show(hostName, hostScore, clientName, clientScore);
    }

    /**
     * Shows a dialog indicating the opponent disconnected unexpectedly.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showDisconnection(opponentName) {
        this.hideAll();
        this.disconnectionDialog?.show(opponentName, false); // false = disconnect
    }

     /**
     * Shows a dialog indicating the opponent quit intentionally.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showOpponentQuit(opponentName) {
         this.hideAll();
         this.disconnectionDialog?.show(opponentName, true); // true = quit
     }

     /**
      * Shows a generic error message using the ErrorDialog instance.
      * @param {string} message - The error message to display.
      * @param {string} [title='Fout'] - Optional title for the dialog.
      */
     showError(message, title = 'Fout') {
         // Maybe don't hideAll for errors? Depends on UX choice. Let ErrorDialog handle its state.
         this.errorDialog?.show(title, message);
         // Log alert usage is no longer needed if ErrorDialog is implemented
     }

    /**
     * Shows a dialog prompting the user to enter their name.
     * @returns {Promise<string|null>} A promise that resolves with the entered name, or null.
     */
    async promptForPlayerName() {
        // No need to hideAll here, prompt should show over existing UI if needed
        // Let the prompt method handle its own visibility.
        if (this.namePromptDialog) {
             return this.namePromptDialog.prompt();
        } else {
             console.error("NamePromptDialog instance not available!");
             return Promise.resolve(null); // Return null if dialog cannot be shown
        }
    }

    /**
     * Sets up common listeners for dialog actions.
     * @private
     */
    _setupCommonListeners() {
        // *** REMOVE THIS ENTIRE METHOD ***
        // Back to Main Menu buttons (applies to multiple dialogs)
        // this.container.querySelectorAll('.backToMain').forEach(button => {
        //     button.addEventListener('click', () => {
        //         console.log("DialogController: Back to Main Menu button clicked.");
        //         this._closeAllDialogs(); // Close the dialog itself
        //         this.mainMenu.showView('mainMenu'); // Navigate
        //         // *** Call MainMenu cleanup ***
        //         this.mainMenu._handleEndOfGameCleanup();
        //     });
        // });

        // Specific listeners per dialog are set up in show... methods
        // ... (Error OK button) ...
    }

    /**
     * Sets up listeners specific to the Multiplayer End Dialog.
     * @private
     */
    _setupMultiplayerEndListeners() {
        // Assuming this.multiplayerEndDialog has a 'backButton' property referencing the button element
        this.multiplayerEndDialog.backButton?.addEventListener('click', () => {
            console.log("DialogController: MP End Dialog Back button clicked.");
            this.multiplayerEndDialog.hide(); // Use hide() method of the specific dialog instance
            this.mainMenuController.showView('mainMenu'); // Use mainMenuController reference
             // *** Call MainMenu cleanup ***
             this.mainMenuController._handleEndOfGameCleanup(); // Use mainMenuController reference
        });
    }

    /**
     * Sets up listeners specific to the Disconnection Dialog.
     * @private
     */
    _setupDisconnectionListeners() {
         // Assuming this.disconnectionDialog has a 'backButton' property referencing the button element
        this.disconnectionDialog.backButton?.addEventListener('click', () => {
             console.log("DialogController: Disconnect Dialog Back button clicked.");
             this.disconnectionDialog.hide(); // Use hide() method of the specific dialog instance
             this.mainMenuController.showView('mainMenu'); // Use mainMenuController reference
             // *** Call MainMenu cleanup ***
             this.mainMenuController._handleEndOfGameCleanup(); // Use mainMenuController reference
        });
    }

    /**
     * Sets up listeners specific to the Single Player End Dialog.
     * Need to ensure its 'backToMain' button also calls the cleanup.
     * (This method might need adjustment based on the actual SinglePlayerEndDialog implementation)
     * @private
     */
    _setupSinglePlayerEndListeners() {
        // Example: Assuming singlePlayerEndDialog has references like this.saveButton, this.restartButton, this.menuButton
        this.singlePlayerEndDialog?.saveButton?.addEventListener('click', async () => {
            // ... save logic ...
            // After saving, usually go back to menu
            this.singlePlayerEndDialog.hide();
            this.mainMenuController.showView('mainMenu');
            this.mainMenuController._handleEndOfGameCleanup();
        });

        this.singlePlayerEndDialog?.restartButton?.addEventListener('click', () => {
            this.singlePlayerEndDialog.hide();
            this.mainMenuController.currentGame?.restartGame();
            // No cleanup here, restarting the game
        });

        // Assuming the main menu button within this dialog has class 'backToMain' or a specific ID
        const spMenuButton = this.singlePlayerEndDialog?.dialogElement?.querySelector('.backToMain, #someSpecificId'); // Adjust selector if needed
        spMenuButton?.addEventListener('click', () => {
            console.log("DialogController: SP End Dialog Back button clicked.");
             this.singlePlayerEndDialog.hide();
             this.mainMenuController.showView('mainMenu');
             this.mainMenuController._handleEndOfGameCleanup();
        });
    }
}