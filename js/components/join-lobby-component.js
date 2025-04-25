import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import miscUtils from '../utils/miscUtils.js';
import questionsManager from '../services/QuestionsManager.js';
import webRTCManager from '../services/WebRTCManager.js';
// import uiManager from '../ui/UIManager.js'; // No longer needed here

/**
 * @class JoinLobbyComponent
 * @extends RefactoredBaseComponent
 * Manages the client's process of joining a multiplayer game.
 * Handles code input, connection status display, game info confirmation, and waiting states.
 * Emits events to signal user actions (SubmitCodeClicked, ConfirmClicked) and handles 
 * incoming events for game info and connection status.
 */
class JoinLobbyComponent extends RefactoredBaseComponent {
    static SELECTOR = '#connectionStatus'; // Parent dialog selector
    static VIEW_NAME = 'JoinLobbyComponent';

    // --- Element Selectors ---
    static JOIN_VIEW_SELECTOR = '#joinView';
    static FETCHING_VIEW_SELECTOR = '#fetchingInfoView';
    static CONFIRM_VIEW_SELECTOR = '#joinConfirmView';
    static WAITING_VIEW_SELECTOR = '#waitingForStartView';
    
    static JOIN_CODE_INPUT_SELECTOR = '#connectionCodeInput';
    static SUBMIT_CODE_BUTTON_SELECTOR = '#submitCode';
    static JOIN_ERROR_DISPLAY_SELECTOR = '#connectionErrorMessage'; // In joinView

    static GAME_INFO_DISPLAY_SELECTOR = '#joinGameInfo'; // In confirmView
    static CONFIRM_JOIN_BUTTON_SELECTOR = '#confirmJoinButton'; // In confirmView
    static CANCEL_JOIN_BUTTON_SELECTOR = '#cancelJoinButton'; // In confirmView
    static PLAYER_NAME_INPUT_SELECTOR = '#joinConfirmPlayerNameInput';
    static REFRESH_NAME_BUTTON_SELECTOR = '#refreshJoinConfirmNameButton';

    static BACK_BUTTON_SELECTOR = '.backToMain'; // Shared

    /**
     * Initializes the component using the declarative pattern.
     * @returns {Object} Configuration object for BaseComponent.
     */
    initialize() {
        this.lastReceivedGameInfo = null;
        this.playerName = null;
        this._nameInputListenerAdded = false;

        return {
            events: [
                { eventName: Events.Multiplayer.Client.GameInfoReceived, callback: this._handleGameInfoReceived },
                { eventName: Events.WebRTC.ConnectionFailed, callback: this._handleConnectionFailed },
                { eventName: Events.Multiplayer.Client.DisconnectedFromHost, callback: this._handleConnectionFailed },
                { eventName: Events.UI.JoinLobby.HostHasStartedGame, callback: this._handleHostHasStartedGame },
                { eventName: Events.UI.MainMenu.JoinGameClicked, callback: this._handleShowView },
            ],
            domEvents: [
                {
                    selector: JoinLobbyComponent.SUBMIT_CODE_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleSubmitCode
                },
                {
                    selector: JoinLobbyComponent.CONFIRM_JOIN_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleConfirmJoin
                },
                {
                    selector: JoinLobbyComponent.CANCEL_JOIN_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleCancel
                },
                {
                    selector: JoinLobbyComponent.BACK_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleBackClick
                },
                {
                    selector: JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR,
                    event: 'input',
                    handler: this._clearError
                },
                {
                    selector: JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR,
                    event: 'keypress',
                    handler: this._handleInputKeyPress
                },
                {
                    selector: JoinLobbyComponent.PLAYER_NAME_INPUT_SELECTOR,
                    event: 'input',
                    handler: this._handleNameInput
                },
                {
                    selector: JoinLobbyComponent.REFRESH_NAME_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleRefreshName
                }
            ],
            setup: () => {
                // --- Cache Elements ---
                this.joinViewContainer = this.rootElement.querySelector(JoinLobbyComponent.JOIN_VIEW_SELECTOR);
                this.fetchingInfoView = this.rootElement.querySelector(JoinLobbyComponent.FETCHING_VIEW_SELECTOR);
                this.joinConfirmView = this.rootElement.querySelector(JoinLobbyComponent.CONFIRM_VIEW_SELECTOR);
                this.waitingForStartView = this.rootElement.querySelector(JoinLobbyComponent.WAITING_VIEW_SELECTOR);
                
                this.joinCodeInput = this.joinViewContainer.querySelector(JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR);
                this.submitCodeButton = this.joinViewContainer.querySelector(JoinLobbyComponent.SUBMIT_CODE_BUTTON_SELECTOR);
                this.joinErrorDisplay = this.joinViewContainer.querySelector(JoinLobbyComponent.JOIN_ERROR_DISPLAY_SELECTOR);
                
                this.gameInfoDisplay = this.joinConfirmView.querySelector(JoinLobbyComponent.GAME_INFO_DISPLAY_SELECTOR);
                this.confirmJoinButton = this.joinConfirmView.querySelector(JoinLobbyComponent.CONFIRM_JOIN_BUTTON_SELECTOR);
                this.cancelJoinButton = this.joinConfirmView.querySelector(JoinLobbyComponent.CANCEL_JOIN_BUTTON_SELECTOR);
                
                this.backButton = this.rootElement.querySelector(JoinLobbyComponent.BACK_BUTTON_SELECTOR);
            }
        };
    }

