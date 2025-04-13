import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Generic confirmation dialog (Yes/No).
 */
class ConfirmationDialog extends BaseDialog {
    static SELECTOR = '#confirmationDialog';
    static VIEW_NAME = 'ConfirmationDialog';

    /** Initializes component elements. */
    initialize() {
        this.messageElement = this.rootElement.querySelector('.dialog-message');
        this.confirmButton = this.rootElement.querySelector('#confirmButton');
        this.cancelButton = this.rootElement.querySelector('#cancelButton');

        if (!this.messageElement || !this.confirmButton || !this.cancelButton) {
            console.error(`[${this.name}] Missing required elements.`);
        }

        this.confirmCallback = null;
        this.cancelCallback = null;

        this._bindMethods();
        // Listeners added by registerListeners
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.confirmButton) this.confirmButton.addEventListener('click', this.handleConfirm);
        if (this.cancelButton) this.cancelButton.addEventListener('click', this.handleCancel);
        // BaseDialog handles ESC close
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.confirmButton) this.confirmButton.removeEventListener('click', this.handleConfirm);
        if (this.cancelButton) this.cancelButton.removeEventListener('click', this.handleCancel);
    }

    /** Handles the confirm button click */
    handleConfirm() {
            this.hide();
        if (this.confirmCallback) {
            this.confirmCallback(this._dialogContext);
            }
            eventBus.emit(Events.UI.Dialog.GenericConfirm, { dialogId: this.name, context: this._dialogContext });
    }

    /** Handles the cancel button click */
    handleCancel() {
            this.hide();
        if (this.cancelCallback) {
            this.cancelCallback(this._dialogContext);
                }
                 eventBus.emit(Events.UI.Dialog.GenericCancel, { dialogId: this.name, context: this._dialogContext });
    }

    /**
     * Shows the confirmation dialog with custom text and callbacks.
     * @param {object} options
     * @param {string} [options.title] - Dialog title text (defaults to template).
     * @param {string} options.message - The main confirmation message.
     * @param {string} [options.okText] - Text for the OK button (defaults to template).
     * @param {string} [options.cancelText] - Text for the Cancel button (defaults to template).
     * @param {Function} [options.onConfirm] - Callback function if confirmed.
     * @param {Function} [options.onCancel] - Callback function if cancelled.
     * @param {any} [options.context] - Optional data to pass to callbacks and events.
     */
    show({ 
        title = getTextTemplate('confirmDefaultTitle'), 
        message, 
        okText = getTextTemplate('confirmDefaultOk'), 
        cancelText = getTextTemplate('confirmDefaultCancel'), 
        onConfirm, 
        onCancel, 
        context = null 
    } = {}) {
        if (!message) {
            console.error(`[${this.name}] show() called without a message.`);
            return;
        }

        this.titleElement.textContent = title;
        this.messageElement.textContent = message;
        this.okButton.textContent = okText;
        this.cancelButton.textContent = cancelText;

        this.confirmCallback = onConfirm;
        this.cancelCallback = onCancel;
        this._dialogContext = context;

        super.show(); // Show the modal
        this.cancelButton.focus(); // Focus cancel by default
    }
}

// Export the class for instantiation by UIManager
export default ConfirmationDialog; 