import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
// Assuming PeerJS is loaded globally or correctly imported as 'Peer'
// import Peer from '../lib/peerjs.min.js'; // Keep if using module

// Internal message type constants
const MSG_TYPE = {
    PING: '__ping__',
    PONG: '__pong__',
    ERROR: 'error',
    PLAYER_INFO: 'player_info', // Note: Use primarily for metadata now
    GAME_INFO: 'game_info',
    PLAYER_LIST_UPDATE: 'player_list_update',
    PLAYER_LEFT: 'player_left', // Might be redundant if PlayerListUpdated covers it
    // Game messages - defined here for reference, sent BY callers
    GAME_START: 'game_start',
    GAME_STATE_UPDATE: 'game_state_update',
    PLAYER_ACTION: 'player_action',
    PLAYER_FINISHED: 'player_finished',
    CONNECTION_ERROR: 'error' // Simplified status
};

// Connection states for clarity
const ConnectionStatus = {
    DISCONNECTED: 'disconnected',
    INITIALIZING_PEER: 'initializing-peer',
    AWAITING_CONNECTIONS: 'awaiting-connections', // Host ready
    CONNECTING_TO_HOST: 'connecting-to-host',
    CONNECTION_PENDING: 'connection-pending', // Client initiated, waiting for 'open'
    CONNECTED_HOST: 'connected-host',
    CONNECTED_CLIENT: 'connected-client',
    ERROR: 'error'
};

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
        /** @type {string | null} Our own PeerJS ID. */
        this.myPeerId = null;
        /** @type {Map<string, Peer.DataConnection>} Map<peerId, DataConnection> - Host: clients, Client: host */
        this.connections = new Map();
        /** @type {Map<string, { name?: string, isHost: boolean }>} Minimal player info needed by WebRTCManager (name from metadata) */
        this.players = new Map();
        /** @type {string} The local player's name. */
        // Use template for default anonymous name
        this.localPlayerName = getTextTemplate('rtcDefaultAnon');
        /** @type {boolean} Whether this instance is acting as the host. */
        this.isHost = false;
        /** @type {object | null} Temporary storage for host game settings (use with caution). */
        this.pendingHostSettings = null;
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


        console.info("[WebRTCManager] Initialized.");
    }

    // --- Host Functionality ---

    /**
     * Initializes this peer as the host.
     * @param {string} playerName - The host's chosen name.
     * @param {object} settings - Initial game settings (optional, can be sent later).
     * @throws {Error} If already connected or initializing.
     */
    startHost(playerName, settings) {
        console.log(`[WebRTCManager] Attempting to start Host. Player: ${playerName}`, { settings });
        if (this.status !== ConnectionStatus.DISCONNECTED && this.status !== ConnectionStatus.ERROR) {
             const message = `[WebRTCManager] Cannot start host, current status is ${this.status}. Call closeConnection() first.`;
             console.error(message);
             throw new Error(message);
        }
        this.resetState(); // Ensure clean state before starting
        this.status = ConnectionStatus.INITIALIZING_PEER;
        this.isHost = true;
        this.localPlayerName = playerName;
        this.pendingHostSettings = settings || {}; // Store settings if provided

        try {
            // Ensure Peer is available (global or imported)
            if (typeof Peer === 'undefined') {
                // Use template for this user-facing error
                throw new Error(getTextTemplate('rtcErrorPeerJSLoad'));
            }

            this.peer = new Peer({ debug: 2 }); // Adjust debug level as needed (0-3)

            // Store bound listeners for later removal
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
            this.resetState(); // Ensure cleanup on creation failure
        }
    }

    /**
     * @private
     * @param {string} id The host PeerJS ID.
     */
    _handleHostOpen(id) {
        if (this.status !== ConnectionStatus.INITIALIZING_PEER) return; // Prevent handling if state changed
        console.log(`[WebRTCManager] Host PeerJS established. Host ID: ${id}`);
        this.myPeerId = id;
        this.status = ConnectionStatus.AWAITING_CONNECTIONS;
        // Add self to player list immediately
        this._updatePlayer(id, { name: this.localPlayerName, isHost: true });
        eventBus.emit(Events.Multiplayer.Host.Initialized, { hostId: id });
        // Let GameCoordinator or HostLobby trigger initial player list broadcast if needed

        // Start heartbeat mechanisms for the host
        this._startHostHeartbeatBroadcast();
        this._startClientTimeoutCheck();
    }

    /**
     * @private
     * @param {Peer.DataConnection} connection The incoming client connection.
     */
    _handleClientConnection(connection) {
        const peerId = connection.peer;
        const clientName = connection.metadata.name || `Client_${peerId.slice(-4)}`; // Use metadata or generate temp name
        console.log(`[WebRTCManager] Incoming connection request from: ${peerId} (${clientName})`);

        // Prevent duplicate connections from same peer ID if one is already open/pending
        if (this.connections.has(peerId)) {
            console.warn(`[WebRTCManager] Duplicate connection attempt from ${peerId}. Closing new attempt.`);
            connection.close();
            return;
        }

        // Store connection immediately to track pending state
        this.connections.set(peerId, connection);

        // Store bound listeners for this specific connection
        const connListeners = {
            open: () => {
                console.log(`[WebRTCManager] Data connection opened with client: ${peerId} (${clientName})`);
                // Connection is fully open, add player formally
                this._updatePlayer(peerId, { name: clientName, isHost: false });

                // Initialize last contact time for timeout check
                this._clientLastContact.set(peerId, Date.now());

                // Send Game Info to the newly connected client
                if (this.isHost) {
                     this._sendGameInfoToClient(connection);
                }

                // Emit ClientConnected *after* adding player and sending info
                eventBus.emit(Events.Multiplayer.Host.ClientConnected, { peerId, playerName: clientName });
                // Host game logic should now trigger broadcasting the updated player list
            },
            data: (data) => this._emitMessageReceived(data, peerId),
            close: () => this._handleClientDisconnection(peerId, 'closed'),
            error: (err) => {
                 console.warn(`[WebRTCManager] Connection error with client ${peerId}:`, err);
                 this._handleClientDisconnection(peerId, 'error');
                 eventBus.emit(Events.WebRTC.ConnectionFailed, { error: err, peerId: peerId, context: 'host-client-conn-error', message: err.message });
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
        // Use current player list and potentially stored settings
        const gameInfoPayload = {
            settings: this.pendingHostSettings || {}, // Send pending settings
            players: Object.fromEntries(this.players), // Send current player list as object
            hostId: this.myPeerId
        };
        console.log(`[WebRTCManager] Sending GAME_INFO to client ${connection.peer}`, gameInfoPayload);
        this.sendMessage(connection, MSG_TYPE.GAME_INFO, gameInfoPayload);
    }

    /**
     * [Host Only] Closes connection to a specific client.
     * @param {string} peerId The ID of the client to disconnect.
     */
    closeClientConnection(peerId) {
        if (!this.isHost) {
            console.warn("[WebRTCManager] closeClientConnection called, but not host.");
            return;
        }
        const connection = this.connections.get(peerId);
        if (connection) {
             console.log(`[WebRTCManager] Host closing connection with client: ${peerId}`);
             connection.close(); // This should trigger the 'close' event handler (_handleClientDisconnection)
        } else {
             console.warn(`[WebRTCManager] Host cannot close connection: No connection found for client ${peerId}.`);
             // If connection doesn't exist, ensure player is removed from list if they are there
             if (this.players.has(peerId)) {
                 this._handleClientDisconnection(peerId, 'force-remove');
             }
        }
    }

    /**
     * @private
     * @param {string} peerId The ID of the disconnecting client.
     * @param {string} reason The reason for disconnection ('closed', 'error', 'force-remove').
     */
    _handleClientDisconnection(peerId, reason = 'unknown') {
        console.log(`[WebRTCManager] Client ${peerId} disconnected. Reason: ${reason}`);
        const wasConnected = this.connections.has(peerId);
        const connection = this.connections.get(peerId);

        // Remove listeners associated with this connection
        const connListeners = this._connectionListeners.get(peerId);
        if (connection && connListeners) {
            connection.off('open', connListeners.open);
            connection.off('data', connListeners.data);
            connection.off('close', connListeners.close);
            connection.off('error', connListeners.error);
            this._connectionListeners.delete(peerId);
        }

        // Ensure connection is closed if initiated locally
        if (connection && connection.open && reason !== 'closed') {
             connection.close();
        }
        this.connections.delete(peerId);

        const playerExisted = this.players.has(peerId);
        if (playerExisted) {
            this._removePlayer(peerId);
            // Emit PlayerLeft for game logic FIRST
            eventBus.emit(Events.Multiplayer.Common.PlayerLeft, { peerId });
        }
        // Emit Host.ClientDisconnected *after* Common.PlayerLeft
        if (wasConnected || playerExisted) { // Only emit if they were actually connected/known
            eventBus.emit(Events.Multiplayer.Host.ClientDisconnected, { peerId });
        }
        // The game logic (listening to PlayerLeft) should now trigger broadcasting the updated player list
    }

    // --- Client Functionality ---

    /**
     * Initializes this peer as a client and attempts to connect to a host.
     * @param {string} hostPeerId - The ID of the host to connect to.
     * @param {string} playerName - This client's chosen name.
     * @throws {Error} If already connected or initializing.
     */
    connectToHost(hostPeerId, playerName) {
        console.log(`[WebRTCManager] Attempting to connect to Host: ${hostPeerId}, Player: ${playerName}`);
        if (!hostPeerId) {
             throw new Error("[WebRTCManager] Cannot connect to host: hostPeerId is required.");
        }
        if (this.status !== ConnectionStatus.DISCONNECTED && this.status !== ConnectionStatus.ERROR) {
            const message = `[WebRTCManager] Cannot connect to host, current status is ${this.status}. Call closeConnection() first.`;
            console.error(message);
            throw new Error(message);
        }
        this.resetState(); // Ensure clean state
        this.status = ConnectionStatus.INITIALIZING_PEER;
        this.isHost = false;
        this.localPlayerName = playerName;
        this.hostId = hostPeerId; // Store target host ID

        try {
             // Ensure Peer is available
            if (typeof Peer === 'undefined') {
                throw new Error('PeerJS library not loaded.');
            }
            this.peer = new Peer({ debug: 2 });

             // Store bound listeners for later removal
            this._peerListeners.open = (id) => {
                 console.log(`[WebRTCManager] Client PeerJS established. Client ID: ${id}`);
                 this.myPeerId = id;
                 // Add self to player list immediately
                 this._updatePlayer(this.myPeerId, { name: this.localPlayerName, isHost: false });
                 this._attemptHostConnection(hostPeerId); // Connect now that we have our ID
            };
            this._peerListeners.error = (err) => this._handleError(err, 'client-peer');
            this._peerListeners.disconnected = () => this._handleDisconnection('client-disconnected-server');
            this._peerListeners.close = () => console.log('[WebRTCManager] Client Peer instance closed.');

            this.peer.on('open', this._peerListeners.open);
            this.peer.on('error', this._peerListeners.error);
            this.peer.on('disconnected', this._peerListeners.disconnected);
            this.peer.on('close', this._peerListeners.close);
            // Client doesn't listen for incoming 'connection'

        } catch (error) {
            console.error("[WebRTCManager] Error creating client PeerJS instance:", error);
            eventBus.emit(Events.WebRTC.ConnectionFailed, { error, context: 'client-peer-creation', message: error.message });
            this.status = ConnectionStatus.ERROR;
            this.resetState();
        }
    }

    /**
     * @private
     * @param {string} targetHostId The host ID to connect to.
     */
    _attemptHostConnection(targetHostId) {
         if (this.status !== ConnectionStatus.INITIALIZING_PEER || !this.peer) {
             console.error("[WebRTCManager] Cannot attempt host connection, invalid state or PeerJS not ready.");
             this.status = ConnectionStatus.ERROR;
             return;
         }
         console.log(`[WebRTCManager] Attempting to connect to host ${targetHostId}...`);
         this.status = ConnectionStatus.CONNECTING_TO_HOST;

        try {
            // Send player name in metadata for immediate use by host
            const conn = this.peer.connect(targetHostId, {
                reliable: true,
                metadata: { name: this.localPlayerName }
            });

            if (!conn) {
                 throw new Error("Peer.connect() returned undefined. Host ID likely invalid or PeerServer issue.");
            }

             this.status = ConnectionStatus.CONNECTION_PENDING;
             this.connections.set(targetHostId, conn); // Store connection immediately

             // Store bound listeners for this specific connection
             const connListeners = {
                 open: () => {
                     if (this.status !== ConnectionStatus.CONNECTION_PENDING) return; // Already handled/closed?
                     console.log(`[WebRTCManager] Data connection opened with host: ${targetHostId}`);
                     this.status = ConnectionStatus.CONNECTED_CLIENT;
                     // Host info should arrive via GAME_INFO message
                     eventBus.emit(Events.Multiplayer.Client.ConnectedToHost, { hostId: targetHostId });
                     // Client does NOT send PLAYER_INFO automatically, host uses metadata
                 },
                 data: (data) => this._emitMessageReceived(data, targetHostId),
                 close: () => this._handleHostDisconnection('closed'),
                 error: (err) => {
                     console.warn(`[WebRTCManager] Connection error with host ${targetHostId}:`, err);
                     // Emit failure event before handling disconnect
                     eventBus.emit(Events.WebRTC.ConnectionFailed, { error: err, peerId: targetHostId, context: 'client-conn-error', message: err.message });
                     this._handleHostDisconnection('error');
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
             // Don't reset full state here, maybe retry? For now, just error state.
        }
    }

     /**
      * @private
      * @param {string} reason The reason for disconnection ('closed', 'error').
      */
    _handleHostDisconnection(reason = 'unknown') {
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
        if (connection && connection.open && reason !== 'closed') {
            connection.close();
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
        console.log("[WebRTCManager] Closing connection and destroying PeerJS instance...");
        if (!this.peer) {
             console.log("[WebRTCManager] Already closed or never initialized.");
             this.resetState(); // Ensure state is clean anyway
             return;
        }

        // 1. Close all active DataConnections
        this.connections.forEach((conn, peerId) => {
            console.log(`[WebRTCManager] Closing connection with ${peerId}`);
             // Remove listeners BEFORE closing to prevent triggering handlers during cleanup
            const connListeners = this._connectionListeners.get(peerId);
            if (conn && connListeners) {
                conn.off('open', connListeners.open);
                conn.off('data', connListeners.data);
                conn.off('close', connListeners.close);
                conn.off('error', connListeners.error);
            }
            if (conn.open) { // Check if connection exists and is open
                conn.close();
            }
        });
        this.connections.clear();
        this._connectionListeners.clear();


        // 2. Remove listeners from Peer object
        if (this.peer && !this.peer.destroyed) {
             if (this._peerListeners.open) this.peer.off('open', this._peerListeners.open);
             if (this._peerListeners.connection) this.peer.off('connection', this._peerListeners.connection);
             if (this._peerListeners.error) this.peer.off('error', this._peerListeners.error);
             if (this._peerListeners.disconnected) this.peer.off('disconnected', this._peerListeners.disconnected);
             if (this._peerListeners.close) this.peer.off('close', this._peerListeners.close);
        }
         this._peerListeners = {}; // Clear stored listeners


        // 3. Destroy the Peer object
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
            console.log("[WebRTCManager] Peer instance destroyed.");
        } else {
            console.log("[WebRTCManager] Peer instance already destroyed or null.");
        }

        // 4. Reset internal state
        this.resetState();
    }

    /** Resets the manager's state variables. */
    resetState() {
        // console.log("[WebRTCManager] Resetting state..."); // Called frequently, maybe make debug level
        this.peer = null;
        this.hostId = null;
        this.myPeerId = null;
        this.connections.clear();
        this.players.clear();
        this.localPlayerName = getTextTemplate('rtcDefaultAnon');
        this.isHost = false;
        this.pendingHostSettings = null;
        this.status = ConnectionStatus.DISCONNECTED;
         this._peerListeners = {};
         this._connectionListeners.clear();
        this._removePeerListeners(); // Remove listeners before potentially destroying peer
        this._clearHeartbeatIntervals(); // Stop pinging and timeout checks
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

        // These errors are usually fatal for the peer object, attempt full cleanup
        console.warn(`[WebRTCManager] Attempting full connection cleanup due to Peer error type: ${type}`);
        this.closeConnection();
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
         this.closeConnection(); // Clean up everything
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
     * @private
     * @param {any} rawData - The received data.
     * @param {string} senderPeerId - The PeerJS ID of the sender.
     */
    _emitMessageReceived(rawData, senderPeerId) {
        // --- Intercept Heartbeats --- 
        if (rawData && rawData.type === MSG_TYPE.PING) {
            // console.log(`[WebRTCManager] Received PING from ${senderPeerId}`);
            if (this.isHost) {
                // Host updates last contact time for this client
                this._clientLastContact.set(senderPeerId, Date.now());
                // Host could optionally send PONG back, but periodic PING broadcast might be sufficient
                // this.sendMessageById(senderPeerId, MSG_TYPE.PONG, {}); 
            } else {
                // Client received PING from host, update last contact time
                this._lastHostContact = Date.now();
                // Client could optionally send PONG back
                // this.sendToHost(MSG_TYPE.PONG, {});
            }
            return; // Don't emit PING messages further
        }
        if (rawData && rawData.type === MSG_TYPE.PONG) {
            // console.log(`[WebRTCManager] Received PONG from ${senderPeerId}`);
            if (this.isHost) {
                this._clientLastContact.set(senderPeerId, Date.now());
            } else {
                this._lastHostContact = Date.now();
            }
            return; // Don't emit PONG messages further
        }
        // --- End Heartbeat Interception ---

        // --- Update Last Contact on ANY message --- 
        if (this.isHost) {
            this._clientLastContact.set(senderPeerId, Date.now());
        } else if (senderPeerId === this.hostId) { // Only update for messages from the host
            this._lastHostContact = Date.now();
        }
        // --- End Last Contact Update ---

        console.debug(`[WebRTCManager] Emitting WebRTC.MessageReceived from ${senderPeerId}:`, rawData);
        eventBus.emit(Events.WebRTC.MessageReceived, { msg: rawData, sender: senderPeerId });
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
            // console.debug(`[WebRTCManager] Sending to ${connection.peer}:`, message);
            try {
                 // PeerJS handles serialization, but stringify explicitly for safety/consistency
                 connection.send(JSON.stringify(message));
            } catch (error) {
                 console.error(`[WebRTCManager] Error sending message to ${connection.peer}:`, error, message);
                 // More robust error check
                 if (error.message.includes("closed") || error.message.includes("Closing")) {
                      console.warn(`[WebRTCManager] Attempted to send on closed channel to ${connection.peer}. Triggering disconnect.`);
                     if (this.isHost) this._handleClientDisconnection(connection.peer, 'send-error-closed');
                     else this._handleHostDisconnection('send-error-closed');
                 }
                 // Maybe emit a specific send error event?
                 eventBus.emit(Events.WebRTC.ConnectionFailed, { error: error, peerId: connection.peer, context: 'send-message-error', message: `Failed to send message type ${type}` });
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
        // console.debug(`[WebRTCManager] Broadcasting type ${type}:`, payload );
        this.connections.forEach((conn) => { // No need for peerId here
            this.sendMessage(conn, type, payload);
        });
    }

     /** [Client Only] Sends a message object to the host. */
    sendToHost(type, payload = {}) {
        if (this.isHost || !this.hostId) {
            console.warn("[WebRTCManager] Cannot sendToHost - not a client or no host ID.");
            return;
        }
        const hostConnection = this.connections.get(this.hostId);
        if (hostConnection) {
            this.sendMessage(hostConnection, type, payload);
        } else {
            console.warn(`[WebRTCManager] Cannot sendToHost type ${type} - connection to host ${this.hostId} not found or not open.`);
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

    /** [Host Only] Starts broadcasting PING messages to all clients. @private */
    _startHostHeartbeatBroadcast() {
        if (!this.isHost || this._pingIntervalId) return;
        console.log("[WebRTCManager Host] Starting PING broadcast interval.");
        this._pingIntervalId = setInterval(() => {
            if (this.status === ConnectionStatus.AWAITING_CONNECTIONS || this.status === ConnectionStatus.CONNECTED_HOST) {
                 this.broadcastMessage(MSG_TYPE.PING, {});
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /** [Host Only] Starts checking for client timeouts. @private */
    _startClientTimeoutCheck() {
        if (!this.isHost || this._timeoutCheckIntervalId) return;
        console.log("[WebRTCManager Host] Starting client timeout check interval.");
        // Clear map initially? No, keep potentially existing times from new connections.

        this._timeoutCheckIntervalId = setInterval(() => {
            const now = Date.now();
            // Check only currently established connections
            this.connections.forEach((connection, peerId) => {
                const lastContact = this._clientLastContact.get(peerId);
                if (!lastContact) {
                    // If connection exists but no contact time, initialize it (should be set on open)
                    console.warn(`[WebRTCManager Host Timeout Check] Initializing missing contact time for client ${peerId}`);
                    this._clientLastContact.set(peerId, now);
                } else if (now - lastContact > TIMEOUT_MS) {
                    console.warn(`[WebRTCManager Host] Client ${peerId} timed out (Last contact: ${new Date(lastContact).toLocaleTimeString()}). Disconnecting.`);
                    this._handleClientDisconnection(peerId, 'timeout'); // Use internal handler
                }
            });

            // Clean up entries in _clientLastContact for peers that are no longer connected
            const connectedIds = new Set(this.connections.keys());
            this._clientLastContact.forEach((timestamp, peerId) => {
                 if (!connectedIds.has(peerId)) {
                     console.debug(`[WebRTCManager Host Timeout Check] Removing timeout tracking for disconnected client ${peerId}`);
                     this._clientLastContact.delete(peerId);
                 }
            });

        }, HEARTBEAT_INTERVAL_MS); // Check interval
    }

    /** [Client Only] Starts sending PING messages to the host. @private */
    _startClientPing() {
        if (this.isHost || this._pingIntervalId) return;
        console.log("[WebRTCManager Client] Starting PING interval to host.");
        this._pingIntervalId = setInterval(() => {
             if (this.status === ConnectionStatus.CONNECTED_CLIENT) {
                 this.sendToHost(MSG_TYPE.PING, {});
             }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /** [Client Only] Starts checking for host timeouts. @private */
    _startHostTimeoutCheck() {
        if (this.isHost || this._timeoutCheckIntervalId) return;
        console.log("[WebRTCManager Client] Starting host timeout check interval.");
        this._lastHostContact = Date.now(); // Initialize contact time

        this._timeoutCheckIntervalId = setInterval(() => {
             if (this.status !== ConnectionStatus.CONNECTED_CLIENT) {
                 // If not connected, stop checking (might have been disconnected)
                 this._clearHeartbeatIntervals(); // Stop all intervals
                 return;
             }

            const now = Date.now();
            if (now - this._lastHostContact > TIMEOUT_MS) {
                console.error(`[WebRTCManager Client] Host ${this.hostId} timed out! Last contact: ${new Date(this._lastHostContact).toLocaleTimeString()}`);
                this._handleHostDisconnection('timeout'); // Use internal handler
                // _handleHostDisconnection calls resetState which clears intervals
            }
        }, HEARTBEAT_INTERVAL_MS); // Check interval
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
}


// --- Singleton Instance ---
const webRTCManager = new WebRTCManager();
// Ensure PeerJS is loaded before initialization attempts if using global script
// Consider adding a check or delay if needed.
export default webRTCManager; 