    /**
     * Handles the ShowView event to set up the initial state when this component is shown.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data]
     * @param {string} [payload.data.playerName] - The player's name, assumed to be set already.
     * @param {string} [payload.data.joinCode] - Optional join code passed from URL flow.
     * @private
     */
    _handleShowView(payload) {
        const { viewName, data = {} } = payload;
        if (viewName === this.name) {
            this.lastReceivedGameInfo = null;
            
            // First try to use the provided name, then localStorage, then generate random
            this.playerName = data.playerName || 
                              localStorage.getItem('unicornPoepUserName') || 
                              miscUtils.generateRandomPlayerName();
            
            // Store the selected name in localStorage for future use
            if (this.playerName && !localStorage.getItem('unicornPoepUserName')) {
                localStorage.setItem('unicornPoepUserName', this.playerName);
            }
            
            const joinCodeFromUrl = data && data.joinCode;

            if (joinCodeFromUrl) {
                if (!data.playerName) {
                    this._showSpecificView('joinView');
                    this._clearError();
                    
                    this.joinCodeInput.value = joinCodeFromUrl;
                    this.joinCodeInput.focus();
                } else {
                    this._showSpecificView('fetchingInfoView'); 
                    this._clearError();
                }
            } else {
                this._showSpecificView('joinView'); 
                this._clearError();
                
                this.joinCodeInput.value = '';
                this.joinCodeInput.focus();
            }
        }
    }

    /** Shows only the specified sub-view within the component. @private */
    _showSpecificView(viewId) {
        const views = [
            this.joinViewContainer,
            this.fetchingInfoView,
            this.joinConfirmView,
            this.waitingForStartView
        ];
        views.forEach(view => {
            if (view.id === viewId) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });
    }

