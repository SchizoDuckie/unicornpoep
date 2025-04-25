import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility

/**
 * @class HostLobbyComponent
 * @extends RefactoredBaseComponent
 * Manages the host's view (#connectionCode) within the #connectionStatus dialog 
 * while waiting for players to join. Displays lobby info and player list.
 * Emits events for starting or cancelling the lobby.
 * @typedef {import('../services/WebRTCManager.js').PlayerData} PlayerData - Define PlayerData type
 */
class HostLobbyComponent extends RefactoredBaseComponent {
    static SELECTOR = '#connectionStatus';
    static VIEW_NAME = 'HostLobbyComponent';

    // --- Element Selectors (Specific to Host View within #connectionStatus) ---
    static HOST_VIEW_SELECTOR = '#connectionCode';
    static HOST_CODE_DISPLAY_SELECTOR = '#hostCodeDisplay';
    static COPY_CODE_BUTTON_SELECTOR = '#copyCodeButton';
    static JOIN_LINK_DISPLAY_SELECTOR = '#hostJoinLinkDisplay';
    static COPY_LINK_BUTTON_SELECTOR = '#copyJoinLinkButton';
    static WHATSAPP_BUTTON_SELECTOR = '#whatsappShareButton';
    static START_GAME_BUTTON_SELECTOR = '#hostStartButton';
    static HOST_ERROR_DISPLAY_SELECTOR = '#hostErrorDisplay';
    static WAITING_TEXT_CONTAINER_SELECTOR = '#hostWaitingText';
    static STATUS_INITIALIZING_SELECTOR = '[data-translation-key="host-status-initializing"]';
    static STATUS_WAITING_SELECTOR = '#host-status-waiting';
    static PLAYER_COUNT_SPAN_SELECTOR = '#playerCount';
    static PLAYER_LABEL_SINGULAR_SELECTOR = '#playerLabelSingular';
    static PLAYER_LABEL_PLURAL_SELECTOR = '#playerLabelPlural';
    static PLAYER_LIST_CONTAINER_SELECTOR = '#hostPlayerListContainer';
    static PLAYER_LIST_UL_SELECTOR = '#hostPlayerList';
    static PLAYER_LIST_PLACEHOLDER_SELECTOR = '#hostPlayerListPlaceholder';
    static BACK_BUTTON_SELECTOR = '.backToMain'; // Shared back button in parent

    /**
     * Initializes the component using the declarative pattern.
     * @returns {Object} Configuration object for BaseComponent.
     */
    initialize() {
        return {
            events: [
                // { eventName: Events.Navigation.ShowView, callback: this._handleShowView }, // REMOVED - UIManager handles showing/hiding the root element
                { eventName: Events.Multiplayer.Host.Initialized, callback: this._handleHostInitialized },
                { eventName: Events.Multiplayer.Host.ErrorOccurred, callback: this._handleHostError },
                { eventName: Events.Multiplayer.Common.PlayerListUpdated, callback: this._handlePlayerListUpdate },
                { eventName: Events.Game.Started, callback: this._handleGameStarted } // Hide when game starts
            ],
            domEvents: [
                {
                    selector: HostLobbyComponent.COPY_CODE_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleCopyCode
                },
                {
                    selector: HostLobbyComponent.COPY_LINK_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleCopyLink
                },
                {
                    selector: HostLobbyComponent.START_GAME_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleStartGameClick
                },
                {
                    selector: HostLobbyComponent.BACK_BUTTON_SELECTOR,
                    event: 'click',
                    handler: this._handleBackClick
                }
                // Add listener for WhatsApp button if custom logic needed beyond href
                // { selector: HostLobbyComponent.WHATSAPP_BUTTON_SELECTOR, event: 'click', handler: this._handleWhatsappClick }
            ],
            domElements: [
                {
                    name: 'hostViewContainer',
                    selector: HostLobbyComponent.HOST_VIEW_SELECTOR,
                    required: true
                },
                {
                    name: 'hostCodeDisplay',
                    selector: HostLobbyComponent.HOST_CODE_DISPLAY_SELECTOR,
                    required: false
                },
                {
                    name: 'copyCodeButton',
                    selector: HostLobbyComponent.COPY_CODE_BUTTON_SELECTOR,
                    required: false
                },
                {
                    name: 'joinLinkDisplay',
                    selector: HostLobbyComponent.JOIN_LINK_DISPLAY_SELECTOR,
                    required: false
                },
                {
                    name: 'copyLinkButton',
                    selector: HostLobbyComponent.COPY_LINK_BUTTON_SELECTOR,
                    required: false
                },
                {
                    name: 'whatsappButton',
                    selector: HostLobbyComponent.WHATSAPP_BUTTON_SELECTOR,
                    required: false
                },
                {
                    name: 'startGameButton',
                    selector: HostLobbyComponent.START_GAME_BUTTON_SELECTOR,
                    required: false
                },
                {
                    name: 'hostErrorDisplay',
                    selector: HostLobbyComponent.HOST_ERROR_DISPLAY_SELECTOR,
                    required: false
                },
                {
                    name: 'waitingTextContainer',
                    selector: HostLobbyComponent.WAITING_TEXT_CONTAINER_SELECTOR,
                    required: false
                },
                {
                    name: 'statusInitializing',
                    selector: HostLobbyComponent.STATUS_INITIALIZING_SELECTOR,
                    required: false
                },
                {
                    name: 'statusWaiting',
                    selector: HostLobbyComponent.STATUS_WAITING_SELECTOR,
                    required: false
                },
                {
                    name: 'playerCountSpan',
                    selector: HostLobbyComponent.PLAYER_COUNT_SPAN_SELECTOR,
                    required: false
                },
                {
                    name: 'playerLabelSingular',
                    selector: HostLobbyComponent.PLAYER_LABEL_SINGULAR_SELECTOR,
                    required: false
                },
                {
                    name: 'playerLabelPlural',
                    selector: HostLobbyComponent.PLAYER_LABEL_PLURAL_SELECTOR,
                    required: false
                },
                {
                    name: 'playerListContainer',
                    selector: HostLobbyComponent.PLAYER_LIST_CONTAINER_SELECTOR,
                    required: false
                },
                {
                    name: 'playerListUL',
                    selector: HostLobbyComponent.PLAYER_LIST_UL_SELECTOR,
                    required: false
                },
                {
                    name: 'playerListPlaceholder',
                    selector: HostLobbyComponent.PLAYER_LIST_PLACEHOLDER_SELECTOR,
                    required: false
                },
                {
                    name: 'backButton',
                    selector: HostLobbyComponent.BACK_BUTTON_SELECTOR,
                    required: false
                }
            ],
            setup: () => {
                // --- Initial State ---
                this.hostCode = null;
                this.hostPeerId = null;
            }
        };
    }

