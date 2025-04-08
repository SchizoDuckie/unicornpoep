import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Dialog for prompting the user to enter their name.
 * Emits Events.UI.Dialog.NameConfirmed when the user confirms.
 * @extends BaseDialog
 */
class NamePromptDialog extends BaseDialog {
    /**
     * Creates an instance of NamePromptDialog.
     */
    constructor() {
        super('#namePromptDialog', 'NamePromptDialog');

        this.nameInput = this.rootElement.querySelector('#namePromptInput');
        this.confirmButton = this.rootElement.querySelector('#namePromptConfirm');

        if (!this.nameInput || !this.confirmButton) {
            console.error(`[${this.name}] Could not find all required child elements (input, confirm button) within ${this.selector}. Dialog cannot function.`);
            throw new Error(`[${this.name}] Missing required child elements within ${this.selector}. Check HTML structure.`);
        }

        this._bindMethods();
        this._boundHandleClose = this._handleDialogClose.bind(this); // Handle native close
        this._addEventListeners();
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleConfirm = this.handleConfirm.bind(this);
    }

    /** Adds specific DOM event listeners for this dialog. */
    _addEventListeners() {
        this.confirmButton.addEventListener('click', this.handleConfirm);
        this.rootElement.addEventListener('close', this._boundHandleClose); // Listen for native close (e.g., ESC key)
    }

     /**
      * Handles the native 'close' event of the dialog element.
      * Ensures the input is cleared when the dialog is dismissed without confirming.
      * @private
      */
     _handleDialogClose() {
        if (this.nameInput) {
            this.nameInput.value = '';
             console.debug(`[${this.name}] Dialog closed natively, name input cleared.`);
        }
     }

    /**
     * Handles the confirm button click.
     * Validates the name and emits the confirmation event.
     */
    handleConfirm() {
        const name = this.nameInput.value.trim();
        if (name) {
            console.debug(`[${this.name}] Name confirmed: '${name}'`);
            eventBus.emit(Events.UI.Dialog.NameConfirmed, { name: name });
            this.hide(); // Close dialog on confirmation
        } else {
            console.warn(`[${this.name}] Confirm attempt failed: Name is empty.`);
            this.nameInput.focus(); // Re-focus input if empty
            // Optionally add visual feedback here (e.g., shake animation)
        }
    }

    /**
     * Shows the dialog and prepares the input field.
     */
    show() {
        this.nameInput.value = ''; // Clear previous input
        super.show(); // Call BaseDialog show to make it visible

        // Focus the input after the dialog is shown
        requestAnimationFrame(() => {
            if (this.rootElement?.open && this.nameInput) {
                this.nameInput.focus();
            }
        });
    }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        console.debug(`[${this.name}] Destroying...`);
        this._removeEventListeners();
        this._boundHandleClose = null; // Clear bound reference
        super.destroy(); // Call base class destroy
    }

    /** Removes specific DOM event listeners attached by this component. */
    _removeEventListeners() {
        // No need to check if elements exist, constructor guarantees it or throws.
        this.confirmButton.removeEventListener('click', this.handleConfirm);
        this.rootElement.removeEventListener('close', this._boundHandleClose);
    }
}

export default NamePromptDialog;
