import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * @class JoinLobbyComponent
 * @extends BaseComponent
 * Manages the client's process of joining a multiplayer game.
 * Handles code input, connection status display, game info confirmation, and waiting states.
 * Assumes it controls various divs within the `#connectionStatus` dialog/view: 
 * `#joinView`, `#fetchingInfoView`, `#joinConfirmView`, `#waitingForStartView`.
 */
class JoinLobbyComponent extends BaseComponent {
    /**
     * Creates an instance of JoinLobbyComponent.
     * @param {string} elementSelector - CSS selector for the component's root container 
     *                                   (e.g., the dialog '#connectionStatus' or a dedicated wrapper).
     */
    constructor(elementSelector = '#connectionStatus') {
        // Use the dialog/container as the root to manage visibility of internal divs
        super(elementSelector, Views.JoinLobby); 

        // Views within the component
        this.joinView = this.rootElement.querySelector('#joinView');
        this.fetchingInfoView = this.rootElement.querySelector('#fetchingInfoView');
        this.joinConfirmView = this.rootElement.querySelector('#joinConfirmView');
        this.waitingForStartView = this.rootElement.querySelector('#waitingForStartView');

        // Elements within Join View
        this.codeInput = this.joinView?.querySelector('#connectionCodeInput');
        this.submitCodeButton = this.joinView?.querySelector('#submitCode');
        this.joinWelcomeMessage = this.joinView?.querySelector('#joinWelcomeMessage');

        // Elements within Join Confirm View
        this.gameInfoDisplay = this.joinConfirmView?.querySelector('#joinGameInfo');
        this.confirmNameInput = this.joinConfirmView?.querySelector('#joinConfirmPlayerNameInput');
        this.confirmJoinButton = this.joinConfirmView?.querySelector('#confirmJoinButton');
        this.cancelJoinButton = this.joinConfirmView?.querySelector('#cancelJoinButton');

        // Shared elements
        this.backButton = this.rootElement.querySelector('.backToMain'); // Shared back button in the dialog?
        this.errorMessageDisplay = this.rootElement.querySelector('#connectionErrorMessage'); // Shared error display?

        this.playerName = ''; // Stored from initial navigation data

        this._bindEvents();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for events relevant to the join lobby
        this.listen(Events.Navigation.ShowView, this.handleShowView);
        this.listen(Events.Multiplayer.Client.ConnectedToHost, this.handleConnectedToHost);
        this.listen(Events.Multiplayer.Client.GameInfoReceived, this.handleGameInfoReceived);
        this.listen(Events.WebRTC.ConnectionFailed, this.handleConnectionFailed);
        this.listen(Events.System.ErrorOccurred, this.handleGenericError);
        // Listen for Game.Started to hide if join was successful
        this.listen(Events.Game.Started, this.handleGameStarted); 
    }

    /** Binds DOM event listeners. @private */
    _bindEvents() {
        this.submitCodeButton?.addEventListener('click', this._handleSubmitCode);
        this.confirmJoinButton?.addEventListener('click', this._handleConfirmJoin);
        this.cancelJoinButton?.addEventListener('click', this._handleCancel);
        this.backButton?.addEventListener('click', this._handleCancel); // Treat back as cancel
        // Clear error on input
        this.codeInput?.addEventListener('input', this._clearError);
        this.confirmNameInput?.addEventListener('input', this._clearError); 
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this.submitCodeButton?.removeEventListener('click', this._handleSubmitCode);
        this.confirmJoinButton?.removeEventListener('click', this._handleConfirmJoin);
        this.cancelJoinButton?.removeEventListener('click', this._handleCancel);
        this.backButton?.removeEventListener('click', this._handleCancel);
        this.codeInput?.removeEventListener('input', this._clearError);
        this.confirmNameInput?.removeEventListener('input', this._clearError);
    }

