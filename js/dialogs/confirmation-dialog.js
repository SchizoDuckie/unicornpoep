import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Class ConfirmationDialog.
 * 
 * Generic confirmation dialog with customizable title, message, and buttons.
 * Emits events when confirmed or canceled.
 * 
 * @extends BaseDialog
 */
class ConfirmationDialog extends BaseDialog {
    static SELECTOR = '#confirmationDialog';
    static VIEW_NAME = 'ConfirmationDialog';
    
    static SELECTORS = {
        TITLE_ELEMENT: '#confirmationTitle',
        MESSAGE_ELEMENT: '.dialog-message',
        CONFIRM_BUTTON: '#confirmButton',
        CANCEL_BUTTON: '#cancelButton'
    };
    
    // State properties
    confirmCallback = null;
    cancelCallback = null;
    _dialogContext = null;

    /**
     * Initialize the component with configuration.
     * 
     * @return {Object} Configuration object for the component
     */
    initialize() {
        return {
            domEvents: [
                { 
                    selector: ConfirmationDialog.SELECTORS.CONFIRM_BUTTON, 
                    event: 'click', 
                    handler: this._handleConfirm
                },
                { 
                    selector: ConfirmationDialog.SELECTORS.CANCEL_BUTTON, 
                    event: 'click', 
                    handler: this._handleCancel
                }
            ],
            domElements: [
                {
                    name: 'titleElement',
                    selector: ConfirmationDialog.SELECTORS.TITLE_ELEMENT
                },
                {
                    name: 'messageElement',
                    selector: ConfirmationDialog.SELECTORS.MESSAGE_ELEMENT
                },
                {
                    name: 'confirmButton',
                    selector: ConfirmationDialog.SELECTORS.CONFIRM_BUTTON
                },
                {
                    name: 'cancelButton',
                    selector: ConfirmationDialog.SELECTORS.CANCEL_BUTTON
                }
            ]
        };
    }

    /**
     * Handles confirm button click.
     * Hides dialog, calls callback, and emits event.
     * 
     * @return void
     * @event Events.UI.Dialog.GenericConfirm
     * @private
     */
    _handleConfirm() {
        this.hide();
        if (this.confirmCallback) {
            this.confirmCallback(this._dialogContext);
        }
        eventBus.emit(Events.UI.Dialog.GenericConfirm, { dialogId: this.name, context: this._dialogContext });
    }

    /**
     * Handles cancel button click.
     * Hides dialog, calls callback, and emits event.
     * 
     * @return void
     * @event Events.UI.Dialog.GenericCancel
     * @private
     */
    _handleCancel() {
        this.hide();
        if (this.cancelCallback) {
            this.cancelCallback(this._dialogContext);
        }
        eventBus.emit(Events.UI.Dialog.GenericCancel, { dialogId: this.name, context: this._dialogContext });
    }

    /**
     * Shows the confirmation dialog with custom text and callbacks.
     * 
     * @param {Object} options Configuration options
     * @param {string} options.title Dialog title text (defaults to template)
     * @param {string} options.message The main confirmation message
     * @param {string} options.okText Text for the OK button (defaults to template)
     * @param {string} options.cancelText Text for the Cancel button (defaults to template)
     * @param {Function} options.onConfirm Callback function if confirmed
     * @param {Function} options.onCancel Callback function if cancelled
     * @param {any} options.context Optional data to pass to callbacks and events
     * @return void
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

        this.elements.titleElement.textContent = title;
        this.elements.messageElement.textContent = message;
        this.elements.confirmButton.textContent = okText;
        this.elements.cancelButton.textContent = cancelText;

        this.confirmCallback = onConfirm;
        this.cancelCallback = onCancel;
        this._dialogContext = context;

        super.show({ context }); // Show the modal and pass context to Component.Shown event
        this.elements.cancelButton.focus(); // Focus cancel by default
    }
}

// Export the class for instantiation by UIManager
export default ConfirmationDialog; 