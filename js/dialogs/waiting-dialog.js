import BaseDialog from './base-dialog.js';
import miscUtils from '../utils/miscUtils.js';

/**
 * Class WaitingDialog.
 * 
 * Simple dialog to display a waiting message.
 * Shows a spinner or message while an operation is in progress.
 * 
 * @extends BaseDialog
 */
class WaitingDialog extends BaseDialog {
    static SELECTOR = '#waitingDialog';
    static VIEW_NAME = 'WaitingDialog';
    
    static SELECTORS = {
        MESSAGE_ELEMENT: '.dialog-message'
    };

    /**
     * Initialize the dialog component using the declarative pattern.
     * 
     * @return {Object} Configuration with domElements
     */
    initialize() {
        return {
            domElements: [
                {
                    name: 'messageElement',
                    selector: WaitingDialog.SELECTORS.MESSAGE_ELEMENT
                }
            ]
        };
    }

    /**
     * Shows the dialog, optionally updating the message.
     * 
     * @param {string} message Optional message to display. Defaults to template.
     * @return void
     */
    show(message) {
        console.log(`[${this.constructor.name}] Show method called with message: ${message || 'default'}`);
        
        if (!this.rootElement) {
            console.error(`[${this.constructor.name}] Cannot show dialog: rootElement is null or undefined.`);
            return;
        }
        
        if (this.elements.messageElement) {
            const messageText = message || miscUtils.getTextTemplate('waitingDialogDefaultMsg');
            console.log(`[${this.constructor.name}] Setting message to: "${messageText}"`);
            this.elements.messageElement.textContent = messageText;
        } else {
            console.warn(`[${this.constructor.name}] Message element not found. Cannot set message.`);
        }
        
        // Call BaseDialog's show method
        super.show();
        
        // Check if the dialog is actually visible after showing
        setTimeout(() => {
            console.log(`[${this.constructor.name}] Dialog show complete. Dialog is ${this.isOpen ? 'open' : 'not open'}`);
            if (this.rootElement) {
                console.log(`[${this.constructor.name}] Element visibility: ${window.getComputedStyle(this.rootElement).display}`);
            }
        }, 100);
    }

    /**
     * Checks if the dialog is currently open.
     * 
     * @return {boolean} True if the dialog is open
     */
    get isOpen() {
        return this.rootElement instanceof HTMLDialogElement && this.rootElement.open;
    }
}

export default WaitingDialog;
