import BaseComponent from './BaseComponent.js';
import eventBus from '../../core/event-bus.js';
import Events from '../../core/event-constants.js';
import webRTCManager from '../../services/WebRTCManager.js'; // For getting host ID
import miscUtils from '../../utils/miscUtils.js'; // For getTextTemplate

/**
 * Dialog shown to the host while waiting for players to join.
 * Displays the join code/link and the list of connected players.
 * Allows the host to start the game once at least one client has joined.
 */
class MultiplayerLobbyDialog extends BaseComponent {
    /**
     * Creates an instance of MultiplayerLobbyDialog.
     * @param {string} selector - The CSS selector for the dialog element.
     */
    constructor(selector = '#multiplayerLobbyDialog') {
        super(selector);
        this.name = 'MultiplayerLobbyDialog'; // Explicitly set name

        // Query selectors for elements within the dialog
        this.lobbyCodeDisplay = this.rootElement.querySelector('#lobbyCode');
        this.playerListUl = this.rootElement.querySelector('#playerList');
        this.startButton = this.rootElement.querySelector('#startMultiplayerGame');
        this.copyLinkButton = this.rootElement.querySelector('#copyJoinLink');
        this.playerCountDisplay = this.rootElement.querySelector('#playerCount');
        this.backButton = this.rootElement.querySelector('.back-button'); // Back button

        // Get the template for a player entry
        const templateElement = this.rootElement.querySelector('#player-list-item-template');
        if (!templateElement) {
            console.error(`[${this.name}] Player list item template not found!`);
            this.playerTemplate = '<li>Template Error</li>'; // Fallback
        } else {
            this.playerTemplate = templateElement.innerHTML;
            // console.debug(`[${this.name}] Loaded player template:`, this.playerTemplate);
        }

        // Bindings - ensure 'this' context is correct in handlers
        this._handleHostInitialized = this._handleHostInitialized.bind(this);
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        this._handleStartClick = this._handleStartClick.bind(this);
        this._handleCopyLink = this._handleCopyLink.bind(this);
        this._handleBackClick = this._handleBackClick.bind(this); // Bind back button handler

        console.log(`[${this.name}] Initialized.`);
        this.registerListeners();
    }

    /**
     * Registers event listeners for the component.
     * @private
     */
    registerListeners() {
        super.registerListeners(); // Call base class method if it exists

        // Listen for when the host is ready (provides the code)
        eventBus.on(Events.Multiplayer.Host.Initialized, this._handleHostInitialized);
        // Listen for updates to the player list
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);

        // Listen for button clicks
        if (this.startButton) {
            this.startButton.addEventListener('click', this._handleStartClick);
        }
        if (this.copyLinkButton) {
            this.copyLinkButton.addEventListener('click', this._handleCopyLink);
        }
        if (this.backButton) { // Add listener for back button
            this.backButton.addEventListener('click', this._handleBackClick);
        }
        console.log(`[${this.name}] Registering DOM listeners.`);
    }

    /**
     * Updates the displayed list of players.
     * @param {Map<string, object>} playersMap - Map of player IDs to player data.
     * @private
     */
    _updatePlayerList(playersMap) {
        console.debug(`[${this.name}] Received PlayerListUpdated. Updating display with ${playersMap.size} players.`);
        if (!this.playerListUl || !this.playerTemplate) {
            console.error(`[${this.name}] Cannot update player list: List UL or template missing.`);
            return;
        }

        // --- Inlined logic from populatePlayerList ---
        this.playerListUl.innerHTML = ''; // Clear existing list
        const hostId = webRTCManager.getMyPeerId(); // Get host ID locally

        playersMap.forEach((playerData, peerId) => {
            // Clone the template content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.playerTemplate.trim();
            const playerElement = tempDiv.firstChild;

            if (playerElement && playerElement.nodeType === Node.ELEMENT_NODE) {
                const nameElement = playerElement.querySelector('.opponent-name'); // Use class defined in template

                if (nameElement) {
                    nameElement.textContent = playerData.name || 'Unnamed Player';
                    if (playerData.isHost || peerId === hostId) { // Check if this player is the host
                         nameElement.textContent += miscUtils.getTextTemplate('lobbyHostSuffix'); // Add "(Host)" suffix
                         nameElement.classList.add('host-player-name'); // Optional: Add class for styling
                    }
                    this.playerListUl.appendChild(playerElement);
                } else {
                     // This error check was inside the old populatePlayerList
                     console.error('[MultiplayerLobbyDialog._renderPlayerList] Template structure error: Missing .opponent-name in template:', this.playerTemplate);
                }
            } else {
                console.error('[MultiplayerLobbyDialog._renderPlayerList] Template structure error: Invalid player element generated from template:', this.playerTemplate);
            }
        });
         // --- End of inlined logic ---


        const clientCount = playersMap.size - 1; // Exclude the host
        this.playerCountDisplay.textContent = miscUtils.getTextTemplate('lobbyPlayerCount', { count: clientCount });
        console.debug(`[${this.name}] Display updated. Client count: ${clientCount}`);

        // Enable/disable start button based on whether clients have joined
        const canStart = clientCount > 0;
        if (this.startButton) {
            this.startButton.disabled = !canStart;
             this.startButton.style.display = canStart ? '' : 'none'; // Show/hide
            console.debug(`[${this.name}] Start button ${canStart ? 'enabled and visible' : 'disabled and hidden'}.`);
        }
    }

    /**
     * Handles the PlayerListUpdated event from the EventBus.
     * @param {object} payload - The event payload.
     * @param {Map<string, object>} payload.players - The updated map of players.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
         this._updatePlayerList(players);
    }

    /**
     * Cleans up event listeners when the component is destroyed or hidden.
     * @private
     */
    unregisterListeners() {
        super.unregisterListeners(); // Call base class method if it exists

        eventBus.off(Events.Multiplayer.Host.Initialized, this._handleHostInitialized);
        eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);

        if (this.startButton) {
            this.startButton.removeEventListener('click', this._handleStartClick);
        }
        if (this.copyLinkButton) {
            this.copyLinkButton.removeEventListener('click', this._handleCopyLink);
        }
         if (this.backButton) { // Remove listener for back button
             this.backButton.removeEventListener('click', this._handleBackClick);
         }
        console.log(`[${this.name}] Unregistering DOM listeners.`);
    }
}

export default MultiplayerLobbyDialog; 