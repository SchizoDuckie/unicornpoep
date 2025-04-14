import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Dialog for prompting the user to enter their name.
 * Emits Events.UI.Dialog.NameConfirmed when the user confirms.
 * @extends BaseDialog
 */
class NamePromptDialog extends BaseDialog {
    static SELECTOR = '#namePromptDialog';
    static VIEW_NAME = 'NamePromptDialog';

    /** Initializes component elements. */
    initialize() {
        this.nameInput = this.rootElement.querySelector('#namePromptInput'); // Use specific ID
        this.confirmButton = this.rootElement.querySelector('#namePromptConfirm'); // Use specific ID
        this.errorDisplay = this.rootElement.querySelector('#nameError'); // Use specific ID

        if (!this.nameInput) console.error(`[${this.name}] Missing #namePromptInput.`);
        if (!this.confirmButton) console.error(`[${this.name}] Missing #namePromptConfirm.`);
        if (!this.errorDisplay) console.warn(`[${this.name}] Missing #nameError.`);

        this.confirmCallback = null;
        this._bindMethods();
        // Listeners added by registerListeners
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this.handleConfirm = this.handleConfirm.bind(this);
        this._clearError = this._clearError.bind(this);
        this._handleDialogClose = this._handleDialogClose.bind(this); // Handle native close
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.confirmButton) this.confirmButton.addEventListener('click', this.handleConfirm);
        if (this.nameInput) this.nameInput.addEventListener('input', this._clearError);
        // Listen for native close (e.g., ESC key) only when shown?
        // Or maybe always listen? Let's keep it simple for now.
        this.rootElement.addEventListener('close', this._handleDialogClose); 
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.confirmButton) this.confirmButton.removeEventListener('click', this.handleConfirm);
        if (this.nameInput) this.nameInput.removeEventListener('input', this._clearError);
        this.rootElement.removeEventListener('close', this._handleDialogClose);
     }

    /** Handles the confirm button click */
    handleConfirm() {
        const name = this.nameInput.value.trim();
        if (this.validateName(name)) {
            this.hide();
            if (typeof this.confirmCallback === 'function') {
                this.confirmCallback(name);
            }
        } else {
            this.nameInput.focus();
        }
    }

    /** Handles the native dialog close event (e.g., ESC key) */
    _handleDialogClose() {
        console.debug(`[${this.name}] Dialog closed (native).`);
        // Treat native close as cancellation/no action
        if (typeof this.confirmCallback === 'function') {
            // Optionally call callback with null/undefined to indicate cancellation?
            // For now, just do nothing, like clicking outside.
        }
        // Ensure listeners are cleaned up if hide() wasn't called via button
        this.unregisterListeners(); // Might be redundant if hide calls it, but safe
    }

    /** Clears the error message */
    _clearError() {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = '';
            this.errorDisplay.classList.add('hidden');
            }
    }

    /** Shows an error message */
    _showError(message) {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = message;
            this.errorDisplay.classList.remove('hidden');
        }
    }
    
    /** Validates the entered name */
    validateName(name) {
        if (!name) {
            this._showError(getTextTemplate('joinErrorEmptyName'));
            return false;
        }
        if (name.length > 40) { 
            this._showError(getTextTemplate('joinErrorNameTooLong'));
            return false;
        }
        this._clearError();
        return true;
    }

    /**
     * Shows the dialog and sets the callback.
     * @param {function(string | null)} onConfirm - Callback function executed with the entered name 
     *                                              or null if canceled (optional).
     * @param {string} [defaultName=''] - Optional default value for the input.
     */
    show(onConfirm, defaultName = '') {
        this.confirmCallback = onConfirm;
        if (this.nameInput) {
            this.nameInput.value = defaultName;
        }
        this._clearError();
        // Ensure listeners are added when shown
        // this.registerListeners(); // Now handled by BaseComponent constructor
        super.show(); // Call BaseDialog show
        if (this.nameInput) {
            this.nameInput.focus();
            this.nameInput.select();
        }
    }

    // Override destroy to ensure listeners are removed
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners(); // Ensure DOM listeners are removed
        super.destroy();
    }
}

export default NamePromptDialog;