    /** Set up initial state of the lobby elements. @private */
    _setupInitialState() {
        if (!this.elements.hostViewContainer) return;
        
        // Hide host-specific view initially
        this.elements.hostViewContainer.classList.add('hidden');
        
        // Reset fields
        if(this.elements.hostCodeDisplay) this.elements.hostCodeDisplay.textContent = getTextTemplate('hostLoading', 'Loading...');
        if(this.elements.joinLinkDisplay) this.elements.joinLinkDisplay.textContent = getTextTemplate('hostLoading', 'Loading...');
        if(this.elements.startGameButton) this.elements.startGameButton.classList.add('hidden'); 
        if(this.elements.copyCodeButton) this.elements.copyCodeButton.disabled = true;
        if(this.elements.copyLinkButton) this.elements.copyLinkButton.disabled = true;
        if(this.elements.whatsappButton) this.elements.whatsappButton.classList.add('hidden');
        if(this.elements.hostErrorDisplay) {
            this.elements.hostErrorDisplay.classList.add('hidden'); 
            this.elements.hostErrorDisplay.replaceChildren(); 
        }

        // Reset waiting text
        if (this.elements.statusInitializing) this.elements.statusInitializing.classList.remove('hidden');
        if (this.elements.statusWaiting) this.elements.statusWaiting.classList.add('hidden');
        if (this.elements.playerCountSpan) this.elements.playerCountSpan.textContent = '0';
        if (this.elements.playerLabelSingular) this.elements.playerLabelSingular.classList.remove('hidden');
        if (this.elements.playerLabelPlural) this.elements.playerLabelPlural.classList.add('hidden');
        if (this.elements.playerListUL) this.elements.playerListUL.replaceChildren();
        if (this.elements.playerListPlaceholder) this.elements.playerListPlaceholder.classList.remove('hidden');
        
        this.hostCode = null;
        this.hostPeerId = null;
    }

