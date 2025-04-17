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
    
    static SELECTORS = {
        MESSAGE_ELEMENT: '.dialog-message'
    };

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration with domElements
     */
    initialize() {
        return {
            domElements: [
                {
                    name: 'messageElement',
                    selector: ErrorDialog.SELECTORS.MESSAGE_ELEMENT
                }
            ]
        };
    }

    /**
     * Shows the dialog and sets the error message.
     * @param {string} [message="Er is een onbekende fout opgetreden."] - The error message to display.
     */
    show(message = "Er is een onbekende fout opgetreden.") {
        console.warn(`[${this.name}] Showing error dialog: ${message}`); // Use warn for errors
        
        if (this.elements.messageElement) {
            this.elements.messageElement.textContent = message;
        }
        
        super.show(); // Call BaseDialog's showModal logic
    }
}

export default ErrorDialog; 