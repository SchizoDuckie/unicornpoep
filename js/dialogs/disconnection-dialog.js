import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * DisconnectionDialog class.
 * 
 * Shows a dialog when a multiplayer game disconnection occurs.
 * Provides reason-specific messages and allows users to return to the main menu.
 * 
 * @property {HTMLElement} elements.messageContainer Element to display the disconnection message
 * @property {HTMLElement} elements.okButton Button to dismiss the dialog and return to menu
 */
class DisconnectionDialog extends BaseDialog {
    static SELECTOR = '#disconnectionDialog';
    static VIEW_NAME = 'DisconnectionDialog';
    
    // Element selectors as constants
    static SELECTORS = {
        MESSAGE_CONTAINER: '.dialog-message',
        OK_BUTTON: '#disconnectionOkButton'
    };

    /**
     * Initializes the dialog using the declarative pattern.
     * 
     * @return {Object} Configuration object with events, domEvents, domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Multiplayer.Disconnected,
                    callback: this.handleDisconnection
                }
            ],
            domEvents: [
                {
                    selector: DisconnectionDialog.SELECTORS.OK_BUTTON,
                    event: 'click',
                    handler: this.handleOkClick
                }
            ],
            domElements: [
                {
                    name: 'messageContainer',
                    selector: DisconnectionDialog.SELECTORS.MESSAGE_CONTAINER
                },
                {
                    name: 'okButton',
                    selector: DisconnectionDialog.SELECTORS.OK_BUTTON
                }
            ]
        };
    }

    /**
     * Handles disconnection events by showing the dialog with an appropriate message.
     * 
     * @param {Object} data Disconnection data
     * @param {string} data.reason The reason for disconnection
     */
    handleDisconnection(data) {
        const reason = data.reason || 'unknown';
        this.showDisconnectionMessage(reason);
        this.show();
    }

    /**
     * Displays a disconnection message based on the reason provided.
     * 
     * @param {string} reason The reason for disconnection
     */
    showDisconnectionMessage(reason) {
        if (!this.elements.messageContainer) return;
        
        let message = '';
        
        switch (reason) {
            case 'host-left':
                message = getTextTemplate('disconnectionHostLeft', 'The game host has left the game.');
                break;
            case 'host-disconnect':
                message = getTextTemplate('disconnectionHostDisconnect', 'You have been disconnected from the host.');
                break;
            case 'player-left':
                message = getTextTemplate('disconnectionPlayerLeft', 'A player has left the game.');
                break;
            case 'connection-error':
                message = getTextTemplate('disconnectionConnectionError', 'A connection error occurred.');
                break;
            case 'server-shutdown':
                message = getTextTemplate('disconnectionServerShutdown', 'The game server has been shut down.');
                break;
            default:
                message = getTextTemplate('disconnectionUnknown', 'You have been disconnected from the game.');
                break;
        }
        
        this.elements.messageContainer.textContent = message;
    }

    /**
     * Handles the OK button click.
     * Emits an event to return to the main menu and hides the dialog.
     */
    handleOkClick() {
        eventBus.emit(Events.UI.Navigation.ReturnToMenu);
        this.hide();
    }
}

export default DisconnectionDialog; 