    /**
     * Handles the ShowView event specifically for this component.
     * Resets state and ensures the host-specific view is ready.
     * The actual visibility is managed by the BaseComponent/UIManager.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data] Optional data with joinCode and playerName
     * @private
     */
    _handleShowView({ viewName, data }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Handling ShowView. Optional data:`, data);
            // Reset UI elements to their initial waiting state
            this._setupInitialState();
            
            // Show the host-specific part of the shared dialog
            if (this.elements.hostViewContainer) {
                 this.elements.hostViewContainer.classList.remove('hidden');
            }

            // REMOVED: Do not call _handleHostInitialized here.
            // Instead, rely *solely* on the Events.Multiplayer.Host.Initialized event
            // received via the event bus to populate code/link details.
            // This ensures the component reacts to the system state rather than ShowView data.
             console.log(`[${this.name}] ShowView complete. Waiting for Host.Initialized event.`);
        }
    }

    /**
     * Handles the Multiplayer.Host.Initialized event.
     * Updates the UI with the join code and shareable link.
     * @param {object} payload
     * @param {string} payload.hostId The short user-friendly join code.
     * @param {string} payload.hostPeerId The full PeerJS ID for the host connection.
     * @private
     */
    _handleHostInitialized({ hostId, hostPeerId }) {
        if (!this.elements.hostViewContainer) return; 
        
        console.log(`[${this.name}] Host Initialized. Code: ${hostId}, PeerID: ${hostPeerId}`);
        this.hostCode = hostId;
        this.hostPeerId = hostPeerId;

        // Show the host-specific view IF the parent component is already visible
        // BaseComponent/UIManager handles making the parent visible.
        // We just ensure our part (#connectionCode) inside it is visible.
        this.elements.hostViewContainer.classList.remove('hidden');

        let joinUrl = '';

        if (hostId && this.elements.hostCodeDisplay) {
            this.elements.hostCodeDisplay.textContent = `${hostId.substring(0, 3)} ${hostId.substring(3)}`;
            if(this.elements.copyCodeButton) this.elements.copyCodeButton.disabled = false;
        } else if (this.elements.hostCodeDisplay) {
            this.elements.hostCodeDisplay.textContent = getTextTemplate('hostLobbyErrorCode', 'Error!');
            if(this.elements.copyCodeButton) this.elements.copyCodeButton.disabled = true;
        }

        if (hostId && this.elements.joinLinkDisplay) {
            joinUrl = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
            this.elements.joinLinkDisplay.textContent = joinUrl;
            if(this.elements.copyLinkButton) this.elements.copyLinkButton.disabled = false;
        } else if (this.elements.joinLinkDisplay) {
            this.elements.joinLinkDisplay.textContent = getTextTemplate('hostLobbyErrorLink', 'Error generating link');
            if(this.elements.copyLinkButton) this.elements.copyLinkButton.disabled = true;
        }
        
        if (hostId && this.elements.whatsappButton && joinUrl) {
            const shareBaseText = this.elements.whatsappButton.dataset.shareText || getTextTemplate('hostWhatsappShare', 'Join my UnicornPoep game!');
            const whatsappText = encodeURIComponent(`${shareBaseText} ${joinUrl}`); 
            this.elements.whatsappButton.href = `https://api.whatsapp.com/send?text=${whatsappText}`;
            this.elements.whatsappButton.classList.remove('hidden');
        } else if (this.elements.whatsappButton) {
            this.elements.whatsappButton.href = '#';
            this.elements.whatsappButton.classList.add('hidden');
        }

