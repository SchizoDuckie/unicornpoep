import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';
import webRTCManager from '../services/WebRTCManager.js'; // Import WebRTCManager

/**
 * @class JoinLobbyComponent
 * @extends BaseComponent
 * Manages the client's process of joining a multiplayer game.
 * Handles code input, connection status display, game info confirmation, and waiting states.
 * Assumes it controls various divs within the `#connectionStatus` dialog/view: 
 * `#joinView`, `#fetchingInfoView`, `#joinConfirmView`, `#waitingForStartView`.
 */
class JoinLobbyComponent extends BaseComponent {
    static SELECTOR = '#connectionStatus'; // Parent dialog selector
    static VIEW_NAME = 'JoinLobbyComponent'; // Use the component registration name (class name) as the VIEW_NAME

    /** 
     * Initializes component elements and binds methods.
     * Called by BaseComponent constructor.
     */
    initialize() {
        console.log(`[${this.name}] Initializing (via BaseComponent)...`);
        // Find the main container for the join view
        this.joinViewContainer = this.rootElement.querySelector('#joinView');
        this.fetchingInfoView = this.rootElement.querySelector('#fetchingInfoView');
        this.joinConfirmView = this.rootElement.querySelector('#joinConfirmView');
        this.waitingForStartView = this.rootElement.querySelector('#waitingForStartView');

        console.log(`[${this.name}] Found joinViewContainer:`, this.joinViewContainer);
        if (!this.joinViewContainer || !this.fetchingInfoView || !this.joinConfirmView || !this.waitingForStartView) {
            console.error(`[${this.name}] Could not find one or more required sub-view containers (#joinView, #fetchingInfoView, #joinConfirmView, #waitingForStartView) within ${this.selector}.`);
        }

        // Find elements strictly WITHIN the #joinView container
        this.joinCodeInput = this.joinViewContainer.querySelector('#connectionCodeInput');
        console.log(`[${this.name}] Found joinCodeInput:`, this.joinCodeInput);
        this.submitCodeButton = this.joinViewContainer.querySelector('#submitCode');
        console.log(`[${this.name}] Found submitCodeButton:`, this.submitCodeButton);
        this.playerNameDisplay = this.joinViewContainer.querySelector('#joinPlayerName');
        console.log(`[${this.name}] Found playerNameDisplay:`, this.playerNameDisplay);
        this.joinErrorDisplay = this.joinViewContainer.querySelector('#connectionErrorMessage');
        console.log(`[${this.name}] Found joinErrorDisplay:`, this.joinErrorDisplay);

        // Find shared elements in the parent (#connectionStatus)
        this.backButton = this.rootElement.querySelector('.backToMain');
        console.log(`[${this.name}] Found backButton:`, this.backButton);

        // Check ONLY for elements expected in the initial view (#joinView or parent)
        if (!this.joinCodeInput || !this.submitCodeButton || !this.playerNameDisplay || !this.joinErrorDisplay || !this.backButton) {
            // This console message will now only trigger if these specific core elements are missing
            console.error(`[${this.name}] Missing required elements within #joinView or parent. Component may malfunction.`);
        }

        this.playerName = '';
        console.log(`[${this.name}] Initialized.`);
    }

