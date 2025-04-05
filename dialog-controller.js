/**
 * Manages various modal dialogs: End of Game (Single/Multi), Disconnection, Opponent Quit, and generic errors.
 */
class DialogController {
    /**
     * Initializes the controller, gets dialog elements, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
        // Single Player End Dialog
        this.singlePlayerEndDialog = document.getElementById('endOfGameDialog');
        this.finalScoreSpan = document.getElementById('finalScore');
        this.playerNameInputSingle = document.getElementById('playerName'); // Input in single player dialog
        this.saveScoreButtonSingle = document.getElementById('saveHighscore');
        this.restartButtonSingle = document.getElementById('restartGame');

        // Multiplayer End Dialog
        this.multiplayerEndDialog = document.getElementById('multiplayerEndDialog');
        this.multiplayerEndTitle = document.getElementById('multiplayerEndTitle');
        this.multiplayerEndResults = document.getElementById('multiplayerEndResults');
        this.multiplayerEndBackButton = document.getElementById('multiplayerEndBackButton');
        this.winnerNameSpan = document.getElementById('winnerName');
        this.winnerScoreSpan = document.getElementById('winnerScore');
        this.loserNameSpan = document.getElementById('loserName');
        this.loserScoreSpan = document.getElementById('loserScore');
        this.saveScoreButtonMulti = document.getElementById('saveMultiplayerHighscore'); // Button in multi dialog
        this.restartButtonMulti = this.multiplayerEndDialog?.querySelector('button[onclick="location.reload()"]'); // Restart via reload

        // Disconnection / Opponent Quit Dialog
        this.disconnectionDialog = document.getElementById('disconnectionDialog');
        this.disconnectionMessageSpan = document.getElementById('disconnectionMessage');
        this.backToMenuButtonDisconnect = document.getElementById('backToMainMenu'); // Button within this specific dialog

        this.setupEventListeners();
    }

    /**
     * Sets up listeners for buttons within all managed dialogs.
     */
    setupEventListeners() {
        // Single Player End Dialog
        if (this.singlePlayerEndDialog) {
            this.saveScoreButtonSingle?.addEventListener('click', () => this.handleSaveSinglePlayer());
            this.restartButtonSingle?.addEventListener('click', () => this.game.restartGame());
            // Listener for the pre-rendered '.backToMain' button
            this.singlePlayerEndDialog.querySelectorAll('.backToMain').forEach(btn => {
                btn.addEventListener('click', () => this.closeAndGoToMenu(this.singlePlayerEndDialog));
            });
             // Close event handler (e.g., pressing ESC)
             this.singlePlayerEndDialog.addEventListener('close', () => {
                 // If closed without specific action, default to going back to menu
                 // Check if game is still potentially active to avoid double navigation
                 if (!this.game.gameAreaController.isVisible()) {
                     // this.game.backToMainMenu(); // Let closeAndGoToMenu handle state reset
                 }
             });
        }

        // Multiplayer End Dialog
        if (this.multiplayerEndDialog) {
             this.saveScoreButtonMulti?.addEventListener('click', () => this.handleSaveMultiplayer());
             // Restart button uses onclick="location.reload()" in HTML

             // Listener for the pre-rendered '.backToMain' button
             this.multiplayerEndDialog.querySelectorAll('.backToMain').forEach(btn => {
                 btn.addEventListener('click', () => this.closeAndGoToMenu(this.multiplayerEndDialog));
             });
             // Close event handler
             this.multiplayerEndDialog.addEventListener('close', () => {
                // If closed via backdrop/esc, ensure state is reset and go to menu
                // Check if game is potentially active
                 if (!this.game.gameAreaController.isVisible()) {
                     // this.game.backToMainMenu();
                 }
             });
        }

        // Disconnection Dialog
        if (this.disconnectionDialog) {
            // The button ID 'backToMainMenu' is specific to this dialog in the HTML
            this.backToMenuButtonDisconnect?.addEventListener('click', () => this.closeAndGoToMenu(this.disconnectionDialog));
             this.disconnectionDialog.addEventListener('close', () => {
                 // Always go to main menu when disconnection dialog is closed (either by button or ESC)
                 this.game.backToMainMenu();
             });
        }

        // Listener for the new dialog's back button
        this.multiplayerEndBackButton?.addEventListener('click', () => {
            this.hideAll(); // Close this dialog
            this.game.backToMainMenu(); // Trigger return and cleanup
        });
    }

