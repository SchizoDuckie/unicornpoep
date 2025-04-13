import BaseComponent from './base-component.js';
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
 * @extends BaseComponent
 * @description Manages the display of the player list in multiplayer games using an HTML template.
 */
class PlayerListComponent extends BaseComponent {
    // --- Static properties REQUIRED by BaseComponent ---
    static SELECTOR = '#playerListContainer';
    static VIEW_NAME = 'PlayerListComponent'; // Or a more user-friendly name if needed

    /**
     * Creates an instance of PlayerListComponent.
     * Calls super() which handles root element finding and basic setup.
     */
    constructor() {
        // Call BaseComponent constructor WITHOUT arguments.
        // It uses the static SELECTOR and VIEW_NAME defined above.
        super();
        // BaseComponent constructor calls this.initialize() and this.registerListeners() if they exist.
        console.log(`[${this.name}] Constructed.`); // this.name is set by BaseComponent
    }

    /**
     * Initializes component elements and state. Called by BaseComponent constructor.
     * @protected
     */
    initialize() {
        console.log(`[${this.name}] Initializing...`);
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

        // --- Bind Handlers Needed for EventBus Listeners ---
        // We bind them here so they are ready when registerListeners is called by BaseComponent
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        this._handlePlayerUpdate = this._handlePlayerUpdate.bind(this);
        this._handleGameStart = this._handleGameStart.bind(this);
        this._handleGameFinished = this._handleGameFinished.bind(this);
        this._resetDisplay = this._resetDisplay.bind(this); // Keep if used internally

        this._resetDisplay(); // Set initial visual state (e.g., clear list, hide)
        console.log(`[${this.name}] Initialized.`);
    }

    /**
     * Registers GLOBAL eventBus listeners using `this.listen()`.
     * Called by BaseComponent constructor.
     * @protected
     */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        // Use this.listen() provided by BaseComponent for automatic cleanup
        this.listen(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
        this.listen(Events.Multiplayer.Common.PlayerUpdated, this._handlePlayerUpdate);
        this.listen(Events.Game.Started, this._handleGameStart);
        this.listen(Events.Game.Finished, this._handleGameFinished);
        // Example: If we needed DOM listeners, they would be added here too,
        // and removed in unregisterListeners.
        // this.someButton = this.rootElement.querySelector(...);
        // if (this.someButton) {
        //    this._boundClickHandler = this._handleClick.bind(this); // Bind if needed
        //    this.someButton.addEventListener('click', this._boundClickHandler);
        // }
    }

    /**
     * Unregisters DOM event listeners. Called by BaseComponent during hide() and destroy().
     * NOTE: Global event bus listeners added via `this.listen()` are cleaned up
     * automatically by BaseComponent's `destroy()` method.
     * @protected
     */
    unregisterListeners() {
        // Remove any specific DOM listeners added in registerListeners
        // Example:
        // if (this.someButton && this._boundClickHandler) {
        //     this.someButton.removeEventListener('click', this._boundClickHandler);
        // }
        // Call super.unregisterListeners() if BaseComponent itself adds listeners someday
        // super.unregisterListeners(); // Currently BaseComponent doesn't add DOM listeners itself
        console.log(`[${this.name}] Unregistered DOM listeners (if any).`);
    }

