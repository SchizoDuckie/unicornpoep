import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
import miscUtils from '../utils/miscUtils.js'; // Import default
// Assuming PeerJS is loaded globally or correctly imported as 'Peer'
// import Peer from '../lib/peerjs.min.js'; // Keep if using module
import { ConnectionStatus, DataConnectionState, DisconnectionReason } from '../core/connection-constants.js'; // Import DisconnectionReason
import { MSG_TYPE } from '../core/message-types.js'; // ADDED: Import from new location

// Define message types used in communication
// export const MSG_TYPE = { ... }; // MOVED to v2/core/message-types.js

// Constants for Heartbeat/Timeout
const HEARTBEAT_INTERVAL_MS = 5000; // Check/Send every 5 seconds
const TIMEOUT_MS = 15000; // Consider connection lost after 15 seconds of silence

/**
 * Manages WebRTC connections using PeerJS for multiplayer games.
 * Handles host initialization, client connection, data messaging relay,
 * basic player state tracking (for connection management), and emits WebRTC/Multiplayer events.
 * It does NOT parse or handle game-specific message content; it emits raw messages via
 * Events.WebRTC.MessageReceived for other services (like MultiplayerGame/MultiplayerClientManager) to handle.
 */
class WebRTCManager {
    constructor() {
        /** @type {Peer | null} The PeerJS instance. */
        this.peer = null;
        /** @type {string | null} ID of the host we are connected to (client only). */
        this.hostId = null;
        /** @type {string | null} Our own PeerJS ID (6-digit code for host, GUID for client). */
        this.myPeerId = null;
        /** @type {Map<string, Peer.DataConnection>} Map<peerId, DataConnection> - Host: clients, Client: host */
        this.connections = new Map();
        /** @type {Map<string, DataConnectionState>} Map<peerId, state> Tracks individual connection states */
        this.connectionStates = new Map();
        /** @type {Map<string, { name?: string, isHost: boolean }>} Minimal player info needed by WebRTCManager (name from metadata) */
        this.players = new Map();
        /** @type {string} The local player's name. */
        this.localPlayerName = miscUtils.generateRandomPlayerName();
        /** @type {boolean} Whether this instance is acting as the host. */
        this.isHost = false;
        /** @type {object | null} Temporary storage for host game settings/data. */
        this.pendingHostGameData = null;
        /** @type {string | null} Difficulty setting for the host game. */
        this.pendingHostDifficulty = null;
        /** @type {ConnectionStatus} Current status of the connection manager. */
        this.status = ConnectionStatus.DISCONNECTED;
        /** @private Stores bound listener functions for easy removal */
        this._peerListeners = {};
        /** @private Stores bound listener functions for individual connections */
        this._connectionListeners = new Map();
        /** @private Interval ID for sending pings */
        this._pingIntervalId = null;
        /** @private Interval ID for checking timeouts */
        this._timeoutCheckIntervalId = null;
        /** @private Map<peerId, timestamp> Last contact time for clients (Host only) */
        this._clientLastContact = new Map();
        /** @private Timestamp Last contact time from host (Client only) */
        this._lastHostContact = null;
        /** @private Stores the actual PeerJS ID of the host */
        this.hostPeerId = null;
        /** @private Store original onerror */
        // this._originalOnError = window.onerror; // REMOVED
        /** @private Store our bound error handler */
        // this._boundErrorHandler = this._handleGlobalError.bind(this);

        // Setup global error handler using addEventListener
        // window.onerror = this._boundErrorHandler; // REMOVED
        window.addEventListener('error', this._boundErrorHandler);

        console.info("[WebRTCManager] Initialized.");
    }

    // --- Host Functionality ---

