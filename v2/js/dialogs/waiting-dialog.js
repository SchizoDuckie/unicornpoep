import BaseDialog from './base-dialog.js';
import miscUtils from '../utils/miscUtils.js'; // Use default import


/**
 * @class WaitingDialog
 * @extends BaseDialog
 * Simple dialog to display a waiting message (e.g., "Waiting for host...").
 */
class WaitingDialog extends BaseDialog {
    static SELECTOR = '#waitingDialog';
    static VIEW_NAME = 'WaitingDialog';

    /** Initializes component elements. */
    initialize() {
        this.messageElement = this.rootElement.querySelector('.dialog-message'); // Generic message class
        // No buttons or listeners specific to this dialog usually
        if (!this.messageElement) console.error(`[${this.name}] Missing required child element .dialog-message.`);
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM listeners (none needed). */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners (none).`);
    }
    /** Unregisters DOM listeners (none needed). */
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
        if (this.spinnerElement) {
            this.spinnerElement.classList.remove('hidden'); // Ensure spinner is visible
        }
        super.show(); // Call BaseDialog's show
    }

    /**
     * Hides the dialog.
     */
    hide() {
        super.hide(); // Call BaseDialog's hide
        if (this.spinnerElement) {
            this.spinnerElement.classList.add('hidden'); // Hide spinner when dialog closes
        }
    }

}

export default WaitingDialog;
