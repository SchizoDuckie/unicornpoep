import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
// Use the default export (singleton instance)
import quizEngine from './QuizEngine.js'; 
import webRTCManager from './WebRTCManager.js';
import { getTextTemplate } from '../utils/miscUtils.js';

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

        // Use the imported singleton instance
        this.quizEngine = quizEngine.getInstance(); // Get the singleton instance

        // Player Management for lobby
        /** @type {Map<string, { name: string, isReady: boolean }>} */
        this.players = new Map();
        // Add host immediately, marked as ready
        this.addPlayer(this.hostId, this.hostName, true); 

        // Bind methods for listeners
        this._boundHandleClientConnected = this.handleClientConnected.bind(this);
        this._boundHandleClientDisconnected = this.handleClientDisconnected.bind(this);
        this._boundHandleDataReceived = this.handleDataReceived.bind(this);
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

        // Host UI update handled by removePlayer
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('mpHostInfoPlayerLeft', {'%NAME%': playerName }), level: 'info' });
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
            // console.warn(`[${this.constructor.name}] Ignoring message (hosting: ${this.isHosting}, sender known: ${this.players.has(sender)}, is host: ${sender === this.hostId})`, msg);
            return; 
        }

        const type = msg.type;
        const payload = msg.payload;
        const playerName = this.players.get(sender)?.name || sender;

        // Only process lobby-relevant messages
        if (!['c_requestJoin', 'client_ready'].includes(type)) {
             console.log(`[${this.constructor.name} Lobby] Ignoring non-lobby message type '${type}' from ${playerName} (${sender})`);
             return;
        }

        console.log(`[${this.constructor.name} Lobby] Received lobby message from ${playerName} (${sender}): Type=${type}`, payload);

        switch (type) {
            case 'c_requestJoin': 
                 const requestedName = payload?.name;
                 if (requestedName) {
                     console.log(`[${this.constructor.name} Lobby] Processing join request for ${sender} with name: ${requestedName}`);
                     // Update player name if needed, keep ready status false until confirmed
                     this.addPlayer(sender, requestedName, false); 
                 } else {
                      console.warn(`[${this.constructor.name} Lobby] Received c_requestJoin from ${sender} without a name.`);
                 }
                 break;
            case 'client_ready':
                 const player = this.players.get(sender);
                 if (player) {
                     if (!player.isReady) {
                         console.log(`[${this.constructor.name} Lobby] Player ${playerName} (${sender}) marked as ready.`);
                         // Update ready status via addPlayer, which handles broadcast
                         this.addPlayer(sender, player.name, true); 
                     } else {
                          console.log(`[${this.constructor.name} Lobby] Player ${playerName} (${sender}) already marked as ready.`);
                     }
                 } else {
                      console.warn(`[${this.constructor.name} Lobby] Received client_ready from unknown peer ${sender}`);
                 }
                break;
            case MSG_TYPE_CLIENT.CLIENT_LEFT:
                console.log(`[${this.name} Lobby] Processing voluntary leave for ${peerId}.`);
                this.handleClientDisconnect(peerId, 'left_voluntarily'); // Use existing handler with specific reason
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
        console.log(`[${this.constructor.name}] Destroyed.`);
    }
}

export default MultiplayerHostManager; 