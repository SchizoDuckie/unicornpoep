import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import webRTCManager from '../services/WebRTCManager.js';
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
import uiManager from '../ui/UIManager.js'; // Import UIManager
// Potentially import PlayerListComponent if it's managed directly here

/**
 * @class HostLobbyComponent
 * @extends BaseComponent
 * Manages the host's view (#connectionCode) within the #connectionStatus dialog 
 * while waiting for players to join. Assumes UIManager handles dialog visibility.
 * @typedef {import('../services/WebRTCManager.js').PlayerData} PlayerData - Define PlayerData type
 */
class HostLobbyComponent extends BaseComponent {
    static SELECTOR = '#connectionStatus';
    static VIEW_NAME = 'HostLobbyComponent';

    /** 
     * Initializes component elements and binds methods/listeners.
     * Called by BaseComponent constructor.
     */
    initialize() {
        // NOTE: This component targets elements *within* its rootElement (#connectionStatus)
        // which is shared with JoinLobbyComponent. Ensure selectors are specific.
        
        this.hostCode = null; // Store the 6-digit code
        this.hostPeerId = null; // Store the actual PeerJS ID of the host

        // --- IMPORTANT: Find elements within the parent dialog (#connectionStatus) --- 
        this.hostViewContainer = this.rootElement.querySelector('#connectionCode');

        // --- Check for the essential container first ---
        if (!this.hostViewContainer) {
            throw new Error(`[${this.name}] Could not find host view container #connectionCode within ${this.selector}.`);
        }

        // --- NOW find elements WITHIN the hostViewContainer (#connectionCode) ---
        this.hostCodeDisplay = this.hostViewContainer.querySelector('#hostCodeDisplay');
        this.copyCodeButton = this.hostViewContainer.querySelector('#copyCodeButton');
        this.joinLinkDisplay = this.hostViewContainer.querySelector('#hostJoinLinkDisplay'); 
        this.copyLinkButton = this.hostViewContainer.querySelector('#copyJoinLinkButton'); 
        this.whatsappButton = this.hostViewContainer.querySelector('#whatsappShareButton'); 
        this.startGameButton = this.hostViewContainer.querySelector('#hostStartButton'); 
        this.hostErrorDisplay = this.hostViewContainer.querySelector('#hostErrorDisplay');

        // Player count/waiting text elements (replace playerListElement)
        this.waitingTextContainer = this.hostViewContainer.querySelector('#hostWaitingText'); 
        this.statusInitializing = this.waitingTextContainer.querySelector('[data-translation-key="host-status-initializing"]');
        this.statusWaiting = this.waitingTextContainer.querySelector('#host-status-waiting');
        this.playerCountSpan = this.statusWaiting.querySelector('#playerCount');
        this.playerLabelSingular = this.statusWaiting.querySelector('#playerLabelSingular');
        this.playerLabelPlural = this.statusWaiting.querySelector('#playerLabelPlural');

        // Add player list elements
        this.playerListContainer = this.rootElement.querySelector('#hostPlayerListContainer');
        this.playerListUL = this.rootElement.querySelector('#hostPlayerList');
        this.playerListPlaceholder = this.rootElement.querySelector('#hostPlayerListPlaceholder');
        
        // --- ADDED: Select the back button from the parent dialog ---
        this.backButton = this.rootElement.querySelector('.backToMain');

        if (!this.playerListUL) console.error(`[${this.name}] Missing element: #hostPlayerList`);
        // --- ADDED: Check for backButton too ---
        if (!this.backButton) console.warn(`[${this.name}] Back button (.backToMain) not found in parent dialog.`);

        // Check for essential elements after querying
        if (!this.hostCodeDisplay || !this.copyCodeButton || !this.joinLinkDisplay || !this.copyLinkButton || !this.whatsappButton || !this.startGameButton || !this.waitingTextContainer || !this.statusWaiting || !this.playerCountSpan || !this.playerLabelSingular || !this.playerLabelPlural) {
            console.error(`[${this.name}] Failed to find one or more essential elements within ${this.selector}. Check HTML structure.`);
            // Optionally throw an error here to halt execution if component is unusable
            // throw new Error(`[${this.name}] Missing essential elements.`);
        }

        this._bindMethods();
        this._setupInitialState();

        // DOM event listeners are added in registerListeners
        // eventBus listeners are added in registerListeners using bound methods
    }

