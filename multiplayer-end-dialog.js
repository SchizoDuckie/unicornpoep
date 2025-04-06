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
        this.backButton.addEventListener('click', () => {
            this.hide(); // Close dialog
            // Multiplayer game cleanup is handled by the game instance itself
            // Just navigate back
            this.mainMenuController.showView('mainMenu', 'backward'); // Add direction
        });
        // Note: Restart is handled by onclick="location.reload()" in HTML
        // Note: Save score button was removed in previous iterations, logic handled differently now.
    }

    /** Sets the dialog title. */
    setTitle(text) {
        if (this.titleElement) {
            this.titleElement.textContent = text;
        } else {
            console.error("MultiplayerEndDialog: Title element not found!");
        }
    }

    /** Clears the results list area. */
    clearResults() {
        if (this.resultsElement) {
            this.resultsElement.innerHTML = ''; // Clear previous results
        } else {
            console.error("MultiplayerEndDialog: Results element not found!");
        }
    }

    /**
     * Adds a single player's result line to the dialog.
     * @param {string} name - Player's name.
     * @param {number} score - Player's score.
     * @param {boolean} isLocal - Whether this is the local player.
     * @param {boolean} isWinner - Whether this player is the winner (and it wasn't a tie).
     */
    addPlayerResult(name, score, isLocal, isWinner) {
        if (!this.resultsElement) return; // Guard clause

        const resultP = document.createElement('p');
        resultP.classList.add('player-result'); // Base class for styling

        let nameText = name;
        if (isLocal) {
            nameText += " (Jij)";
            resultP.classList.add('local-player');
        }
        if (isWinner) {
            resultP.classList.add('winner'); // Add winner class for styling
            nameText = `🏆 ${nameText}`; // Add trophy emoji
        }

        resultP.innerHTML = `<strong>${nameText}:</strong> ${score} punten`; // Use innerHTML for emoji

        this.resultsElement.appendChild(resultP);
    }

    /**
     * Shows the dialog. Assumes content (title, results) has been populated beforehand
     * by the DialogController.
     * REMOVED old parameters: hostName, hostScore, clientName, clientScore
     */
    show() { 
        // Content population is now done by DialogController before calling this show method.
        console.log("MultiplayerEndDialog: show() called.");
        // Optional: Trigger confetti here if desired
        if (typeof confetti === 'function') {
            console.log("MultiplayerEndDialog: Triggering confetti.");
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        }
        super.show(); // Call BaseDialog's show method to make it visible
    }

    /** Handles the Back button click. */
    handleBack() {
        console.log("MultiplayerEndDialog: Back clicked.");
        this.hide();
        // Let the MultiplayerGame know the dialog is closed if needed
        this.mainMenuController.currentGame.onMultiplayerEndDialogClose();
        // Navigate via the main controller
        this.mainMenuController.showView('mainMenu');
    }

    /** Override onClose if needed, e.g., to notify game state */
    onClose() {
        super.onClose();
        console.log("MultiplayerEndDialog: Closed via ESC or programmatically.");
        // Ensure navigation happens even if closed via ESC
        // Avoid double navigation if handleBack already triggered it
        if (this.mainMenuController.viewElements.mainMenu && !this.mainMenuController.viewElements.mainMenu.classList.contains('hidden')) {
             // Already on main menu, do nothing
        } else {
            this.mainMenuController.showView('mainMenu');
        }
    }
} 