    /**
     * Handles the GameInfoReceived event.
     * Updates UI to show game details and confirmation options.
     * @param {object} payload - Expected payload from Events.Multiplayer.Client.GameInfoReceived.
     * @private
     */
    async _handleGameInfoReceived(payload) {
        const { questionsData, difficulty, players, hostId } = payload;
        this.lastReceivedGameInfo = { questionsData, difficulty, players, hostId };

        // Ensure QuestionsManager is initialized before using getSheetDisplayName
        await questionsManager.initialize();

        const defaultUnknown = miscUtils.getTextTemplate('joinInfoUnknown', 'Unknown');
        const defaultHost = miscUtils.getTextTemplate('joinInfoDefaultHost', 'Host');
        const defaultDifficulty = miscUtils.getTextTemplate('joinInfoDefaultDifficulty', 'Medium');
        const defaultSheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheets', 'N/A');

        const hostPlayer = players && players[hostId] ? players[hostId] : null;
        const hostName = hostPlayer && hostPlayer.name ? hostPlayer.name : defaultHost;
        
        let sheetsInfo = defaultSheetsInfo;
        if (questionsData && Array.isArray(questionsData.sheets) && questionsData.sheets.length > 0) {
            const sheetNames = questionsData.sheets.map(sheet => sheet.name || sheet.id || defaultUnknown);
            sheetsInfo = sheetNames.join(', ');
        } else {
            sheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheetsSelected', 'None selected');
        }

        const playerValues = players ? Object.values(players) : [];
        const playerNames = playerValues.map(p => p.name || defaultUnknown).join(', ');
        
        this.gameInfoDisplay.innerHTML = `
            <p><strong>Host:</strong> ${hostName}</p>
            <p><strong>Sheets:</strong> ${sheetsInfo}</p>
            <p><strong>Difficulty:</strong> ${difficulty || defaultDifficulty}</p>
            <p><strong>Players:</strong> ${playerNames}</p>
        `;

        this._showSpecificView('joinConfirmView');
        this._clearError();
        
        const nameInput = this.rootElement.querySelector(JoinLobbyComponent.PLAYER_NAME_INPUT_SELECTOR);
        if (nameInput) {
            // If playerName is empty, first check localStorage, then generate a random name
            if (!this.playerName) {
                this.playerName = localStorage.getItem('unicornPoepUserName') || miscUtils.generateRandomPlayerName();
                // Store in localStorage if not already there
                if (!localStorage.getItem('unicornPoepUserName')) {
                    localStorage.setItem('unicornPoepUserName', this.playerName);
                }
            }
            
            nameInput.value = this.playerName;
        }
        
        this.confirmJoinButton.disabled = false;
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     * @private
     */
    _showError(message) {
        if (this.joinErrorDisplay) {
            this.joinErrorDisplay.textContent = message;
            this.joinErrorDisplay.classList.remove('hidden');
            
            // Reset to join view in case we're in a different state
            this._showSpecificView('joinView');
        }
    }
    
    /**
     * Handles connection failures or disconnects.
     * @param {object} payload - Event payload (structure depends on specific event).
     * @private
     */
    _handleConnectionFailed(payload = {}) {
        // If playerName is missing, try to get a default
        if (!this.playerName) {
            this.playerName = localStorage.getItem('unicornPoepUserName') || miscUtils.generateRandomPlayerName();
        }
        
        const defaultMsg = miscUtils.getTextTemplate('joinErrorConnectionFailed', 'Connection failed or host disconnected.');
        
        // Extract message from different possible payload structures
        let message = defaultMsg;
        if (payload.message) {
            message = payload.message;
        } else if (payload.error) {
            message = payload.error.message || 
                     (typeof payload.error === 'string' ? payload.error : defaultMsg);
            
            if (payload.error.type === 'peer-unavailable') {
                message = miscUtils.getTextTemplate('joinErrorHostNotFound', 'Host not found. The game may have ended or the code is incorrect.');
            }
        } else if (payload.reason) {
            message = payload.reason;
        }
        
        this._showError(message); 
        this._showSpecificView('joinView');
        
        this.submitCodeButton.disabled = false;
        this.joinCodeInput.focus();
        
        if (this.joinCodeInput.value) {
            this.joinCodeInput.select();
        }
    }

    /**
     * Handles the submit code button click.
     * Validates the code and emits the SubmitCodeClicked event.
     * @param {Event} event The click event.
     * @private
     * @event Events.UI.JoinLobby.SubmitCodeClicked
     */
    _handleSubmitCode(event) {
        if (event) event.preventDefault();
        
        if (!this.joinCodeInput.value) {
            this._showError(miscUtils.getTextTemplate('joinErrorCodeInvalid', 'Please enter a valid connection code.'));
            return;
        }
        
        const code = this.joinCodeInput.value.replace(/\s+/g, ''); // Remove spaces
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            this._showError(miscUtils.getTextTemplate('joinErrorCodeInvalid', 'Invalid code. Please enter a 6-digit code.'));
            return;
        }
        
        // Make sure we have a playerName before submitting
        if (!this.playerName) {
            this.playerName = localStorage.getItem('unicornPoepUserName') || miscUtils.generateRandomPlayerName();
        }
        
        this._showSpecificView('fetchingInfoView');
        this.submitCodeButton.disabled = true;

        eventBus.emit(Events.UI.JoinLobby.SubmitCodeClicked, {
            code: code,
            playerName: this.playerName
        });
    }
    
