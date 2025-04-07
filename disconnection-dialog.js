/**
 * Manages the dialog shown when an opponent disconnects or quits.
 * Uses the #disconnectionDialog element. Inherits from BaseDialog.
 */
class DisconnectionDialog extends BaseDialog {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        super('disconnectionDialog', mainMenuController);

        this.messageSpan = this.querySelector('#disconnectionMessage');
        // Button ID is specific in this dialog's HTML
        this.backButton = this.querySelector('#backToMainMenu');

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.backButton.addEventListener('click', () => {
            this.hide();
            this.mainMenuController.showView('mainMenu', 'backward');
        });
    }

    /**
     * Shows the dialog with the appropriate message.
     * @param {string | null} opponentName - The opponent's name, if known.
     * @param {boolean} didQuit - True if the opponent quit intentionally, false if disconnected.
     */
    show(opponentName, didQuit = false) {
        if (!this.messageSpan) return;

        const name = opponentName || 'De andere speler';
        const action = didQuit ? 'heeft het spel verlaten' : 'heeft de verbinding verbroken';
        this.messageSpan.textContent = `${name} ${action}.`;

        super.show();
    }

    /** Handles the Back button click. */
    handleBack() {
        console.log("DisconnectionDialog: Back clicked.");
        this.hide();
        // Navigate via the main controller
        this.mainMenuController.showView('mainMenu');
    }

    /** Override onClose to ensure navigation */
    onClose() {
        super.onClose();
        // Always go to main menu when this dialog is closed
        console.log("DisconnectionDialog: Closed via ESC or programmatically, navigating to menu.");
         // Avoid double navigation if handleBack already triggered it
         if (this.mainMenuController.viewElements.mainMenu && !this.mainMenuController.viewElements.mainMenu.classList.contains('hidden')) {
              // Already on main menu, do nothing
         } else {
             this.mainMenuController.showView('mainMenu');
         }
    }
} 