    /** 
     * Registers DOM and eventBus event listeners. 
     * Called by BaseComponent constructor.
     */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners...`);
        // Bind methods first
        this.handleShowView = this.handleShowView.bind(this);
        this._handleGameInfoReceived = this._handleGameInfoReceived.bind(this);
        this.handleConnectionFailed = this.handleConnectionFailed.bind(this);
        this._handleSubmitCode = this._handleSubmitCode.bind(this);
        this._handleConfirmJoin = this._handleConfirmJoin.bind(this);
        this._handleCancel = this._handleCancel.bind(this);
        this._handleBackClick = this._handleBackClick.bind(this);
        // KEEP Debugging logs for now
        console.log('[${this.name}] Method on prototype (_handleGameInfoReceived):', JoinLobbyComponent.prototype._handleGameInfoReceived);
        console.log('[${this.name}] Instance has own property _handleGameInfoReceived:', this.hasOwnProperty('_handleGameInfoReceived'));
        console.log('[${this.name}] Type of this._handleGameInfoReceived before bind:', typeof this._handleGameInfoReceived);
        console.log('[${this.name}] Method on prototype (handleConnectionFailed):', JoinLobbyComponent.prototype.handleConnectionFailed);
        console.log('[${this.name}] Instance has own property handleConnectionFailed:', this.hasOwnProperty('handleConnectionFailed'));
        console.log('[${this.name}] Type of this.handleConnectionFailed before bind:', typeof this.handleConnectionFailed);
        
        // Add DOM Listeners
        if (this.submitCodeButton) this.submitCodeButton.addEventListener('click', this._handleSubmitCode);
        if (this.joinCodeInput) {
            this.joinCodeInput.addEventListener('input', this._clearError);
             // Optional: Add Enter key listener
             this.joinCodeInput.addEventListener('keypress', this._handleInputKeyPress);
        }
        if (this.backButton) this.backButton.addEventListener('click', this._handleBackClick);
        
        // Add eventBus Listeners using BaseComponent helper
        this.listen(Events.Navigation.ShowView, this.handleShowView);
        this.listen(Events.Multiplayer.Client.GameInfoReceived, this._handleGameInfoReceived);
        this.listen(Events.WebRTC.ConnectionFailed, this.handleConnectionFailed);
        this.listen(Events.Multiplayer.Client.DisconnectedFromHost, this.handleConnectionFailed);
        console.log(`[${this.name}] Listeners registered.`);
    }

    /**
     * Handles the ShowView event to set up the initial state.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data]
     * @param {string} [payload.data.playerName]
     * @param {string} [payload.data.joinCode] - Optional join code passed from GameCoordinator via URL param flow.
     * @param {boolean} [payload.data.showConnecting] - Optional flag to immediately show connecting state.
     */
    handleShowView({ viewName, data = {} }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view. Data:`, data);
            // Use template for default name
            this.playerName = data.playerName || getTextTemplate('joinDefaultPlayerName');

            if (this.playerNameDisplay) {
                this.playerNameDisplay.textContent = this.playerName;
            }
            if (this.joinCodeInput) {
                // Pre-fill code if passed via URL flow, otherwise clear it
                this.joinCodeInput.value = data.joinCode || ''; 
            }

            // Determine initial sub-view
            if (data.showConnecting) {
                console.log(`[${this.name}] Starting in 'fetchingInfoView' due to showConnecting flag.`);
                this._showSpecificView('fetchingInfoView');
            } else {
                console.log(`[${this.name}] Starting in 'joinView'.`);
                this._showSpecificView('joinView'); 
                this.joinCodeInput.focus(); // Focus code input only if starting in joinView
            }

            this._clearError();
            this.show(); // Show the overall container/dialog
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
                view.classList.toggle('hidden', view.id !== viewId);
            }
        });
        console.log(`[${this.name}] Showing sub-view: ${viewId}`);

        // Pause/resume timeout check based on view
        if (viewId === 'joinConfirmView') {
            console.log(`[${this.name}] Pausing host timeout check for confirmation view.`);
            webRTCManager.pauseHostTimeoutCheck();
        } else {
            // Ensure timeout check is running if we switch *away* from confirm view to another view *within* this component
            // (e.g., if an error occurred *after* confirmation showed, though unlikely)
            webRTCManager.resumeHostTimeoutCheck();
        }
    }

    /** Handles the ConnectedToHost event from WebRTCManager. @private */
    handleConnectedToHost() {
        console.log(`[${this.name}] Connected to host. Waiting for game info...`);
        this._showSpecificView('fetchingInfoView');
        this._clearError();
    }

    /**
     * Handles the GameInfoReceived event from WebRTCManager.
     * Ensure REGULAR method definition.
     * @param {object} payload
     * @param {object} payload.questionsData - Structured question data { sheets: [...] }.
     * @param {string} payload.difficulty - Game difficulty.
     * @param {Map<string, object>} payload.players - Current players.
     * @param {string} payload.hostId - The host's peer ID.
     */
    _handleGameInfoReceived({ questionsData, difficulty, players, hostId }) { // Ensure regular method
        console.log(`[${this.name}] Received game info:`, { questionsData, difficulty, players, hostId });
        this.lastReceivedGameInfo = { questionsData, difficulty, players, hostId }; // Store for later use

        // Query for elements within the specific view (#joinConfirmView)
        const confirmView = this.rootElement.querySelector('#joinConfirmView');
        const gameInfoDisplay = confirmView ? confirmView.querySelector('#joinGameInfo') : null;
        const confirmButton = confirmView ? confirmView.querySelector('#confirmJoinButton') : null;
        const nameInput = confirmView ? confirmView.querySelector('#joinConfirmPlayerNameInput') : null;

        if (gameInfoDisplay) {
            const defaultUnknown = getTextTemplate('joinInfoUnknown');
            const defaultHost = getTextTemplate('joinInfoDefaultHost');
            const defaultDifficulty = getTextTemplate('joinInfoDefaultDifficulty');
            const defaultSheetsInfo = getTextTemplate('joinInfoNoSheets');

            // Safely get host player name
            const hostPlayer = players.get(hostId);
            const hostName = hostPlayer ? hostPlayer.name : defaultHost;
            
            // Extract sheet names or count from questionsData
            let sheetsInfo = defaultSheetsInfo;
            if (questionsData && Array.isArray(questionsData.sheets) && questionsData.sheets.length > 0) {
                sheetsInfo = questionsData.sheets.map(sheet => sheet.name || defaultUnknown).join(', ');
            } else if (questionsData && questionsData.sheets) {
                 // Handle case where sheets array might be empty
                 sheetsInfo = getTextTemplate('joinInfoNoSheetsSelected');
            }

            const playerNames = Array.from(players.values()).map(p => p.name || defaultUnknown).join(', ');
            
            gameInfoDisplay.innerHTML = `
                <p><strong>Host:</strong> ${hostName}</p>
                <p><strong>Sheets:</strong> ${sheetsInfo}</p>
                <p><strong>Difficulty:</strong> ${difficulty || defaultDifficulty}</p>
                <p><strong>Players:</strong> ${playerNames}</p>
            `;
        }

        this._showSpecificView('joinConfirmView');
        this._clearError();

        if (confirmButton) {
            confirmButton.disabled = false;
            // Add listener here, remove in unregisterListeners or when hiding view
            confirmButton.addEventListener('click', this._handleConfirmJoin);
        } else {
             console.error(`[${this.name}] Confirm button not found in #joinConfirmView.`);
        }
        if (nameInput) {
             nameInput.value = this.playerName; // Pre-fill name
             nameInput.focus();
        } else {
             console.error(`[${this.name}] Name input not found in #joinConfirmView.`);
        }
    }

    /**
     * Handles WebRTC connection failures.
     * Ensure REGULAR method definition.
     * @param {object} payload
     * @param {Error} payload.error
     * @param {string} [payload.context]
     */
    handleConnectionFailed({ error, context }) { // Ensure regular method
        if (context === 'client-connect') {
             console.error(`[${this.name}] Connection failed:`, error.message);
             this._showError(`${getTextTemplate('joinErrorConnectPrefix')}${error.message}`);
             this._showSpecificView('joinView');
        } else if (this.isVisible) {
             console.warn(`[${this.name}] Received connection failure in context: ${context}`);
        }
    }
    
     /**
      * Handles generic System errors that might occur during the join process.
      * @param {object} payload 
      * @param {string} payload.message
      * @param {string} [payload.context]
      */
     handleGenericError({ message, context }) {
         // Only display error if it seems relevant to the join context
         // and this component is visible.
         if (this.isVisible && context.toLowerCase().includes('join')) {
             console.error(`[${this.name}] Received relevant system error:`, message, context);
             this._showError(message);
             // Don't switch views automatically, let user retry or cancel
         }
     }

    /** Handles submitting the connection code. DEFINED AS REGULAR METHOD @private */
    _handleSubmitCode() {
        const code = this.joinCodeInput.value.trim();
        if (!code || !/^[0-9]{6}$/.test(code)) {
            this._showError(getTextTemplate('joinErrorInvalidCode'));
            this.joinCodeInput.focus();
            return;
        }

        console.log(`[${this.name}] Submitting code: ${code}`);
        this._clearError();

        eventBus.emit(Events.UI.JoinLobby.SubmitCodeClicked, {
            code: code,
            playerName: this.playerName
        });
    }

    /** Handles confirming the join after seeing game info. DEFINED AS REGULAR METHOD @private */
    _handleConfirmJoin() {
        // Find the name input within the *confirmation view*
        const confirmView = this.rootElement.querySelector('#joinConfirmView');
        const confirmNameInput = confirmView ? confirmView.querySelector('#joinConfirmPlayerNameInput') : null;
        const confirmButton = confirmView ? confirmView.querySelector('#confirmJoinButton') : null;

        if (!confirmNameInput) {
             console.error(`[${this.name}] Could not find confirm name input #joinConfirmPlayerNameInput`);
             this._showError('Internal error: Missing name input.');
             if (confirmButton) confirmButton.disabled = false; // Re-enable button if input missing
             return;
        }

        const confirmedName = confirmNameInput.value.trim();
        if (!confirmedName) {
            this._showError(getTextTemplate('joinErrorEmptyName'));
            confirmNameInput.focus();
            if (confirmButton) confirmButton.disabled = false; // Re-enable button on error
            return;
        }
        if (confirmedName.length > 40) {
            this._showError(getTextTemplate('joinErrorNameTooLong'));
            confirmNameInput.focus();
            if (confirmButton) confirmButton.disabled = false; // Re-enable button on error
            return;
        }

        console.log(`[${this.name}] Confirming join with name: ${confirmedName}`);
        this._clearError();
        if (confirmButton) confirmButton.disabled = true; // Disable button on successful submission

        // Resume timeout check before hiding
        console.log(`[${this.name}] Resuming host timeout check after confirmation.`);
        webRTCManager.resumeHostTimeoutCheck();

        eventBus.emit(Events.UI.JoinLobby.ConfirmClicked, { playerName: confirmedName });
        this.hide();
    }

    /** Handles cancel button click or back button click. DEFINED AS REGULAR METHOD @private */
    _handleCancel() {
        console.log(`[${this.name}] Cancel/Back clicked.`);
        // Query for confirm button to re-enable it if necessary
        const confirmButton = this.rootElement.querySelector('#confirmJoinButton'); 
        if (confirmButton) confirmButton.disabled = false;

        // Resume timeout check before hiding
        console.log(`[${this.name}] Resuming host timeout check after cancellation.`);
        webRTCManager.resumeHostTimeoutCheck();

        eventBus.emit(Events.UI.JoinLobby.CancelClicked);
        this.hide();
    }

    /** Clears the error message display. @private */
    _clearError() {
        if (this.joinErrorDisplay) { // Check if it exists
            this.joinErrorDisplay.textContent = '';
            this.joinErrorDisplay.classList.add('hidden');
        }
         // Clear potential invalid states on inputs
         if (this.joinCodeInput) this.joinCodeInput.classList.remove('invalid'); // Check if it exists
    }

    /** Displays an error message. @private */
    _showError(message) {
        if (this.joinErrorDisplay) { // Check if it exists
            this.joinErrorDisplay.textContent = message;
            this.joinErrorDisplay.classList.remove('hidden');
        }
         // Add invalid class to relevant input (if possible to determine)
         // For simplicity, maybe just show the error text for now.
    }

    /** Handles back button click. DEFINED AS REGULAR METHOD @private */
    _handleBackClick() {
        console.log(`[${this.name}] Back button clicked.`);
        this._handleCancel();
    }
}

export default JoinLobbyComponent;