    /**
     * Checks if any of the managed dialogs are currently visible/open.
     * @returns {boolean} True if any dialog is open, false otherwise.
     */
    isDialogVisible() {
        return (this.singlePlayerEndDialog?.open ||
                this.multiplayerEndDialog?.open ||
                this.disconnectionDialog?.open) ?? false; // Use nullish coalescing for default false
    }

    /**
     * Hides all managed dialogs by calling their close() method.
     */
    hideAll() {
        [this.singlePlayerEndDialog, this.multiplayerEndDialog, this.disconnectionDialog].forEach(dialog => {
            if (dialog && typeof dialog.close === 'function' && dialog.open) {
                dialog.close();
            }
        });
        if (this.multiplayerEndDialog && this.multiplayerEndDialog.open) {
            this.multiplayerEndDialog.close();
        }
        this.multiplayerEndDialog?.classList.add('hidden'); // Also add hidden class if using CSS
    }

    /**
     * Shows the end-of-game dialog for single player.
     * @param {number} score - The final score.
     */
    showSinglePlayerEnd(score) {
        this.hideAll(); // Ensure others are closed
        if (!this.singlePlayerEndDialog) return;

        if (this.finalScoreSpan) this.finalScoreSpan.textContent = score;
        if (this.playerNameInputSingle) this.playerNameInputSingle.value = this.game.playerName; // Pre-fill name
        // Check if already open to prevent errors, though hideAll should handle it
        if (!this.singlePlayerEndDialog.open) {
            this.singlePlayerEndDialog.showModal();
        }
    }

