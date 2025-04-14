import BaseDialog from './base-dialog.js';
import miscUtils from '../utils/miscUtils.js';

/**
 * @class WaitingDialog
 * @extends BaseDialog
 * Simple dialog to display a waiting message
 */
class WaitingDialog extends BaseDialog {
    static SELECTOR = '#waitingDialog';
    static VIEW_NAME = 'WaitingDialog';

    /** Initializes component elements. */
    initialize() {
        this.messageElement = this.rootElement.querySelector('.dialog-message');
        if (!this.messageElement) console.error(`[${this.name}] Missing required child element .dialog-message.`);
        console.log(`[${this.name}] Initialized.`);
    }

    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners (none).`);
    }
    
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners (none).`);
    }

    /**
     * Shows the dialog, optionally updating the message.
     * @param {string} [message] - Optional message to display. Defaults to template.
     */
    show(message) {
        if (this.messageElement) {
            this.messageElement.textContent = message || miscUtils.getTextTemplate('waitingDialogDefaultMsg');
        }
        super.show(); // Call BaseDialog's show
    }

    /**
     * Hides the dialog.
     */
    hide() {
        super.hide(); // Call BaseDialog's hide
    }

    /**
     * Checks if the dialog is currently open.
     * @returns {boolean} True if the dialog is open
     */
    get isOpen() {
        return this.rootElement instanceof HTMLDialogElement && this.rootElement.open;
    }
}

export default WaitingDialog;
