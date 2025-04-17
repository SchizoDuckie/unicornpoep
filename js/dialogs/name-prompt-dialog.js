import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';
import miscUtils from '../utils/miscUtils.js';

/**
 * NamePromptDialog class.
 * 
 * Displays a modal dialog that prompts users for their name before starting a game.
 * Used primarily for multiplayer and single player game modes to collect player identity.
 * 
 * @property {Object} elements Cached DOM elements for the dialog
 * @property {HTMLElement} elements.nameInput Input field for entering name
 * @property {HTMLElement} elements.confirmButton Button to confirm name selection
 * @property {HTMLElement} elements.cancelButton Button to cancel name selection
 * @property {HTMLElement} elements.dialogTitle Title element of the dialog
 * @property {HTMLElement} elements.errorMessage Element for displaying validation errors
 * @property {string} gameMode Current game mode requiring the name
 * @property {Function|null} onConfirmCallback Optional callback for transition support
 */
class NamePromptDialog extends BaseDialog {
    static SELECTOR = '#namePromptDialog';
    static VIEW_NAME = 'NamePromptDialog';
    
    // Element selectors as constants
    static SELECTORS = {
        NAME_INPUT: '#namePromptInput',
        CONFIRM_BUTTON: '#namePromptConfirm',
        DIALOG_TITLE: '#namePromptDialog h2',
        ERROR_MESSAGE: '#nameError',
        REFRESH_NAME_BUTTON: '#refreshPlayerNameButton'
    };

    // Initial state
    gameMode = null;
    onConfirmCallback = null;

    /**
     * Initializes the dialog using the declarative pattern.
     * 
     * @return {Object} Configuration object with events, domEvents, domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.UI.NamePrompt.Show,
                    callback: this._handleShowPrompt
                }
            ],
            domEvents: [
                {
                    selector: NamePromptDialog.SELECTORS.CONFIRM_BUTTON,
                    event: 'click',
                    handler: this._handleConfirm
                },
                {
                    selector: NamePromptDialog.SELECTORS.NAME_INPUT,
                    event: 'keyup',
                    handler: this._handleNameKeyup
                },
                {
                    selector: NamePromptDialog.SELECTORS.NAME_INPUT,
                    event: 'input',
                    handler: this._validateNameInput
                },
                {
                    selector: NamePromptDialog.SELECTORS.REFRESH_NAME_BUTTON,
                    event: 'click',
                    handler: this._handleRefreshName
                }
            ],
            domElements: [
                {
                    name: 'nameInput',
                    selector: NamePromptDialog.SELECTORS.NAME_INPUT,
                    required: true
                },
                {
                    name: 'confirmButton',
                    selector: NamePromptDialog.SELECTORS.CONFIRM_BUTTON,
                    required: true
                },
                {
                    name: 'dialogTitle',
                    selector: NamePromptDialog.SELECTORS.DIALOG_TITLE,
                    required: false
                },
                {
                    name: 'errorMessage',
                    selector: NamePromptDialog.SELECTORS.ERROR_MESSAGE,
                    required: false
                },
                {
                    name: 'refreshNameButton',
                    selector: NamePromptDialog.SELECTORS.REFRESH_NAME_BUTTON,
                    required: false
                }
            ]
        };
    }

    /**
     * Handles the ShowPrompt event to show the dialog.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.mode Game mode requiring the name
     * @param {Function} payload.callback Optional callback for transition support
     */
    _handleShowPrompt(payload) {
        console.log(`[NamePromptDialog DEBUG] _handleShowPrompt called with payload:`, payload);
        const { mode, callback } = payload || {};
        this.gameMode = mode || 'single';
        this.onConfirmCallback = callback || null;
        
        console.log(`[NamePromptDialog DEBUG] Game mode set to: ${this.gameMode}`);
        console.log(`[NamePromptDialog DEBUG] Callback type: ${typeof this.onConfirmCallback}`);
        
        // Update dialog title based on game mode
        this._updateDialogTitle();
        
        // Load stored name from localStorage
        let playerName = '';
        try {
            playerName = localStorage.getItem('unicornPoepUserName') || '';
            console.log(`[${this.name}] Loaded player name from storage:`, playerName);
        } catch (e) {
            console.warn(`[${this.name}] Failed to load player name from localStorage:`, e);
        }
        
        // Set player name or generate if not found
        if (playerName && this.elements.nameInput) {
            console.log(`[NamePromptDialog DEBUG] Setting input value to: ${playerName}`);
            this.elements.nameInput.value = playerName;
        } else if (this.elements.nameInput) {
            const randomName = miscUtils.generateRandomPlayerName();
            console.log(`[NamePromptDialog DEBUG] Generated random name: ${randomName}`);
            this.elements.nameInput.value = randomName;
        } else {
            console.error(`[NamePromptDialog DEBUG] nameInput element not found!`);
        }
        
        this._clearErrorMessage();
        
        // Update button states
        this._validateNameInput();
        
        // Show the dialog
        console.log(`[NamePromptDialog DEBUG] About to call show()`);
        this.show();
        console.log(`[NamePromptDialog DEBUG] show() called`);
        
        // Focus the input field after dialog appears
        setTimeout(() => {
            if (this.elements.nameInput) {
                console.log(`[NamePromptDialog DEBUG] Focusing input field`);
                this.elements.nameInput.focus();
            }
        }, 100);
    }