    /** Bind component methods to ensure correct 'this' context */
    _bindMethods() {
        // Bind DOM event listener handlers
        this.handleCopyCode = this.handleCopyCode.bind(this);
        this.handleCopyLink = this.handleCopyLink.bind(this);
        this.handleStartGame = this.handleStartGame.bind(this);

        // Bind eventBus handlers
        this.handleHostInitialized = this.handleHostInitialized.bind(this);
        this._handleHostError = this._handleHostError.bind(this);
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        // --- ADDED: Bind back button handler ---
        this._handleBackClick = this._handleBackClick.bind(this);
        this._handleStartGameClick = this._handleStartGameClick.bind(this);
    }

    /** Set up initial state of the lobby elements */
    _setupInitialState() {
        if (!this.rootElement) return; // Should not happen if constructor check works
        
        // Use templates for initial text
        if(this.hostCodeDisplay) this.hostCodeDisplay.textContent = getTextTemplate('hostLoading') || 'Laden...'; // Use loading text
        if(this.joinLinkDisplay) this.joinLinkDisplay.textContent = getTextTemplate('hostLoading') || 'Laden...';
        if(this.startGameButton) this.startGameButton.classList.add('hidden'); // Start hidden, enable later
        if(this.copyCodeButton) this.copyCodeButton.disabled = true;
        if(this.copyLinkButton) this.copyLinkButton.disabled = true;
        if(this.whatsappButton) this.whatsappButton.classList.add('hidden'); // Start hidden
        if(this.hostErrorDisplay) {
            this.hostErrorDisplay.classList.add('hidden'); 
            this.hostErrorDisplay.replaceChildren(); 
        }

        // Reset waiting text to initializing state
        if (this.statusInitializing) this.statusInitializing.classList.remove('hidden');
        if (this.statusWaiting) this.statusWaiting.classList.add('hidden');
        if (this.playerCountSpan) this.playerCountSpan.textContent = '0';
        if (this.playerLabelSingular) this.playerLabelSingular.classList.remove('hidden'); // Default to singular
        if (this.playerLabelPlural) this.playerLabelPlural.classList.add('hidden');
        if (this.playerListUL) this.playerListUL.replaceChildren(); // Clear player list
        if (this.playerListPlaceholder) this.playerListPlaceholder.classList.remove('hidden'); // Show placeholder
        
        this.hostCode = null; // Clear host ID
        this.hostPeerId = null; // Clear host PeerID
    }

