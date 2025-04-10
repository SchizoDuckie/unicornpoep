import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * A reusable confirmation dialog.
 * Emits GenericConfirm or GenericCancel events with context.
 */
class ConfirmationDialog extends BaseDialog {
    constructor() {
        super('#confirmationDialog', 'ConfirmationDialog');

        this.titleElement = this.rootElement.querySelector('#confirmationTitle');
        this.messageElement = this.rootElement.querySelector('#confirmationMessage');
        this.okButton = this.rootElement.querySelector('#confirmOkButton');
        this.cancelButton = this.rootElement.querySelector('#confirmCancelButton');

        if (!this.titleElement || !this.messageElement || !this.okButton || !this.cancelButton) {
            throw new Error(`[${this.name}] Missing required child elements within #confirmationDialog.`);
        }

        this._confirmCallback = null;
        this._cancelCallback = null;
        this._dialogContext = null;

        this._addEventListeners();
        console.log(`[${this.name}] Initialized.`);
    }

    _addEventListeners() {
        this.okButton.addEventListener('click', () => {
            this.hide();
            if (this._confirmCallback) {
                this._confirmCallback(this._dialogContext);
            }
            eventBus.emit(Events.UI.Dialog.GenericConfirm, { dialogId: this.name, context: this._dialogContext });
        });

        this.cancelButton.addEventListener('click', () => {
            this.hide();
            if (this._cancelCallback) {
                this._cancelCallback(this._dialogContext);
            }
            eventBus.emit(Events.UI.Dialog.GenericCancel, { dialogId: this.name, context: this._dialogContext });
        });

        // Also handle native 'close' (e.g., ESC) as cancel
        this.rootElement.addEventListener('close', () => {
            if (this.isVisible) { // Only trigger cancel if it was closed while visible (not on initial hide)
                if (this._cancelCallback) {
                    this._cancelCallback(this._dialogContext);
                }
                 eventBus.emit(Events.UI.Dialog.GenericCancel, { dialogId: this.name, context: this._dialogContext });
                 this.isVisible = false; // Ensure isVisible state matches
            }
        });
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

        this._confirmCallback = onConfirm;
        this._cancelCallback = onCancel;
        this._dialogContext = context;

        super.show(); // Show the modal
        this.cancelButton.focus(); // Focus cancel by default
    }
}

// Export the class for instantiation by UIManager
export default ConfirmationDialog; 