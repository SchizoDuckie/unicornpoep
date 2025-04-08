import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import webRTCManager from '../services/WebRTCManager.js';
// Potentially import PlayerListComponent if it's managed directly here

/**
 * @class HostLobbyComponent
 * @extends BaseComponent
 * Manages the host's view while waiting for players to join.
 * Displays connection info, player list, and the start game button.
 * Assumes it controls the `#connectionCode` div within the `#connectionStatus` dialog/view.
 */
class HostLobbyComponent extends BaseComponent {
    /**
     * Creates an instance of HostLobbyComponent.
     * @param {string} elementSelector - CSS selector for the component's root element (e.g., '#connectionCode').
     */
    constructor() {
        super('#connectionCode', Views.HostLobby);

        // Element references within the host lobby view
        this.hostCodeDisplay = this.rootElement.querySelector('#hostCodeDisplay');
        this.copyCodeButton = this.rootElement.querySelector('#copyCodeButton');
        this.hostJoinLinkDisplay = this.rootElement.querySelector('#hostJoinLinkDisplay');
        this.copyLinkButton = this.rootElement.querySelector('#copyJoinLinkButton');
        this.whatsappButton = this.rootElement.querySelector('#whatsappShareButton');
        this.waitingText = this.rootElement.querySelector('#hostWaitingText'); // Shows player count
        this.startButton = this.rootElement.querySelector('#hostStartButton');
        this.backButton = this.rootElement.closest('dialog, .view-container')?.querySelector('.backToMain'); // Find back button in parent
        // Assuming PlayerListComponent instance is managed elsewhere and updates via events
        // this.playerListContainer = this.rootElement.querySelector('#playerListContainer'); // If list is inside this component

        this.hostId = null;

        this._bindEvents();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for events relevant to the host lobby
        this.listen(Events.Navigation.ShowView, this.handleShowView);
        this.listen(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        this.listen(Events.Multiplayer.Host.ClientConnected, this.updatePlayerDisplay);
        this.listen(Events.Multiplayer.Host.ClientDisconnected, this.updatePlayerDisplay);
        // Listen for PlayerListUpdated if using a separate PlayerListComponent
        // this.listen(Events.Multiplayer.Common.PlayerListUpdated, this.handlePlayerListUpdate);
    }

    /** Binds DOM event listeners. @private */
    _bindEvents() {
        this.copyCodeButton?.addEventListener('click', this._handleCopyCode);
        this.copyLinkButton?.addEventListener('click', this._handleCopyLink);
        this.startButton?.addEventListener('click', this._handleStartClick);
        this.backButton?.addEventListener('click', this._handleBackClick); // Use back/cancel event
        // Note: WhatsApp button uses href, no click listener needed unless modifying behavior
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this.copyCodeButton?.removeEventListener('click', this._handleCopyCode);
        this.copyLinkButton?.removeEventListener('click', this._handleCopyLink);
        this.startButton?.removeEventListener('click', this._handleStartClick);
        this.backButton?.removeEventListener('click', this._handleBackClick);
    }

    /**
     * Handles the ShowView event.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data] - Optional data (playerName, settings) - might not be needed here
     */
    handleShowView({ viewName, data }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view. Data:`, data);
            this._resetLobbyState();
            this.show();
            // WebRTC init happens in GameCoordinator, we wait for Host.Initialized
        }
    }

    /** Resets the lobby display elements. @private */
    _resetLobbyState() {
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = 'Laden...';
        if (this.hostJoinLinkDisplay) this.hostJoinLinkDisplay.textContent = 'Laden...';
        if (this.whatsappButton) this.whatsappButton.href = '#';
        this.startButton?.classList.add('hidden');
        this.hostId = null;
        this.updatePlayerDisplay(); // Reset player count display
    }

    /**
     * Handles the Host.Initialized event from WebRTCManager.
     * @param {object} payload
     * @param {string} payload.hostId - The assigned host PeerJS ID.
     */
    handleHostInitialized({ hostId }) {
        console.log(`[${this.name}] Host initialized with ID: ${hostId}`);
        this.hostId = hostId;
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = hostId;
        
        // Construct join link
        const joinUrl = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
        if (this.hostJoinLinkDisplay) this.hostJoinLinkDisplay.textContent = joinUrl;
        if (this.whatsappButton) {
            const whatsappText = encodeURIComponent(`Doe mee met mijn Unicorn Poep spel! Klik hier: ${joinUrl}`);
            this.whatsappButton.href = `https://api.whatsapp.com/send?text=${whatsappText}`;
        }

        // Start button might still be hidden until at least one player joins?
        // Or enable immediately if 1-player hosting is allowed?
        // For now, enable when host is ready.
        this.startButton?.classList.remove('hidden'); 
        this.updatePlayerDisplay(); // Update text now that host is ready
    }

    /** Updates the waiting text based on connected clients. */
    updatePlayerDisplay() {
        // Needs info from WebRTCManager about connected players
        // Example: const playerCount = webRTCManager.getClientCount();
        // const playerCount = 0; // Placeholder
        const playerList = webRTCManager.getPlayerList(); // Get Map<peerId, { name: string, isHost: boolean }>
        // Count clients (excluding the host if present in the list)
        let clientCount = 0;
        if (playerList) {
            playerList.forEach(player => {
                if (!player.isHost) {
                    clientCount++;
                }
            });
        }
        
        const playerText = clientCount === 1 ? 'speler' : 'spelers';
        
        if (this.waitingText) {
            if (this.hostId) {
                this.waitingText.textContent = `Wachten op spelers... (${clientCount} verbonden ${playerText})`;
            } else {
                this.waitingText.textContent = 'Host initialiseren...';
            }
        }
        // Show/hide start button based on player count? (Optional)
        // if (this.startButton) {
        //     this.startButton.classList.toggle('hidden', clientCount < 1);
        // }
    }

    /** Handles copying the host code. @private */
    _handleCopyCode = async () => {
        if (!this.hostId) return;
        try {
            await navigator.clipboard.writeText(this.hostId);
            console.log(`[${this.name}] Host code copied: ${this.hostId}`);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Code gekopieerd!', level: 'success', duration: 1500 });
        } catch (err) {
            console.error(`[${this.name}] Failed to copy host code:`, err);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Kopiëren mislukt', level: 'error' });
        }
    }

    /** Handles copying the join link. @private */
    _handleCopyLink = async () => {
        const link = this.hostJoinLinkDisplay?.textContent;
        if (!link || link === 'Laden...') return;
        try {
            await navigator.clipboard.writeText(link);
            console.log(`[${this.name}] Join link copied: ${link}`);
             eventBus.emit(Events.System.ShowFeedback, { message: 'Link gekopieerd!', level: 'success', duration: 1500 });
        } catch (err) {
            console.error(`[${this.name}] Failed to copy join link:`, err);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Kopiëren mislukt', level: 'error' });
        }
    }

    /** Handles the start button click. @private */
    _handleStartClick = () => {
        console.log(`[${this.name}] Start Game button clicked.`);
        // GameCoordinator listens for this and starts the MultiplayerGame host instance
        eventBus.emit(Events.UI.HostLobby.StartGameClicked);
        // Optionally disable start button after clicking
         this.startButton?.setAttribute('disabled', 'true');
    }

    /** Handles the back/cancel button click. @private */
    _handleBackClick = () => {
        console.log(`[${this.name}] Back/Cancel button clicked.`);
        eventBus.emit(Events.UI.HostLobby.CancelClicked); // Specific cancel event
        this.hide();
        // GameCoordinator handles cleanup and navigation
    }

    // Override destroy
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
}

export default HostLobbyComponent;