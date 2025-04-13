import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import miscUtils from '../utils/miscUtils.js';
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
        // Main container views
        this.joinViewContainer = this.rootElement.querySelector('#joinView');
        this.fetchingInfoView = this.rootElement.querySelector('#fetchingInfoView');
        this.joinConfirmView = this.rootElement.querySelector('#joinConfirmView');
        this.waitingForStartView = this.rootElement.querySelector('#waitingForStartView');
        
        if (!this.joinViewContainer || !this.fetchingInfoView || !this.joinConfirmView || !this.waitingForStartView) {
            console.error(`[${this.name}] Could not find one or more required sub-view containers.`);
        }

        // Elements in #joinView
        this.joinCodeInput = this.joinViewContainer?.querySelector('#connectionCodeInput');
        this.submitCodeButton = this.joinViewContainer?.querySelector('#submitCode');
        this.playerNameDisplay = this.joinViewContainer?.querySelector('#joinPlayerName');
        this.joinErrorDisplay = this.joinViewContainer?.querySelector('#connectionErrorMessage');

        // Elements in #joinConfirmView
        this.confirmNameInput = this.joinConfirmView?.querySelector('#joinConfirmPlayerNameInput');
        this.confirmRefreshNameButton = this.joinConfirmView?.querySelector('#refreshJoinConfirmNameButton'); // Find the button here
        this.confirmJoinButton = this.joinConfirmView?.querySelector('#confirmJoinButton');
        this.cancelJoinButton = this.joinConfirmView?.querySelector('#cancelJoinButton'); // Added for completeness

        // Shared elements
        this.backButton = this.rootElement.querySelector('.backToMain');
        
        // Check core elements needed initially
        if (!this.joinCodeInput || !this.submitCodeButton || !this.backButton) {
            console.error(`[${this.name}] Missing critical initial elements (#connectionCodeInput, #submitCode, .backToMain).`);
        }
        // Check elements needed for confirmation step
         if (!this.confirmNameInput || !this.confirmRefreshNameButton || !this.confirmJoinButton || !this.cancelJoinButton) {
             console.warn(`[${this.name}] Missing elements for confirmation view (#joinConfirmPlayerNameInput, #refreshJoinConfirmNameButton, #confirmJoinButton, #cancelJoinButton). Will cause issues later.`);
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
        this._handleConfirmRefreshName = this._handleConfirmRefreshName.bind(this); // Bind new handler

        // Add DOM Listeners
        if (this.submitCodeButton) this.submitCodeButton.addEventListener('click', this._handleSubmitCode);
        if (this.joinCodeInput) {
            this.joinCodeInput.addEventListener('input', this._clearError);
            this.joinCodeInput.addEventListener('keypress', this._handleInputKeyPress);
        }
        if (this.backButton) this.backButton.addEventListener('click', this._handleBackClick);
        
        // Listeners for Confirm View (added in initialize, safe if elements exist)
        if (this.confirmJoinButton) this.confirmJoinButton.addEventListener('click', this._handleConfirmJoin);
        if (this.cancelJoinButton) this.cancelJoinButton.addEventListener('click', this._handleCancel);
        if (this.confirmRefreshNameButton) this.confirmRefreshNameButton.addEventListener('click', this._handleConfirmRefreshName); // Add listener for refresh button
        
        // Add eventBus Listeners using BaseComponent helper
        this.listen(Events.Navigation.ShowView, this.handleShowView);
        this.listen(Events.Multiplayer.Client.GameInfoReceived, this._handleGameInfoReceived);
        this.listen(Events.WebRTC.ConnectionFailed, this.handleConnectionFailed);
        this.listen(Events.Multiplayer.Client.DisconnectedFromHost, this.handleConnectionFailed); // Already handled by handleConnectionFailed? Keep for clarity
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
            this.playerName = data.playerName || miscUtils.getTextTemplate('joinDefaultPlayerName');

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
        // Note: We already queried these in initialize, use the stored references
        const gameInfoDisplay = this.joinConfirmView?.querySelector('#joinGameInfo');

        if (gameInfoDisplay) {
            const defaultUnknown = miscUtils.getTextTemplate('joinInfoUnknown');
            const defaultHost = miscUtils.getTextTemplate('joinInfoDefaultHost');
            const defaultDifficulty = miscUtils.getTextTemplate('joinInfoDefaultDifficulty');
            const defaultSheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheets');

            // Safely get host player name
            const hostPlayer = players.get(hostId);
            const hostName = hostPlayer ? hostPlayer.name : defaultHost;
            
            // Extract sheet names or count from questionsData
            let sheetsInfo = defaultSheetsInfo;
            if (questionsData && Array.isArray(questionsData.sheets) && questionsData.sheets.length > 0) {
                sheetsInfo = questionsData.sheets.map(sheet => sheet.name || defaultUnknown).join(', ');
            } else if (questionsData && questionsData.sheets) {
                 // Handle case where sheets array might be empty
                 sheetsInfo = miscUtils.getTextTemplate('joinInfoNoSheetsSelected');
            }

            const playerNames = Array.from(players.values()).map(p => p.name || defaultUnknown).join(', ');
            
            gameInfoDisplay.innerHTML = `
                <p><strong>Host:</strong> ${hostName}</p>
                <p><strong>Sheets:</strong> ${sheetsInfo}</p>
                <p><strong>Difficulty:</strong> ${difficulty || defaultDifficulty}</p>
                <p><strong>Players:</strong> ${playerNames}</p>
            `;
        } else {
             console.error(`[${this.name}] Game info display area not found in #joinConfirmView.`);
        }

        this._showSpecificView('joinConfirmView');
        this._clearError();

        // Use existing references found in initialize
        if (this.confirmJoinButton) {
            this.confirmJoinButton.disabled = false;
            // Listener was added in registerListeners, no need to add again
        } else {
             console.error(`[${this.name}] Confirm button not found (checked this.confirmJoinButton).`);
        }
        if (this.confirmNameInput) {
             // Load name from localStorage or generate random if not set yet
             this._loadOrGenerateNameForConfirm();
             this.confirmNameInput.focus();
        } else {
             console.error(`[${this.name}] Name input not found (checked this.confirmNameInput).`);
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
             this._showError(`${miscUtils.getTextTemplate('joinErrorConnectPrefix')}${error.message}`);
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
            this._showError(miscUtils.getTextTemplate('joinErrorInvalidCode'));
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
        // Use existing references from initialize
        if (!this.confirmNameInput) {
             console.error(`[${this.name}] Could not find confirm name input (this.confirmNameInput).`);
             this._showError('Internal error: Missing name input.');
             if (this.confirmJoinButton) this.confirmJoinButton.disabled = false; 
             return;
        }
        
        const confirmedName = this.confirmNameInput.value.trim();
        if (!confirmedName) {
            // Assuming joinErrorDisplay is used for this view too, or add a specific error element
            this._showError(miscUtils.getTextTemplate('joinErrorEmptyName')); 
            this.confirmNameInput.focus();
            if (this.confirmJoinButton) this.confirmJoinButton.disabled = false; 
            return;
        }
        if (confirmedName.length > 40) {
            this._showError(miscUtils.getTextTemplate('joinErrorNameTooLong'));
            this.confirmNameInput.focus();
            if (this.confirmJoinButton) this.confirmJoinButton.disabled = false; 
            return;
        }

        console.log(`[${this.name}] Confirming join with name: ${confirmedName}`);
        this._clearError();
        if (this.confirmJoinButton) this.confirmJoinButton.disabled = true; 

        // Save the confirmed name to localStorage
        try {
            localStorage.setItem('unicornPoepUserName', confirmedName);
            console.log(`[${this.name}] Saved confirmed name to localStorage: ${confirmedName}`);
        } catch (e) {
            console.warn(`[${this.name}] Could not save name to localStorage`, e);
        }

        // Resume timeout check before hiding
        console.log(`[${this.name}] Resuming host timeout check after confirmation.`);
        webRTCManager.resumeHostTimeoutCheck();

        eventBus.emit(Events.UI.JoinLobby.ConfirmClicked, { playerName: confirmedName });
        this.hide(); // Hide the dialog/component
    }

    /** Handles cancel button click in the confirmation view. DEFINED AS REGULAR METHOD @private */
    _handleCancel() {
        console.log(`[${this.name}] Cancel button clicked.`);
        // Re-enable confirm button if needed
        if (this.confirmJoinButton) this.confirmJoinButton.disabled = false;

        // Resume timeout check before hiding
        console.log(`[${this.name}] Resuming host timeout check after cancellation.`);
        webRTCManager.resumeHostTimeoutCheck();

        eventBus.emit(Events.UI.JoinLobby.CancelClicked);
        this.hide(); // Hide the dialog/component
    }
    
    /** Handles the click on the refresh name button within the join confirmation view. @private */
    _handleConfirmRefreshName() {
        console.log(`[${this.name}] Refresh name button clicked in confirm view.`);
        const newName = miscUtils.generateRandomPlayerName();
        if (this.confirmNameInput) {
            this.confirmNameInput.value = newName;
            this._clearError(); // Clear any validation errors specific to this view if needed
            console.log(`[${this.name}] Set random name in confirm view: ${newName}`);
        } else {
            console.error(`[${this.name}] Confirm name input not found for refresh.`);
        }
    }
    
     /** Loads name from localStorage or generates random for the confirm input. @private */
     _loadOrGenerateNameForConfirm() {
         if (!this.confirmNameInput) return;
 
         try {
             // First priority: Use the username already set in this component from the initial connection
             if (this.playerName) {
                 this.confirmNameInput.value = this.playerName;
                 console.log(`[${this.name}] Pre-filled confirm name with already set playerName: ${this.playerName}`);
             } else {
                 // Second priority: Try getting from localStorage
                 const storedName = localStorage.getItem('unicornPoepUserName');
                 if (storedName) {
                     this.confirmNameInput.value = storedName;
                     console.log(`[${this.name}] Pre-filled confirm name with stored: ${storedName}`);
                 } else {
                     // Last resort: Generate random name
                     const randomName = miscUtils.generateRandomPlayerName();
                     this.confirmNameInput.value = randomName;
                     console.log(`[${this.name}] Generated random name for confirm input: ${randomName}`);
                 }
             }
         } catch (error) {
             console.error(`[${this.name}] Error loading/generating name for confirm input:`, error);
             this.confirmNameInput.value = 'Player'; // Fallback
         }
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
