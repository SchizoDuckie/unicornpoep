/**
 * Manages the specific dialog shown at the end of a multiplayer game.
 * Inherits from BaseDialog.
 */
class MultiplayerEndDialog extends BaseDialog {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        super('multiplayerEndDialog', mainMenuController);

        this.titleElement = this.querySelector('#multiplayerEndTitle');
        this.resultsElement = this.querySelector('#multiplayerEndResults');
        this.backButton = this.querySelector('#multiplayerEndBackButton'); // Specific back button ID

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.backButton?.addEventListener('click', () => {
            this.hide(); // Close dialog
            // Multiplayer game cleanup is handled by the game instance itself
            // Just navigate back
            this.mainMenuController.showView('mainMenu', 'backward'); // Add direction
        });
        // Note: Restart is handled by onclick="location.reload()" in HTML
        // Note: Save score button was removed in previous iterations, logic handled differently now.
    }

    /**
     * Shows the dialog and populates it with the game results.
     * @param {string} hostName
     * @param {number} hostScore
     * @param {string} clientName
     * @param {number} clientScore
     */
    show(hostName, hostScore, clientName, clientScore) {
        if (!this.titleElement || !this.resultsElement) {
            console.error("MultiplayerEndDialog: Title or results element not found!");
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
            winnerName = hostName; winnerScore = hostScore;
            loserName = clientName; loserScore = clientScore;
            title = "Gelijkspel!";
        }

        this.titleElement.textContent = title;
        this.resultsElement.innerHTML = `
            <p><strong>${winnerName}:</strong> ${winnerScore} punten</p>
            <p><strong>${loserName}:</strong> ${loserScore} punten</p>
        `;

        // Trigger confetti (can keep this simple logic here or move to BaseDialog/controller)
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        }

        super.show(); // Call BaseDialog's show method
    }

    /** Handles the Back button click. */
    handleBack() {
        console.log("MultiplayerEndDialog: Back clicked.");
        this.hide();
        // Let the MultiplayerGame know the dialog is closed if needed
        this.mainMenuController?.currentGame?.onMultiplayerEndDialogClose?.();
        // Navigate via the main controller
        this.mainMenuController?.showView('mainMenu');
    }

    /** Override onClose if needed, e.g., to notify game state */
    onClose() {
        super.onClose();
        console.log("MultiplayerEndDialog: Closed via ESC or programmatically.");
        // Ensure navigation happens even if closed via ESC
        // Avoid double navigation if handleBack already triggered it
        if (this.mainMenuController?.viewElements?.mainMenu && !this.mainMenuController.viewElements.mainMenu.classList.contains('hidden')) {
             // Already on main menu, do nothing
        } else {
            this.mainMenuController?.showView('mainMenu');
        }
    }
} 