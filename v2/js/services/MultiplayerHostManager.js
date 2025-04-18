import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
// Use the default export (singleton instance)
import quizEngine from './QuizEngine.js'; 
import webRTCManager from './WebRTCManager.js';
import { getTextTemplate } from '../utils/miscUtils.js';
// Import MSG_TYPE constants
import { MSG_TYPE } from '../core/message-types.js'; 

// Define a fallback constant for client_ready in case the import fails
const CLIENT_READY = 'client_ready';

/**
 * Manages the host-side logic for the **lobby phase** of a multiplayer game session.
 * - Initializes hosting via WebRTCManager.
 * - Listens for client connections/disconnections.
 * - Handles join requests and manages the player list *before* the game starts.
 * - Broadcasts player list updates to clients in the lobby.
 */
class MultiplayerHostManager {
    /**
     * @param {string} hostName The name of the host player.
     * @param {string[]} sheetIds Selected sheet IDs for the quiz.
     * @param {string} difficulty Selected difficulty level.
     * @param {string} hostId The PeerJS ID assigned to this host.
     */
    constructor(hostName, sheetIds, difficulty, hostId) {
        console.log(`[${this.constructor.name}] Initializing with Host ID: ${hostId}`);
        this.hostName = hostName;
        this.hostId = hostId; // The host's own PeerJS ID
        this.settings = { sheetIds, difficulty, hostId }; // Store settings
        this.isHosting = false; // Is the lobby active?
        this.gameHasStarted = false; // Added this flag

        // Use the imported singleton instance
        this.quizEngine = quizEngine.getInstance(); // Get the singleton instance

        // Player Management for lobby
        /** @type {Map<string, { name: string, isReady: boolean }>} */
        this.players = new Map();
        /** @type {Set<string>} Peers who have requested a rematch */
        this._rematchRequestedPeers = new Set(); 

        // Add host immediately, marked as ready
        this.addPlayer(this.hostId, this.hostName, true); 

        // Bind methods for listeners
        this._boundHandleClientConnected = this.handleClientConnected.bind(this);
        this._boundHandleClientDisconnected = this.handleClientDisconnected.bind(this);
        this._boundHandleDataReceived = this.handleDataReceived.bind(this);
        this._boundHandlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
    }

