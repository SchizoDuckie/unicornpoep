import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Assuming a View constant exists
import webRTCManager from '../services/WebRTCManager.js'; // Import for getting local ID
import { getTextTemplate } from '../utils/miscUtils.js'; // Import for templates

/**
 * Dialog displayed while waiting in a multiplayer lobby (host or client).
 * @extends BaseDialog
 */
class MultiplayerLobbyDialog extends BaseDialog {
    static SELECTOR = '#multiplayerLobbyDialog';
    static VIEW_NAME = 'MultiplayerLobbyDialog';
    
    static SELECTORS = {
        PLAYER_LIST: '#lobbyPlayerList',
        BACK_BUTTON: '.backToMain',
        STATUS_TEXT: '#lobbyStatusText',
        PLAYER_TEMPLATE: '#lobby-player-item-template'
    };
    
    // State variable
    localPlayerId = null;

    /**
     * Initializes component using the declarative pattern
     * @returns {Object} Configuration with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Multiplayer.Common.PlayerListUpdated,
                    callback: this._handlePlayerListUpdate
                },
                {
                    eventName: Events.Game.Started,
                    callback: this.hide
                },
                {
                    eventName: Events.Multiplayer.Client.DisconnectedFromHost,
                    callback: this._handleDisconnect
                },
                {
                    eventName: Events.WebRTC.ConnectionFailed,
                    callback: this._handleDisconnect
                }
            ],
            
            domEvents: [
                {
                    selector: MultiplayerLobbyDialog.SELECTORS.BACK_BUTTON, 
                    event: 'click',
                    handler: this._handleLeaveClick
                }
            ],
            
            domElements: [
                {
                    name: 'playerListUL',
                    selector: MultiplayerLobbyDialog.SELECTORS.PLAYER_LIST
                },
                {
                    name: 'backButton',
                    selector: MultiplayerLobbyDialog.SELECTORS.BACK_BUTTON
                },
                {
                    name: 'statusText',
                    selector: MultiplayerLobbyDialog.SELECTORS.STATUS_TEXT
                },
                {
                    name: 'playerItemTemplateElement',
                    selector: MultiplayerLobbyDialog.SELECTORS.PLAYER_TEMPLATE,
                    isGlobal: true // Template is not under the component's root element
                }
            ]
        };
    }

    /** 
     * Shows the dialog, optionally storing initial data 
     * @param {Object} data - Initial data object
     */
    show(data = {}) {
        if (data && data.localPlayerId) {
            this.localPlayerId = data.localPlayerId;
        }
        if (data && data.isHost) {
            this.elements.statusText.textContent = getTextTemplate('lobbyWaitingForPlayers');
        } else if (data && !data.isHost) {
            this.elements.statusText.textContent = getTextTemplate('lobbyWaitingForHost');
        }
        super.show();
    }

    /**
     * Handles updates to the player list from the host/coordinator.
     * @param {object} payload - The event payload.
     * @param {Map<string, object>} payload.players - The map of current players (peerId -> playerData).
     * @param {string} [payload.localPlayerId] - The local player's ID (might come via payload or stored in `this.localPlayerId`).
     * @private
     */
    _handlePlayerListUpdate({ players, localPlayerId }) {
        // Convert object to Map if needed
        const playersMap = players instanceof Map ? players : new Map(Object.entries(players));
        console.debug("[MultiplayerLobbyDialog] Handling PlayerListUpdated event:", playersMap);
        const idToUse = localPlayerId || this.localPlayerId;
        this._renderPlayerList(playersMap, idToUse);
    }

    /**
     * Renders the player list inside the dialog.
     * @param {Map<string, { name: string, isHost?: boolean, isReady?: boolean }>} playersMap - Map of player IDs to player data.
     * @param {string} localPlayerId - The ID of the local player.
     * @private
     */
    _renderPlayerList(playersMap, localPlayerId) {
        if (!this.elements.playerListUL || !this.elements.playerItemTemplateElement) {
             console.error(`[${this.name}] Cannot render player list: List UL or Template missing.`);
             return;
        }

        // Ensure localPlayerId is known if possible
        if (!localPlayerId) {
            localPlayerId = webRTCManager.getMyPeerId();
            console.warn(`[${this.name}] localPlayerId not provided to _renderPlayerList, fetching from WebRTCManager: ${localPlayerId}`);
        }
        this.localPlayerId = localPlayerId; // Store it for consistency

        this.elements.playerListUL.innerHTML = ''; // Clear previous list

        if (!playersMap || playersMap.size === 0) {
             const placeholder = document.createElement('li');
             placeholder.textContent = getTextTemplate('lobbyNoPlayersYet', { default: 'Waiting for players...' });
             placeholder.classList.add('italic', 'text-gray-500', 'p-2'); // Added padding
             this.elements.playerListUL.appendChild(placeholder);
            return;
        }

        // Sort players? Optional: Host first, then others alphabetically? For now, use Map order.
        playersMap.forEach((playerData, peerId) => {
            try {
                const templateContent = this.elements.playerItemTemplateElement.content.cloneNode(true);
                const listItem = templateContent.querySelector('.lobby-player-item');

                if (!listItem) {
                    console.error(`[${this.name}] Template structure error: Missing .lobby-player-item in template:`, this.elements.playerItemTemplateElement.id);
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
                this.elements.playerListUL.appendChild(listItem);

             } catch (error) {
                 console.error(`[${this.name}] Error rendering player item for ${peerId}:`, error, playerData);
             }
        });
    }

    /**
     * Handles disconnection from the host.
     * @param {object} [payload] - Optional disconnect reason.
     * @private
     */
    _handleDisconnect(payload) {
        console.warn(`[${this.name}] Disconnected/Connection Failed. Reason:`, payload.reason || 'N/A');
        this.hide();
    }

    /**
     * Handles the click on the "Leave Lobby" button.
     * @private
     */
    _handleLeaveClick() {
        console.debug("[MultiplayerLobbyDialog] Leave button clicked.");
        eventBus.emit(Events.UI.MultiplayerLobby.LeaveClicked);
        this.hide();
    }
}

export default MultiplayerLobbyDialog;
