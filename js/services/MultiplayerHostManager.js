import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
// Use the default export (singleton instance)
import QuizEngine from './QuizEngine.js'; 
import webRTCManager from './WebRTCManager.js';
import { getTextTemplate } from '../utils/miscUtils.js';
// Import MSG_TYPE constants
import { MSG_TYPE } from '../core/message-types.js'; 

// Added: Import MultiplayerHostGame
import MultiplayerHostGame from '../game/MultiplayerHostGame.js';

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
     * @param {object} settings Game settings (e.g., { sheetIds: [...], difficulty: '...' }).
     * @param {string} hostId The PeerJS ID assigned to this host.
     */
    constructor(hostName, settings, hostId) {
        console.log(`[${this.constructor.name}] Initializing with Host ID: ${hostId}`);
        this.hostName = hostName;
        this.hostId = hostId; // The host's own PeerJS ID
        this.settings = settings; // Store settings
        this.isHosting = false; // Is the lobby active?
        this.gameHasStarted = false; // Added this flag
        this.questionsData = null; // ADDED: Store loaded questions data
        this.difficulty = settings.difficulty; // ADDED: Store difficulty from settings
        this.activeGame = null; // ADDED: Reference to the active game instance

        // Use the imported singleton instance
        this.quizEngine = QuizEngine.getInstance(); // Get the singleton instance

        // Define fallback constant here if needed, or rely on MSG_TYPE
        // this.CLIENT_READY = MSG_TYPE.CLIENT_READY || 'client_ready';

        // Player Management for lobby
        /** @type {Map<string, { name: string, isReady: boolean, isHost: boolean }>} */
        this.players = new Map();
        /** @type {Set<string>} Peers who have requested a rematch */
        this._rematchRequestedPeers = new Set(); 

        // Add host immediately, marked as ready
        this.addPlayer(this.hostId, this.hostName, true, true);
    }

    /**
     * Asynchronously loads necessary data via QuizEngine *before* hosting starts.
     * Stores the loaded data locally.
     * @throws {Error} If QuizEngine fails to load questions.
     */
    async initialize() {
        // Use the instance stored in this.quizEngine
        // BUGFIX: loadQuestionsFromManager doesn't return questions data, 
        // it modifies the QuizEngine instance internally.
        // We need to track success instead of expecting a return value
        await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.settings.difficulty);
        
        // If we get here without an error being thrown, questions were loaded successfully
        // Set questionsData to a non-null value to indicate successful initialization
        this.questionsData = this.quizEngine.getQuestionCount() > 0;
        
        if (!this.questionsData) {
            console.error(`[${this.constructor.name}] Failed to load questions or no questions loaded`);
            throw new Error("Failed to load questions. No questions available.");
        }
        
        console.log(`[${this.constructor.name}] Successfully loaded ${this.quizEngine.getQuestionCount()} questions`);
    }

    /**
     * Starts the lobby hosting phase.
     * Sets up listeners for client connections and messages.
     * Requires initialize() to have been called successfully first.
     */
    startHosting() {
        if (this.isHosting) {
            console.warn(`[${this.constructor.name}] Already hosting.`);
            return;
        }
        if (!this.questionsData) { // Ensure initialize was called
            console.error(`[${this.constructor.name}] Cannot start hosting, initialize() must be called first to load questions.`);
            throw new Error("Host manager not initialized. Call initialize() first.");
        }

        console.log(`[${this.constructor.name}] Starting hosting (Lobby Phase)...`);
        this.isHosting = true;

        try {
            // REMOVED: Don't call webRTCManager.startHost() again as it's already been called
            // by MultiplayerHostCoordinator.handleGameStartRequested
            console.log(`[${this.constructor.name}] Setting up event listeners for hosting...`);

            // Listen for direct connection events from WebRTCManager
            eventBus.on(Events.Multiplayer.Host.ClientConnected, this.handleClientConnected);
            eventBus.on(Events.Multiplayer.Host.ClientDisconnected, this.handleClientDisconnected);
            // Listen for messages (join requests, ready signals)
            eventBus.on(Events.WebRTC.MessageReceived, this.handleDataReceived); 
            // Listen for player list updates from WebRTCManager (handles name changes etc.)
            eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
            console.log(`[${this.constructor.name}] Event listeners registered.`);

            // ADDED: Create the MultiplayerHostGame instance now
            try {
                console.log(`[${this.constructor.name}] Creating MultiplayerHostGame instance...`);
                this.activeGame = new MultiplayerHostGame(
                    this.settings,
                    this.quizEngine, // Pass the singleton instance
                    this.hostName,
                    this.hostId
                );
                // The game instance initializes itself via its constructor
                console.log(`[${this.constructor.name}] MultiplayerHostGame instance created.`);

                // ADDED: Listen for the host UI signal to start the game
                eventBus.on(Events.UI.HostLobby.StartGameClicked, this.handleStartGameClicked);
                console.log(`[${this.constructor.name}] Listening for StartGameClicked.`);

            } catch (gameError) {
                console.error(`[${this.constructor.name}] Error creating MultiplayerHostGame:`, gameError);
                eventBus.emit(Events.System.ErrorOccurred, { message: `Failed to prepare host game: ${gameError.message}`, error: gameError, context: 'host-manager-game-create' });
                this.stopHosting(); // Clean up listeners
                this.isHosting = false;
                // Optionally rethrow or handle differently
                throw gameError; // Rethrow to signal failure
            }

        } catch (error) {
             console.error(`[${this.constructor.name}] Error setting up host manager:`, error);
             eventBus.emit(Events.System.ErrorOccurred, { message: `Failed to set up host manager: ${error.message}`, error, context: 'host-manager-setup' });
             this.stopHosting(); // Clean up listeners if startHost throws
             this.isHosting = false;
        }
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
        // Keep isHosting true until fully stopped/game started
        // this.isHosting = false; // Defer setting this?

        // Remove listeners specific to the LOBBY phase
        eventBus.off(Events.Multiplayer.Host.ClientConnected, this.handleClientConnected);
        // DO NOT remove ClientDisconnected here - needed during game phase
        // eventBus.off(Events.Multiplayer.Host.ClientDisconnected, this.handleClientDisconnected); 
        eventBus.off(Events.WebRTC.MessageReceived, this.handleDataReceived); // Stop listening for lobby messages
        eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate); // Stop sync based on WebRTC list
        eventBus.off(Events.UI.HostLobby.StartGameClicked, this.handleStartGameClicked); // Stop listening for UI start click

        // Keep the activeGame instance, it's needed for the game phase
        // if (this.activeGame) { ... }

        // Mark lobby as inactive, but the manager might still be active for the game
        // this.isHosting = false; // Maybe rename this flag or use gameHasStarted?
        console.log(`[${this.constructor.name}] Lobby phase listeners removed.`);
    }

    /**
     * Resets the internal state, including stored questions data.
     * Intended to be called before starting a new hosting session.
     */
    resetState() {
        console.log(`[${this.constructor.name}] Resetting state.`);
        this.isHosting = false;
        this.gameHasStarted = false;
        this.players.clear();
        this._rematchRequestedPeers.clear();
        // Reset added properties
        this.questionsData = null; 
        this.difficulty = this.settings.difficulty; // Reset difficulty from initial settings
        // Add host again after clearing
        this.addPlayer(this.hostId, this.hostName, true, true); 
    }

    /**
     * Adds a player to the lobby list or updates their info.
     * Triggers a broadcast of the updated player list if lobby hosting is active.
     * @param {string} peerId The PeerJS ID of the player.
     * @param {string} name The player's name.
     * @param {boolean} isReady Initial ready state.
     * @param {boolean} isHost Whether the player is the host.
     * @private
     */
    addPlayer(peerId, name, isReady = false, isHost = false) {
        const defaultName = name || getTextTemplate('mcDefaultPlayerName');
        const playerExists = this.players.has(peerId);
        const existingPlayer = playerExists ? this.players.get(peerId) : null;

        let changed = false;
        
        if (!playerExists) {
            // Add new player
            this.players.set(peerId, {
                name: defaultName,
                isReady: isReady,
                isHost: isHost
            });
            console.log(`[${this.constructor.name} Lobby] Player added: ${defaultName} (${peerId}), Ready: ${isReady}, Host: ${isHost}`);
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
            if (existingPlayer.isHost !== isHost) {
                console.log(`[${this.constructor.name} Lobby] Player ${peerId} updated host status to: ${isHost}`);
                existingPlayer.isHost = isHost;
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
            eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: Object.fromEntries(this.players) });
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
                 eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: Object.fromEntries(this.players) });
            }
        }
    }

    /**
     * Handles the WebRTC event indicating a client has connected.
     * Adds the player to the internal list.
     * @param {object} payload
     * @param {string} payload.peerId Client's PeerJS ID.
     * @param {string} payload.playerName Client's chosen name.
     * @event Events.WebRTC.ClientConnected
     */
    handleClientConnected = ({ peerId, playerName }) => {
        console.log(`[${this.constructor.name} Lobby] Client connected: ${peerId}, Name: ${playerName}`);
        // Add player as not ready initially.
        this.addPlayer(peerId, playerName, false, false); 
        
        // --- FIX: Send game info immediately upon connection --- 
        console.log(`[${this.constructor.name} Lobby] Sending initial game info to newly connected client: ${peerId}`);
        this.sendGameInfoToClient(peerId);
        // --- END FIX ---
    }

    /**
     * Handles a client disconnecting (via WebRTCManager event).
     * Removes player from lobby list.
     * @param {object} payload
     * @param {string} payload.peerId Client's PeerJS ID.
     * @param {string} payload.reason Reason for disconnect.
     * @event Events.WebRTC.ClientDisconnected
     */
    handleClientDisconnected = ({ peerId, reason }) => {
        if (!this.players.has(peerId)) {
            console.warn(`[${this.constructor.name}] Received disconnect for unknown or already removed peer: ${peerId}`);
            return;
        }

        const playerName = this.players.get(peerId)?.name || 'Unknown';
        console.log(`[${this.constructor.name}] Client disconnected: ${playerName} (${peerId}). Reason: ${reason}. Game started: ${this.gameHasStarted}`);

        this.removePlayer(peerId); // Remove from internal list (conditionally broadcasts)
        this._rematchRequestedPeers.delete(peerId); // Clear rematch request on disconnect

        // Show feedback regardless of game state
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('mpHostPlayerLeft', {'%NAME%': playerName }), level: 'info' });

        // --- Notify Active Game if it has started ---
        if (this.gameHasStarted && this.activeGame) {
            if (typeof this.activeGame.handlePlayerDisconnect === 'function') {
                console.log(`[${this.constructor.name}] Notifying active game about player disconnect: ${playerName} (${peerId})`);
                this.activeGame.handlePlayerDisconnect(peerId, playerName);
            } else {
                console.warn(`[${this.constructor.name}] Active game instance exists but has no 'handlePlayerDisconnect' method.`);
            }
        } else {
             console.log(`[${this.constructor.name}] Player disconnected during lobby phase or no active game. Lobby UI updated via removePlayer.`);
             // Lobby UI update (local emit) happens inside removePlayer if gameHasStarted is false
        }
    }

    /**
     * Sends game info (questions, difficulty, players) to a specific client using the internal send method.
     * @param {string} clientPeerId The PeerJS ID of the client.
     * @private
     */
    sendGameInfoToClient(clientPeerId) {
        // Ensure quizEngine instance and questions exist
        if (!this.isHosting || !this.quizEngine || !this.quizEngine.questions || this.quizEngine.questions.length === 0 || !clientPeerId) {
            console.warn(`[${this.constructor.name}] Cannot send game info: hosting inactive, quiz engine not ready/no questions, or invalid client ID.`);
            return;
        }

        console.log(`[${this.constructor.name}] Sending game info to client ${clientPeerId}...`);

        // Group questions by sheetId
        const questionsForClient = this.quizEngine.questions;
        const sheetsMap = new Map();
        questionsForClient.forEach(q => {
            if (!q.sheetId) return;
            if (!sheetsMap.has(q.sheetId)) {
                sheetsMap.set(q.sheetId, []);
            }
            sheetsMap.get(q.sheetId).push({ question: q.question, answer: q.answer });
        });

        // Get sheet metadata (id, name)
        const availableSheets = (typeof questionsManager !== 'undefined' && questionsManager.getAvailableSheets) ? questionsManager.getAvailableSheets() : [];
        const sheets = Array.from(sheetsMap.entries()).map(([sheetId, questions]) => {
            const meta = availableSheets.find(s => s.id === sheetId) || { id: sheetId, name: sheetId, isCustom: false };
            return {
                id: sheetId,
                name: meta.name || sheetId,
                isCustom: meta.isCustom || false,
                questions
            };
        });

        const gameInfoPayload = {
            questionsData: { sheets },
            difficulty: this.difficulty,
            players: Object.fromEntries(this.players),
            settings: this.settings
        };

        this._sendMessageToClient(clientPeerId, MSG_TYPE.GAME_INFO, gameInfoPayload);
        console.log(`[${this.constructor.name}] Game info sent to client ${clientPeerId}`, gameInfoPayload);
    }

    /**
     * Handles data messages received from any connected client *during the lobby phase*.
     * Primarily handles 'c_requestJoin' and 'client_ready'.
     * @param {object} eventData - Payload from Events.WebRTC.MessageReceived.
     * @param {any} eventData.msg - The received message data { type: string, payload: any }.
     * @param {string} eventData.sender - The PeerJS ID of the client who sent the message.
     * @event Events.WebRTC.MessageReceived
     */
    handleDataReceived = ({ msg, sender }) => {
        // Ignore if lobby isn't active or sender is host/unknown
        if (!this.isHosting || !this.players.has(sender) || sender === this.hostId) {
            console.warn(`[${this.constructor.name}] Ignoring message (hosting: ${this.isHosting}, sender known: ${this.players.has(sender)}, is host: ${sender === this.hostId})`, msg);
            return; 
        }

        const type = msg.type;
        const payload = msg.payload;
        const playerName = this.players.get(sender).name || sender;

        const acceptedTypes = [MSG_TYPE.C_REQUEST_JOIN, MSG_TYPE.C_UPDATE_NAME, MSG_TYPE.CLIENT_READY, MSG_TYPE.C_REQUEST_REMATCH];
        if (!acceptedTypes.includes(type)) {
             console.log(`[${this.constructor.name} Lobby] Ignoring non-lobby message type '${type}' from ${playerName} (${sender})`);
             return;
        }

        console.log(`[${this.constructor.name} Lobby] Received lobby message from ${playerName} (${sender}): Type=${type}`, payload);

        switch (type) {
            case MSG_TYPE.C_REQUEST_JOIN: 
                 const requestedName = payload.name;
                 if (requestedName) {
                     console.log(`[${this.constructor.name} Lobby] Processing join request for ${sender} with name: ${requestedName}`);
                     // Update player name if needed, keep ready status false until confirmed
                     this.addPlayer(sender, requestedName, false, false); 
                 } else {
                      console.warn(`[${this.constructor.name} Lobby] Received c_requestJoin from ${sender} without a name.`);
                 }
                 break;
            case MSG_TYPE.C_UPDATE_NAME:
                 const newName = payload.name;
                 if (newName && this.players.has(sender)) {
                     console.log(`[${this.constructor.name} Lobby] Processing name update for ${sender}: ${newName}`);
                     const player = this.players.get(sender);
                     this.addPlayer(sender, newName, player.isReady, player.isHost);
                 } else {
                     console.warn(`[${this.constructor.name} Lobby] Received c_updateName from ${sender} without a name or unknown sender.`);
                 }
                 break;
            case MSG_TYPE.CLIENT_READY: // Explicit fallback
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
                         this.addPlayer(sender, player.name, isReady, player.isHost);
                         
                         // Send game info to the client immediately when they become ready
                         this.sendGameInfoToClient(sender);
                         
                         // Force broadcast the player list update to ensure all clients receive it
                         this._broadcastPlayerListUpdate();
                         
                         // Also force emit locally for host UI to ensure it updates
                         eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: Object.fromEntries(this.players) });
                         
                         // Manually log the player list after update to verify
                         console.log(`[${this.constructor.name} Lobby] Player list after update:`, Object.fromEntries(this.players));
                     } else {
                          console.log(`[${this.constructor.name} Lobby] Player ${playerName} (${sender}) already marked as ready.`);
                          // Re-send game info even if already ready (might be reconnecting)
                          this.sendGameInfoToClient(sender);
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
     * Broadcasts the current player list to all connected clients.
     * @private
     */
    _broadcastPlayerListUpdate() {
        const playersObject = Object.fromEntries(this.players);
        this._broadcastToClients(MSG_TYPE.PLAYER_LIST_UPDATE, { players: playersObject });
    }

    /**
     * Sends a message to a specific client via WebRTCManager.
     * @param {string} peerId The recipient PeerJS ID.
     * @param {string} type The message type.
     * @param {object} payload The message payload.
     * @private
     */
    _sendMessageToClient(peerId, type, payload) {
        if (!this.isHosting) {
            console.warn(`[${this.constructor.name} Lobby] Cannot send message to ${peerId}, hosting not active.`);
            return;
        }
        if (!this.players.has(peerId) || peerId === this.hostId) {
            console.warn(`[${this.constructor.name} Lobby] Cannot send message to ${peerId}, not a valid connected client.`);
            return;
        }
        webRTCManager.sendToPeer(peerId, type, payload);
    }

    /**
     * Broadcasts a message to all connected clients (excluding host), optionally excluding others.
     * Uses WebRTCManager for the actual broadcast mechanism.
     * @param {string} type Message type identifier.
     * @param {object} payload Message data.
     * @param {string[]} [excludePeerIds=[]] List of peer IDs to exclude from broadcast.
     * @private
     */
    _broadcastToClients(type, payload, excludePeerIds = []) {
        if (!this.isHosting) {
            console.warn(`[${this.constructor.name} Lobby] Cannot broadcast, hosting not active.`);
            return;
        }

        const allClientIds = Array.from(this.players.keys()).filter(id => id !== this.hostId);
        const broadcastList = allClientIds.filter(id => !excludePeerIds.includes(id));

        if (broadcastList.length === 0) {
            // Log even if list is empty, useful for debugging state issues
            console.log(`[${this.constructor.name} Lobby] No clients available or targeted for broadcast type '${type}'. (Total clients: ${allClientIds.length}, Excluded: ${excludePeerIds.length})`);
            return;
        }

        console.log(`[${this.constructor.name} Lobby] Broadcasting: Type=${type} to ${broadcastList.length} clients (Excluded: ${excludePeerIds.join(', ') || 'none'})`, payload);
        // Use the correct method: broadcastMessage, which handles filtering internally
        webRTCManager.broadcastMessage(type, payload); 
    }

    /**
     * Called when the host cancels the lobby.
     * Informs clients and cleans up.
     */
    leaveLobby() {
        console.log(`[${this.constructor.name}] Host is leaving lobby.`);
        if (this.isHosting) {
             // Inform clients lobby is closing
             this._broadcastToClients('feedback', { message: getTextTemplate('mpHostLobbyCancelled'), level: 'warn' }, []);
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
        this.leaveLobby(); // Ensure lobby stops and lobby-specific listeners are removed
        
        // Explicitly remove listeners that might persist after stopHosting
        eventBus.off(Events.Multiplayer.Host.ClientDisconnected, this.handleClientDisconnected);
        eventBus.off(Events.WebRTC.MessageReceived, this.handleDataReceived); // Ensure this is off too
        eventBus.off(Events.UI.HostLobby.StartGameClicked, this.handleStartGameClicked); // Ensure this is off

        // Clean up active game instance if it exists
        if (this.activeGame) {
            if (typeof this.activeGame.destroy === 'function') {
                this.activeGame.destroy();
            }
            this.activeGame = null;
        }

        this.players.clear();
        this.quizEngine = null; // Release reference
        this.isHosting = false;
        this.gameHasStarted = false; // Reset flag
        this._rematchRequestedPeers.clear(); 
        console.log(`[${this.constructor.name}] Destroyed.`);
    }

    /**
     * [ADDED] Handles the PlayerListUpdated event from WebRTCManager.
     * Synchronizes the internal player list (names, etc.) with the authoritative list.
     * @param {object} payload
     * @param {Map<string, { name: string, isHost: boolean }>} payload.players The authoritative player list from WebRTCManager.
     * @private
     */
    _handlePlayerListUpdate = ({ players }) => {
        if (!this.isHosting) return; // Only process if lobby is active
        // Convert object to Map if needed
        const playersMap = players instanceof Map ? players : new Map(Object.entries(players));
        console.log(`[${this.constructor.name} Lobby] Received PlayerListUpdated event from WebRTCManager. Synchronizing...`);
        playersMap.forEach((playerData, peerId) => {
            if (peerId === this.hostId) return; // Ignore the host entry (managed separately)
            const existingPlayer = this.players.get(peerId);
            const webRTCName = playerData.name || getTextTemplate('mcDefaultPlayerName'); // Ensure a name exists
            if (!existingPlayer) {
                console.warn(`[${this.constructor.name} Lobby Sync] Adding missing player ${webRTCName} (${peerId})`);
                this.addPlayer(peerId, webRTCName, false, false); // Add as not ready initially
            } else if (existingPlayer.name !== webRTCName) {
                console.log(`[${this.constructor.name} Lobby Sync] Updating name for ${peerId} from '${existingPlayer.name}' to '${webRTCName}'`);
                this.addPlayer(peerId, webRTCName, existingPlayer.isReady, existingPlayer.isHost); 
            }
        });
    }

    /**
     * [ADDED] Handles the click event from the Host Lobby UI to start the game.
     * Tells the active game instance to begin its start sequence.
     * @private
     */
    handleStartGameClicked = () => {
        console.log(`[${this.constructor.name}] Start Game button clicked.`);
        if (!this.isHosting) {
            console.warn(`[${this.constructor.name}] StartGameClicked received, but not hosting.`);
            return;
        }
        if (this.gameHasStarted) {
            console.warn(`[${this.constructor.name}] StartGameClicked received, but game already started.`);
            return;
        }
        if (!this.activeGame) {
            console.error(`[${this.constructor.name}] StartGameClicked received, but no active game instance exists.`);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Error: No active game found.', level: 'error' });
            return;
        }
        if (typeof this.activeGame.startGameSequence !== 'function') {
            console.error(`[${this.constructor.name}] StartGameClicked received, but active game instance is missing startGameSequence method.`);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Error: Cannot start game sequence.', level: 'error' });
            return;
        }

        console.log(`[${this.constructor.name}] Instructing active game instance to start sequence...`);
        this.gameHasStarted = true; // Set flag to prevent multiple starts
        this.activeGame.startGameSequence();

        // Optionally: Stop listening for *new* client connections/lobby messages here?
        // Or maybe startGameSequence handles broadcasting GAME_START which signals clients
        // and the HostLobbyComponent hides itself. Let's rely on the game sequence for now.
    };

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
        this.stopHosting(); // Removes LOBBY listeners only now

        // 2. Broadcast GAME_START to all connected clients
        console.log(`[${this.constructor.name}] Broadcasting GAME_START.`);
        this._broadcastToClients(MSG_TYPE.GAME_START, {
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
            this._broadcastToClients(MSG_TYPE.H_REMATCH_ACCEPTED, {}, []); 

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