    /**
     * Handles the keypress event on the join code input.
     * Allows submitting the form by pressing Enter.
     * @param {KeyboardEvent} event - The keypress event.
     * @private
     */
    _handleInputKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.submitCodeButton.click();
        }
    }

    /**
     * Handles the player name input event.
     * @param {InputEvent} event - The input event.
     * @private 
     */
    _handleNameInput(event) {
        this.playerName = event.target.value.trim();
        // Update localStorage when name is changed by user
        if (this.playerName) {
            localStorage.setItem('unicornPoepUserName', this.playerName);
        }
    }

    /**
     * Handles the refresh name button click.
     * @private
     */
    _handleRefreshName() {
        const nameInput = this.rootElement.querySelector(JoinLobbyComponent.PLAYER_NAME_INPUT_SELECTOR);
        if (nameInput) {
            const randomName = miscUtils.generateRandomPlayerName();
            nameInput.value = randomName;
            this.playerName = randomName;
            
            // Update localStorage with the new name
            localStorage.setItem('unicornPoepUserName', this.playerName);
            
            eventBus.emit(Events.Multiplayer.Common.PlayerUpdated, {
                peerId: webRTCManager.getMyPeerId(),
                updatedData: { name: randomName }
            });
            // Notify the host of the name change so it updates the player list for all
            webRTCManager.sendToHost('c_requestJoin', { name: randomName });
        }
    }
    
    /**
     * Clears any displayed error messages.
     * @private
     */
    _clearError() {
        if (this.joinErrorDisplay) {
            this.joinErrorDisplay.textContent = '';
            this.joinErrorDisplay.classList.add('hidden');
        }
    }
    
    /**
     * Handles the confirm join button click.
     * Sends the player's confirmation to join the game via eventBus
     * and triggers the waiting dialog.
     * @private
     * @event Events.UI.JoinLobby.ConfirmClicked
     * @event Events.System.ShowWaitingDialog
     */
    _handleConfirmJoin() {
        if (!this.playerName) {
            this._showError(miscUtils.getTextTemplate('genericInternalError'));
            this.confirmJoinButton.disabled = false;
            return;
        }

        // Check for name field in case user modified it directly in the DOM
        const nameInput = this.rootElement.querySelector(JoinLobbyComponent.PLAYER_NAME_INPUT_SELECTOR);
        if (nameInput && nameInput.value.trim()) {
            this.playerName = nameInput.value.trim();
        }

        eventBus.emit(Events.UI.JoinLobby.ConfirmClicked, { playerName: this.playerName });

        // Hide this component/dialog
        this.hide();

        // Emit event for UIManager to show the dedicated waiting dialog with a clear message
        eventBus.emit(Events.System.ShowWaitingDialog, { 
            message: miscUtils.getTextTemplate('waitingDialogDefaultMsg', 'Even geduld, de baas van het spel gaat zo beginnen!')
        });
    }
    
    /**
     * Handles the cancel button click.
     * Returns to the multiplayer choice view.
     * @private
     * @event Events.UI.JoinLobby.CancelClicked
     */
    _handleCancel() {
        eventBus.emit(Events.UI.JoinLobby.CancelClicked);
        
        // Return to multiplayer choice
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
    }
    
    /**
     * Handles the Back button click.
     * Navigates back to the Multiplayer Choice view.
     * @param {Event} event The click event.
     * @private
     * @event Events.Navigation.ShowView
     */
    _handleBackClick(event) {
        event.preventDefault();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the HostHasStartedGame event, typically emitted by a coordinator.
     * Navigates the client to the game area.
     * @param {object} payload The event payload.
     * @param {object} payload.gameData Data needed to start the game view.
     * @private
     */
    _handleHostHasStartedGame(payload) {
        const { gameData } = payload;
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.GameArea, 
            data: gameData
        });
    }
}

export default JoinLobbyComponent;
