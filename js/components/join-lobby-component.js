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

    static BACK_BUTTON_SELECTOR = '.backToMain'; // Shared

    /**
     * Initializes the component using the declarative pattern.
     * @returns {Object} Configuration object for BaseComponent.
     */
    initialize() {
        return {
            events: [
                { eventName: Events.Multiplayer.Client.GameInfoReceived, callback: this._handleGameInfoReceived },
                { eventName: Events.WebRTC.ConnectionFailed, callback: this._handleConnectionFailed },
                { eventName: Events.Multiplayer.Client.DisconnectedFromHost, callback: this._handleConnectionFailed },
                { eventName: Events.UI.JoinLobby.HostHasStartedGame, callback: this._handleHostHasStartedGame },
                { eventName: Events.UI.MainMenu.JoinGameClicked, callback: (e) => this._handleShowView({ viewName: this.name }) },
            ],
            domEvents: [
                {
                    selector: JoinLobbyComponent.SUBMIT_CODE_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleSubmitCode.bind(this)
                },
                {
                    selector: JoinLobbyComponent.CONFIRM_JOIN_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleConfirmJoin.bind(this)
                },
                {
                    selector: JoinLobbyComponent.CANCEL_JOIN_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleCancel.bind(this)
                },
                {
                    selector: JoinLobbyComponent.BACK_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleBackClick.bind(this)
                },
                {
                    selector: JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR,
                    event: 'input',
                    handler: this._clearError.bind(this)
                },
                {
                    selector: JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR,
                    event: 'keypress',
                    handler: this._handleInputKeyPress.bind(this)
                }
            ],
            setup: () => {
                // --- Cache Elements ---
                this.joinViewContainer = this.rootElement.querySelector(JoinLobbyComponent.JOIN_VIEW_SELECTOR);
                this.fetchingInfoView = this.rootElement.querySelector(JoinLobbyComponent.FETCHING_VIEW_SELECTOR);
                this.joinConfirmView = this.rootElement.querySelector(JoinLobbyComponent.CONFIRM_VIEW_SELECTOR);
                this.waitingForStartView = this.rootElement.querySelector(JoinLobbyComponent.WAITING_VIEW_SELECTOR);
                
                // Join View Elements
                this.joinCodeInput = this.joinViewContainer.querySelector(JoinLobbyComponent.JOIN_CODE_INPUT_SELECTOR);
                this.submitCodeButton = this.joinViewContainer.querySelector(JoinLobbyComponent.SUBMIT_CODE_BUTTON_SELECTOR);
                this.joinErrorDisplay = this.joinViewContainer.querySelector(JoinLobbyComponent.JOIN_ERROR_DISPLAY_SELECTOR);
                
                // Confirm View Elements
                this.gameInfoDisplay = this.joinConfirmView.querySelector(JoinLobbyComponent.GAME_INFO_DISPLAY_SELECTOR);
                this.confirmJoinButton = this.joinConfirmView.querySelector(JoinLobbyComponent.CONFIRM_JOIN_BUTTON_SELECTOR);
                this.cancelJoinButton = this.joinConfirmView.querySelector(JoinLobbyComponent.CANCEL_JOIN_BUTTON_SELECTOR);
                
                // Shared Elements
                this.backButton = this.rootElement.querySelector(JoinLobbyComponent.BACK_BUTTON_SELECTOR);

                // --- Validate Critical Elements ---
                if (!this.joinViewContainer || !this.fetchingInfoView || !this.joinConfirmView || !this.waitingForStartView) {
                    console.error(`[${this.name}] Missing one or more required sub-view containers.`);
                    // Consider disabling the component or throwing an error
                }
                if (!this.joinCodeInput || !this.submitCodeButton || !this.backButton) {
                    console.error(`[${this.name}] Missing critical initial elements in Join View.`);
                }
                 if (!this.confirmJoinButton || !this.cancelJoinButton || !this.gameInfoDisplay) {
                     console.warn(`[${this.name}] Missing critical elements in Confirm View.`);
                 }

                this.lastReceivedGameInfo = null; // Store game info when received
                this.playerName = null; // Store player name received via ShowView
                this._nameInputListenerAdded = false; // Flag to track if name input listener is added
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
    _handleShowView({ viewName, data = {} }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view. Data:`, data);
            this.lastReceivedGameInfo = null; // Reset stored game info
            
            // Assign player name or generate random one
            const providedName = data.playerName;
            this.playerName = providedName || miscUtils.generateRandomPlayerName();
            console.log(`[${this.name}] Player name set to: ${this.playerName} (Provided: ${providedName})`); // <-- Log name after generation

            // --- ADJUSTED LOGIC --- 
            const joinCodeFromUrl = data && data.joinCode;

            if (joinCodeFromUrl) {
                // Joining via URL link. Connection is handled by Coordinator.
                // Show the 'fetching info' view immediately.
                console.log(`[${this.name}] Join via URL detected. Showing fetching view.`);
                this._showSpecificView('fetchingInfoView'); 
                this._clearError();
                // No need to pre-fill or focus input, or auto-submit.
            } else {
                // Standard flow (e.g., navigated from MultiplayerChoice)
                // Reset UI to initial state (#joinView)
                console.log(`[${this.name}] Standard join flow. Showing join view.`);
                this._showSpecificView('joinView'); 
                this._clearError();
                
                if (this.joinCodeInput) {
                    this.joinCodeInput.value = ''; // Ensure input is clear
                    this.joinCodeInput.focus(); 
                } else {
                    console.error(`[${this.name}] Join code input not found.`);
                }
            }
            // --- END ADJUSTED LOGIC ---

            // BaseComponent handles the actual visibility toggle
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
            if (view) {
                // Use classList.add/remove for clarity
                if (view.id === viewId) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            }
        });
        console.log(`[${this.name}] Showing sub-view: ${viewId}`);
    }

    /**
     * Handles the GameInfoReceived event.
     * Updates UI to show game details and confirmation options.
     * Expects questionsData.sheets structure from the host (no double-nesting, no legacy flat arrays).
     * @param {object} payload - Expected payload from Events.Multiplayer.Client.GameInfoReceived.
     * @param {object} payload.questionsData
     * @param {string} payload.difficulty
     * @param {Map<string, object>} payload.players
     * @param {string} payload.hostId
     * @private
     */
    async _handleGameInfoReceived({ questionsData, difficulty, players, hostId }) {
        console.log(`[${this.name}] START _handleGameInfoReceived. Data:`, { questionsData, difficulty, players, hostId });
        this.lastReceivedGameInfo = { questionsData, difficulty, players, hostId }; // Store for later use

        // Ensure QuestionsManager is initialized before using getSheetDisplayName
        await questionsManager.initialize();

        if (this.gameInfoDisplay) {
            try { 
                const defaultUnknown = miscUtils.getTextTemplate('joinInfoUnknown', 'Unknown');
                const defaultHost = miscUtils.getTextTemplate('joinInfoDefaultHost', 'Host');
                const defaultDifficulty = miscUtils.getTextTemplate('joinInfoDefaultDifficulty', 'Medium');
                const defaultSheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheets', 'N/A');

                const hostPlayer = players && players[hostId] ? players[hostId] : null;
                const hostName = hostPlayer && hostPlayer.name ? hostPlayer.name : defaultHost;
                
                let sheetsInfo = defaultSheetsInfo;
                if (questionsData && Array.isArray(questionsData.sheets) && questionsData.sheets.length > 0) {
                    const sheetNames = questionsData.sheets.map(function(sheet) {
                        return sheet.name || sheet.id || defaultUnknown;
                    });
                    sheetsInfo = sheetNames.join(', ');
                } else {
                    sheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheetsSelected', 'None selected');
                }
                // --- END REVISED --- 

                const playerValues = players ? Object.values(players) : [];
                const playerNames = playerValues.map(function(p) { return p.name || defaultUnknown; }).join(', ');
                
                this.gameInfoDisplay.innerHTML = `
                    <p><strong>Host:</strong> ${hostName}</p>
                    <p><strong>Sheets:</strong> ${sheetsInfo}</p>
                    <p><strong>Difficulty:</strong> ${difficulty || defaultDifficulty}</p>
                    <p><strong>Players:</strong> ${playerNames}</p>
                `;
                console.log(`[${this.name}] Successfully updated gameInfoDisplay.`);
            } catch (error) {
                console.error(`[${this.name}] Error updating gameInfoDisplay:`, error); 
                this.gameInfoDisplay.innerHTML = `<p class=\"error-message\">Error displaying game details.</p>`;
            }
        } else {
             console.error(`[${this.name}] Game info display area (#joinGameInfo) not found.`);
        }
        // ... rest of the method (showing view, enabling button, etc.) ...
        console.log(`[${this.name}] Attempting to show joinConfirmView...`);
        this._showSpecificView('joinConfirmView');
        this._clearError();
        const nameInput = this.rootElement.querySelector('#joinConfirmPlayerNameInput');
        if (nameInput) {
            // WORKAROUND: If playerName is null/empty when info received, generate a new random name.
            if (!this.playerName) {
                console.warn(`[${this.name}] this.playerName was null/empty when GameInfoReceived. Regenerating.`);
                this.playerName = miscUtils.generateRandomPlayerName();
            }
            // END WORKAROUND
            
            console.log(`[${this.name}] Setting name input. Using playerName: ${this.playerName}`);
            nameInput.value = this.playerName || ''; // Use the (potentially regenerated) name
            console.log(`[${this.name}] Updated name input.`);
            if (!this._nameInputListenerAdded) {
                try { 
                    nameInput.addEventListener('input', function(event) {
                        this.playerName = event.target.value.trim();
                    }.bind(this));
                    const refreshButton = this.rootElement.querySelector('#refreshJoinConfirmNameButton');
                    if (refreshButton) {
                        refreshButton.addEventListener('click', function() {
                            var randomName = miscUtils.generateRandomPlayerName();
                            nameInput.value = randomName;
                            this.playerName = randomName;
                            eventBus.emit(Events.Multiplayer.Common.PlayerUpdated, {
                                peerId: webRTCManager.getMyPeerId(),
                                updatedData: { name: randomName }
                            });
                            // Notify the host of the name change so it updates the player list for all
                            webRTCManager.sendToHost('c_requestJoin', { name: randomName });
                        }.bind(this));
                        console.log(`[${this.name}] Added refresh button listener.`);
                    } else {
                        console.warn(`[${this.name}] Refresh name button not found.`);
                    }
                    this._nameInputListenerAdded = true;
                    console.log(`[${this.name}] Added name input listener.`);
                } catch (error) {
                    console.error(`[${this.name}] Error adding name input/refresh listeners:`, error);
                }
            }
        } else {
            console.warn(`[${this.name}] Player name input (#joinConfirmPlayerNameInput) not found in confirm view.`);
        }
        if (this.confirmJoinButton) {
            this.confirmJoinButton.disabled = false;
            console.log(`[${this.name}] Enabled confirm join button.`);
        } else {
             console.error(`[${this.name}] Confirm button (#confirmJoinButton) not found.`);
        }
        console.log(`[${this.name}] END _handleGameInfoReceived.`);
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     * @private
     */
    _showError = (message) => {
        if (this.joinErrorDisplay) {
            this.joinErrorDisplay.textContent = message;
            this.joinErrorDisplay.classList.remove('hidden');
            
            // Reset to join view in case we're in a different state
            this._showSpecificView('joinView');
        }
    }
    
    /**
     * Handles connection failures or disconnects.
     * @param {object} [payload={}] - Event payload (structure depends on specific event).
     * @param {Error} [payload.error] - Error object from ConnectionFailed.
     * @param {string} [payload.message] - Optional message.
     * @private
     */
    _handleConnectionFailed(payload = {}) {
        // ---> ADD THIS CHECK: Only handle if the component is currently visible
        if (this.rootElement.classList.contains('hidden')) {
            console.log(`[${this.name}] Ignoring ConnectionFailed event because component is hidden.`);
            return; 
        }
        // ---> END ADDED CHECK

        console.warn(`[${this.name}] Connection failed or disconnected. Payload:`, payload);
        const defaultMsg = miscUtils.getTextTemplate('joinErrorConnectionFailed', 'Connection failed or host disconnected.');
        // Prioritize specific error message if available
        const message = payload.message || payload.error.message || defaultMsg;
        this._showError(message); 
        this._showSpecificView('joinView'); // Revert to initial join view
        if (this.joinCodeInput) { // Ensure element exists before focusing
            this.joinCodeInput.focus();
        }
    }

    /**
     * Handles the click event on the submit code button.
     * Validates input and initiates connection to host.
     * @param {Event} event - The click event.
     * @private
     * @event Events.UI.JoinLobby.SubmitCodeClicked
     */
    _handleSubmitCode(event) {
        if (event) event.preventDefault(); // Prevent form submission if called by event
        
        if (!this.joinCodeInput || !this.joinCodeInput.value) {
            this._showError(miscUtils.getTextTemplate('joinErrorCodeInvalid', 'Please enter a valid connection code.'));
            return;
        }
        
        const code = this.joinCodeInput.value.replace(/\s+/g, ''); // Remove spaces
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            this._showError(miscUtils.getTextTemplate('joinErrorCodeInvalid', 'Invalid code. Please enter a 6-digit code.'));
            return;
        }
        
        // Show fetching view while connecting
        this._showSpecificView('fetchingInfoView');
        
        // Optionally disable the button to prevent multiple submissions
        if(this.submitCodeButton) this.submitCodeButton.disabled = true;

        // Emit event for MultiplayerClientManager to handle
        eventBus.emit(Events.UI.JoinLobby.SubmitCodeClicked, {
            code: code
        });
    }
    
    /**
     * Handles the keypress event on the join code input.
     * Allows submitting the form by pressing Enter.
     * @param {KeyboardEvent} event - The keypress event.
     * @private
     */
    _handleInputKeyPress(event) {
        if (event.key === 'Enter' && this.submitCodeButton) {
            event.preventDefault();
            this.submitCodeButton.click();
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
            console.error(`[${this.name}] Cannot confirm join: Player name is missing.`);
            this._showError(miscUtils.getTextTemplate('genericInternalError'));
            if (this.confirmJoinButton) this.confirmJoinButton.disabled = false; // Re-enable if error
            return;
        }

        // Check for name field in case user modified it directly in the DOM
        const nameInput = this.rootElement.querySelector('#joinConfirmPlayerNameInput');
        if (nameInput && nameInput.value.trim()) {
            this.playerName = nameInput.value.trim();
        }

        console.log(`[${this.name}] Confirming join for player: ${this.playerName}`);
        // Emit event for MultiplayerClientManager to handle the join logic
        eventBus.emit(Events.UI.JoinLobby.ConfirmClicked, { playerName: this.playerName });

        // Hide this component/dialog
        this.hide();

        // Emit event for UIManager to show the dedicated waiting dialog with a clear message
        eventBus.emit(Events.System.ShowWaitingDialog, { 
            message: miscUtils.getTextTemplate('waitingDialogDefaultMsg', 'Even geduld, de baas van het spel gaat zo beginnen!')
        });
        console.log(`[${this.name}] Emitted System.ShowWaitingDialog with custom message.`);
    }
    
    /**
     * Handles the cancel button click.
     * Returns to the multiplayer choice view.
     * @private
     * @event Events.UI.JoinLobby.CancelClicked
     */
    _handleCancel() {
        console.log(`[${this.name}] Cancel join clicked.`);
        // Signal cancellation
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
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
    }

    /**
     * Handles the HostHasStartedGame event, typically emitted by a coordinator.
     * Navigates the client to the game area.
     * @param {object} payload The event payload.
     * @param {object} payload.gameData Data needed to start the game view.
     * @private
     */
    _handleHostHasStartedGame({ gameData }) {
        console.log(`[${this.name}] Received HostHasStartedGame. Navigating to GameArea.`);

        // WaitingDialog is hidden by MultiplayerClientCoordinator upon receiving GameStarted event.
        // We just need to navigate.

        // Emit the navigation event to show the GameArea
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.GameArea, 
            data: gameData // Pass the necessary data
        });

        // NOTE: We DO NOT call this.hide() here.
        // The UIManager will handle hiding this component when it processes the ShowView event for GameArea.
        // Since we already hid it in _handleConfirmJoin, this note is less relevant, but leaving it.
    }
}

export default JoinLobbyComponent;
