import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility

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
 * @extends RefactoredBaseComponent
 * @description Manages the display of the player list in multiplayer games using an HTML template.
 */
class PlayerListComponent extends RefactoredBaseComponent {
    // --- Static properties REQUIRED by RefactoredBaseComponent ---
    static SELECTOR = '#playerListContainer';
    static VIEW_NAME = 'PlayerListComponent';

    /**
     * Creates an instance of PlayerListComponent.
     */
    constructor() {
        super();
        console.log(`[${this.name}] Constructed via RefactoredBaseComponent.`);
    }

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and setup
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Multiplayer.Common.PlayerListUpdated,
                    callback: this._handlePlayerListUpdate
                },
                {
                    eventName: Events.Multiplayer.Common.PlayerUpdated,
                    callback: this._handlePlayerUpdate
                },
                {
                    eventName: Events.Game.Started,
                    callback: this._handleGameStart
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                }
            ],
            
            domEvents: [], // No DOM events to handle
            
            setup: () => {
                // Find the template using document.querySelector
                const templateElement = document.querySelector('#player-list-item-template');

                if (!templateElement || !(templateElement instanceof HTMLTemplateElement)) {
                    console.error(`[${this.name}] Template element not found or is not a <template>: #player-list-item-template`);
                    this.template = null;
                    // Optionally throw error if template is critical, preventing component init
                    // throw new Error(`[${this.name}] Critical template element not found: #player-list-item-template`);
                } else {
                    this.template = templateElement; // Store the template element reference
                }

                /** @type {Map<string, PlayerData>} */
                this.playerData = new Map();

                this._resetDisplay(); // Set initial visual state (e.g., clear list, hide)
                console.log(`[${this.name}] Initialized.`);
            }
        };
    }

    /**
     * Handles the Multiplayer.Common.PlayerListUpdated event.
     * Rebuilds the player list display **sorted by score** using the template.
     * @param {object} payload - The event payload.
     * @param {Map<string, {name: string, isHost: boolean, score?: number}>} payload.players - Map of player data.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        if (!this.rootElement || !this.template || !players) {
            console.warn(`[${this.name}] Cannot update player list: Component not ready or missing data.`);
            return;
        }
        // Convert object to Map if needed
        const playersMap = players instanceof Map ? players : new Map(Object.entries(players));
        const myPeerId = webRTCManager.getMyPeerId();
        // --- Sorting Logic ---
        const playerEntries = Array.from(playersMap.entries());
        playerEntries.sort(([, playerA], [, playerB]) => {
             const scoreA = playerA.score ?? 0;
             const scoreB = playerB.score ?? 0;
             return scoreB - scoreA;
        });
        this.rootElement.innerHTML = '';
        this.playerData.clear();
        playerEntries.forEach(([peerId, playerInfo]) => {
            this._addPlayerToList(peerId, playerInfo, myPeerId);
        });
        if (playersMap.size > 0) {
            this.show();
        }
    }

    /**
     * Adds a single player to the list display and internal map.
     * Assumes the parent `_handlePlayerListUpdate` handles clearing and sorting.
     * @param {string} peerId - The player's peer ID.
     * @param {object} playerInfo - Player details ({ name, isHost, score }).
     * @param {string} myPeerId - The local player's peer ID.
     * @private
     */
    _addPlayerToList(peerId, playerInfo, myPeerId) {
        if (!this.template || !this.rootElement) return; // Guard

        const score = playerInfo.score !== undefined ? playerInfo.score : 0;
        const name = playerInfo.name || getTextTemplate('playerListUnnamed');

        const templateContent = this.template.content.cloneNode(true);
        const listItem = templateContent.querySelector('.opponent-entry');

        if (!listItem) {
            console.error(`[${this.name}] Template structure incorrect: .opponent-entry not found.`);
            return;
        }

        const nameSpan = listItem.querySelector('.opponent-name');
        const scoreSpan = listItem.querySelector('.opponent-score');
        const tagsContainer = listItem.querySelector('.opponent-status');

        listItem.dataset.peerId = peerId;
        if (nameSpan) nameSpan.textContent = name;
        if (scoreSpan) scoreSpan.textContent = String(score);

        if (tagsContainer) {
            tagsContainer.innerHTML = '';
            if (playerInfo.isHost) {
                const hostTag = document.createElement('span');
                hostTag.classList.add('player-tag', 'host-tag');
                hostTag.textContent = getTextTemplate('playerListHostTag');
                tagsContainer.appendChild(hostTag);
            }
            if (peerId === myPeerId) {
                const youTag = document.createElement('span');
                youTag.classList.add('player-tag', 'you-tag');
                youTag.textContent = getTextTemplate('playerListYouTag');
                tagsContainer.appendChild(youTag);
            }
        }

        // Add to the DOM
        this.rootElement.appendChild(listItem);
        
        // Store the complete player data plus DOM reference
        this.playerData.set(peerId, {
            name: name,
            score: score,
            isHost: playerInfo.isHost || false,
            element: listItem,
            ... playerInfo // Store any other properties provided
        });
    }

    /**
     * Handles the Multiplayer.Common.PlayerUpdated event to update a single player's attributes
     * without rebuilding the entire list. Particularly useful for score updates.
     * @param {object} payload - The event payload.
     * @param {string} payload.peerId - The peer ID of the player to update.
     * @param {object} payload.updatedData - Object containing updated fields (name, score, isHost, etc).
     * @private
     */
    _handlePlayerUpdate({ peerId, updatedData }) {
        if (!peerId || !updatedData || !this.playerData.has(peerId)) {
            console.warn(`[${this.name}] Cannot update player: Invalid data or peer ID not in list.`);
            return;
        }

        // Get existing player data
        const existingData = this.playerData.get(peerId);
        
        // Update score in the DOM if it changed and the element exists
        if (updatedData.score !== undefined && existingData.element) {
            const scoreSpan = existingData.element.querySelector('.opponent-score');
            if (scoreSpan) {
                scoreSpan.textContent = String(updatedData.score);
            }
            
            // Update the data in our Map
            existingData.score = updatedData.score;
        }
        
        // Update name in the DOM if it changed and the element exists
        if (updatedData.name && existingData.element) {
            const nameSpan = existingData.element.querySelector('.opponent-name');
            if (nameSpan) {
                nameSpan.textContent = updatedData.name;
            }
            
            // Update the data in our Map
            existingData.name = updatedData.name;
        }
        
        // Update other properties in our Map
        Object.assign(existingData, updatedData);
        
        // Commit the updated data back to the Map
        this.playerData.set(peerId, existingData);
        
        // NOTE: We do not re-sort here; if sorting needs to be maintained after updates,
        // we'd need to call _handlePlayerListUpdate with the full list instead.
    }

    /**
     * Handles the game start event to show or hide component based on game mode.
     * @param {object} payload - The event payload.
     * @param {string} payload.mode - Game mode identifier.
     * @private
     */
    _handleGameStart({ mode }) {
        // Show for multiplayer modes, hide for single player
        if (mode === 'multiplayer-host' || mode === 'multiplayer-client') {
            console.log(`[${this.name}] Game started in ${mode} mode. Showing player list.`);
            this.show();
        } else {
            console.log(`[${this.name}] Game started in ${mode} mode. Hiding player list.`);
            this.hide();
        }
    }

    /**
     * Resets the player list display to empty and optionally hides it.
     * @param {boolean} [hideComponent=true] - Whether to hide the component after clearing.
     * @private
     */
    _resetDisplay(hideComponent = true) {
        if (this.rootElement) {
            this.rootElement.innerHTML = '';
        }
        
        this.playerData.clear();
        
        if (hideComponent) {
            this.hide();
        }
        
        console.log(`[${this.name}] Display reset.`);
    }

    /**
     * Handles the game finished event.
     * @private
     */
    _handleGameFinished() {
        console.log(`[${this.name}] Game finished. Resetting display.`);
        this._resetDisplay(true); // Reset and hide
    }
}

export default PlayerListComponent; 