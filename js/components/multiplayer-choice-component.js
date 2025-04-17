import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';
import miscUtils from '../utils/miscUtils.js';

/**
 * @class MultiplayerChoiceComponent
 * @extends RefactoredBaseComponent
 * Handles the view where the user chooses to Host or Join a multiplayer game
 * after entering their name.
 */
class MultiplayerChoiceComponent extends RefactoredBaseComponent {
    static SELECTOR = '#multiplayerChoice';
    static VIEW_NAME = 'MultiplayerChoiceComponent';

    // Element selectors using consistent pattern
    static SELECTORS = {
        PLAYER_NAME_INPUT: '#playerNameInput',
        HOST_BUTTON: '#hostGame',
        JOIN_BUTTON: '#joinGame',
        BACK_BUTTON: '.backToMain',
        NAME_ERROR: '#choiceError',
        REFRESH_NAME_BUTTON: '#refreshPlayerNameButton'
    };

    /**
     * Initializes the component using the declarative pattern.
     * @returns {Object} Configuration object for BaseComponent.
     */
    initialize() {
        return {
            // Global event listeners
            events: [
                // Listen for ShowView to handle focus, visibility is handled by UIManager/Base
                { 
                    eventName: Events.Navigation.ShowView, 
                    callback: this._handleShowView 
                }
            ],
            
            // DOM event handlers
            domEvents: [
                { 
                    selector: MultiplayerChoiceComponent.SELECTORS.HOST_BUTTON, 
                    event: 'click', 
                    handler: this._handleHostClick
                },
                { 
                    selector: MultiplayerChoiceComponent.SELECTORS.JOIN_BUTTON, 
                    event: 'click', 
                    handler: this._handleJoinClick
                },
                { 
                    selector: MultiplayerChoiceComponent.SELECTORS.BACK_BUTTON, 
                    event: 'click',
                    emits: Events.UI.MainMenu.Show
                },
                { 
                    selector: MultiplayerChoiceComponent.SELECTORS.PLAYER_NAME_INPUT, 
                    event: 'input', 
                    handler: this._clearError
                },
                { 
                    selector: MultiplayerChoiceComponent.SELECTORS.REFRESH_NAME_BUTTON, 
                    event: 'click', 
                    handler: this._handleRefreshName
                }
            ],
            
            // Use domElements pattern to query and cache elements
            domElements: [
                {
                    name: 'playerNameInput',
                    selector: MultiplayerChoiceComponent.SELECTORS.PLAYER_NAME_INPUT
                },
                {
                    name: 'nameError',
                    selector: MultiplayerChoiceComponent.SELECTORS.NAME_ERROR
                }
            ],
            
            // Directly use the method that loads player name
            setup: this._loadAndSetName
        };
    }
    
    /**
     * Handles the ShowView event specifically for this component.
     * Focuses the input field when the view becomes active.
     * @param {object} payload Event payload.
     * @param {string} payload.viewName The name of the view being shown.
     * @private
     */
    _handleShowView({ viewName }) {
        // Check if the event is for this specific component
        if (viewName === this.name) {
            if (this.elements.playerNameInput) {
                this.elements.playerNameInput.focus();
            }
        }
    }
    
    /**
     * Clears the error message display.
     * @private
     */
    _clearError() {
        if (this.elements.nameError) {
            this.elements.nameError.textContent = '';
            this.elements.nameError.classList.add('hidden');
        }
    }

    /**
     * Shows an error message.
     * @param {string} message The message to display
     * @private
     */
    _showError(message) {
        if (this.elements.nameError) {
            this.elements.nameError.textContent = message;
            this.elements.nameError.classList.remove('hidden');
        }
    }
    
    /**
     * Handles the click on the refresh name button.
     * @private
     */
    _handleRefreshName() {
        const newName = miscUtils.generateRandomPlayerName();
        if (this.elements.playerNameInput) {
            this.elements.playerNameInput.value = newName;
            this._clearError();
        }
    }

    /**
     * Loads name from localStorage or generates a random one.
     * @private
     */
    _loadAndSetName() {
        eventBus.emit(Events.UI.HideAllViews);
        try {
            const storedName = localStorage.getItem('unicornPoepUserName'); 
            let nameToSet = storedName || miscUtils.generateRandomPlayerName();
            
            if (this.elements.playerNameInput) {
                this.elements.playerNameInput.value = nameToSet;
            }
        } catch (error) {
            if (this.elements.playerNameInput) {
                this.elements.playerNameInput.value = 'Player'; 
            }
        }
    }

    /**
     * Handles the Host Game button click.
     * Validates name, emits NamePrompt.Show event, saves name.
     * @param {Event} event The click event.
     * @private
     */
    _handleHostClick(event) {
        event.preventDefault();
        const playerName = this.elements.playerNameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('errorPlayerNameMissing'));
            return;
        }
        
        // Save name for future use
        localStorage.setItem('unicornPoepUserName', playerName);
        
        // Emit the host event directly with the player name
        // No need for redundant name prompt since we already have the name
        eventBus.emit(Events.UI.MultiplayerChoice.HostClicked, { playerName });
    }

    /**
     * Handles the Join Game button click.
     * Validates name, emits NamePrompt.Show event, saves name.
     * @param {Event} event The click event.
     * @private
     */
    _handleJoinClick(event) {
        event.preventDefault();
        const playerName = this.elements.playerNameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('errorPlayerNameMissing'));
            return;
        }
        
        // Save name for future use
        localStorage.setItem('unicornPoepUserName', playerName);
        
        // Emit the join event directly with the player name
        // No need for redundant name prompt since we already have the name
        eventBus.emit(Events.UI.MultiplayerChoice.JoinClicked, { playerName });
    }
}

export default MultiplayerChoiceComponent; 