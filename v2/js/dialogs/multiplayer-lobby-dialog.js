import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Assuming a View constant exists
import webRTCManager from '../services/WebRTCManager.js'; // Import for getting local ID
import { getTextTemplate } from '../utils/miscUtils.js'; // Import for templates

/**
 * Dialog displayed while waiting in a multiplayer lobby (host or client).
 */
class MultiplayerLobbyDialog extends BaseDialog {
    static SELECTOR = '#multiplayerLobbyDialog';
    static VIEW_NAME = 'MultiplayerLobbyDialog';

    /** Initializes component elements. */
    initialize() {
        this.playerListUL = this.rootElement.querySelector('#lobbyPlayerList');
        this.backButton = this.rootElement.querySelector('.backToMain');
        this.statusText = this.rootElement.querySelector('#lobbyStatusText');
        this.playerItemTemplateElement = document.getElementById('lobby-player-item-template');

        if (!this.playerListUL) console.error(`[${this.name}] Missing list element #lobbyPlayerList.`);
        if (!this.backButton) console.error(`[${this.name}] Missing back button .backToMain.`);
        if (!this.statusText) console.warn(`[${this.name}] Optional status text element #lobbyStatusText not found.`);
        if (!this.playerItemTemplateElement || !(this.playerItemTemplateElement instanceof HTMLTemplateElement)) {
             console.error(`[${this.name}] Player item template '#lobby-player-item-template' not found or not a <template>.`);
             this.playerItemTemplateElement = null;
        }

        this.localPlayerId = null;

        this._bindMethods();

        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers GLOBAL event listeners */
    registerListeners() {
        this.listen(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
        this.listen(Events.Game.Started, this.hide);
        this.listen(Events.Multiplayer.Client.DisconnectedFromHost, this._handleDisconnect);
        this.listen(Events.WebRTC.ConnectionFailed, this._handleDisconnect);

        this.registerDOMListeners();
    }

    /** Registers specific DOM listeners */
    registerDOMListeners() {
         console.log(`[${this.name}] Registering DOM listeners.`);
         if (this.backButton) this.backButton.addEventListener('click', this._handleLeaveClick);
    }

    /** Unregisters specific DOM listeners */
    unregisterDOMListeners() {
         console.log(`[${this.name}] Unregistering DOM listeners.`);
         if (this.backButton) this.backButton.removeEventListener('click', this._handleLeaveClick);
    }

    _bindMethods() {
        this._handleLeaveClick = this._handleLeaveClick.bind(this);
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        this._handleDisconnect = this._handleDisconnect.bind(this);
        this._renderPlayerList = this._renderPlayerList.bind(this);
    }

    /** Shows the dialog, optionally storing initial data */
    show(data = {}) {
        if (data && data.localPlayerId) {
            this.localPlayerId = data.localPlayerId;
        }
        if (data && data.isHost) {
            this.statusText.textContent = getTextTemplate('lobbyWaitingForPlayers');
        } else if (data && !data.isHost) {
            this.statusText.textContent = getTextTemplate('lobbyWaitingForHost');
        }
        super.show();
    }

    /**
     * Handles updates to the player list from the host/coordinator.
     * @param {object} payload - The event payload.
     * @param {Map<string, object>} payload.players - The map of current players (peerId -> playerData).
     * @param {string} [payload.localPlayerId] - The local player's ID (might come via payload or stored in `this.localPlayerId`).
     */
    _handlePlayerListUpdate({ players, localPlayerId }) {
        console.debug("[MultiplayerLobbyDialog] Handling PlayerListUpdated event:", players);
        // Use the localPlayerId from the event if provided, otherwise use the one stored during show()
        const idToUse = localPlayerId || this.localPlayerId;
        // Always attempt to update the list when the event is received
        // Call the internal render method instead of the missing external one
        this._renderPlayerList(players, idToUse); // Corrected call
    }

    /**
     * Renders the player list inside the dialog.
     * @param {Map<string, { name: string, isHost?: boolean, isReady?: boolean }>} playersMap - Map of player IDs to player data.
     * @param {string} localPlayerId - The ID of the local player.
     * @private
     */
    _renderPlayerList(playersMap, localPlayerId) {
        if (!this.playerListUL || !this.playerItemTemplateElement) {
             console.error(`[${this.name}] Cannot render player list: List UL or Template missing.`);
             return;
        }

        // Ensure localPlayerId is known if possible
        if (!localPlayerId) {
            localPlayerId = webRTCManager.getMyPeerId();
            console.warn(`[${this.name}] localPlayerId not provided to _renderPlayerList, fetching from WebRTCManager: ${localPlayerId}`);
        }
        this.localPlayerId = localPlayerId; // Store it for consistency

        this.playerListUL.innerHTML = ''; // Clear previous list

        if (!playersMap || playersMap.size === 0) {
             const placeholder = document.createElement('li');
             placeholder.textContent = getTextTemplate('lobbyNoPlayersYet', { default: 'Waiting for players...' });
             placeholder.classList.add('italic', 'text-gray-500', 'p-2'); // Added padding
             this.playerListUL.appendChild(placeholder);
            return;
        }

        // Sort players? Optional: Host first, then others alphabetically? For now, use Map order.
        playersMap.forEach((playerData, peerId) => {
            try {
                const templateContent = this.playerItemTemplateElement.content.cloneNode(true);
                const listItem = templateContent.querySelector('.lobby-player-item');

                if (!listItem) {
                    console.error(`[${this.name}] Template structure error: Missing .lobby-player-item in template:`, this.playerItemTemplateElement.id);
                    return; // Skip this player if template item is broken
                }

                const nameSpan = listItem.querySelector('.lobby-player-name');
                const tagsSpan = listItem.querySelector('.lobby-player-tags');

                // Name
                if (nameSpan) {
                    nameSpan.textContent = playerData.name || getTextTemplate('lobbyUnnamedPlayer', { default: 'Unnamed Player' });
                } else {
                    console.warn(`[${this.name}] Template missing .lobby-player-name span.`);
                    // Still append the item, just without the name
                    listItem.textContent = playerData.name || getTextTemplate('lobbyUnnamedPlayer', { default: 'Unnamed Player' });
                }

                // Tags (Host, You, Ready)
                if (tagsSpan) {
                    tagsSpan.innerHTML = ''; // Clear any default tags
                    let tags = [];
                    if (playerData.isHost) {
                        tags.push(getTextTemplate('playerListHostTag', { default: '(Host)' }));
                    }
                    if (peerId === localPlayerId) {
                        tags.push(getTextTemplate('playerListYouTag', { default: '(You)' }));
                        // Apply special styling for the local player
                         if (listItem.classList) {
                            listItem.classList.add('local-player-lobby', 'font-semibold'); // Example style
                         }
                    }
                    // Check for 'isReady' specifically, common in lobbies
                    if (playerData.isReady && !playerData.isHost) {
                        tags.push(getTextTemplate('lobbyReadyTag', { default: '[Ready]' }));
                        // Optionally add a style for ready players
                         if (listItem.classList) {
                             listItem.classList.add('player-ready-lobby'); // Example class
                         }
                    }
                    tagsSpan.textContent = tags.join(' ');
                } else {
                     console.warn(`[${this.name}] Template missing .lobby-player-tags span.`);
                }

                listItem.dataset.peerId = peerId; // Store peerId for potential future use
                this.playerListUL.appendChild(listItem);

             } catch (error) {
                 console.error(`[${this.name}] Error rendering player item for ${peerId}:`, error, playerData);
             }
        });
    }

    /**
     * Handles the game start event from the host.
     */
    hideOnGameStart() {
        console.debug("[MultiplayerLobbyDialog] Game started, closing lobby dialog.");
        this.hide();
    }

    /**
     * Handles disconnection from the host.
     * @param {object} [payload] - Optional disconnect reason.
     */
    _handleDisconnect(payload) {
        console.warn(`[${this.name}] Disconnected/Connection Failed. Reason:`, payload?.reason || 'N/A');
        this.hide();
    }

    /**
     * Handles the click on the "Leave Lobby" button.
     */
    _handleLeaveClick() {
        console.debug("[MultiplayerLobbyDialog] Leave button clicked.");
        eventBus.emit(Events.UI.MultiplayerLobby.LeaveClicked);
        this.hide();
    }

    /**
     * Cleans up listeners when the component is destroyed.
     */
    destroy() {
        this.unregisterDOMListeners();
        super.destroy();
        console.debug(`[${this.name}] Destroyed`);
    }
}

export default MultiplayerLobbyDialog;