    /** Register DOM and eventBus listeners */
    registerListeners() {
        // DOM listeners
        if (this.copyCodeButton) this.copyCodeButton.addEventListener('click', this.handleCopyCode);
        if (this.copyLinkButton) this.copyLinkButton.addEventListener('click', this.handleCopyLink);
        if (this.startGameButton) this.startGameButton.addEventListener('click', this._handleStartGameClick);
        // --- ADDED: Add back button listener ---
        if (this.backButton) this.backButton.addEventListener('click', this._handleBackClick);

        // eventBus listeners (using methods bound in _bindMethods)
        eventBus.on(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        eventBus.on(Events.Multiplayer.Host.ErrorOccurred, this._handleHostError);
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
    }

    /** Unregister DOM and eventBus listeners */
    unregisterListeners() {
        // DOM listeners
        if (this.copyCodeButton) this.copyCodeButton.removeEventListener('click', this.handleCopyCode);
        if (this.copyLinkButton) this.copyLinkButton.removeEventListener('click', this.handleCopyLink);
        if (this.startGameButton) this.startGameButton.removeEventListener('click', this._handleStartGameClick);
        // --- ADDED: Remove back button listener ---
        if (this.backButton) this.backButton.removeEventListener('click', this._handleBackClick);

        // eventBus listeners
        eventBus.off(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        eventBus.off(Events.Multiplayer.Host.ErrorOccurred, this._handleHostError);
        eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
    }

    /** Resets the lobby display elements. Called by show() or externally */
    _resetLobbyState() {
         this._setupInitialState();
         // Ensure host-specific part is hidden on reset
         if (this.hostViewContainer) {
             this.hostViewContainer.classList.add('hidden');
         }
    }

    /**
     * Handles the Host.Initialized event from WebRTCManager.
     * Makes the host view visible and updates its content.
     * @param {object} payload
     * @param {string} payload.hostId The 6-digit host ID.
     * @param {string} payload.hostPeerId The host's actual PeerJS ID.
     */
    handleHostInitialized({ hostId, hostPeerId }) {
        // Don't update if component isn't fully initialized
        if (!this.hostViewContainer || !this.rootElement) return; 
        
        console.log(`[${this.name}] Host Initialized. Code: ${hostId}, PeerID: ${hostPeerId}`);
        this.hostCode = hostId;
        this.hostPeerId = hostPeerId;

        // --- Explicitly Hide Loading View ---
        const loadingComponent = uiManager.getComponent('LoadingComponent'); // Use component name
        if (loadingComponent) {
            console.log(`[${this.name}] Hiding LoadingComponent.`);
            loadingComponent.hide();
        } else {
            console.warn(`[${this.name}] Could not find LoadingComponent to hide.`);
        }
        // --- End Hide Loading View ---

        // --- Make Visible --- 
        // Ensure parent dialog is shown (using BaseComponent's show which targets #connectionStatus)
        super.show(); 
        // Ensure host-specific view within the dialog is shown
        this.hostViewContainer.classList.remove('hidden');
        // --- End Make Visible ---

        let joinUrl = '';

        // Update code display (format with spaces)
        if (hostId && this.hostCodeDisplay) {
            this.hostCodeDisplay.textContent = `${hostId.substring(0, 3)} ${hostId.substring(3)}`;
            if(this.copyCodeButton) this.copyCodeButton.disabled = false;
        } else if (this.hostCodeDisplay) {
            this.hostCodeDisplay.textContent = getTextTemplate('hostLobbyErrorCode') || 'Error!';
            if(this.copyCodeButton) this.copyCodeButton.disabled = true;
        }

        // Update join link using the 6-digit hostId
        if (hostId && this.joinLinkDisplay) {
            joinUrl = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
            this.joinLinkDisplay.textContent = joinUrl;
            // this.joinLinkDisplay.href = joinUrl; // It's a span, not an anchor
            if(this.copyLinkButton) this.copyLinkButton.disabled = false;
        } else if (this.joinLinkDisplay) {
            this.joinLinkDisplay.textContent = getTextTemplate('hostLobbyErrorLink') || 'Error generating link';
            // this.joinLinkDisplay.removeAttribute('href');
            if(this.copyLinkButton) this.copyLinkButton.disabled = true;
        }
        
        // Update WhatsApp link
        if (hostId && this.whatsappButton && joinUrl) { // Ensure joinUrl is set
            const shareBaseText = this.whatsappButton.dataset.shareText || getTextTemplate('hostWhatsappShare') || 'Join my UnicornPoep game!';
            const whatsappText = encodeURIComponent(`${shareBaseText} ${joinUrl}`); 
            this.whatsappButton.href = `https://api.whatsapp.com/send?text=${whatsappText}`;
            this.whatsappButton.classList.remove('hidden'); // Show the button
        } else if (this.whatsappButton) {
            this.whatsappButton.href = '#'; // Reset href
            this.whatsappButton.classList.add('hidden'); // Hide if no hostId
        }

        // Fetch initial player list when host is initialized
        const initialPlayers = webRTCManager.getPlayerList(); // Get current list
        this._handlePlayerListUpdate({ players: initialPlayers }); // Update display with potentially existing players
    }

    /**
     * Updates the waiting text and player list based on connected clients.
     * Triggered by the PlayerListUpdated event.
     * @param {object} payload
     * @param {Map<string, PlayerData>} payload.players - The full map of players.
     * @private
     */
     _handlePlayerListUpdate({ players }) {
        if (!this.hostViewContainer || !this.waitingTextContainer || !players) return;
        console.log(`[${this.name}] Received PlayerListUpdated. Updating display with ${players.size} players.`);

        let clientCount = 0;

        // Iterate over the map to count clients and build the list
        if (this.playerListUL) {
            this.playerListUL.replaceChildren(); // Clear previous list
        }
        
        players.forEach((playerData, peerId) => {
            if (peerId !== this.hostPeerId) { // Use stored actual host PeerJS ID for comparison
                clientCount++;
                // Build list item using latest data
                if (this.playerListUL) {
                    const li = document.createElement('li');
                    const playerName = playerData.name || getTextTemplate('playerListUnnamed') || `Speler_${peerId.slice(-4)}`;
                    
                    // Check if player is ready and add ready tag if they are
                    if (playerData.isReady) {
                        const readyTag = getTextTemplate('lobbyReadyTag') || '[IS ER KLAAR VOOR]';
                        li.textContent = `${playerName} ${readyTag}`;
                        li.classList.add('player-ready'); // Add a class for styling if needed
                    } else {
                        li.textContent = playerName;
                    }
                    
                    this.playerListUL.appendChild(li);
                }
            }
        });

        console.log(`[${this.name}] Display updated. Client count: ${clientCount}`);

        // Show/hide placeholder based on client count
        if(this.playerListPlaceholder) this.playerListPlaceholder.classList.toggle('hidden', clientCount > 0);

        if (this.hostCode) {
            // Host is ready, show waiting status
            if (this.statusInitializing) this.statusInitializing.classList.add('hidden');
            if (this.statusWaiting) this.statusWaiting.classList.remove('hidden');

            if (this.playerCountSpan) this.playerCountSpan.textContent = clientCount.toString();
            
            // Toggle singular/plural labels based on count
            if (this.playerLabelSingular) this.playerLabelSingular.classList.toggle('hidden', clientCount !== 1);
            if (this.playerLabelPlural) this.playerLabelPlural.classList.toggle('hidden', clientCount === 1);

            // Enable/disable start button based on whether clients are present
            this.updateStartButtonState(clientCount);
        } else {
            // Host not initialized yet, show initializing
            if (this.statusInitializing) this.statusInitializing.classList.remove('hidden');
            if (this.statusWaiting) this.statusWaiting.classList.add('hidden');
            if(this.startGameButton) this.startGameButton.classList.add('hidden'); // Ensure start button is hidden
        }
    }

    /** Copy the 6-digit host code to clipboard */
    handleCopyCode() {
        if (!this.hostCode) return;
        navigator.clipboard.writeText(this.hostCode)
            .then(() => {
                console.log('Host code copied to clipboard');
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostCopyCodeSuccess'), level: 'success' });
            })
            .catch(err => {
                console.error('Failed to copy host code: ', err);
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostCopyCodeError'), level: 'error' });
            });
    }

    /** Copy the full join link to clipboard */
    handleCopyLink() {
        if (!this.joinLinkDisplay || !this.joinLinkDisplay.textContent || this.joinLinkDisplay.textContent.startsWith('Error') || this.joinLinkDisplay.textContent.startsWith('Laden')) return;
        navigator.clipboard.writeText(this.joinLinkDisplay.textContent)
            .then(() => eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostLobbyLinkCopied') || 'Link copied!', level: 'success' }))
            .catch((err) => {
                console.error(`[${this.name}] Failed to copy link:`, err);
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostLobbyLinkCopyFailed') || 'Failed to copy link.', level: 'error' });
            });
    }

    /** Handle the click on the start game button */
    handleStartGame() {
        console.log(`[${this.name}] Start Game button clicked.`);
        // Optionally add validation here (e.g., minimum players) before emitting
        eventBus.emit(Events.UI.HostLobby.StartGameClicked);
    }

    /**
     * Updates the state of the start button (enabled/disabled, visible/hidden).
     * @param {number} clientCount - The number of connected clients (excluding host).
     * @private
     */
    updateStartButtonState(clientCount) {
        if (!this.startGameButton) return;
        // Enable start button only if there is at least one client connected
        const canStart = clientCount > 0;
        this.startGameButton.disabled = !canStart;
        this.startGameButton.classList.toggle('hidden', !canStart);
        console.log(`[${this.name}] Start button ${canStart ? 'enabled' : 'disabled'} and ${canStart ? 'visible' : 'hidden'}.`);
    }

    /** 
     * Overrides base show to ensure initial state is reset.
     * Note: This is usually called by UIManager, but we call it 
     * directly in handleHostInitialized now.
     */
    show() {
        this._resetLobbyState();
        super.show(); // Make #connectionStatus visible
        // Do NOT show hostViewContainer here, wait for handleHostInitialized
    }

    /** 
     * Overrides base hide to ensure host-specific view is also hidden.
     */
    hide() {
        if (this.hostViewContainer) {
            this.hostViewContainer.classList.add('hidden');
        }
        super.hide(); // Hide #connectionStatus
    }

    /**
     * Override destroy for any specific cleanup.
     * BaseComponent destroy handles listeners.
     */
    destroy() {
        // Any specific cleanup for HostLobbyComponent
        super.destroy(); // Call BaseComponent destroy
        console.log(`[${this.name}] Destroyed.`);
    }

    /**
     * Handles host errors from WebRTCManager or GameCoordinator.
     * @param {object} payload
     * @param {string} payload.errorKey - Translation key for the error message.
     * @param {string} [payload.originalMessage] - Original error message, if any.
     * @param {number} [payload.index] - Optional index related to the error.
     */
    _handleHostError({ errorKey, originalMessage, index }) {
        console.error(`[${this.name}] Host Error Received: key=${errorKey}, msg=${originalMessage}, index=${index}`);
        // Use template for error message
        const displayMessage = getTextTemplate(errorKey) || originalMessage || getTextTemplate('hostLobbyGenericError') || 'An unknown error occurred.';
        if (this.hostErrorDisplay) {
            this.hostErrorDisplay.textContent = displayMessage;
            this.hostErrorDisplay.classList.remove('hidden');
        }
        // Consider more specific actions based on errorKey if needed
    }

    // --- ADDED: Back Button Handler ---
    /**
     * Handles the click event for the back button.
     * Navigates back to the Multiplayer Choice screen.
     * @private
     */
    _handleBackClick() {
        console.log(`[${this.name}] Back button clicked.`);
        // TODO: Consider cleanup? Should MultiplayerHostManager be stopped here, or does GameCoordinator handle it on view change?
        // For now, just navigate back.
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
        this.hide(); // Hide this component's view/dialog
    }
    // --- END ADDED SECTION ---

    /**
     * Handles the click on the "Start Game" button.
     * Emits the StartGameClicked event.
     * @private
     */
    _handleStartGameClick() {
        // Check if button should be enabled (double safety check)
        if (!this.startGameButton || this.startGameButton.disabled) {
            console.warn(`[${this.name}] Start Game button clicked, but it was disabled.`);
            return;
        }
        console.log(`[${this.name}] Start Game button clicked. Emitting ${Events.UI.HostLobby.StartGameClicked}`);
        this.startGameButton.disabled = true; // Prevent double-clicks immediately
        eventBus.emit(Events.UI.HostLobby.StartGameClicked); // Ensure correct event name
    }
}

export default HostLobbyComponent;