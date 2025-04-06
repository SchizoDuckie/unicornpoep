/**
 * Manages the generic error dialog (#errorDialog).
 * Inherits from BaseDialog.
 */
class ErrorDialog extends BaseDialog {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        // Note: mainMenuController might be null if used for early init errors
        super('errorDialog', mainMenuController);

        this.messageElement = this.querySelector('#errorMessage'); // Assuming this ID exists
        this.titleElement = this.querySelector('h2'); // Assuming first h2 is the title
        this.okButton = this.querySelector('#errorOkButton');

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.okButton?.addEventListener('click', () => this.hide());
        // No specific onClose needed unless state needs reset
    }

    /**
     * Shows the dialog with a title and message.
     * @param {string} title - The title for the dialog.
     * @param {string} message - The error message content.
     */
    show(title, message) {
        if (this.titleElement) {
            this.titleElement.textContent = title || 'Fout'; // Default title
        }
        if (this.messageElement) {
            this.messageElement.textContent = message;
        } else {
             // Fallback if the specific message element isn't found
             this.dialogElement.textContent = `${title}: ${message}`;
             console.warn("ErrorDialog: #errorMessage element not found, using fallback.");
        }
        super.show();
    }

    // Hide is handled by BaseDialog + OK button listener
} 