    /**
     * Handles the ShowView event, preparing the initial join view.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data]
     * @param {string} [payload.data.playerName]
     */
    handleShowView({ viewName, data }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view. Data:`, data);
            this.playerName = data?.playerName || 'Player'; // Store name
            this._showSpecificView('joinView'); // Start at the code input view
            if (this.joinWelcomeMessage) {
                this.joinWelcomeMessage.textContent = `Hoi ${this.playerName}! Voer de code in die je van de host hebt gekregen.`;
            }
            if (this.confirmNameInput) { // Pre-fill name in confirm view
                this.confirmNameInput.value = this.playerName;
            }
            if (this.codeInput) this.codeInput.value = ''; // Clear code input
            this._clearError();
            this.show(); // Show the overall container/dialog
            this.codeInput?.focus();
        }
    }

    /** Shows only the specified sub-view within the component. @private */
    _showSpecificView(viewId) {
        const views = [this.joinView, this.fetchingInfoView, this.joinConfirmView, this.waitingForStartView];
        views.forEach(view => {
            if (view) {
                view.classList.toggle('hidden', view.id !== viewId);
            }
        });
        console.log(`[${this.name}] Showing sub-view: ${viewId}`);
    }

    /** Handles the ConnectedToHost event from WebRTCManager. @private */
    handleConnectedToHost() {
        console.log(`[${this.name}] Connected to host. Waiting for game info...`);
        this._showSpecificView('fetchingInfoView');
        this._clearError();
    }

    /**
     * Handles the GameInfoReceived event from WebRTCManager.
     * @param {object} payload
     * @param {object} payload.settings - Host's game settings.
     * @param {Map<string, object>} payload.players - Current players.
     */
    handleGameInfoReceived({ settings, players }) {
        console.log(`[${this.name}] Received game info:`, { settings, players });
        if (this.gameInfoDisplay) {
            // TODO: Format settings and player list nicely for display
            const playerNames = Array.from(players.values()).map(p => p.name || 'Unknown').join(', ');
            this.gameInfoDisplay.innerHTML = `
                <p><strong>Host:</strong> ${players.get(settings.hostId)?.name || 'Host'}</p>
                <p><strong>Sheets:</strong> ${settings.sheetIds?.join(', ') || 'Default'}</p>
                <p><strong>Difficulty:</strong> ${settings.difficulty || 'Medium'}</p>
                <p><strong>Players:</strong> ${playerNames}</p>
            `;
        }
        this._showSpecificView('joinConfirmView');
        this._clearError();
        this.confirmNameInput?.focus(); // Focus name input in confirm view
    }

    /**
     * Handles WebRTC connection failures.
     * @param {object} payload
     * @param {Error} payload.error
     * @param {string} [payload.context]
     */
    handleConnectionFailed({ error, context }) {
        if (context === 'client-connect') { // Only handle client connection errors here
             console.error(`[${this.name}] Connection failed:`, error.message);
             this._showError(`Kon niet verbinden: ${error.message}`);
             this._showSpecificView('joinView'); // Go back to code input view
        } else if (this.isVisible) {
             // Handle other potentially relevant failures if the lobby is visible
             console.warn(`[${this.name}] Received connection failure in context: ${context}`);
             // Maybe show a generic error or force back to main menu?
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
         if (this.isVisible && context?.toLowerCase().includes('join')) {
             console.error(`[${this.name}] Received relevant system error:`, message, context);
             this._showError(message);
             // Don't switch views automatically, let user retry or cancel
         }
     }

    /** Handles submitting the connection code. @private */
    _handleSubmitCode = () => {
        const code = this.codeInput?.value.trim();
        if (!code || !/^[0-9]{6}$/.test(code)) { // Basic 6-digit validation
            this._showError('Voer een geldige 6-cijferige code in.');
            this.codeInput?.focus();
            return;
        }

        console.log(`[${this.name}] Submitting code: ${code}`);
        this._clearError();
        this._showSpecificView('fetchingInfoView'); // Show connecting status immediately

        // Emit event for GameCoordinator to handle connection attempt
        eventBus.emit(Events.UI.JoinLobby.SubmitCodeClicked, { 
            code: code, 
            playerName: this.playerName // Pass name along
        });
    }

    /** Handles confirming the join after seeing game info. @private */
    _handleConfirmJoin = () => {
        // Validate name again in case it was changed
         const confirmedName = this.confirmNameInput?.value.trim();
         if (!confirmedName) {
             this._showError('Vul alsjeblieft je naam in.');
             this.confirmNameInput?.focus();
             return;
         }
          if (confirmedName.length > 20) {
              this._showError('Naam mag maximaal 20 tekens lang zijn.');
              this.confirmNameInput?.focus();
              return;
          }
          // If name changed, potentially update WebRTCManager/Coordinator?
          if (confirmedName !== this.playerName) {
              console.log(`[${this.name}] Player name changed to: ${confirmedName}`);
              this.playerName = confirmedName; 
              // TODO: Add event/mechanism to update name with host if needed
              // E.g., eventBus.emit(Events.Multiplayer.Client.NameChanged, { name: confirmedName });
          }

        console.log(`[${this.name}] Confirming join.`);
        this._clearError();
        this._showSpecificView('waitingForStartView');
        
        // Emit event for GameCoordinator to finalize join and start client-side game instance
        eventBus.emit(Events.UI.JoinLobby.ConfirmClicked);
    }

    /** Handles cancel button click or back button click. @private */
    _handleCancel = () => {
        console.log(`[${this.name}] Cancel/Back clicked.`);
        eventBus.emit(Events.UI.JoinLobby.CancelClicked); // Specific cancel event
        this.hide();
        // GameCoordinator listens for CancelClicked and handles cleanup/navigation
    }

    /** Clears the error message display. @private */
    _clearError = () => {
        if (this.errorMessageDisplay) {
            this.errorMessageDisplay.textContent = '';
            this.errorMessageDisplay.classList.add('hidden');
        }
         // Clear potential invalid states on inputs
         this.codeInput?.classList.remove('invalid');
         this.confirmNameInput?.classList.remove('invalid');
    }

    /** Displays an error message. @private */
    _showError(message) {
        if (this.errorMessageDisplay) {
            this.errorMessageDisplay.textContent = message;
            this.errorMessageDisplay.classList.remove('hidden');
        }
         // Add invalid class to relevant input (if possible to determine)
         // For simplicity, maybe just show the error text for now.
    }
    
     /** Hide component if game starts successfully. @private */
     handleGameStarted({ mode }) {
         if (mode === 'multiplayer' && this.isVisible) {
             console.log(`[${this.name}] Multiplayer game started, hiding lobby.`);
             this.hide();
         }
     }

    // Override destroy
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
}

export default JoinLobbyComponent; 