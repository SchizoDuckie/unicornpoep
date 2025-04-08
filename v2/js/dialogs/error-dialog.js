import BaseDialog from './base-dialog.js';
// No specific UI events needed to be emitted from this dialog, only closes itself.
// No eventBus or Events needed unless we add specific error reporting events later.

/**
 * A generic dialog to display error messages to the user.
 * @extends BaseDialog
 */
class ErrorDialog extends BaseDialog {
    /**
     * Creates an instance of ErrorDialog.
     */
    constructor() {
        super('#errorDialog', 'ErrorDialog');

        // Find elements (rootElement guaranteed by super())
        this.messageElement = this.rootElement.querySelector('#errorMessage');
        this.okButton = this.rootElement.querySelector('#errorOkButton');

        if (!this.messageElement || !this.okButton) {
            // Throw if essential elements are missing
            throw new Error(`[${this.name}] Missing required child elements within #errorDialog: #errorMessage or #errorOkButton.`);
        }

        this._bindMethods();
        this._addEventListeners();
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleOk = this.handleOk.bind(this);
    }

    /** Adds specific DOM event listeners for this dialog. */
    _addEventListeners() {
        this.okButton.addEventListener('click', this.handleOk);
        // No specific close listener needed as BaseDialog handles ESC,
        // and OK button click also closes it.
    }

    /** Removes specific DOM event listeners. */
    _removeEventListeners() {
        // Constructor throws if okButton is missing, so we can assume it exists here.
        this.okButton.removeEventListener('click', this.handleOk);
    }

    /**
     * Handles the OK button click. Simply closes the dialog.
     */
    handleOk() {
        console.debug(`[${this.name}] OK button clicked.`);
        this.hide();
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
        this._removeEventListeners();
        super.destroy();
    }
}

export default ErrorDialog; 