    /**
     * Handles the Multiplayer.Common.PlayerListUpdated event.
     * Rebuilds the player list display using the template.
     * @param {object} payload - The event payload.
     * @param {Map<string, {name: string, isHost: boolean, score?: number}>} payload.players - Map of player data.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        // Check if the component has been destroyed or rootElement is missing
        if (!this.rootElement || !this.template || !players) {
            console.warn(`[${this.name}] Cannot update player list: Component not ready or missing data.`);
            return;
        }
        console.debug(`[${this.name}] Received player list update:`, players);

        this._resetDisplay(false); // Clear DOM but keep component visible if already shown

        const myPeerId = webRTCManager.getMyPeerId();

        players.forEach((playerInfo, peerId) => {
            this._addPlayerToList(peerId, playerInfo, myPeerId);
        });

        // Only show if we actually added players or if the component wasn't hidden by resetDisplay
        if (players.size > 0 || this.isVisible) {
             this.show(); // Ensure list container is visible (uses BaseComponent show)
        }
    }

    /**
     * Adds or updates a single player in the list based on template.
     * @param {string} peerId - The player's peer ID.
     * @param {object} playerInfo - Player details ({ name, isHost, score }).
     * @param {string} myPeerId - The local player's peer ID.
     * @private
     */
    _addPlayerToList(peerId, playerInfo, myPeerId) {
        if (!this.template || !this.rootElement) return; // Guard against missing template or root

        const score = playerInfo.score !== undefined ? playerInfo.score : 0;
        // Use template for default name
        const name = playerInfo.name || getTextTemplate('playerListUnnamed');

        // Clone the template CONTENT
        const templateContent = this.template.content.cloneNode(true);
        const listItem = templateContent.querySelector('.opponent-entry'); // Get the main list item element

        if (!listItem) {
            console.error(`[${this.name}] Template structure incorrect: .opponent-entry not found within #player-list-item-template.`);
            return;
        }

        // Find elements within the template clone using correct class names
        const nameSpan = listItem.querySelector('.opponent-name');
        const scoreSpan = listItem.querySelector('.opponent-score');
        const tagsContainer = listItem.querySelector('.opponent-status');

        // Populate the clone
        listItem.dataset.peerId = peerId;
        if (nameSpan) nameSpan.textContent = name;
        if (scoreSpan) scoreSpan.textContent = String(score); // Ensure score is a string

        // Add tags (Host, You)
        if (tagsContainer) {
            tagsContainer.innerHTML = ''; // Clear existing tags if any

            if (playerInfo.isHost) {
                const hostTag = document.createElement('span');
                hostTag.classList.add('player-tag', 'host-tag');
                // Use template for tag text
                hostTag.textContent = getTextTemplate('playerListHostTag');
                tagsContainer.appendChild(hostTag);
            }
            if (peerId === myPeerId) {
                const youTag = document.createElement('span');
                youTag.classList.add('player-tag', 'you-tag');
                // Use template for tag text
                youTag.textContent = getTextTemplate('playerListYouTag');
                tagsContainer.appendChild(youTag);
                listItem.classList.add('local-player'); // Add class to the list item itself
            }
        } else {
            console.warn(`[${this.name}] Template missing '.opponent-status' container for tags.`);
        }


        // Append the populated clone (the .opponent-entry div) directly to the root element
        this.rootElement.appendChild(listItem);

        // Store reference for updates
        this.playerData.set(peerId, {
            name: name,
            score: score,
            isHost: playerInfo.isHost || false,
            element: listItem // Store the actual list item element
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
    _handlePlayerUpdate({ peerId, updatedData }) {
        // Check if component/rootElement exists first
        if (!this.rootElement) return;

        const playerData = this.playerData.get(peerId);
        // Ensure playerData and the associated element exist in the DOM
        if (!playerData || !playerData.element || !this.rootElement.contains(playerData.element) || !updatedData) {
             if (!playerData) {
                 // console.warn(`[${this.name}] Received update for unknown player ${peerId}. Maybe PlayerListUpdate is pending?`);
             } else if (!this.rootElement.contains(playerData.element)) {
                 // console.warn(`[${this.name}] Received update for player ${peerId} but their element is no longer in the DOM (inside root).`);
                 this.playerData.delete(peerId); // Clean up stale data
             }
             return;
        }

        // Update Score if present
        if (updatedData.score !== undefined) {
            const newScore = updatedData.score;
            playerData.score = newScore;
            // Find the score element *within the player's list item*
            const scoreElement = playerData.element.querySelector('.opponent-score');
            if (scoreElement) {
                scoreElement.textContent = String(newScore);
                // Optional: Add animation/highlight on update
                playerData.element.classList.add('score-updated');
                // Use requestAnimationFrame to ensure class is added before removal for transition/animation
                requestAnimationFrame(() => {
                     setTimeout(() => {
                         // Check element still exists and is within our root before removing class
                         if (playerData.element && this.rootElement && this.rootElement.contains(playerData.element)) {
                             playerData.element.classList.remove('score-updated');
                         }
                     }, 300); // Duration of highlight/animation
                });
            } else {
                 console.warn(`[${this.name}] Could not find .opponent-score element for player ${peerId} during update.`);
            }
        }

        // Update Name if present (less common)
        if (updatedData.name !== undefined) {
            const newName = updatedData.name;
            playerData.name = newName;
            const nameElement = playerData.element.querySelector('.opponent-name');
            if (nameElement) {
                 nameElement.textContent = newName;
            } else {
                console.warn(`[${this.name}] Could not find .opponent-name element for player ${peerId} during update.`);
            }
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
    _handleGameStart({ mode }) {
        if (mode === 'multiplayer') {
            this._resetDisplay(false); // Clear any previous state but keep visible if already shown
            this.show(); // Ensure container is visible for MP games
        } else {
            this._resetDisplay(); // Hide and clear for non-multiplayer modes
        }
    }

    /**
     * Clears the player list display and internal data.
     * @param {boolean} [hideComponent=true] - Whether to also hide the root element using BaseComponent's hide().
     * @private
     */
    _resetDisplay(hideComponent = true) {
        // console.debug(`[${this.name}] Resetting display.`);
        // Always clear the root element directly
        if (this.rootElement) {
            this.rootElement.innerHTML = ''; // Clear list items
        } else {
             // Component might be resetting before rootElement is assigned or after destroy
            // console.warn(`[${this.name}] Cannot clear display, rootElement is null/undefined.`);
        }
        this.playerData.clear();
        if (hideComponent) {
            this.hide(); // Use BaseComponent's hide method
        }
    }

    /**
     * Handles the Game.Finished event.
     * @private
     */
    _handleGameFinished() {
        console.log(`[${this.name}] Game finished, resetting display.`);
        this._resetDisplay();
    }


    /**
     * Clean up resources, remove listeners. Called by external manager (e.g., UIManager).
     * BaseComponent's destroy method handles global listener cleanup.
     */
    destroy() {
        console.log(`[${this.name}] Destroying component.`);
        // BaseComponent's destroy calls unregisterListeners (for DOM)
        // and cleanupListeners (for global bus via this.listen)
        super.destroy(); // CRITICAL: Call base class destroy

        // Nullify references specific to this component AFTER calling super.destroy()
        this.playerData = null;
        this.template = null;
        // Bound handlers don't strictly need nulling if the instance is GC'd, but can be explicit
        // this._handlePlayerListUpdate = null; // etc.
    }
}

export default PlayerListComponent; 