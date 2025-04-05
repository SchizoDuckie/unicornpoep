/**
 * Manages WebRTC peer-to-peer communication for multiplayer functionality.
 */
class WebRTCManager {
    /**
     * Initializes a new WebRTC manager instance.
     * @param {Game} game - Reference to the main game instance.
     */
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.connectionCode = null;
        this.disconnectedByUser = false;
        
        console.log("WebRTCManager initialized");
    }
    
    /**
     * Initializes this client as the host for a connection.
     */
    async initializeAsHost() {
        this.isHost = true;
        this.game.isHost = true;
        
        // Generate a random 6-letter connection code
        this.connectionCode = this.generateConnectionCode();
        console.log(`Generated connection code: ${this.connectionCode}`);
        
        // Create a new Peer with the connection code as ID
        this.peer = new Peer(this.connectionCode, {
            debug: 2 // Enable extensive logging
        });
        
        // Handle peer opening
        this.peer.on('open', (id) => {
            console.log(`Peer opened with ID: ${id}`);
            // ID should match our connection code
            if (id !== this.connectionCode) {
                console.warn(`Peer ID (${id}) doesn't match connection code (${this.connectionCode})`);
            }
        });
        
        // Handle incoming connections
        this.peer.on('connection', (conn) => {
            console.log(`Incoming connection from: ${conn.peer}`);
            
            // Store the connection
            this.connection = conn;
            
            // Set up the connection handlers
            this.setupConnection();
        });
        
        // Handle peer errors
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection error: ' + err);
        });
        
        return this.connectionCode;
    }
    
    /**
     * Connects to a host using their connection code.
     * @param {string} code - The connection code provided by the host.
     */
    async connectToHost(code) {
        this.isHost = false;
        this.game.isHost = false;
        this.connectionCode = code;
        console.log(`Attempting to connect to host with code: ${code}`);
        
        // Create a new peer
        this.peer = new Peer(null, {
            debug: 2 // Enable extensive logging
        });
        
        // Handle peer opening
        this.peer.on('open', (id) => {
            console.log(`My peer ID: ${id}`);
            
            // Connect to the host
            console.log(`Connecting to host: ${code}`);
            this.connection = this.peer.connect(code, {
                reliable: true
            });
            
            // Set up the connection handlers
            this.connection.on('open', () => {
                console.log(`Connection to ${code} opened!`);
                this.setupConnection();
                
                // Tell the game the connection is established
                this.game.handleConnectionEstablished();
            });
            
            this.connection.on('error', (err) => {
                console.error('Connection error:', err);
                alert('Connection error: ' + err);
            });
        });
        
        // Handle peer errors
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            alert('Connection error: ' + err);
        });
    }
    
    /**
     * Sets up event handlers for the connection.
     * @private
     */
    setupConnection() {
        if (!this.connection) {
            console.error('No connection to set up');
            return;
        }
        
        // Handle connection open
        this.connection.on('open', () => {
            console.log(`Connection opened to: ${this.connection.peer}`);
            
            // Tell the game the connection is established
            if (this.isHost) {
                this.game.handleConnectionEstablished();
            }
        });
        
        // Handle incoming data
        this.connection.on('data', (data) => {
            console.log('Received data:', data);
            
            try {
                // Parse the data if it's JSON
                const message = typeof data === 'object' ? data : JSON.parse(data);
                
                // Handle different message types
                switch (message.type) {
                    case 'answer':
                        console.log(`Opponent answered: ${message.answer}`);
                        this.game.handleOpponentAnswer(message.answer);
                        break;
                    case 'score':
                        console.log(`Opponent score update: ${message.score}`);
                        this.game.opponentScore = message.score;
                        this.game.opponentName = message.playerName || this.game.opponentName || 'Speler 2';
                        this.game.ui.updateOpponentScore(message.score);
                        break;
                    case 'ready':
                        console.log('Opponent is ready for next question');
                        this.game.handleOpponentReady();
                        break;
                    case 'gameSetup':
                        this.game.handleGameSetup(message);
                        break;
                    case 'timerSyncRequest':
                        if (this.isHost) {
                            const timeRemaining = this.game.timer?.getRemainingTime();
                            this.sendMessage({ 
                                type: 'timerSync',
                                remaining: timeRemaining,
                                timestamp: Date.now()
                            });
                        }
                        break;
                    case 'timerSync':
                        if (!this.isHost) {
                            const latency = Date.now() - message.timestamp;
                            const adjustedRemaining = message.remaining - latency;
                            this.game.timer?.sync(adjustedRemaining);
                        }
                        break;
                    case 'playerInfo':
                        console.log(`Received player info: ${message.name}`);
                        this.game.handlePlayerInfo(message);
                        break;
                    case 'gameEnd':
                        console.log(`Game ended. Scores: ${message.hostScore} vs ${message.clientScore}`);
                        console.log(`Player names: ${message.hostName} vs ${message.clientName}`);
                        
                        // Set the scores and names correctly based on whether we're host or client
                        if (this.isHost) {
                            this.game.score = message.hostScore;
                            this.game.opponentScore = message.clientScore;
                            this.game.playerName = message.hostName;
                            this.game.opponentName = message.clientName;
                        } else {
                            this.game.score = message.clientScore;
                            this.game.opponentScore = message.hostScore;
                            this.game.playerName = message.clientName;
                            this.game.opponentName = message.hostName;
                        }
                        
                        // End the game
                        this.game.endMultiplayerGame();
                        break;
                    case 'userQuit':
                        console.log('Opponent quit the game intentionally');
                        // The other user chose to quit, handle gracefully without showing disconnect message
                        this.game.handleOpponentQuit();
                        break;
                    default:
                        console.warn(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                console.error('Error processing message:', error);
                console.log('Raw data received:', data);
            }
        });
        
        // Handle connection close
        this.connection.on('close', () => {
            console.log('Connection closed by peer', this.disconnectedByUser ? '(local user initiated)' : '');
            
            // Only trigger disconnection if it was unexpected
            if (!this.disconnectedByUser && this.game.isMultiplayer) {
                this.handleDisconnection('Verbinding verbroken');
            }
        });
        
        // Handle connection errors
        this.connection.on('error', (err) => {
            console.error('Connection error:', err);
            
            // Only trigger disconnection if it was unexpected
            if (!this.disconnectedByUser && this.game.isMultiplayer) {
                this.handleDisconnection('Verbindingsfout: ' + err);
            }
        });
        
        // Add event handlers to the peer itself
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.handleDisconnection('Verbinding verbroken');
        });
        
        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            this.handleDisconnection('Netwerkfout: ' + err);
        });
    }
    
    /**
     * Handles a disconnection from the peer.
     * @param {string} reason - The reason for disconnection.
     */
    handleDisconnection(reason) {
        // Only handle unexpected disconnects
        if (!this.disconnectedByUser && this.game.isMultiplayer) {
            console.log('Connection closed unexpectedly');
            this.game.endDisconnectedGame();
        } else {
            console.log('Ignoring expected disconnection');
        }
    }
    
    /**
     * Sends a message to the peer.
     * @param {Object} message - The message to send.
     */
    sendMessage(message) {
        if (this.connection && this.connection.open) {
            console.log('Sending message:', message);
            
            // Convert the message to JSON string and send
            this.connection.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message: Connection not open');
        }
    }
    
    /**
     * Generates a random 6-digit connection code.
     * @returns {string} A 6-digit numeric code.
     * @private
     */
    generateConnectionCode() {
        // Use only digits
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += Math.floor(Math.random() * 10).toString();
        }
        return code;
    }
    
    /**
     * Cleans up the WebRTC connection.
     * @param {boolean} userInitiated - Whether the cleanup was initiated by the user
     */
    cleanup(userInitiated = false) {
        console.log('Cleaning up WebRTC connection', userInitiated ? '(user initiated)' : '');
        
        // Set the disconnect flag BEFORE any close events can fire
        if (userInitiated) {
            this.disconnectedByUser = true;
        }
        
        // Use setTimeout to ensure this runs after current call stack is complete
        setTimeout(() => {
            if (this.connection) {
                this.connection.close();
                this.connection = null;
            }
            
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            
            this.isHost = false;
            this.connectionCode = null;
        }, 0);
    }
} 