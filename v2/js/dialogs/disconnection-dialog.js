import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * Dialog shown when a multiplayer connection is lost or intentionally closed by the peer.
 * @extends BaseDialog
 */
class DisconnectionDialog extends BaseDialog {
    /**
     * Creates an instance of DisconnectionDialog.
     */
    constructor() {
        super('#disconnectionDialog', 'DisconnectionDialog');

        // Find elements (rootElement guaranteed by super())
        this.messageElement = this.rootElement.querySelector('#disconnectionMessage');
        this.menuButton = this.rootElement.querySelector('#backToMainMenu'); // Button ID from HTML

        if (!this.messageElement || !this.menuButton) {
            // Throw if essential elements are missing
            throw new Error(`[${this.name}] Missing required child elements within #disconnectionDialog: #disconnectionMessage or #backToMainMenu.`);
        }

        this._bindMethods();
        this._addEventListeners();
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleMenu = this.handleMenu.bind(this);
    }

    /** Adds specific DOM event listeners for this dialog. */
    _addEventListeners() {
        this.menuButton.addEventListener('click', this.handleMenu);
        // No specific close listener needed as BaseDialog handles ESC
    }

    /** Removes specific DOM event listeners. */
    _removeEventListeners() {
        // Constructor throws if menuButton is missing, so we can assume it exists here.
        this.menuButton.removeEventListener('click', this.handleMenu);
    }

    /**
     * Handles the return to menu button click.
     */
    handleMenu() {
        console.debug(`[${this.name}] Return to menu clicked.`);
        // Use ReturnToMenu event for consistency.
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }

    /**
     * Shows the dialog and sets the disconnection message.
     * @param {string} [message] - The message to display (defaults to template).
     */
    show(message = getTextTemplate('disconnectDefault')) {
        // Constructor throws if messageElement is missing, safe to use here.

        console.debug(`[${this.name}] Showing disconnection dialog: ${message}`);
        this.messageElement.textContent = message;
        super.show(); // Call BaseDialog's showModal logic
    }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        this._removeEventListeners();
        super.destroy();
    }
}

export default DisconnectionDialog; 