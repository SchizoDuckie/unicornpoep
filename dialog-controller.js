/**
 * Manages instances of specific dialog classes.
 * Acts as a facade to show/hide different dialogs.
 */
class DialogController {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        if (!mainMenuController) {
            throw new Error("DialogController requires a MainMenuController instance!");
        }
        this.mainMenuController = mainMenuController;
        this.game = null; // Game instance will be set via MainMenu

        // --- Dialog Instances ---
        this.singlePlayerEndDialog = new SinglePlayerEndDialog('endOfGameDialog', this);
        this.multiplayerEndDialog = new MultiplayerEndDialog('multiplayerEndDialog', this);
        this.disconnectionDialog = new DisconnectionDialog('disconnectionDialog', this);
        this.errorDialog = new ErrorDialog('errorDialog', this);
        this.namePromptDialog = new NamePromptDialog('namePromptDialog', this);
        this.practiceEndDialog = new PracticeEndDialog('practiceEndDialog', this); // Use specific class

        // Rebuild dialogInstances array with existing dialogs
        this.dialogInstances = [
            this.singlePlayerEndDialog,
            this.multiplayerEndDialog,
            this.disconnectionDialog,
            this.errorDialog,
            this.namePromptDialog,
            this.practiceEndDialog // Add the new specific dialog instance
        ].filter(instance => instance); // Filter out any nulls

        // Initial hide of all managed dialogs
        this.hideAll();

