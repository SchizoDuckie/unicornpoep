import BaseDialog from './base-dialog.js';
// No specific UI events needed to be emitted from this dialog, only closes itself.
// No eventBus or Events needed unless we add specific error reporting events later.

/**
 * A generic dialog to display error messages to the user.
 * @extends BaseDialog
 */
class ErrorDialog extends BaseDialog {
    static SELECTOR = '#errorDialog';
    static VIEW_NAME = 'ErrorDialog';

    /**
     * Creates an instance of ErrorDialog.
     */
    constructor() {
        super(ErrorDialog.SELECTOR, ErrorDialog.VIEW_NAME);

        this.initialize();
    }

    /** Initializes component elements. */
    initialize() {
        this.messageElement = this.rootElement.querySelector('.dialog-message'); // Generic message class
        if (!this.messageElement) {
            console.error(`[${this.name}] Missing required child element .dialog-message.`);
        }
        this.addCloseButtonListener(); // Add listener for default close button
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM listeners (handled by initialize/addCloseButtonListener). */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners (none needed here).`);
    }
    /** Unregisters DOM listeners (handled by BaseDialog/BaseComponent). */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners (none needed here).`);
    }

    /**
     * Shows the dialog and sets the error message.
     * @param {string} [message="Er is een onbekende fout opgetreden."] - The error message to display.
     */
    show(message = "Er is een onbekende fout opgetreden.") {
        // Constructor throws if messageElement is missing, safe to use here.

        console.warn(`[${this.name}] Showing error dialog: ${message}`); // Use warn for errors
        this.messageElement.textContent = message;
        super.show(); // Call BaseDialog's showModal logic
    }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        this.unregisterListeners();
        super.destroy();
    }
}

export default ErrorDialog; 