    /**
     * Updates the dialog title based on the current game mode.
     */
    _updateDialogTitle() {
        if (!this.elements.dialogTitle) return;
        
        let titleKey = 'namePromptTitleDefault';
        
        if (this.gameMode === 'multiplayer-host') {
            titleKey = 'namePromptTitleHost';
        } else if (this.gameMode === 'multiplayer-join') {
            titleKey = 'namePromptTitleJoin';
        } else if (this.gameMode === 'single') {
            titleKey = 'namePromptTitleSingle';
        }
        
        this.elements.dialogTitle.textContent = getTextTemplate(titleKey, 'Enter Your Name');
    }

    /**
     * Validates the name input and updates UI accordingly.
     */
    _validateNameInput() {
        if (!this.elements.nameInput) return false;
        
        const name = this.elements.nameInput.value.trim();
        const isValid = name.length >= 2;
        
        // Update confirm button state
        if (this.elements.confirmButton) {
            this.elements.confirmButton.disabled = !isValid;
            this.elements.confirmButton.classList.toggle('btn-disabled', !isValid);
        }
        
        // Clear previous error
        this._clearErrorMessage();
        
        return isValid;
    }

    /**
     * Clears any displayed error message.
     */
    _clearErrorMessage() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = '';
            this.elements.errorMessage.classList.add('hidden');
        }
    }

    /**
     * Displays an error message in the dialog.
     * 
     * @param {string} message The error message to display
     */
    _showErrorMessage(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.remove('hidden');
        }
    }

    /**
     * Handles the confirm button click.
     * Validates name and emits the appropriate event based on game mode.
     */
    _handleConfirm() {
        if (!this._validateNameInput()) {
            this._showErrorMessage(getTextTemplate('namePromptErrorShort', 'Name must be at least 2 characters'));
            return;
        }
        
        const playerName = this.elements.nameInput.value.trim();
        
        // Save to localStorage
        try {
            localStorage.setItem('unicornPoepUserName', playerName);
        } catch (e) {
            console.warn(`[${this.name}] Failed to save player name to localStorage:`, e);
        }
        
        // Emit name confirmed event with mode and name
        eventBus.emit(Events.UI.NamePrompt.Confirmed, {
            name: playerName,
            mode: this.gameMode
        });
        
        // Support direct callback pattern during refactoring transition
        if (typeof this.onConfirmCallback === 'function') {
            this.onConfirmCallback(playerName);
        }
        
        this.hide();
    }

    /**
     * Handles keyup events in the name input.
     * 
     * @param {KeyboardEvent} event Keyboard event
     */
    _handleNameKeyup(event) {
        if (event.key === 'Enter') {
            if (this._validateNameInput()) {
                this._handleConfirm();
            }
        }
    }

    /**
     * Handles refreshing the player name with a random name.
     */
    _handleRefreshName() {
        console.log(`[${this.name}] Generating random player name`);
        const newName = miscUtils.generateRandomPlayerName();
        this.elements.nameInput.value = newName;
        this._validateNameInput();
        this._clearErrorMessage();
    }
}

export default NamePromptDialog;
