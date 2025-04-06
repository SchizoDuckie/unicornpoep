/**
 * Manages the specific dialog shown at the end of a single-player PRACTICE game.
 * Inherits from BaseDialog.
 */
class PracticeEndDialog extends BaseDialog {
    /**
     * @param {string} dialogId - The HTML ID of the dialog element.
     * @param {DialogController} dialogController - The DialogController instance.
     */
    constructor(dialogId, dialogController) {
        super(dialogId, null); // Call parent constructor
        this.dialogController = dialogController; // Store the actual DialogController

        // Find specific elements (adjust selectors if needed)
        this.tryAgainButton = this.querySelector('#practiceTryAgainButton'); // Added
        this.menuButton = this.querySelector('#practiceMenuButton'); // Renamed from okButton

        if (!this.tryAgainButton) {
            console.error(`PracticeEndDialog: Try Again button not found within #${dialogId}.`);
        }
        if (!this.menuButton) {
            console.error(`PracticeEndDialog: Menu button not found within #${dialogId}.`);
        }

        this._setupEventListeners();
    }

    /** Sets up listeners specific to this dialog's buttons. */
    _setupEventListeners() {
        if (this.tryAgainButton) { // Listener for Try Again
            this.tryAgainButton.addEventListener('click', () => this.handleTryAgain());
        }
        if (this.menuButton) { // Listener for Main Menu
            this.menuButton.addEventListener('click', () => this.handleBackToMenu());
        }
    }

    /**
     * Shows the dialog.
     * (Content is assumed to be static in the HTML for this specific dialog)
     */
    show() {
        // Reset button states
        if (this.tryAgainButton) this.tryAgainButton.disabled = false;
        if (this.menuButton) this.menuButton.disabled = false;
        
        super.show(); // Call BaseDialog's show method
    }

    /** Handles the Try Again button click. */
    handleTryAgain() {
        console.log("PracticeEndDialog: Try Again clicked.");
        this.hide(); // Hide this dialog
        const mainMenu = this.dialogController.mainMenuController;
        // Trigger restart via the game instance
        if (mainMenu && mainMenu.currentGame && typeof mainMenu.currentGame.restartGame === 'function') {
            mainMenu.currentGame.restartGame();
        } else {
            console.error("PracticeEndDialog: Cannot restart game, currentGame or restartGame method not found.");
            // Fallback: Go to main menu if restart fails
            if(mainMenu) mainMenu.showView('mainMenu'); 
        }
    }

    /** Handles the Main Menu button click. */
    handleBackToMenu() {
        console.log("PracticeEndDialog: Back to Menu clicked.");
        this.hide(); // Hide this dialog
        const mainMenu = this.dialogController.mainMenuController;
        // Navigate back to main menu via the main controller
        if(mainMenu) {
             mainMenu.showView('mainMenu', 'backward');
             // Call cleanup
             mainMenu._handleEndOfGameCleanup();
        }
    }

    /** Override onClose to ensure cleanup and navigation */
    onClose() {
        super.onClose(); // Call base method
        console.log("PracticeEndDialog: Closed via ESC or programmatically.");
        // Default action on close (ESC) is to go back to menu
        this.handleBackToMenu(); 
    }
} 