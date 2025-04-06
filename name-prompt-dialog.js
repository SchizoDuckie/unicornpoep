/**
 * Manages the dialog for prompting the user to enter their name (#namePromptDialog).
 * Inherits from BaseDialog.
 */
class NamePromptDialog extends BaseDialog {
    /**
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        super('namePromptDialog', mainMenuController);

        this.inputElement = this.querySelector('#namePromptInput');
        this.confirmButton = this.querySelector('#namePromptConfirm');
        // Assuming no cancel button based on HTML

        // Promise resolvers for the prompt interaction
        this.resolvePromise = null;
        this.rejectPromise = null; // Although typically we just resolve with null

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.confirmButton.addEventListener('click', () => this.handleConfirm());
        // Add listener for Enter key on input
        this.inputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent potential form submission
                this.handleConfirm();
            }
        });
    }

    /**
     * Shows the dialog and returns a Promise that resolves with the entered name
     * or null if cancelled/closed.
     * @returns {Promise<string|null>}
     */
    prompt() {
        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
            // this.rejectPromise = reject; // Not typically used, resolve(null) covers cancellation

            if (this.inputElement) {
                this.inputElement.value = ''; // Clear previous input
            }
            super.show(); // Show the dialog using base class method
            this.inputElement.focus(); // Focus the input field
        });
    }

    /** Handles the Confirm button click. */
    handleConfirm() {
        const name = this.inputElement.value.trim();
        if (name) {
            this.hide(); // Hide the dialog first
            if (this.resolvePromise) {
                this.resolvePromise(name); // Resolve the promise with the name
                this.resolvePromise = null; // Clear resolver
            }
        } else {
            // Provide feedback - potentially delegate to showError
            // Use alert for now as DialogController might not be fully available depending on usage context
            alert("Voer alsjeblieft een naam in.");
            this.inputElement.focus();
        }
    }

    /** Override onClose to handle ESC key closing */
    onClose() {
        super.onClose(); // Call base method
        // If closed without confirming, resolve the promise with null
        if (this.resolvePromise) {
            console.log("NamePromptDialog: Closed via ESC or programmatically, resolving with null.");
            this.resolvePromise(null);
            this.resolvePromise = null;
        }
    }

    // Hide is handled by BaseDialog and handleConfirm/onClose
} 