    /**
     * Shows the end-of-game dialog for multiplayer matches.
     * @param {string} hostName
     * @param {number} hostScore
     * @param {string} clientName
     * @param {number} clientScore
     */
    showMultiplayerEndDialog(hostName, hostScore, clientName, clientScore) {
        this.hideAll(); // Ensure no other dialogs are open

        if (!this.multiplayerEndDialog || !this.multiplayerEndTitle || !this.multiplayerEndResults) {
            console.error("Multiplayer end dialog elements not found!");
            return;
        }

        let winnerName = '';
        let loserName = '';
        let winnerScore = 0;
        let loserScore = 0;
        let title = '';

        if (hostScore > clientScore) {
            winnerName = hostName; winnerScore = hostScore;
            loserName = clientName; loserScore = clientScore;
            title = `${winnerName} wint!`;
        } else if (clientScore > hostScore) {
            winnerName = clientName; winnerScore = clientScore;
            loserName = hostName; loserScore = hostScore;
             title = `${winnerName} wint!`;
        } else {
            // Tie
            winnerName = hostName; winnerScore = hostScore; // Arbitrarily pick one for display consistency if needed
            loserName = clientName; loserScore = clientScore;
            title = "Gelijkspel!";
        }

        this.multiplayerEndTitle.textContent = title;

        // Display results - Customize formatting as needed
        this.multiplayerEndResults.innerHTML = `
            <p><strong>${winnerName}:</strong> ${winnerScore} punten</p>
            <p><strong>${loserName}:</strong> ${loserScore} punten</p>
        `;

        // Trigger confetti, targeting the dialog or body
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
        });

         // Make sure the dialog element is visible before showing
         this.multiplayerEndDialog.classList.remove('hidden');
        this.multiplayerEndDialog.showModal();
    }

    /**
     * Shows a dialog indicating the opponent disconnected unexpectedly.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showDisconnection(opponentName) {
        this.hideAll();
        if (!this.disconnectionDialog) return;

        const name = opponentName || 'De andere speler';
        if (this.disconnectionMessageSpan) {
             this.disconnectionMessageSpan.textContent = `${name} heeft de verbinding verbroken.`;
        }
        if (!this.disconnectionDialog.open) {
             this.disconnectionDialog.showModal();
        }
    }

     /**
     * Shows a dialog indicating the opponent quit intentionally.
     * @param {string | null} opponentName - The opponent's name, if known.
     */
    showOpponentQuit(opponentName) {
         this.hideAll();
         if (!this.disconnectionDialog) return; // Reuse disconnection dialog

         const name = opponentName || 'De andere speler';
         if (this.disconnectionMessageSpan) {
             this.disconnectionMessageSpan.textContent = `${name} heeft het spel verlaten.`;
         }
         if (!this.disconnectionDialog.open) {
            this.disconnectionDialog.showModal();
         }
     }

     /**
      * Shows a generic error message using an alert.
      * @param {string} message - The error message to display.
      */
     showError(message) {
         // Simple implementation using alert. Could be replaced with a dedicated dialog later.
         alert(`Fout: ${message}`);
     }

    /** Handles saving score from the single player end dialog. */
    handleSaveSinglePlayer() {
        if (!this.playerNameInputSingle) return;
        const name = this.playerNameInputSingle.value;
        if (!name.trim()) { alert("Vul je naam in om op te slaan!"); return; }
        this.game.updatePlayerName(name);
        this.game.saveHighscore(name); // Game handles closing dialog and navigation
    }

    /** Handles saving score from the multiplayer end dialog (local player's score). */
    handleSaveMultiplayer() {
        // Save with game's current name, as dialog has no input
        alert("Score wordt opgeslagen voor " + this.game.playerName); // Give feedback
        this.game.saveHighscore(this.game.playerName); // Game handles closing dialog and navigation
    }

    /**
     * Closes a specified dialog and triggers navigation back to the main menu via the Game class.
     * @param {HTMLDialogElement | null} dialogElement - The dialog element to close.
     */
    closeAndGoToMenu(dialogElement) {
        if (dialogElement && typeof dialogElement.close === 'function' && dialogElement.open) {
            dialogElement.close(); // Close the dialog first
        }
        // Then call the central method in Game to handle state reset and navigation
        this.game.backToMainMenu();
    }

    /**
     * Shows a dialog prompting the user to enter their name.
     * @returns {Promise<string|null>} A promise that resolves with the entered name, 
     *                                  or null if the dialog was cancelled or closed.
     */
    promptForPlayerName() {
        return new Promise((resolve) => {
            const dialog = document.getElementById('namePromptDialog');
            const input = document.getElementById('namePromptInput');
            const confirmButton = document.getElementById('namePromptConfirm');
            // const cancelButton = document.getElementById('namePromptCancel'); // If you add one

            if (!dialog || !input || !confirmButton) {
                console.error("Name prompt dialog elements not found!");
                resolve(null); // Cannot proceed
                return;
            }

            // Function to handle closing and resolving
            const closeDialog = (name = null) => {
                confirmButton.removeEventListener('click', handleConfirm);
                // if (cancelButton) cancelButton.removeEventListener('click', handleCancel);
                dialog.removeEventListener('close', handleClose); // Handle closing via ESC
                dialog.close();
                dialog.classList.add('hidden'); // Re-hide after closing
                resolve(name); // Resolve with the name or null
            };

            const handleConfirm = () => {
                const name = input.value.trim();
                if (name) {
                    closeDialog(name);
                } else {
                    alert("Voer alsjeblieft een naam in."); // Basic validation
                    input.focus();
                }
            };

            // const handleCancel = () => {
            //     closeDialog(null);
            // };

            const handleClose = () => { // Handle ESC key closing
                 // Resolve with null if closed without confirmation
                 // Check dialog.returnValue if needed, but simple null resolution is often fine
                 closeDialog(null); 
            }

            // Setup listeners
            confirmButton.addEventListener('click', handleConfirm);
            // if (cancelButton) cancelButton.addEventListener('click', handleCancel);
            dialog.addEventListener('close', handleClose);

            // Show the dialog
            input.value = ''; // Clear previous input
            dialog.classList.remove('hidden'); // <<< --- ADD THIS LINE to remove hidden class
            dialog.showModal();
            input.focus();
        });
    }
}