import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

import webRTCManager from '../services/WebRTCManager.js'; // Ensure correct path and casing

/**
 * @typedef {object} PlayerData
 * @property {string} name
 * @property {number} score
 * @property {boolean} isHost
 * @property {HTMLElement} element - The list item element for this player.
 */

/**
 * @class PlayerListComponent
 * @extends BaseComponent
 * @description Manages the display of the player list in multiplayer games using an HTML template.
 */
class PlayerListComponent extends BaseComponent {
    /**
     * Creates an instance of PlayerListComponent.
     */
    constructor() {
        super('#playerListContainer', Views.PlayerList);
     
        this.template = document.querySelector('#player-list-item-template');
        if (!this.template) {
            console.error(`[${this.name}] Template element not found: #player-list-item-template`);
            return; // Cannot function without the template
        }

        /** @type {Map<string, PlayerData>} */
        this.playerData = new Map(); // Map<peerId, PlayerData>

        this.listen(Events.Multiplayer.Common.PlayerListUpdated, this.handlePlayerListUpdate);
        this.listen(Events.Multiplayer.Common.PlayerUpdated, this.handlePlayerUpdate); // Listen for specific updates

        // Show/hide based on game state
        this.listen(Events.Game.Started, this.handleGameStart);
        this.listen(Events.Game.Finished, this.resetDisplay); // Hide/clear after game
        this.listen(Events.Navigation.ShowView, this.handleViewChange); // Hide if navigating away

        console.debug(`[${this.name}] Initialized.`);
        this.resetDisplay(); // Start hidden and clear
    }

    /**
     * Handles the Multiplayer.Common.PlayerListUpdated event.
     * Rebuilds the player list display using the template.
     * @param {object} payload - The event payload.
     * @param {Map<string, {name: string, isHost: boolean, score?: number}>} payload.players - Map of player data.
     * @private
     */
    handlePlayerListUpdate({ players }) {
        if (!this.template || !players) return;
        console.debug(`[${this.name}] Received player list update:`, players);

        this.resetDisplay(false); // Clear DOM but keep component visible if already shown

        const myPeerId = webRTCManager.getMyPeerId();

        players.forEach((playerInfo, peerId) => {
            this._addPlayerToList(peerId, playerInfo, myPeerId);
        });

        this.show(); // Ensure list container is visible
    }

    /**
     * Adds or updates a single player in the list based on template.
     * @param {string} peerId - The player's peer ID.
     * @param {object} playerInfo - Player details ({ name, isHost, score }).
     * @param {string} myPeerId - The local player's peer ID.
     * @private
     */
    _addPlayerToList(peerId, playerInfo, myPeerId) {
        const score = playerInfo.score !== undefined ? playerInfo.score : 0;
        const name = playerInfo.name || 'Unnamed Player'; // Default name

        // Clone the template
        const listItem = this.template.content.cloneNode(true).querySelector('.player-item');
        if (!listItem) {
            console.error(`[${this.name}] Template structure incorrect: .player-item not found.`);
            return;
        }

        // Find elements within the template clone
        const nameSpan = listItem.querySelector('.player-name');
        const scoreSpan = listItem.querySelector('.player-score');
        const tagsContainer = listItem.querySelector('.player-tags'); // Optional container for tags

        // Populate the clone
        listItem.dataset.peerId = peerId;
        if (nameSpan) nameSpan.textContent = name;
        if (scoreSpan) scoreSpan.textContent = String(score);

        // Add tags (Host, You)
        if (tagsContainer) tagsContainer.innerHTML = ''; // Clear existing tags if any

        if (playerInfo.isHost) {
            const hostTag = document.createElement('span');
            hostTag.classList.add('player-tag', 'host-tag');
            hostTag.textContent = '(Host)';
            (tagsContainer || listItem).appendChild(hostTag); // Append to tags container or item
        }
        if (peerId === myPeerId) {
            const youTag = document.createElement('span');
            youTag.classList.add('player-tag', 'you-tag');
            youTag.textContent = '(You)';
            (tagsContainer || listItem).appendChild(youTag);
            listItem.classList.add('local-player');
        }

        // Append the populated clone to the list
        this.rootElement.appendChild(listItem);

        // Store reference for updates
        this.playerData.set(peerId, {
            name: name,
            score: score,
            isHost: playerInfo.isHost || false,
            element: listItem
        });
    }

    /**
     * Handles the Multiplayer.Common.PlayerUpdated event.
     * Updates the specific player's display based on the received data.
     * @param {object} payload - The event payload.
     * @param {string} payload.peerId - The ID of the player whose data changed.
     * @param {object} payload.updatedData - The specific fields that were updated (e.g., { score: 100 }).
     * @private
     */
    handlePlayerUpdate({ peerId, updatedData }) {
        const playerData = this.playerData.get(peerId);
        if (!playerData || !playerData.element || !updatedData) return;

        // console.debug(`[${this.name}] Handling player update for ${peerId}:`, updatedData);

        // Update Score if present
        if (updatedData.score !== undefined) {
            const newScore = updatedData.score;
            playerData.score = newScore;
            const scoreElement = playerData.element.querySelector('.player-score');
            if (scoreElement) {
                scoreElement.textContent = String(newScore);
                // Optional: Add animation/highlight on update
                playerData.element.classList.add('score-updated');
                setTimeout(() => playerData.element?.classList.remove('score-updated'), 300);
            }
        }

        // Update Name if present (less common)
        if (updatedData.name !== undefined) {
            const newName = updatedData.name;
            playerData.name = newName;
            const nameElement = playerData.element.querySelector('.player-name');
            if (nameElement) nameElement.textContent = newName;
        }

        // Update other fields like 'finished' status if implemented
        // if (updatedData.isFinished !== undefined) { ... }
    }

    /**
     * Shows the list only if the game mode is multiplayer.
     * @param {object} payload
     * @param {string} payload.mode - Game mode ('single', 'multiplayer', 'practice').
     * @private
     */
    handleGameStart({ mode }) {
        if (mode === 'multiplayer') {
            this.resetDisplay(false); // Clear any previous state but keep visible if already shown
            // Expecting PlayerListUpdated shortly after
        } else {
            this.resetDisplay(); // Hide and clear for non-multiplayer modes
        }
    }

    /**
     * Hides the list if navigating away from the GameArea.
     * @param {object} payload
     * @param {string} payload.viewName
     * @private
     */
    handleViewChange({ viewName }) {
        // Assuming the player list is only relevant inside 'GameArea' or multiplayer lobbies
        // Adjust this logic based on where the list should be visible
        if (viewName !== 'GameArea' && viewName !== 'HostLobby' && viewName !== 'JoinLobby') {
            this.resetDisplay(); // Hide and clear data
        }
    }

    /**
     * Clears the player list display and internal data.
     * @param {boolean} [hideComponent=true] - Whether to also hide the root element.
     * @private
     */
    resetDisplay(hideComponent = true) {
        // console.debug(`[${this.name}] Resetting display.`);
        if (this.rootElement) {
            this.rootElement.innerHTML = ''; // Clear list items
        }
        this.playerData.clear();
        if (hideComponent) {
            this.hide();
        }
    }
}

export default PlayerListComponent; 