        // Update player list with initial state (likely just the host)
        // The PlayerListUpdated event should follow shortly from the manager
        this._handlePlayerListUpdate({ players: new Map([[hostPeerId, { name: 'You (Host)', isHost: true }]]) });
        // Show waiting text (not initializing anymore)
        if (this.elements.statusInitializing) this.elements.statusInitializing.classList.add('hidden');
        if (this.elements.statusWaiting) this.elements.statusWaiting.classList.remove('hidden');
    }

    /**
     * Updates the player list display based on PlayerListUpdated event.
     * Shows '[IS ER KLAAR VOOR]' for each ready player (not host) using the translation key 'lobbyReadyTag'.
     * @param {object} payload
     * @param {Map<string, PlayerData>} payload.players - The full map of players.
     * @private
     */
     _handlePlayerListUpdate({ players }) {
        if (!this.elements.playerListUL || !players) return;
        // Convert object to Map if needed
        const playersMap = players instanceof Map ? players : new Map(Object.entries(players));
        console.log(`[${this.name}] Handling PlayerListUpdated with ${playersMap.size} players.`);
        this.elements.playerListUL.replaceChildren();
        let clientCount = 0;
        if (playersMap.size > 0) {
            playersMap.forEach((playerData, peerId) => {
                const li = document.createElement('li');
                const isHost = this.hostPeerId && peerId === this.hostPeerId;
                let displayName = playerData.name || `Player ${peerId.substring(0, 4)}`;
                if (isHost) {
                    displayName += ' (Host)';
                }
                // Show '[IS ER KLAAR VOOR]' for ready players (not host)
                if (playerData.isReady && !isHost) {
                    const readyTag = getTextTemplate('lobbyReadyTag', '[IS ER KLAAR VOOR]');
                    displayName += ` ${readyTag}`;
                    li.classList.add('player-ready-lobby'); // Optionally add a class for styling
                }
                li.textContent = displayName;
                li.dataset.peerId = peerId;
                this.elements.playerListUL.appendChild(li);
                if (!isHost) {
                     clientCount++;
                }
            });
            this.elements.playerListPlaceholder.classList.add('hidden');
        } else {
            this.elements.playerListPlaceholder.classList.remove('hidden');
        }

        // Update waiting text
        if (this.elements.statusInitializing) this.elements.statusInitializing.classList.add('hidden');
        if (this.elements.statusWaiting) this.elements.statusWaiting.classList.remove('hidden');
        if (this.elements.playerCountSpan) this.elements.playerCountSpan.textContent = clientCount.toString();
        if (this.elements.playerLabelSingular) this.elements.playerLabelSingular.classList.toggle('hidden', clientCount !== 1);
        if (this.elements.playerLabelPlural) this.elements.playerLabelPlural.classList.toggle('hidden', clientCount === 1);

        this.updateStartButtonState(clientCount);
    }

    /**
     * Handles Copy Code button click. @private */
    _handleCopyCode() {
        if (!this.hostCode) return;
        console.log(`[${this.name}] Copying host code: ${this.hostCode}`);
        navigator.clipboard.writeText(this.hostCode).then(() => {
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostCodeCopied', 'Host code copied!'), level: 'success' });
        }).catch(err => {
            console.error('Failed to copy host code: ', err);
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostCodeCopyFailed', 'Could not copy code'), level: 'error' });
        });
    }

    /** Handles Copy Link button click. @private */
    _handleCopyLink() {
        if (!this.hostCode) return;
        const joinUrl = `${window.location.origin}${window.location.pathname}?join=${this.hostCode}`;
        navigator.clipboard.writeText(joinUrl).then(() => {
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostLinkCopied', 'Join link copied!'), level: 'success' });
        }).catch(err => {
            console.error('Failed to copy join link: ', err);
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('hostLinkCopyFailed', 'Could not copy link'), level: 'error' });
        });
    }

    /**
     * Enables/disables the start button based on player count.
     * @param {number} clientCount - The number of connected clients (excluding host).
     * @private 
     */
    updateStartButtonState(clientCount) {
        const canStart = clientCount >= 1; 
        this.elements.startGameButton.disabled = !canStart;
        this.elements.startGameButton.parentElement.classList.toggle('hidden', !canStart); 
        this.elements.startGameButton.parentElement.classList.toggle('active', canStart); 
    
        
        if (canStart) {
             this.elements.startGameButton.textContent = getTextTemplate('hostStartButton', 'Start Game');
        } else {
             this.elements.startGameButton.textContent = getTextTemplate('hostStartButtonWaiting', 'Waiting for players...');
        }
    }

    /**
     * Handles errors specific to the host initialization or lobby phase.
     * @param {object} payload 
     * @param {string} payload.errorKey - Translation key for the error.
     * @param {string} [payload.originalMessage] - Optional underlying error.
     * @private
     */
    _handleHostError({ errorKey, originalMessage }) {
        console.error(`[${this.name}] Host Error: ${errorKey}`, originalMessage || '');
        if (this.elements.hostErrorDisplay) {
            const message = getTextTemplate(errorKey, 'An error occurred while hosting.');
            this.elements.hostErrorDisplay.textContent = message;
            this.elements.hostErrorDisplay.classList.remove('hidden');
        }
        // Optionally disable start button etc.
        if (this.elements.startGameButton) this.elements.startGameButton.disabled = true;
    }

    /**
     * Handles the user clicking the Lobby Back button
     * Emits a CancelClicked event for any interested listeners and navigates back.
     * @private
     * @event Events.UI.HostLobby.CancelClicked
     */
    _handleBackClick() {
        console.log(`[${this.name}] Back clicked, cancelling host lobby.`);
        // Emit the cancel event for MultiplayerHostCoordinator to handle closing the lobby
        eventBus.emit(Events.UI.HostLobby.CancelClicked);
        
        // Navigate back to multiplayer choice
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
    }

    /**
     * Handles the user clicking the Start Game button
     * Emits a StartGameClicked event for the game coordinator to handle.
     * @private
     * @event Events.UI.HostLobby.StartGameClicked
     */
    _handleStartGameClick() {
        console.log(`[${this.name}] Start Game clicked.`);
        // Emit the start event for MultiplayerHostCoordinator
        eventBus.emit(Events.UI.HostLobby.StartGameClicked);
    }

    /** Hides this component when the game starts. @private */
    _handleGameStarted() {
        console.log(`[${this.name}] Game started, hiding component.`);
        this.hide();
    }
}

export default HostLobbyComponent;