    /**
     * Asynchronously loads necessary data via QuizEngine *before* hosting starts.
     * (Required by GameCoordinator before calling startHosting).
     * @throws {Error} If QuizEngine fails to load questions.
     */
    async initialize() {
        console.log(`[${this.constructor.name}] Initializing QuizEngine via loadQuestions...`);
        try {
            // Use loadQuestions with stored settings
            await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.settings.difficulty);
            console.log(`[${this.constructor.name}] QuizEngine questions loaded successfully.`);
            // Use getQuestionCount
            if (this.quizEngine.getQuestionCount() === 0) {
                 console.error(`[${this.constructor.name}] Initialization failed: No questions found for the selected sheets.`);
                 throw new Error(getTextTemplate('mpHostErrorNoQuestions'));
            }
        } catch (error) {
            console.error(`[${this.constructor.name}] Error loading questions via QuizEngine:`, error);
            // Rethrow a user-friendly error or a specific error type
            throw new Error(getTextTemplate('mpHostErrorQuizEngineInitFail', { '%MSG%': error.message }));
        }
    }

    /**
     * Starts the lobby hosting phase.
     * Listens for client connections and lobby-related messages.
     */
    startHosting() {
        if (this.isHosting) {
            console.warn(`[${this.constructor.name}] Already hosting.`);
            return;
        }
        console.log(`[${this.constructor.name}] Starting hosting (Lobby Phase)... Listening for clients.`);
        this.isHosting = true;
        // Listen for direct connection events from WebRTCManager
        eventBus.on(Events.Multiplayer.Host.ClientConnected, this._boundHandleClientConnected);
        eventBus.on(Events.Multiplayer.Host.ClientDisconnected, this._boundHandleClientDisconnected);
        // Listen for messages (join requests, ready signals)
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleDataReceived); 
        // Listen for player list updates from WebRTCManager (handles name changes etc.)
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate);
    }

    /**
     * Stops the lobby hosting phase.
     * Removes listeners and cleans up lobby state.
     */
    stopHosting() {
        if (!this.isHosting) {
            return;
        }
        console.log(`[${this.constructor.name}] Stopping hosting (Lobby Phase)...`);
        this.isHosting = false;
        // Remove listeners
        eventBus.off(Events.Multiplayer.Host.ClientConnected, this._boundHandleClientConnected);
        eventBus.off(Events.Multiplayer.Host.ClientDisconnected, this._boundHandleClientDisconnected);
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);
        eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate);
        // Optionally, clear player list or keep it? Let's clear for a clean stop.
        // this.players.clear(); 
    }

    /**
     * Adds a player to the lobby list or updates their info.
     * Triggers a broadcast of the updated player list if lobby hosting is active.
     * @param {string} peerId The PeerJS ID of the player.
     * @param {string} name The player's name.
     * @param {boolean} isReady Initial ready state.
     * @private
     */
    addPlayer(peerId, name, isReady = false) {
        const defaultName = name || getTextTemplate('mcDefaultPlayerName');
        const playerExists = this.players.has(peerId);
        const existingPlayer = playerExists ? this.players.get(peerId) : null;

        let changed = false;
        
        if (!playerExists) {
            // Add new player
            this.players.set(peerId, {
                name: defaultName,
                isReady: isReady // Store only lobby-relevant state
            });
            console.log(`[${this.constructor.name} Lobby] Player added: ${defaultName} (${peerId}), Ready: ${isReady}`);
            changed = true;
        } else {
            // Update existing player if necessary
            let updated = false;
            if (existingPlayer.name !== defaultName) {
                console.log(`[${this.constructor.name} Lobby] Player ${peerId} updated name to: ${defaultName}`);
                existingPlayer.name = defaultName;
                updated = true;
            }
            // Update ready status if different
            if (existingPlayer.isReady !== isReady) {
                console.log(`[${this.constructor.name} Lobby] Player ${peerId} updated ready status to: ${isReady}`);
                existingPlayer.isReady = isReady;
                updated = true;
            }
            if (updated) {
                changed = true;
            }
        }
        
        // If anything changed AND hosting is active, broadcast and update local UI
        if (changed && this.isHosting) {
            console.log(`[${this.constructor.name} Lobby] Player list changed, broadcasting update.`);
            this._broadcastPlayerListUpdate();
            // Also emit locally for host UI
            eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
        } else if (changed) {
             console.log(`[${this.constructor.name} Lobby] Player list changed, but not broadcasting (hosting not active).`);
        }
    }

    /**
     * Removes a player from the lobby list.
     * @param {string} peerId The PeerJS ID of the player to remove.
     * @private
     */
    removePlayer(peerId) {
        if (this.players.has(peerId)) {
            const removedPlayerName = this.players.get(peerId).name;
            this.players.delete(peerId);
            console.log(`[${this.constructor.name} Lobby] Player removed: ${removedPlayerName} (${peerId})`);
            // Update player list for everyone if hosting is active
             if (this.isHosting) {
                 this._broadcastPlayerListUpdate();
                 // Also emit locally for host UI
                 eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
            }
        }
    }

    /**
     * Handles a client successfully connecting (via WebRTCManager event).
     * Adds player to lobby list (as not ready initially).
     * @param {object} payload
     * @param {string} payload.peerId Client's PeerJS ID.
     * @param {string} payload.playerName Client's reported name.
     */
    handleClientConnected({ peerId, playerName }) {
        console.log(`[${this.constructor.name} Lobby] Client connected event: ${playerName} (${peerId})`);
        // Add player as not ready. addPlayer handles broadcast.
        this.addPlayer(peerId, playerName, false); 
    }

    /**
     * Handles a client disconnecting (via WebRTCManager event).
     * Removes player from lobby list.
     * @param {object} payload
     * @param {string} payload.peerId Client's PeerJS ID.
     */
    handleClientDisconnected({ peerId }) {
        console.log(`[${this.constructor.name} Lobby] Client disconnected: ${peerId}`);
        const playerName = this.players.get(peerId)?.name || 'Unknown';
        this.removePlayer(peerId);
        this._rematchRequestedPeers.delete(peerId); // <<< Clear rematch request on disconnect

        // Host UI update handled by removePlayer
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('mpHostLobbyCancelled', {'%NAME%': playerName }), level: 'info' });
    }

    /**
     * Handles data messages received from any connected client *during the lobby phase*.
     * Primarily handles 'c_requestJoin' and 'client_ready'.
     * @param {object} eventData - Payload from Events.WebRTC.MessageReceived.
     * @param {any} eventData.msg - The received message data { type: string, payload: any }.
     * @param {string} eventData.sender - The PeerJS ID of the client who sent the message.
     */
    handleDataReceived({ msg, sender }) {
        // Ignore if lobby isn't active or sender is host/unknown
        if (!this.isHosting || !this.players.has(sender) || sender === this.hostId) {
            console.warn(`[${this.constructor.name}] Ignoring message (hosting: ${this.isHosting}, sender known: ${this.players.has(sender)}, is host: ${sender === this.hostId})`, msg);
            return; 
        }

        const type = msg.type;
        const payload = msg.payload;
        const playerName = this.players.get(sender)?.name || sender;

        // Only process lobby-relevant messages
        // Create a combined list of accepted types, accounting for potential undefined values
        const clientReadyType = MSG_TYPE.CLIENT_READY || CLIENT_READY;
        const acceptedTypes = [MSG_TYPE.C_REQUEST_JOIN, clientReadyType, MSG_TYPE.C_REQUEST_REMATCH];
        if (!acceptedTypes.includes(type)) {
             console.log(`[${this.constructor.name} Lobby] Ignoring non-lobby message type '${type}' from ${playerName} (${sender})`);
             return;
        }

        console.log(`[${this.constructor.name} Lobby] Received lobby message from ${playerName} (${sender}): Type=${type}`, payload);

        switch (type) {
            case MSG_TYPE.C_REQUEST_JOIN: 
                 const requestedName = payload?.name;
                 if (requestedName) {
                     console.log(`[${this.constructor.name} Lobby] Processing join request for ${sender} with name: ${requestedName}`);
                     // Update player name if needed, keep ready status false until confirmed
                     this.addPlayer(sender, requestedName, false); 
                 } else {
                      console.warn(`[${this.constructor.name} Lobby] Received c_requestJoin from ${sender} without a name.`);
                 }
                 break;
            // Use both possible type values for CLIENT_READY
            case clientReadyType:
            case CLIENT_READY: // Explicit fallback
                 console.log(`[${this.constructor.name} Lobby] Processing CLIENT_READY message from ${playerName} (${sender})`, payload);
                 const player = this.players.get(sender);
                 if (player) {
                     console.log(`[${this.constructor.name} Lobby] Current player data:`, player);
                     if (!player.isReady) {
                         console.log(`[${this.constructor.name} Lobby] Marking player ${playerName} (${sender}) as ready.`);
                         
                         // Extract isReady from payload if available, otherwise default to true
                         const isReady = payload && typeof payload.isReady === 'boolean' ? payload.isReady : true;
                         console.log(`[${this.constructor.name} Lobby] isReady value from payload: ${isReady}`);
                         
                         // Force isReady to true regardless of message payload structure
                         this.addPlayer(sender, player.name, isReady);
                         
                         // Force broadcast the player list update to ensure all clients receive it
                         this._broadcastPlayerListUpdate();
                         
                         // Also force emit locally for host UI to ensure it updates
                         eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
                         
                         // Manually log the player list after update to verify
                         console.log(`[${this.constructor.name} Lobby] Player list after update:`, Object.fromEntries(this.players));
                     } else {
                          console.log(`[${this.constructor.name} Lobby] Player ${playerName} (${sender}) already marked as ready.`);
                     }
                 } else {
                      console.warn(`[${this.constructor.name} Lobby] Received client_ready from unknown peer ${sender}`);
                 }
                break;
            case MSG_TYPE.C_REQUEST_REMATCH:
                if (!this._rematchRequestedPeers.has(sender)) {
                    console.log(`[${this.constructor.name} Lobby] Rematch requested by ${playerName} (${sender})`);
                    this._rematchRequestedPeers.add(sender);
                    // Optionally notify other players? For now, just track.
                    // Check if all connected players are now ready for rematch
                    this._checkRematchReadiness();
                } else {
                    console.log(`[${this.constructor.name} Lobby] Duplicate rematch request from ${playerName} (${sender})`);
                }
                break;
            default:
                // Should not be reached due to filter above
                console.warn(`[${this.constructor.name} Lobby] Unexpected message type: ${type}`);
        }
    }

    /**
     * Sends a message to all connected clients *in the lobby*.
     * @param {string} type - The message type identifier.
     * @param {object} payload - The data payload for the message.
     * @param {string[]} [excludePeerIds=[]] - Optional array of PeerJS IDs to exclude.
     * @private
     */
    _broadcast(type, payload, excludePeerIds = []) {
        if (!this.isHosting) return;
        console.log(`[${this.constructor.name} Lobby] Broadcasting: Type=${type} to clients (exclude: ${excludePeerIds.join(',') || 'none'})`, payload); 
        const allClients = Array.from(this.players.keys()).filter(id => id !== this.hostId);
        const excludedSet = new Set(excludePeerIds);

        let sentCount = 0;
        allClients.forEach(peerId => {
             if (!excludedSet.has(peerId)) {
                 webRTCManager.sendToPeer(peerId, type, payload); 
                 sentCount++;
            } 
        });
         console.log(`[${this.constructor.name} Lobby] Broadcast complete: Sent type '${type}' to ${sentCount}/${allClients.length} potential clients.`);
    }

    /**
     * Specifically broadcasts the current lobby player list to all clients.
     * @private
     */
    _broadcastPlayerListUpdate() {
         if (!this.isHosting) return;
         const playersObject = Object.fromEntries(this.players);
         console.debug(`[${this.constructor.name} Lobby] Broadcasting player_list_update. List:`, playersObject);
         this._broadcast('player_list_update', { players: playersObject }, []); 
    }

    /**
     * Called when the host cancels the lobby.
     * Informs clients and cleans up.
     */
    leaveLobby() {
        console.log(`[${this.constructor.name}] Host is leaving lobby.`);
        if (this.isHosting) {
             // Inform clients lobby is closing
             this._broadcast('feedback', { message: getTextTemplate('mpHostLobbyCancelled'), level: 'warn' }, []);
             // Short delay to allow message delivery?
             // setTimeout(() => {
                  this.stopHosting(); // Remove listeners
                  // GameCoordinator should call webRTCManager.closeConnection()
             // }, 500);
        } else {
            this.stopHosting(); // Ensure listeners are off even if called redundantly
        }
    }

    /**
     * Cleans up resources, removes listeners.
     */
    destroy() {
        console.log(`[${this.constructor.name}] Destroying...`);
        this.leaveLobby(); // Ensure lobby stops and listeners are removed
        this.players.clear();
        this.quizEngine = null; // Release reference
        this.isHosting = false;
        this._rematchRequestedPeers.clear(); // <<< Clear rematch requests on destroy
        console.log(`[${this.constructor.name}] Destroyed.`);
    }

    /**
     * [ADDED] Handles the PlayerListUpdated event from WebRTCManager.
     * Synchronizes the internal player list (names, etc.) with the authoritative list.
     * @param {object} payload
     * @param {Map<string, { name: string, isHost: boolean }>} payload.players The authoritative player list from WebRTCManager.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        if (!this.isHosting) return; // Only process if lobby is active

        console.log(`[${this.constructor.name} Lobby] Received PlayerListUpdated event from WebRTCManager. Synchronizing...`);
        
        // Iterate through the authoritative list from WebRTCManager
        players.forEach((playerData, peerId) => {
            if (peerId === this.hostId) return; // Ignore the host entry (managed separately)

            const existingPlayer = this.players.get(peerId);
            const webRTCName = playerData.name || getTextTemplate('mcDefaultPlayerName'); // Ensure a name exists
            
            if (!existingPlayer) {
                // Player is in WebRTC list but not ours? Add them (should be rare if ClientConnected worked)
                console.warn(`[${this.constructor.name} Lobby Sync] Adding missing player ${webRTCName} (${peerId})`);
                this.addPlayer(peerId, webRTCName, false); // Add as not ready initially
            } else if (existingPlayer.name !== webRTCName) {
                // Name mismatch? Update our record using addPlayer logic
                 console.log(`[${this.constructor.name} Lobby Sync] Updating name for ${peerId} from '${existingPlayer.name}' to '${webRTCName}'`);
                // Use addPlayer to ensure consistency and trigger broadcasts if needed
                // Keep existing ready status
                this.addPlayer(peerId, webRTCName, existingPlayer.isReady); 
            }
            // Note: We don't sync 'isReady' from this event, as that's managed by explicit 'client_ready' messages.
        });

        // Optional: Check for players in our list that are NO LONGER in the WebRTC list?
        // This shouldn't happen if disconnect events are working correctly.
        // const localPeerIds = new Set(this.players.keys());
        // localPeerIds.delete(this.hostId); // Don't check host
        // const webRTCPeerIds = new Set(players.keys());
        // localPeerIds.forEach(localPeerId => {
        //     if (!webRTCPeerIds.has(localPeerId)) {
        //         console.warn(`[${this.constructor.name} Lobby Sync] Player ${localPeerId} exists locally but not in WebRTC update. Removing.`);
        //         this.removePlayer(localPeerId);
        //     }
        // });
    }

    /**
     * [REVISED] Initiates the game start sequence.
     * Stops lobby listeners and broadcasts GAME_START.
     * Called by GameCoordinator for both initial start and rematches.
     */
    initiateGameStart() {
        if (!this.isHosting) {
            console.warn(`[${this.constructor.name}] initiateGameStart called, but not hosting.`);
            return;
        }

        // Prevent starting multiple times
        if (this.gameHasStarted) { // Assuming we add this flag
            console.warn(`[${this.constructor.name}] initiateGameStart called, but game sequence already started.`);
            return;
        }

        console.log(`[${this.constructor.name}] Initiating game start sequence...`);
        this.gameHasStarted = true; // Set flag

        // 1. Stop listening specifically for *lobby* events (join requests, ready)
        // Keep listeners for generic messages and disconnects active for the game phase.
        this.stopHosting(); // Rename or refine this if needed

        // 2. Broadcast GAME_START to all connected clients
        console.log(`[${this.constructor.name}] Broadcasting GAME_START.`);
        this._broadcast(MSG_TYPE.GAME_START, {
             // Payload might include final confirmed player list or initial game state if needed
             players: Object.fromEntries(this.players)
        });

        console.log(`[${this.constructor.name}] Game sequence initiated. GameCoordinator will create game instance.`);
    }

    /**
     * Checks if all currently connected clients have requested a rematch.
     * If so, initiates the rematch process.
     * @private
     */
    _checkRematchReadiness() {
        if (!this.isHosting) return; // Only check if hosting

        const connectedClientIds = Array.from(this.players.keys()).filter(id => id !== this.hostId);
        
        if (connectedClientIds.length === 0) {
            console.log(`[${this.constructor.name} Rematch Check] No clients connected, cannot start rematch.`);
            this._rematchRequestedPeers.clear(); 
            return;
        }

        const allReady = connectedClientIds.every(clientId => this._rematchRequestedPeers.has(clientId));

        if (allReady) {
            console.log(`[${this.constructor.name} Rematch Check] All ${connectedClientIds.length} client(s) ready for rematch! Initiating...`);
            
            // 1. Notify clients rematch is accepted/starting (Optional but good UX)
            this._broadcast(MSG_TYPE.H_REMATCH_ACCEPTED, {}, []); 

            // 2. Trigger the game start sequence (broadcasts GAME_START)
            this.initiateGameStart();

            // 3. Emit local event for GameCoordinator to create the Game Instance
            eventBus.emit(Events.Multiplayer.Host.RematchReady, {
                hostId: this.hostId,
                settings: this.settings,
                players: this.players 
            });

            // 4. Reset rematch state for the next round
            this._rematchRequestedPeers.clear();

        } else {
             const readyCount = connectedClientIds.filter(id => this._rematchRequestedPeers.has(id)).length;
             console.log(`[${this.constructor.name} Rematch Check] Waiting for rematch requests (${readyCount}/${connectedClientIds.length} ready).`);
        }
    }
}

export default MultiplayerHostManager; 