    /**
     * Initializes this peer as the host, using a generated 6-digit code as the Peer ID.
     * @param {string} playerName - The host's chosen name.
     * @param {object} questionsData - The structured question data object from QuestionsManager.
     * @param {string} difficulty - The selected game difficulty.
     * @throws {Error} If PeerJS initialization fails or another game is active.
     */
    startHost(playerName, questionsData, difficulty) {
        console.log(`[WebRTCManager] Attempting to start Host with 6-digit ID. Player: ${playerName}, Difficulty: ${difficulty}`);
        if (this.status !== ConnectionStatus.DISCONNECTED && this.status !== ConnectionStatus.ERROR) {
             const message = `[WebRTCManager] Cannot start host, current status is ${this.status}. Call closeConnection() first.`;
             console.error(message);
             throw new Error(message);
        }
        this.resetState();
        this.status = ConnectionStatus.INITIALIZING_PEER;
        this.isHost = true;
        this.localPlayerName = playerName;
        this.pendingHostGameData = questionsData || { sheets: [] }; // Store questions data
        this.pendingHostDifficulty = difficulty || 'normal'; // Store difficulty

        try {
            if (typeof Peer === 'undefined') {
                throw new Error(miscUtils.getTextTemplate('rtcErrorPeerJSLoad'));
            }

            // *** Generate 6-digit code to use AS Peer ID ***
            const generatedCodeId = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[WebRTCManager] Generated 6-digit Host ID: ${generatedCodeId}`);
            this.myPeerId = generatedCodeId; // Store it immediately

            // *** Use the generated code as the Peer ID ***
            this.peer = new Peer(generatedCodeId, { debug: 2 }); // Pass code to constructor

            // Store bound listeners
            this._peerListeners.open = (id) => this._handleHostOpen(id);
            this._peerListeners.connection = (conn) => this._handleClientConnection(conn);
            this._peerListeners.error = (err) => this._handleError(err, 'host-peer');
            this._peerListeners.disconnected = () => this._handleDisconnection('host-disconnected-server');
            this._peerListeners.close = () => console.log('[WebRTCManager] Host Peer instance closed.');

            this.peer.on('open', this._peerListeners.open);
            this.peer.on('connection', this._peerListeners.connection);
            this.peer.on('error', this._peerListeners.error);
            this.peer.on('disconnected', this._peerListeners.disconnected);
            this.peer.on('close', this._peerListeners.close);

        } catch (error) {
            console.error("[WebRTCManager] Error creating host PeerJS instance:", error);
            eventBus.emit(Events.WebRTC.ConnectionFailed, { error, context: 'host-peer-creation', message: error.message });
            this.status = ConnectionStatus.ERROR;
            this.resetState();
        }

        // Add global error listener now that Peer is active
        window.addEventListener('error', this._boundErrorHandler);
        console.debug("[WebRTCManager] Added global error listener (host).");
    }

    /**
     * @private
     * @param {string} id The host PeerJS ID (should match the generated 6-digit code).
     */
    _handleHostOpen(id) {
        if (this.status !== ConnectionStatus.INITIALIZING_PEER) return;
        
        if (id !== this.myPeerId) {
            console.error(`[WebRTCManager] Mismatch! Host Peer opened with ID ${id}, but expected ${this.myPeerId}. Check PeerServer configuration or if ID was reused.`);
            this.myPeerId = id; 
            this.hostPeerId = id; 
        } else {
             this.hostPeerId = id;
        }
        
        console.log(`[WebRTCManager] Host PeerJS established. Assigned ID (6-digit): ${this.myPeerId}, Actual PeerJS ID used: ${this.hostPeerId}`);
        
        this.status = ConnectionStatus.AWAITING_CONNECTIONS;
        this._updatePlayer(this.myPeerId, { name: this.localPlayerName, isHost: true });

        eventBus.emit(Events.Multiplayer.Host.Initialized, {
            hostId: this.myPeerId,
            hostPeerId: this.hostPeerId
        });

        this._startHostHeartbeatBroadcast();
        this._startClientTimeoutCheck();

        // Add global error listener now that Peer is active
        window.addEventListener('error', this._boundErrorHandler);
        console.debug("[WebRTCManager] Added global error listener (host).");
    }

    /**
     * @private
     * @param {Peer.DataConnection} connection The incoming client connection.
     */
    _handleClientConnection(connection) {
        const peerId = connection.peer;

        // --- FIX: Safely handle potentially undefined metadata ---
        // Assign a temporary name. The actual name will come via 'client_hello'.
        const clientName = `Client_${peerId.slice(-4)}`; // Use placeholder initially
        console.log(`[WebRTCManager] Incoming connection request from: ${peerId} (Temp Name: ${clientName})`);
        // --- END FIX ---

        // Prevent duplicate connections (logic remains the same)
        if (this.connections.has(peerId)) {
            console.warn(`[WebRTCManager] Duplicate connection attempt from ${peerId}. Closing new attempt.`);
            connection.close();
            return;
        }

        // Store connection immediately (logic remains the same)
        this.connections.set(peerId, connection);
        this.connectionStates.set(peerId, DataConnectionState.OPENING);

        // Store bound listeners for this specific connection
        const connListeners = {
            open: () => {
                console.log(`[WebRTCManager] Data connection opened with client: ${peerId}`); // Log with PeerID initially
                // Connection is fully open
                this.connectionStates.set(peerId, DataConnectionState.OPEN);

                // Initialize last contact time for timeout check
                this._clientLastContact.set(peerId, Date.now());

                // Emit ClientConnected event WITHOUT name, as it's not confirmed yet.
                eventBus.emit(Events.Multiplayer.Host.ClientConnected, { peerId });

            },
            data: (rawData) => {
                // Wrap the entire handler content in a try-catch for robustness
                try {
                const peerId = connection.peer; // Capture peerId for this handler context
                    // +++ ADD RAW LOG +++
                    console.log(`%c[WebRTC RAW Host] Received data from ${peerId}:`, 'color: orange; font-weight: bold;', rawData); // Added color for visibility
                    // +++ END RAW LOG +++

                let messageData;
                    // Parsing logic (moved inside the main try-catch)
                try {
                    if (typeof rawData === 'string') {
                        messageData = JSON.parse(rawData);
                    } else if (typeof rawData === 'object' && rawData !== null) {
                        messageData = rawData;
                    } else {
                        console.error(`[WebRTCManager Host] Received unexpected data type from ${peerId}: ${typeof rawData}`, rawData);
                        return; // Ignore unexpected types
                        }
                    } catch (parseError) {
                        console.error(`[WebRTCManager Host] Failed to parse message JSON string in 'data' handler from ${peerId}:`, parseError, rawData);
                        this._handleClientDisconnection(peerId, 'message_parse_error');
                        return; // Stop processing if string parsing fails
                    }

                    // --- Add strict check for message type ---
                    if (!messageData || typeof messageData.type !== 'string') {
                        console.warn(`[WebRTCManager Host] Received message without a valid 'type' string from ${peerId}. Ignoring.`, messageData);
                        return;
                    }
                    // --- End check ---

                    // Update last contact time AFTER successful parsing and type check
                    this._clientLastContact.set(peerId, Date.now());

                    // --- ADD Handling for client_hello ---
                    if (messageData.type === 'client_hello' && messageData.payload) {
                        const playerName = messageData.payload.name || `Player_${peerId.slice(-4)}`;
                         console.log(`[WebRTCManager Host] Received client_hello from ${peerId}. Setting name to: ${playerName}`);
                         // Update the player list internally in WebRTCManager
                        this._updatePlayer(peerId, { name: playerName, isHost: false });

                         // --- FIX: Send Game Info AFTER hello ---
                         if (this.isHost) {
                            this._sendGameInfoToClient(connection);
                         }
                         // --- END FIX ---

                         // Emit the updated list (HostLobbyComponent and others listen for this)
                        eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
                         // Also emit PlayerJoined now that we have the name
                         eventBus.emit(Events.Multiplayer.Common.PlayerJoined, { peerId, playerData: { name: playerName, isHost: false } });

                         // Do not emit MessageReceived further for this internal message type
                         return;
                    }
                    // --- END Handling for client_hello ---

                    // Pass other validated messages to the emit handler
                        this._emitMessageReceived(messageData, peerId);

                } catch (outerError) {
                     const currentPeerId = connection?.peer || 'unknown';
                     console.error(`[WebRTCManager Host] Unexpected error in 'data' handler for peer ${currentPeerId}:`, outerError);
                     if (currentPeerId !== 'unknown') {
                          this._handleClientDisconnection(currentPeerId, 'data_handler_unexpected_error');
                     }
                }
            },
            close: () => {
                 console.warn(`[WebRTCManager] Data connection closed for client: ${peerId}`);
                 this.connectionStates.set(peerId, DataConnectionState.CLOSED);
                 this._handleClientDisconnection(peerId, DisconnectionReason.CLOSED_BY_REMOTE);
            },
            error: (err) => {
                 console.error(`[WebRTCManager] Data connection error for client ${peerId}:`, err);
                 this.connectionStates.set(peerId, DataConnectionState.CLOSED);
                 this._handleClientDisconnection(peerId, DisconnectionReason.CONNECTION_ERROR);
                 // Optionally emit a specific error event?
                 eventBus.emit(Events.WebRTC.ConnectionFailed, { error: err, context: 'data-connection', peerId: peerId });
            }
        };
        this._connectionListeners.set(peerId, connListeners);

        connection.on('open', connListeners.open);
        connection.on('data', connListeners.data);
        connection.on('close', connListeners.close);
        connection.on('error', connListeners.error);
    }

    /**
     * Sends current game settings and player list to a specific new client.
     * @param {Peer.DataConnection} connection - The connection to the new client.
     * @private
     */
    _sendGameInfoToClient(connection) {
        if (!this.isHost || !connection || !connection.open) return;
        
        // Construct payload with full questions data and difficulty
        const gameInfoPayload = {
            questions: this.pendingHostGameData, // Send the full questions data structure
            difficulty: this.pendingHostDifficulty, // Send the difficulty
            players: Object.fromEntries(this.players), // Send current player list as object
            hostId: this.myPeerId
        };
        console.log(`[WebRTCManager] Sending GAME_INFO to client ${connection.peer}`); // Don't log full payload for brevity
        // console.debug('[WebRTCManager] Game Info Payload:', gameInfoPayload); // Optional full log
        this.sendMessage(connection, MSG_TYPE.GAME_INFO, gameInfoPayload);
    }

    /**
     * [Host Only] Closes connection to a specific client.
     * @param {string} peerId The ID of the client to disconnect.
     */
    closeClientConnection(peerId) {
        if (!this.isHost) return;
        console.log(`[WebRTCManager] Host manually closing connection with client: ${peerId}`);
        this._safelyCloseDataConnection(peerId, DisconnectionReason.MANUAL_HOST_DISCONNECT);
    }

    /**
     * @private Handles cleanup when a client connection is lost or closed.
     * This is triggered BY on('close') or on('error') events, or potentially after a safe close attempt.
     * It should NOT attempt to call connection.close() itself again.
     * @param {string} peerId Client's PeerJS ID.
     * @param {string} [reason='unknown'] - Reason for disconnection.
     */
    _handleClientDisconnection(peerId, reason = DisconnectionReason.UNKNOWN) {
        // Prevent handling if already disconnected or cleanup in progress
        if (!this.players.has(peerId) || !this.connections.has(peerId)) {
            // console.warn(`[WebRTCManager] Attempted to handle disconnection for already removed/unknown peer: ${peerId}. Reason: ${reason}`);
            return;
        }
        const wasOpen = this.connectionStates.get(peerId) === DataConnectionState.OPEN;
        const playerName = this.players.get(peerId)?.name || 'Unknown';

        console.log(`[WebRTCManager] Cleaning up connection for ${playerName} (${peerId}). Reason: ${reason}`);

        // Clean up internal state
        this._removePeerListeners(this.connections.get(peerId)); // Remove listeners first
        this._connectionListeners.delete(peerId); // Remove stored bound listeners
        this.connections.delete(peerId);
        this.connectionStates.set(peerId, DataConnectionState.CLOSED);
        this._clientLastContact.delete(peerId);
        this._removePlayer(peerId); // Removes from this.players and emits PlayerListUpdated

        // Emit specific disconnect event if connection was fully open
        if (wasOpen || reason === DisconnectionReason.TIMEOUT) {
             eventBus.emit(Events.Multiplayer.Host.ClientDisconnected, { peerId, reason });
        }

        // Provide clearer user feedback via event
        let feedbackKey = 'mpClientDisconnectedGeneric'; // Default key
        let feedbackLevel = 'warn';
        if (reason === DisconnectionReason.TIMEOUT) {
            feedbackKey = 'mpClientDisconnectedTimeout';
        } else if (reason === DisconnectionReason.LEFT_VOLUNTARILY) {
            feedbackKey = 'mpClientDisconnectedLeft';
            feedbackLevel = 'info'; // Use info level for voluntary leave
        } else if (reason === DisconnectionReason.SHUTDOWN) {
            // Don't show feedback if host is shutting down normally
            return;
        } else if (reason === DisconnectionReason.SHUTDOWN_CLOSE_ERROR) {
             // Don't show feedback for shutdown errors either (host initiated)
             return;
        }
        const feedbackMessage = miscUtils.getTextTemplate(feedbackKey, { playerName: playerName });
        if (feedbackMessage) {
            eventBus.emit(Events.System.ShowFeedback, { message: feedbackMessage, level: feedbackLevel });
        }
    }
    
    /**
     * Attempts to safely close a DataConnection, checking its state first.
     * @param {string} peerId The peer ID of the connection to close.
     * @param {string} reason The reason for closing (for logging).
     * @private
     */
    _safelyCloseDataConnection(peerId, reason) {
        // +++ ADDED CHECK: Ensure peerId is valid and connection exists +++
        if (!peerId) {
            console.warn(`[WebRTCManager] _safelyCloseDataConnection: Invalid peerId provided. Reason: ${reason}`);
            return; 
        }
        const connection = this.connections.get(peerId);
        // +++ END ADDED CHECK +++

        if (connection) {
            // Check if connection is already closing or closed
            const currentState = this.connectionStates.get(peerId);
            if (currentState === DataConnectionState.CLOSED || currentState === DataConnectionState.CLOSING) {
                console.debug(`[WebRTCManager] _safelyCloseDataConnection: Connection ${peerId} already closed or closing (State: ${currentState}).`);
                // Ensure cleanup still happens if needed
                this._handleClientDisconnection(peerId, reason + DisconnectionReason.ALREADY_CLOSED_SUFFIX);
            return;
        }

            console.log(`[WebRTCManager] _safelyCloseDataConnection: Closing connection with ${peerId}. Reason: ${reason}`);
            this.connectionStates.set(peerId, DataConnectionState.CLOSING);
            try {
                connection.close();
                // The on('close') or on('error') handler will call _handleClientDisconnection for final cleanup.
            } catch (closeError) {
                 // Catch potential errors during close (like the flush error if state is bad)
                 console.warn(`[WebRTCManager] _safelyCloseDataConnection: Error during connection.close() for ${peerId} (Reason: ${reason}). Might be expected if connection was already broken.`, closeError);
                // If close throws, the event handlers might not fire, so trigger cleanup directly.
                this._handleClientDisconnection(peerId, `${reason}_close_error`);
            }
        } else {
             console.warn(`[WebRTCManager] _safelyCloseDataConnection: Attempted to close non-existent connection for peerId: ${peerId}. Reason: ${reason}. (May be expected if already cleaned up)`);
             // Do not trigger cleanup here if connection doesn't exist, it was likely handled already.
        }
    }

    // --- Client Functionality ---

    /**
     * Initializes this peer as a client and attempts to connect to a host using the 6-digit code.
     * @param {string} hostPeerId - The 6-digit code of the host to connect to.
     * @param {string} playerName - This client's chosen name.
     * @throws {Error} If hostPeerId is invalid, already connected, or initialization fails.
     */
    connectToHost(hostPeerId, playerName) {
        console.log(`[WebRTCManager] Attempting to connect to Host (6-digit ID): ${hostPeerId}, Player: ${playerName}`);
        // Basic validation
        if (!/^[0-9]{6}$/.test(hostPeerId)) {
            console.error(`[WebRTCManager] Invalid host ID format: ${hostPeerId}. Must be 6 digits.`);
            eventBus.emit(Events.WebRTC.ConnectionFailed, { error: new Error('Invalid host code format.'), context: 'client-connect-validation' });
            return;
        }
        if (this.status !== ConnectionStatus.DISCONNECTED && this.status !== ConnectionStatus.ERROR) {
             const message = `[WebRTCManager] Cannot connect, current status is ${this.status}. Call closeConnection() first.`;
            console.error(message);
            eventBus.emit(Events.WebRTC.ConnectionFailed, { error: new Error(message), context: 'client-connect-state' });
            return;
        }

        this.resetState();
        this.status = ConnectionStatus.INITIALIZING_PEER; // Use constant
        this.isHost = false;
        this.localPlayerName = playerName || miscUtils.generateRandomPlayerName();
        this.hostId = hostPeerId; // Store the target ID

        try {
            if (typeof Peer === 'undefined') {
                throw new Error(miscUtils.getTextTemplate('rtcErrorPeerJSLoad'));
            }
            // Client uses PeerServer-assigned ID
            this.peer = new Peer({ debug: 2 });

            // Store bound listeners
            this._peerListeners.open = (id) => this._handleClientOpen(id);
            this._peerListeners.error = (err) => this._handleError(err, 'client-peer');
            this._peerListeners.disconnected = () => this._handleDisconnection('client-disconnected-server');
            this._peerListeners.close = () => console.log('[WebRTCManager] Client Peer instance closed.');

            this.peer.on('open', this._peerListeners.open);
            this.peer.on('error', this._peerListeners.error);
            this.peer.on('disconnected', this._peerListeners.disconnected);
            this.peer.on('close', this._peerListeners.close);

        } catch (error) {
            console.error("[WebRTCManager] Error creating client PeerJS instance:", error);
            eventBus.emit(Events.WebRTC.ConnectionFailed, { error, context: 'client-peer-creation' });
            this.status = ConnectionStatus.ERROR; // Use constant
            this.resetState();
        }
        // Add global error listener now that Peer is active
        window.addEventListener('error', this._boundErrorHandler);
        console.debug("[WebRTCManager] Added global error listener (client).");
    }

    /**
     * @private
     * @param {string} id The client PeerJS ID (should match the generated 6-digit code).
     */
    _handleClientOpen(id) {
        // Check if peer object exists and is not destroyed
        if (!this.peer || this.peer.destroyed) {
            console.error("[WebRTCManager] _handleClientOpen called but peer is invalid or destroyed.");
            this._handleError(new Error("Client Peer object invalid during open event"), 'client-peer-open-invalid');
             return;
         }
        // Check if already connected or trying to connect
        if (this.status !== ConnectionStatus.INITIALIZING_PEER) {
            console.warn(`[WebRTCManager] _handleClientOpen called in unexpected state: ${this.status}. Ignoring.`);
            return; 
        }
        
        console.log(`[WebRTCManager] Client PeerJS established. Client ID: ${id}`);
        this.myPeerId = id; // Assign the received client ID
        this._updatePlayer(this.myPeerId, { name: this.localPlayerName, isHost: false });

        // Now that our peer is open, attempt to connect to the target host ID
                     if (!this.hostId) {
             console.error("[WebRTCManager] Critical error: Client Peer opened, but no target hostId is set!");
             this._handleError(new Error("Target host ID missing after client peer open"), 'client-peer-open-no-hostid');
                         return;
                     }
        this._attemptHostConnection(this.hostId); // Trigger the connection to host

        // Do NOT set status or start heartbeats here. Let _attemptHostConnection handle it.
        // eventBus.emit(Events.Multiplayer.Client.ConnectedToHost, { hostId: this.hostId }); // MOVED to _attemptHostConnection's 'open' handler
        // this._startClientPing(); // MOVED to _attemptHostConnection's 'open' handler
        // this._startHostTimeoutCheck(); // MOVED to _attemptHostConnection's 'open' handler
    }

     /**
      * @private
      * @param {string} reason The reason for disconnection ('closed', 'error').
     * @private
      */
    _handleHostDisconnection(reason = DisconnectionReason.UNKNOWN) {
        const hostPeerId = this.hostId; // Store before clearing
        if (!hostPeerId) return; // Already disconnected

        console.log(`[WebRTCManager] Disconnected from host ${hostPeerId}. Reason: ${reason}`);
        this.status = ConnectionStatus.DISCONNECTED; // Or ERROR if reason is 'error'? Let's use DISCONNECTED.

        const connection = this.connections.get(hostPeerId);
        // Remove listeners associated with this connection
        const connListeners = this._connectionListeners.get(hostPeerId);
        if (connection && connListeners) {
            connection.off('open', connListeners.open);
            connection.off('data', connListeners.data);
            connection.off('close', connListeners.close);
            connection.off('error', connListeners.error);
            this._connectionListeners.delete(hostPeerId);
        }

        // Ensure connection is closed
        if (connection && connection.open && reason !== DisconnectionReason.CLOSED_BY_REMOTE) {
            try {
                connection.close();
            } catch (e) {
                console.warn(`[WebRTCManager] Error closing connection with ${hostPeerId}:`, e);
            }
        }
        this.connections.delete(hostPeerId);

        this.hostId = null; // Mark as disconnected from host

        // Don't reset peer, allow potential reconnect attempts by UI/Coordinator
        // Emit DisconnectedFromHost first
        eventBus.emit(Events.Multiplayer.Client.DisconnectedFromHost, { hostId: hostPeerId, reason });
        // Then emit PlayerLeft for game logic
        eventBus.emit(Events.Multiplayer.Common.PlayerLeft, { peerId: hostPeerId });
    }

    // --- Common Functionality ---

    /** Closes all connections and destroys the PeerJS instance. */
    closeConnection() {
        console.log(`[WebRTCManager] Closing connection and destroying PeerJS instance...`);
        this._clearHeartbeatIntervals();

        if (this.connections.size > 0) {
            console.log(`[WebRTCManager] Closing ${this.connections.size} active data connections...`);
            // Get peer IDs before iterating as closing might modify the map
            const peerIdsToClose = Array.from(this.connections.keys()); 
            peerIdsToClose.forEach(peerId => {
                 this._safelyCloseDataConnection(peerId, 'shutdown');
            });
            // Maps are cleared within _handleClientDisconnection triggered by close events/errors
            // Do not clear maps here directly anymore.
            // this.connections.clear();
            // this.connectionStates.clear();
            // this._connectionListeners.clear();
        }

        if (this.peer) {
            console.log("[WebRTCManager] Destroying PeerJS instance...");
            this._removePeerListeners(); // Remove listeners before destroying
            try {
                 if (!this.peer.destroyed) {
                     this.peer.destroy();
                 }
            } catch (destroyError) {
                 // Catch potential errors during destroy (like the flush error if state is bad)
                 console.warn("[WebRTCManager] Error during peer.destroy(). Might be expected if connection was already broken.", destroyError);
            }
            this.peer = null;
        }

        // Reset internal state AFTER cleanup attempts
        this.resetState(); // This clears players map etc.
        console.log("[WebRTCManager] Connection closed and state reset.");
    }

    /** Resets the manager's state variables. */
    resetState() {
        // console.log("[WebRTCManager] Resetting state..."); // Called frequently, maybe make debug level
        this.peer = null;
        this.hostId = null;
        this.myPeerId = null;
        this.connections.clear();
        this.connectionStates.clear();
        this.players.clear();
        this.localPlayerName = miscUtils.generateRandomPlayerName();
        this.isHost = false;
        this.pendingHostGameData = null;
        this.pendingHostDifficulty = null;
        this.status = ConnectionStatus.DISCONNECTED;
         this._peerListeners = {};
         this._connectionListeners.clear();
        this._removePeerListeners(); // Remove listeners before potentially destroying peer
        this._clearHeartbeatIntervals(); // Stop pinging and timeout checks
        this.hostPeerId = null; // Reset the hostPeerId

        // Restore original window.onerror handler - REMOVED logic
        // if (window.onerror === this._boundErrorHandler) {
        //     window.onerror = this._originalOnError;
        //      console.info("[WebRTCManager] Restored original window.onerror handler.");
        // }
        // this._originalOnError = null; // Clear reference

        // Remove our specific event listener
        window.removeEventListener('error', this._boundErrorHandler);
        console.info("[WebRTCManager] Removed global error event listener via resetState.");

        console.info("[WebRTCManager] State reset complete.");
    }

    /**
     * Handles generic PeerJS object errors.
     * @param {Error & { type?: string }} err - The error object.
     * @param {string} [context='general-peer'] - Context where the error occurred.
     * @private
     */
    _handleError(err, context = 'general-peer') {
        console.error(`[WebRTCManager] PeerJS Error (${context}):`, err);
        let message = err.message || 'Unknown PeerJS Error';
        let type = err.type || 'unknown'; // e.g., 'network', 'peer-unavailable', 'server-error', 'webrtc', 'browser-incompatible'

        this.status = ConnectionStatus.ERROR; // Set error state

        // Emit a standardized event
        eventBus.emit(Events.WebRTC.ConnectionFailed, {
            error: err,
            message: `WebRTC Error (${type}): ${message}`,
            context: context,
            peerId: this.myPeerId // Error relates to our peer object
        });

        // Remove listener on fatal peer errors
        window.removeEventListener('error', this._boundErrorHandler);

        // These errors are usually fatal for the peer object, attempt full cleanup
        console.warn(`[WebRTCManager] Attempting full connection cleanup due to Peer error type: ${type}`);
        // DO NOT call closeConnection here. Let the listener (GameCoordinator) handle cleanup based on the emitted event.
    }

    /**
     * Handles peer disconnection from the PeerServer signaling server.
     * @param {string} context - 'host-disconnected-server' or 'client-disconnected-server'.
     * @private
     */
    _handleDisconnection(context) {
         // Ignore if already disconnected or errored
         if (this.status === ConnectionStatus.DISCONNECTED || this.status === ConnectionStatus.ERROR) return;

         console.warn(`[WebRTCManager] Disconnected from PeerServer (${context}). Peer ID: ${this.myPeerId}`);
         this.status = ConnectionStatus.ERROR; // Treat as error

         eventBus.emit(Events.WebRTC.ConnectionFailed, {
             error: new Error('Disconnected from signaling server.'),
             message: 'Lost connection to signaling server.',
             context: context
         });
         // DO NOT call closeConnection here. Let the listener (GameCoordinator) handle cleanup.
    }


    // --- Player List Management ---

    /** @private Adds or updates a player in the local list. */
    _updatePlayer(peerId, playerData) {
        if (!peerId) return;
        // Ensure basic structure
        const dataToSet = {
            name: playerData.name || this.players.get(peerId).name || 'Unknown', // Preserve name if not provided
            isHost: typeof playerData.isHost === 'boolean' ? playerData.isHost : (this.players.get(peerId).isHost ?? false) // Preserve isHost
        };
        this.players.set(peerId, dataToSet);
         console.debug(`[WebRTCManager] Player updated: ${peerId}`, this.players.get(peerId));
    }

     /** @private Removes a player from the local list. */
    _removePlayer(peerId) {
        if (this.players.has(peerId)) {
            this.players.delete(peerId);
            console.debug(`[WebRTCManager] Player removed: ${peerId}`);
        }
    }

    // --- Messaging ---

    /**
     * @param {object} messageData - The PARSED message object.
     * @param {string} senderPeerId - The PeerJS ID of the sender.
     */
    _emitMessageReceived(messageData, senderPeerId) {
        // Data should already be parsed by the 'data' handler
        if (!messageData || typeof messageData !== 'object') {
            console.error(`[WebRTCManager] _emitMessageReceived called with invalid data from ${senderPeerId}:`, messageData);
            return;
        }

        // --- Intercept Heartbeats --- 
        if (messageData.type === MSG_TYPE.PING) {
            // console.log(`[WebRTCManager] Received PING from ${senderPeerId}`);
            if (this.isHost) {
                // Host updates last contact time for this client
                const oldTime = this._clientLastContact.get(senderPeerId);
                this._clientLastContact.set(senderPeerId, Date.now());
                console.log(`[WebRTC DEBUG Host] Updated last contact for ${senderPeerId} due to PING (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
                // *** ADD PONG RESPONSE ***
                const connection = this.connections.get(senderPeerId); 
                if (connection) { 
                    this.sendMessage(connection, MSG_TYPE.PONG, {}); 
                } else {
                    console.warn(`[WebRTC PONG] Could not send PONG to ${senderPeerId}, connection not found.`);
                }
                // *** END PONG RESPONSE ***
            } else {
                // Client received PING from host, update last contact time
                 const oldTime = this._lastHostContact;
                 this._lastHostContact = Date.now();
                 console.log(`[WebRTC DEBUG Client] Updated last contact from host ${senderPeerId} due to PING (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
                // Client could optionally send PONG back
                // this.sendToHost(MSG_TYPE.PONG, {});
            }
            return; // Don't emit PING messages further
        }
        if (messageData.type === MSG_TYPE.PONG) {
            // console.log(`[WebRTCManager] Received PONG from ${senderPeerId}`);
            if (this.isHost) {
                 const oldTime = this._clientLastContact.get(senderPeerId);
                 this._clientLastContact.set(senderPeerId, Date.now());
                 console.log(`[WebRTC DEBUG Host] Updated last contact for ${senderPeerId} due to PONG (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
            } else {
                 const oldTime = this._lastHostContact;
                 this._lastHostContact = Date.now();
                 console.log(`[WebRTC DEBUG Client] Updated last contact from host ${senderPeerId} due to PONG (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
            }
            return; // Don't emit PONG messages further
        }
        // --- End Heartbeat Interception ---

        // --- ADD DEBUG LOG ---
        console.log(`[WebRTCManager._emitMessageReceived] Preparing to emit message from ${senderPeerId}. Type: ${messageData?.type}`);
        // --- END DEBUG LOG ---

        // --- Update Last Contact on ANY message ---
        // The last contact time is now primarily updated in the 'data' handler (for host)
        // or the 'data' handler (for client) *before* calling this function.
        // However, we still need to update it here for PONG messages (since they return early above)
        // and potentially other internal message types if they were handled directly in `data`.
        // Let's keep the update logic here as a fallback/for clarity, even if redundant for most messages now.
        if (this.isHost) {
             const oldTime = this._clientLastContact.get(senderPeerId);
             // Only update if PING/PONG didn't already (or if it wasn't updated in 'data' handler - safety)
             if (messageData.type !== MSG_TYPE.PING && messageData.type !== MSG_TYPE.PONG) {
                 this._clientLastContact.set(senderPeerId, Date.now());
                 console.log(`[WebRTC DEBUG Host - emit] Updated last contact for ${senderPeerId} due to MSG Type '${messageData?.type}' (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
             }
        } else if (senderPeerId === this.hostId) { // Only update for messages from the host
             const oldTime = this._lastHostContact;
             // Only update if PING/PONG didn't already
             if (messageData.type !== MSG_TYPE.PING && messageData.type !== MSG_TYPE.PONG) {
                this._lastHostContact = Date.now();
                console.log(`[WebRTC DEBUG Client - emit] Updated last contact from host ${senderPeerId} due to MSG Type '${messageData?.type}' (Old: ${oldTime ? new Date(oldTime).toLocaleTimeString() : 'None'}, New: ${new Date(Date.now()).toLocaleTimeString()})`);
             }
        }
        // --- End Last Contact Update ---

        // Emit the PARSED data object
        console.debug(`[WebRTCManager] Emitting WebRTC.MessageReceived from ${senderPeerId}:`, messageData);
        eventBus.emit(Events.WebRTC.MessageReceived, { msg: messageData, sender: senderPeerId });
    }


    /**
     * Sends a message object to a specific peer via a connection.
     * Ensures the payload is stringified.
     * @param {DataConnection} connection - The PeerJS DataConnection.
     * @param {string} type - The message type (e.g., 'game_start').
     * @param {object} [payload={}] - The data payload.
     */
    sendMessage(connection, type, payload = {}) {
        if (!connection) {
             console.warn(`[WebRTCManager] Cannot send message: connection object is null/undefined.`);
             return;
        }
         if (connection.open) {
            const message = { type, payload };
            // *** ADDED DEBUG LOGGING FOR PING ***
            if (type === MSG_TYPE.PING) {
                 console.log(`[WebRTC Send PING] Attempting to send PING to ${connection.peer}`);
            }
            // *** END ADDED DEBUG LOGGING ***
            // console.debug(`[WebRTCManager] Sending to ${connection.peer}:`, message);
            try {
                 // PeerJS handles serialization, but stringify explicitly for safety/consistency
                 connection.send(message); // Send the object directly
            } catch (error) {
                 console.error(`[WebRTCManager] Error sending message to ${connection.peer}:`, error, message);
                  // --- Resilience Check for Broken Connection State --- 
                  const isFlushError = (error instanceof TypeError && error.message.includes("Cannot read properties of undefined (reading 'flush')"));
                  const isInvalidState = (error.name === 'InvalidStateError'); // Common when channel closed unexpectedly

                  if (isFlushError || isInvalidState) {
                       console.warn(`[WebRTCManager] Attempted to send on likely broken/closed channel to ${connection.peer}. Triggering proactive safe close.`);
                       // Attempt safe closure first instead of immediate full disconnect
                       this._safelyCloseDataConnection(connection, 'broken-connection-on-send');
                       // IMPORTANT: Do not proceed to emit ConnectionFailed for this specific case,
                       // as _safelyCloseDataConnection might handle or trigger the necessary events.
                   } else {
                        // For other unexpected send errors, emit a general failure
                 eventBus.emit(Events.WebRTC.ConnectionFailed, { error: error, peerId: connection.peer, context: 'send-message-error', message: `Failed to send message type ${type}` });
                   }
            }
        } else {
            console.warn(`[WebRTCManager] Cannot send message type ${type}, connection to ${connection.peer} is not open.`);
            // Optional: Queue message or emit failure? For now, just warn.
        }
    }

    /** [Host Only] Sends a message object to all connected clients. */
    broadcastMessage(type, payload = {}) {
        if (!this.isHost) {
             console.warn("[WebRTCManager] broadcastMessage called, but not host.");
             return;
        }
        // *** MODIFIED DEBUG LOGGING ***
        console.log(`[WebRTC Broadcast ${type}] Broadcasting to ${this.connections.size} connection(s).`); 
        // *** END MODIFIED DEBUG LOGGING ***
        this.connections.forEach((conn) => { // No need for peerId here
            // *** ADDED DEBUG LOGGING ***
            console.log(`[WebRTC Broadcast ${type}] Sending to peer: ${conn.peer}`);
            // *** END ADDED DEBUG LOGGING ***
            this.sendMessage(conn, type, payload);
        });
    }

     /**
      * Sends a message to the host (used by client).
      * Ensures the instance is a client and connected before sending.
      * @param {string} type - The message type.
      * @param {object} payload - The message payload.
      * @throws {Error} If not connected as a client or connection is not open.
      */
    sendToHost(type, payload = {}) {
        if (this.isHost) {
            console.error("[WebRTCManager] sendToHost called, but this instance is the host.");
            throw new Error("Cannot send to host from host instance.");
        }
        // Use hostId (the 6-digit code) which is the key for the connection map
        if (!this.hostId) {
             console.error("[WebRTCManager] sendToHost called, but not connected to any host.");
            throw new Error("Not connected to host.");
        }
        const hostConnection = this.connections.get(this.hostId);
        // Check state using hostId as well
        if (hostConnection && this.connectionStates.get(this.hostId) === DataConnectionState.OPEN) {
            // console.log(`[WebRTCManager] Sending to Host (${this.hostId}): Type=${type}`, payload);
            try {
                 // Call the internal sendMessage method for consistency and error handling
            this.sendMessage(hostConnection, type, payload);
            } catch (error) {
                 // sendMessage has its own catch block, but add one here just in case sendMessage itself throws
                 console.error(`[WebRTCManager] Unexpected error calling sendMessage within sendToHost for host ${this.hostId}:`, error);
             }
        } else {
             console.error(`[WebRTCManager] sendToHost failed: Connection to host ${this.hostId} not open or not found. State: ${this.connectionStates.get(this.hostId)}`);
            throw new Error(`Connection to host ${this.hostId} is not open.`);
        }
    }

    // --- Getters ---
    getPlayerList() {
        return new Map(this.players); // Return a copy
    }

    getMyPeerId() {
        return this.myPeerId;
    }

     getIsHost() {
         return this.isHost;
     }

     /** Gets the current connection status. */
     getStatus() {
         return this.status;
     }

     /** Gets the ID of the host (if client and connected). */
     getHostId() {
         return this.hostId;
     }

     /** Gets IDs of all currently connected peers (clients for host, host for client). */
     getConnectedPeerIds() {
         return Array.from(this.connections.keys());
     }

    // --- Heartbeat and Timeout Methods ---

    /** [Host Only] Starts broadcasting PING messages to all connected clients. @private */
    _startHostHeartbeatBroadcast() {
        this._clearHeartbeatIntervals(); // Clear previous if any
        console.log(`[${this.constructor.name} Host] Starting PING broadcast interval.`);
        this._pingIntervalId = setInterval(() => {
            // +++ ADDED DEBUG LOG +++
            console.log(`[WebRTCManager Host PING Interval] Tick. Status: ${this.status}, Connections: ${this.connections.size}`);
            // +++ END ADDED DEBUG LOG +++
            if (this.status === ConnectionStatus.AWAITING_CONNECTIONS || this.status === ConnectionStatus.CONNECTED_HOST) {
                 // +++ ADDED DEBUG LOG +++
                 console.log(`[WebRTCManager Host PING Interval] Status OK, attempting broadcast.`);
                 // +++ END ADDED DEBUG LOG +++
                 this.broadcastMessage(MSG_TYPE.PING, {});
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /** [Host Only] Starts checking for client timeouts. @private */
    _startClientTimeoutCheck() {
        this._clearHeartbeatIntervals(); // Clear previous if any
        console.log(`[${this.constructor.name} Host] Starting client timeout check interval.`);
        this._timeoutCheckIntervalId = setInterval(() => {
            const now = Date.now();
            this._clientLastContact.forEach((lastContactTime, peerId) => {
                if (now - lastContactTime > TIMEOUT_MS) {
                    console.warn(`[WebRTCManager Host] Client ${peerId} timed out (Last contact: ${new Date(lastContactTime).toLocaleTimeString()}). Triggering cleanup.`);
                    this._handleClientDisconnection(peerId, DisconnectionReason.TIMEOUT);
                }
            });
        }, HEARTBEAT_INTERVAL_MS); // Check every heartbeat interval
    }

    /** [Client Only] Starts sending PING messages to the host. @private */
    _startClientPing() {
        if (this.isHost || this._pingIntervalId) return; // Only run on client, only start once

        console.log("[WebRTCManager Client] Starting PING interval to host.");
        this._pingIntervalId = setInterval(() => {

             if (this.status === ConnectionStatus.CONNECTED_CLIENT && this.hostId) {
                
              //  console.log(`[WebRTCManager Client PING Interval] Status OK, attempting send to host ${this.hostId}.`);
                this.sendToHost(MSG_TYPE.PING, {}); // Send PING message type
            } else {
                // console.debug("[WebRTCManager Client] Skipping PING (not connected).");
             }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /** [Client Only] Starts checking for host timeout. @private */
    _startHostTimeoutCheck() {
        if (this.isHost || this._timeoutCheckIntervalId) return;
        console.log("[WebRTCManager Client] Starting host timeout check interval.");
        // Clear previous interval if any (safety)
        if (this._timeoutCheckIntervalId) clearInterval(this._timeoutCheckIntervalId);
        // Initialize contact time
        this._lastHostContact = Date.now();

        this._timeoutCheckIntervalId = setInterval(() => {
             if (this.status === ConnectionStatus.CONNECTED_CLIENT) {
                 const now = Date.now();
                 if (now - this._lastHostContact > TIMEOUT_MS) {
                     console.warn(`[WebRTCManager Client] Host timed out (Last contact: ${new Date(this._lastHostContact).toLocaleTimeString()}). Disconnecting.`);
                     this._handleHostDisconnection(DisconnectionReason.TIMEOUT);
                 }
             }
        }, HEARTBEAT_INTERVAL_MS); // Check interval
    }

    /** [Client Only] Pauses the host timeout check interval. */
    pauseHostTimeoutCheck() {
        if (!this.isHost && this._timeoutCheckIntervalId) {
            console.log("[WebRTCManager Client] Pausing host timeout check.");
            clearInterval(this._timeoutCheckIntervalId);
            this._timeoutCheckIntervalId = null;
        }
    }

    /** [Client Only] Resumes the host timeout check interval if paused. */
    resumeHostTimeoutCheck() {
        // Only resume if we are a client, connected, and the interval isn't already running
        if (!this.isHost && this.status === ConnectionStatus.CONNECTED_CLIENT && !this._timeoutCheckIntervalId) {
            console.log("[WebRTCManager Client] Resuming host timeout check.");
            // Re-initialize last contact time to now to avoid immediate timeout after resuming
            this._lastHostContact = Date.now();
            this._startHostTimeoutCheck(); // Re-use the start logic
        }
    }

    /** @private */
    _removePeerListeners() {
        if (this.peer && this._peerListeners.open) {
            Object.entries(this._peerListeners).forEach(([event, listener]) => {
                if (listener) {
                    this.peer.off(event, listener);
                }
            });
            this._peerListeners = {}; // Clear stored listeners
            console.debug("[WebRTCManager] Removed PeerJS listeners.");
        }
    }

    /** @private */
    _clearHeartbeatIntervals() {
        console.log("[WebRTCManager] Clearing heartbeat/timeout intervals.");
        if (this._pingIntervalId) {
            clearInterval(this._pingIntervalId);
            this._pingIntervalId = null;
        }
        if (this._timeoutCheckIntervalId) {
            clearInterval(this._timeoutCheckIntervalId);
            this._timeoutCheckIntervalId = null;
        }
        this._clientLastContact.clear();
        this._lastHostContact = null;
    }

    /**
     * Sends a message to a specific peer (used by host).
     * @param {string} targetPeerId - The PeerJS ID of the recipient.
     * @param {string} type - The message type (e.g., GAME_START).
     * @param {object} payload - The message payload.
     */
    sendToPeer(targetPeerId, type, payload = {}) {
        if (!this.connections || !this.connections.has(targetPeerId)) {
            console.warn(`[WebRTCManager] sendToPeer: No connection found for targetPeerId: ${targetPeerId}. Ignoring.`);
            return;
        }
        const connection = this.connections.get(targetPeerId);
        
        // *** ADDED: try...catch around sendMessage ***
        try {
            // Check if connection exists and appears open before attempting send
            if (connection && connection.open) { 
            this.sendMessage(connection, type, payload);
        } else {
                console.warn(`[WebRTCManager] sendToPeer: Connection to ${targetPeerId} not open or ready. State: ${connection?.readyState}. Ignoring send.`);
                // Optionally trigger cleanup if connection is unexpectedly closed
                if (connection && connection.readyState !== 'connecting' && connection.readyState !== 'open') {
                    this._handleClientDisconnection(targetPeerId, 'send_fail_not_open');
                }
            }
        } catch (error) {
            console.error(`[WebRTCManager] sendToPeer: Error sending message to ${targetPeerId}. Type: ${type}. Error:`, error);
            // Attempt cleanup for the problematic connection
            this._handleClientDisconnection(targetPeerId, 'send_fail_exception'); 
        }
        // *** END try...catch ***
    }

    /**
     * Initiates the data connection to the specified host ID.
     * Sets up listeners for the connection lifecycle.
     * @param {string} targetHostId The 6-digit host ID to connect to.
     * @private
     */
    _attemptHostConnection(targetHostId) {
         if (this.status !== ConnectionStatus.INITIALIZING_PEER || !this.peer) {
             console.error("[WebRTCManager] Cannot attempt host connection, invalid state or PeerJS not ready.");
             this.status = ConnectionStatus.ERROR;
             this._handleError(new Error("Attempted connection with invalid state/peer"), 'client-attempt-invalid-state');
             return;
         }
         console.log(`[WebRTCManager] Attempting to connect to host ${targetHostId} (using 6-digit ID)...`);
         this.status = ConnectionStatus.CONNECTING_TO_HOST;

        try {
             // Use the stored player name for the initial (but unused by host) metadata
             // Host relies on the 'client_hello' message instead.
             const conn = this.peer.connect(targetHostId, {
                 reliable: true,
                 // metadata: { name: this.localPlayerName } // Metadata less critical now
             });

             console.log(`[WebRTC Client] Created connection object for host ${targetHostId}:`, conn);

             if (!conn) {
                  throw new Error("Peer.connect() returned undefined. Host ID likely invalid or PeerServer issue.");
             }

              this.status = ConnectionStatus.CONNECTION_PENDING;
              this.connections.set(targetHostId, conn);
              this.connectionStates.set(targetHostId, DataConnectionState.OPENING);

              // Setup listeners for this specific connection
              const connListeners = {
                  open: () => {
                      if (this.status !== ConnectionStatus.CONNECTION_PENDING) {
                           console.warn(`[WebRTCManager] Host connection 'open' event received in unexpected state: ${this.status}.`);
                           return;
                      }
                      if (!this.hostId) {
                          console.error("[WebRTCManager] Critical error: Connection opened but hostId is not set!");
                          this._handleHostDisconnection(DisconnectionReason.INTERNAL_ERROR);
                          return;
                      }
                      console.log(`[WebRTCManager] Data connection opened with host: ${targetHostId}`);
                      this.status = ConnectionStatus.CONNECTED_CLIENT;
                      this.connectionStates.set(this.hostId, DataConnectionState.OPEN);
                      this.hostPeerId = targetHostId; // Store the actual host ID we connected to

                      // Send explicit hello message with name
                      console.log(`[WebRTC Client] Sending client_hello with name: ${this.localPlayerName}`);
                      this.sendMessage(conn, 'client_hello', { name: this.localPlayerName });

                      // Emit connection success event and start heartbeats
                      eventBus.emit(Events.Multiplayer.Client.ConnectedToHost, { hostId: targetHostId });
                      this._startClientPing();
                      this._startHostTimeoutCheck();
                  },
                  data: (rawData) => {
                      const senderPeerId = targetHostId; // For client, sender is always the host
                       // Wrap the entire handler content in a try-catch for robustness
                      try {
                           console.log(`%c[WebRTC RAW Client] Received data from host ${senderPeerId}:`, 'color: orange; font-weight: bold;', rawData);
                          let messageData;
                          try {
                              if (typeof rawData === 'string') {
                                  messageData = JSON.parse(rawData);
                              } else if (typeof rawData === 'object' && rawData !== null) {
                                  messageData = rawData;
                              } else {
                                  console.error(`[WebRTCManager Client] Received unexpected data type from ${senderPeerId}: ${typeof rawData}`, rawData);
                                  return; // Ignore unexpected types
                              }
                          } catch (parseError) {
                               console.error(`[WebRTCManager Client] Failed to parse message JSON string in 'data' handler from ${senderPeerId}:`, parseError, rawData);
                              this._handleHostDisconnection(DisconnectionReason.MESSAGE_PARSE_ERROR);
                              return; // Stop processing if string parsing fails
                          }
                           // Update last contact time immediately after receiving/parsing any valid data structure
                           this._lastHostContact = Date.now();
                           console.log(`[WebRTC DEBUG Client] Updated last contact for host ${senderPeerId} at start of data handler (Time: ${new Date().toLocaleTimeString()})`);

                           // Pass the PARSED/validated data to the emit handler
                           this._emitMessageReceived(messageData, senderPeerId);
                      } catch(outerError) {
                           console.error(`[WebRTCManager Client] Unexpected error in host 'data' handler:`, outerError);
                           this._handleHostDisconnection(DisconnectionReason.DATA_HANDLER_ERROR);
                      }
                  },
                  close: () => this._handleHostDisconnection(DisconnectionReason.CLOSED_BY_REMOTE),
                  error: (err) => {
                      console.warn(`[WebRTCManager] Connection error with host ${targetHostId}:`, err);
                       // Specific error for unavailable peer ID
                      if (err.type === 'peer-unavailable') {
                           console.error(`[WebRTCManager] Host ID ${targetHostId} not found on PeerServer.`);
                           eventBus.emit(Events.WebRTC.ConnectionFailed, { error: err, peerId: targetHostId, context: 'client-connect-not-found', message: miscUtils.getTextTemplate('rtcErrorHostNotFound') });
                           this._handleHostDisconnection(DisconnectionReason.PEER_UNAVAILABLE);
                      } else {
                           eventBus.emit(Events.WebRTC.ConnectionFailed, { error: err, peerId: targetHostId, context: 'client-conn-error', message: err.message });
                           this._handleHostDisconnection(DisconnectionReason.CONNECTION_ERROR);
                      }
                  }
              };
              this._connectionListeners.set(targetHostId, connListeners);

              conn.on('open', connListeners.open);
              conn.on('data', connListeners.data);
              conn.on('close', connListeners.close);
              conn.on('error', connListeners.error);

         } catch (error) {
              console.error(`[WebRTCManager] Failed to initiate connection to host ${targetHostId}:`, error);
              eventBus.emit(Events.WebRTC.ConnectionFailed, { error, peerId: targetHostId, context: 'client-connect-initiate', message: error.message });
              this.status = ConnectionStatus.ERROR;
         }
    }
}


// --- Singleton Instance ---
const webRTCManager = new WebRTCManager();
// Ensure PeerJS is loaded before initialization attempts if using global script
// Consider adding a check or delay if needed.
export default webRTCManager; 