        // Setup listeners (handled by dialog classes or show methods)
    }

    /**
     * Checks if any managed dialog instance is currently open.
     * @returns {boolean} True if any dialog is open, false otherwise.
     */
    isDialogVisible() {
        // Ensure dialogInstances exists and is an array
        if (!Array.isArray(this.dialogInstances)) {
            console.error("DialogController: dialogInstances is not an array!");
            return false;
        }
        return this.dialogInstances.some(instance => instance && typeof instance.isOpen === 'function' && instance.isOpen());
    }

    /**
     * Hides all managed dialog instances.
     */
    hideAll() {
        // Ensure dialogInstances exists and is an array
         if (!Array.isArray(this.dialogInstances)) {
            console.warn("DialogController: Cannot hideAll, dialogInstances is not an array.");
            return;
        }
        console.log("DialogController: Hiding all managed dialog instances.");
        this.dialogInstances.forEach(instance => {
            if (instance && typeof instance.hide === 'function') {
                instance.hide();
            }
        });
    }

    // --- Facade Methods ---

    /**
     * Shows the end game dialog for TEST MODE, displaying score and handling high score input.
     * @param {number} score - The final score achieved.
     * @param {boolean} isNewHighScore - Whether the score is a new high score.
     */
    showTestEndDialog(score, isNewHighScore) {
        console.log(`DialogController: Showing TEST end dialog. Score: ${score}, New Highscore: ${isNewHighScore}`);
        this.hideAll(); // Hide others before showing
        // Pass isNewHighScore to the specific dialog's show method
        this.singlePlayerEndDialog.show(score, isNewHighScore);
    }

    /**
     * Shows a simple dialog indicating practice mode is finished.
     */
    showPracticeEndDialog() {
        console.log("DialogController: Showing PRACTICE end dialog.");
        this.hideAll(); // Hide others before showing
        this.practiceEndDialog.show(); // Call show on the specific PracticeEndDialog instance
    }

    /**
     * Displays the results of a multiplayer game using a dedicated dialog.
     * @param {Array<Object>} playersArray - Array of all player objects {peerId, playerName, score, isFinished}.
     * @param {Object|null} winnerInfo - Information about the winner {peerId, playerName, score, ...} or null for a tie.
     * @param {string} localPlayerId - The PeerJS ID of the local player.
     */
    displayMultiplayerResults(playersArray, winnerInfo, localPlayerId) {
        console.log("DialogController: displayMultiplayerResults called with", playersArray, winnerInfo, localPlayerId);
        if (!this.multiplayerEndDialog) {
            console.error("MultiplayerEndDialog instance not available!");
            return;
        }
        this.hideAll(); // Hide other dialogs first

        const dialogInstance = this.multiplayerEndDialog;

        // --- Set Title (Corrected Logic) --- 
        let titleText = "Spel voorbij!"; // Default title

        if (playersArray.length > 1) {
            if (winnerInfo) {
                // Assume winner first
                titleText = `${winnerInfo.playerName} wint!`;
                
                // Now check for a tie among top scorers
                const topScore = winnerInfo.score;
                const winners = playersArray.filter(p => p.score === topScore);
                if (winners.length > 1) {
                    titleText = "Gelijkspel!"; // It's a tie
                }
            } else {
                 // No winner info from host, but multiple players -> Assume tie
                 console.warn("displayMultiplayerResults: No winnerInfo provided by host for multi-player game. Declaring a tie.");
                 titleText = "Gelijkspel!";
            }
        } 
        // If only one player, "Spel voorbij!" remains correct.
        
        dialogInstance.setTitle(titleText);

        // --- Populate Results List --- 
        dialogInstance.clearResults(); // Assuming a method to clear previous results

        // Sort players by score descending
        playersArray.sort((a, b) => b.score - a.score);

        playersArray.forEach(player => {
            const isLocal = player.peerId === localPlayerId;
            const isWinner = winnerInfo && player.peerId === winnerInfo.peerId && titleText !== "Gelijkspel!"; // Only highlight winner if not a tie
            // Pass necessary info to the dialog instance method
            dialogInstance.addPlayerResult(player.playerName, player.score, isLocal, isWinner);
        });

        // --- Attach Close Listener for Navigation --- 
        dialogInstance.dialogElement.addEventListener('close', () => {
            console.log(`DialogController: '${dialogInstance.dialogId}' closed, navigating back to main menu.`);
            if (this.mainMenuController && typeof this.mainMenuController.showView === 'function') {
                 // Ensure cleanup happens *after* navigation is requested
                 // Navigation should handle cleanup of the game instance.
                 this.mainMenuController.showView('mainMenu', 'backward');
            } else {
                console.error("DialogController: Cannot navigate back after dialog close - mainMenuController or showView missing.");
            }
        }, { once: true }); // Use 'once' so the listener cleans itself up

        dialogInstance.show(); // Show the populated dialog
    }

    /**
     * @deprecated Use displayMultiplayerResults instead.
     * Shows the end-of-game dialog for multiplayer matches.
     * @param {string} hostName, @param {number} hostScore, @param {string} clientName, @param {number} clientScore
     */
    showMultiplayerEndDialog(hostName, hostScore, clientName, clientScore) {
        console.warn("DEPRECATED: showMultiplayerEndDialog called. Use displayMultiplayerResults.");
        // Basic implementation for backward compatibility or error state, 
        // but ideally this is replaced by displayMultiplayerResults.
        this.hideAll();
        if (this.multiplayerEndDialog) {
            this.multiplayerEndDialog.setTitle(`${hostName} vs ${clientName}`); // Simple title
            this.multiplayerEndDialog.clearResults();
            this.multiplayerEndDialog.addPlayerResult(hostName, hostScore, true, hostScore >= clientScore); // Assume host is local? Bad assumption.
            this.multiplayerEndDialog.addPlayerResult(clientName, clientScore, false, clientScore > hostScore);
            this.multiplayerEndDialog.show();
        } else {
            this.showError("Kon eind dialoog niet tonen.");
        }
    }

    /**
     * Shows a dialog indicating the opponent disconnected unexpectedly.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showDisconnection(opponentName) {
        this.hideAll();
        this.disconnectionDialog.show(opponentName, false); // false = disconnect
    }

     /**
     * Shows a dialog indicating the opponent quit intentionally.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showOpponentQuit(opponentName) {
         this.hideAll();
         this.disconnectionDialog.show(opponentName, true); // true = quit
     }

     /**
      * Shows a generic error message using the ErrorDialog instance.
      * @param {string} message - The error message to display.
      * @param {string} [title='Fout'] - Optional title for the dialog.
      */
     showError(message, title = 'Fout') {
         // Maybe don't hideAll for errors? Depends on UX choice. Let ErrorDialog handle its state.
         this.errorDialog.show(title, message);
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
        this.multiplayerEndDialog.backButton.addEventListener('click', () => {
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
        this.disconnectionDialog.backButton.addEventListener('click', () => {
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
        this.singlePlayerEndDialog.saveButton.addEventListener('click', async () => {
            // ... save logic ...
            // After saving, usually go back to menu
            this.singlePlayerEndDialog.hide();
            this.mainMenuController.showView('mainMenu');
            this.mainMenuController._handleEndOfGameCleanup();
        });

        this.singlePlayerEndDialog.restartButton.addEventListener('click', () => {
            this.singlePlayerEndDialog.hide();
            this.mainMenuController.currentGame.restartGame();
            // No cleanup here, restarting the game
        });

        // Assuming the main menu button within this dialog has class 'backToMain' or a specific ID
        const spMenuButton = this.singlePlayerEndDialog.dialogElement.querySelector('.backToMain, #someSpecificId'); // Adjust selector if needed
        spMenuButton.addEventListener('click', () => {
            console.log("DialogController: SP End Dialog Back button clicked.");
             this.singlePlayerEndDialog.hide();
             this.mainMenuController.showView('mainMenu');
             this.mainMenuController._handleEndOfGameCleanup();
        });
    }
}