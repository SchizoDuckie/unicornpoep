import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * Dialog shown when a multiplayer connection is lost or intentionally closed by the peer.
 * @extends BaseDialog
 */
class DisconnectionDialog extends BaseDialog {
    static SELECTOR = '#disconnectionDialog';
    static VIEW_NAME = 'DisconnectionDialog';

    /** Initializes component elements. */
    initialize() {
        this.messageElement = this.rootElement.querySelector('.dialog-message'); // Generic message class
        this.okButton = this.rootElement.querySelector('#disconnectionOkButton'); // Specific OK button

        if (!this.messageElement) console.error(`[${this.name}] Missing required child element .dialog-message.`);
        if (!this.okButton) console.error(`[${this.name}] Missing required child element #disconnectionOkButton.`);

        this._bindMethods();
        // Listeners added by registerListeners
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this.handleOk = this.handleOk.bind(this);
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.okButton) {
             this.okButton.addEventListener('click', this.handleOk);
        } else {
             console.warn(`[${this.name}] OK button not found, cannot add listener.`);
        }
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.okButton) {
             this.okButton.removeEventListener('click', this.handleOk);
        }
    }

    /** Handles the OK button click */
    handleOk() {
        console.debug(`[${this.name}] OK button clicked.`);
        this.hide();
        // Optionally emit an event to navigate back to the main menu
        eventBus.emit(Events.UI.Dialog.ReturnToMenuClicked);
    }

    /** Shows the dialog with a specific message */
    show(message = 'You have been disconnected.') { // Provide a default message
        if (this.messageElement) {
            this.messageElement.textContent = message;
        }
        super.show(); // Call BaseDialog show
    }
    
    // Override destroy to ensure listeners are removed
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners(); // Ensure DOM listeners are removed
        super.destroy();
    }
}

export default DisconnectionDialog; 