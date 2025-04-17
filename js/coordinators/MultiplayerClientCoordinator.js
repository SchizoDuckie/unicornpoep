import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import miscUtils from '../utils/miscUtils.js';
import { ConnectionStatus } from '../core/connection-constants.js';
import { MSG_TYPE } from '../core/message-types.js';

// Game mode class
import MultiplayerClientGame from '../game/MultiplayerClientGame.js';

// Services
import webRTCManager from '../services/WebRTCManager.js';
import uiManager from '../ui/UIManager.js';
import QuizEngine from '../services/QuizEngine.js';
import multiplayerClientManager from '../services/MultiplayerClientManager.js';

// Dialogs
import ErrorDialog from '../dialogs/error-dialog.js';

/**
 * Class MultiplayerClientCoordinator
 * 
 * Coordinates activities for client-side multiplayer games including connection management,
 * joining games, handling the game lifecycle, and managing disconnections. Acts as the main
 * coordinator between the UI, game logic, and multiplayer client when this client is not the host.
 * 
 * @property {MultiplayerGame|null} activeGame The currently active multiplayer game instance
 * @property {string|null} currentGameMode The current game mode (should be 'multiplayer-client' when active)
 * @property {string|null} playerName The local player's name
 */
class MultiplayerClientCoordinator {
    /**
     * Initializes the coordinator.
     * Sets up initial state and registers event listeners.
     * Does NOT hold a reference to the client manager, interacts via events and singleton.
     */
    constructor() {
        console.info("[MultiplayerClientCoordinator] Initializing...");
        
        this.activeGame = null;
        this.currentGameMode = null;
        this.playerName = null;
        
        this.registerListeners();
    }

    /**
     * Registers event listeners for client-related events.
     * @private
     */
    registerListeners() {
        console.info("[MultiplayerClientCoordinator] Registering listeners...");
        
        // --- NEW: Listen for join code detected from URL ---
        eventBus.on(Events.System.ValidJoinCodeDetected, this.handleValidJoinCodeDetected);
        
        // Main menu
        eventBus.on(Events.UI.MainMenu.JoinGameClicked, this.handleJoinGameClicked);
        
        // Multiplayer choice events
        eventBus.on(Events.UI.MultiplayerChoice.JoinClicked, this.handleJoinClicked);
        
        // Join game screen
        eventBus.on(Events.UI.JoinGame.ConnectClicked, this.handleConnectToGame);
        eventBus.on(Events.UI.JoinGame.CancelJoinClicked, this.handleCancelJoin);
        eventBus.on(Events.Multiplayer.Client.JoinFailed, this.handleJoinFailed);
        
        // Lobby
        eventBus.on(Events.UI.Lobby.LeaveGameClicked, this.handleLeaveLobby);
        
        // Game flow
        eventBus.on(Events.Game.Finished, this.handleGameFinished);
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        
        // Connection events (Now defined in event-constants.js)
        eventBus.on(Events.Multiplayer.GameStarted, this.handleMultiplayerGameStarted);
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnection);
        
        console.info("[MultiplayerClientCoordinator] Listeners registered.");
    }

    /**
     * Handles the join game button click from the main menu.
     * Shows the join game screen.
     * 
     * @private
     * @event Events.UI.MainMenu.JoinGameClicked
     */
    handleJoinGameClicked = () => {
        console.log("[MultiplayerClientCoordinator] JoinGameClicked received.");
        
        if (this.activeGame || webRTCManager.status !== ConnectionStatus.DISCONNECTED) {
            console.warn("[MultiplayerClientCoordinator] Already connected or in a game.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnAlreadyConnected'), level: 'warn' });
            return;
        }
       // uiManager.showDialog(Views.MultiplayerLobby);
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.JoinLobby });
    }

    /**
     * Handles the MultiplayerChoice JoinClicked event.
     * Shows the join game screen with the player name pre-filled.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.playerName The player name
     * @private
     * @event Events.UI.MultiplayerChoice.JoinClicked
     */
    handleJoinClicked = ({ playerName }) => {
        console.log(`[MultiplayerClientCoordinator] JoinClicked received with player name: ${playerName}`);
        
        if (this.activeGame || webRTCManager.status !== ConnectionStatus.DISCONNECTED) {
            console.warn("[MultiplayerClientCoordinator] Already connected or in a game.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnAlreadyConnected'), level: 'warn' });
            return;
        }
        
        // Store the player name
        this.playerName = playerName;
        
        // Show the join game screen with the player name pre-filled
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.MultiplayerLobbyDialog,
            data: { playerName: playerName }
        });
    }

    /**
     * Handles the connect button click from the join game screen.
     * Attempts to connect to a host with the given game code and player name.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.gameCode The game code to connect to
     * @param {string} payload.playerName The player's name
     * @private
     * @event Events.UI.JoinGame.ConnectClicked
     * @throws Shows error feedback if connection fails
     */
    handleConnectToGame = async ({ gameCode, playerName }) => {
        console.log("[MultiplayerClientCoordinator] ConnectClicked received:", { gameCode, playerName });
        
        if (this.activeGame || webRTCManager.status !== ConnectionStatus.DISCONNECTED) {
            console.warn("[MultiplayerClientCoordinator] Already connected or in a game.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnAlreadyConnected'), level: 'warn' });
            return;
        }
        
        this.playerName = playerName;
        
        // Show connecting status in the Join Game view
        eventBus.emit(Events.UI.JoinGame.Connecting, { code: gameCode }); 

        try {
            // Use the singleton manager to initiate the connection
            multiplayerClientManager.initiateConnection(gameCode, playerName);
            this.currentGameMode = 'multiplayer-client';
            console.log(`[MultiplayerClientCoordinator] Connection initiated to ${gameCode}. Waiting for connection events.`);
            
        } catch (error) {
            console.error(`[MultiplayerClientCoordinator] Connection initiation error: ${error.message}`, error);
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorConnecting', `Failed to initiate connection: ${error.message}`), level: 'error' });
            eventBus.emit(Events.UI.JoinGame.ConnectionFailed, { error: error.message });
        }
    }

    /**
     * Handles the cancel button click from the join game screen.
     * Returns to the main menu.
     * 
     * @private
     * @event Events.UI.JoinGame.CancelJoinClicked
     */
    handleCancelJoin = () => {
        console.log("[MultiplayerClientCoordinator] CancelJoinClicked received.");
        this.playerName = null;
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the leave game button click from the lobby.
     * Disconnects from the host and returns to the main menu.
     * 
     * @private
     * @event Events.UI.Lobby.LeaveGameClicked
     */
    handleLeaveLobby = () => {
        console.log("[MultiplayerClientCoordinator] LeaveLobbyClicked received.");
        
        // Tell the manager to disconnect
        multiplayerClientManager.disconnect();
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the multiplayer game started event from the server.
     * Initializes the client-side game instance and starts the game immediately after the countdown.
     * Ensures the timer starts in sync with the host.
     * 
     * @param {Object} payload Event payload
     * @param {Object} payload.gameData Initial game data from the server
     * @private
     * @event Events.Multiplayer.GameStarted
     * @throws Shows error feedback if game initialization fails
     */
    handleMultiplayerGameStarted = async ({ gameData }) => {
        console.log("[MultiplayerClientCoordinator] GameStarted received:", gameData);
        // Ensure player name is available (retrieve if needed)
        if (!this.playerName) {
            this.playerName = multiplayerClientManager.getPlayerName(); 
            if (!this.playerName) {
                console.warn("[MultiplayerClientCoordinator] Player name not found after game start. Generating new.");
                this.playerName = miscUtils.generatePlayerName();
            }
        }
        if (!gameData || !gameData.questionsData || !gameData.difficulty || !gameData.hostId) {
            console.error("[MultiplayerClientCoordinator] Invalid gameData received in GameStarted event:", gameData);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorInvalidGameData'), level: 'error' });
            this.resetState();
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }
        // Hide the waiting dialog
        eventBus.emit(Events.System.HideWaitingDialog);
        try {
            console.log("[MultiplayerClientCoordinator] Creating MultiplayerClientGame instance...");
            this.activeGame = new MultiplayerClientGame(
                QuizEngine.getInstance(),
                gameData.difficulty,
                this.playerName,
                gameData.hostId
            );
            this.currentGameMode = 'multiplayer-client';
            console.log("[MultiplayerClientCoordinator] MultiplayerClientGame instance created.");
            // Start the game immediately (the countdown was already handled by the manager)
            this.activeGame.start();
            console.log("[MultiplayerClientCoordinator] Called activeGame.start() after countdown.");
            // Emit event for JoinLobbyComponent to handle navigation
            eventBus.emit(Events.UI.JoinLobby.HostHasStartedGame, { 
                gameData: {
                    gameMode: this.currentGameMode, 
                    role: 'client',
                    playerName: this.playerName
                }
            });
        } catch (error) {
            console.error("[MultiplayerClientCoordinator] Error starting client game:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorStartingClientGame', error.message || 'Unknown error'), level: 'error' });
            this.resetState();
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the game finished event.
     * Performs cleanup after a game has ended.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.mode The game mode that finished
     * @private
     * @event Events.Game.Finished
     */
    handleGameFinished = ({ mode }) => {
        if (mode !== 'multiplayer-client') return;
        
        console.log("[MultiplayerClientCoordinator] Game.Finished received.");
        
        // Clean up game but keep client manager active
        if (this.activeGame) {
            if (typeof this.activeGame.destroy === 'function') {
                this.activeGame.destroy();
            }
            this.activeGame = null;
        }
        
        // Navigation to results screen is handled by the game
    }

    /**
     * Handles the user leaving the game.
     * Resets the state and returns to main menu.
     * 
     * @private
     * @event Events.UI.GameArea.LeaveGameClicked
     */
    handleLeaveGame = () => {
        console.log("[MultiplayerClientCoordinator] LeaveGame received.");
        // Tell the manager to disconnect
        multiplayerClientManager.disconnect();
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles disconnection from the host.
     * Cleans up resources and shows the disconnection dialog.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.reason The reason for disconnection
     * @private
     * @event Events.Multiplayer.Client.DisconnectedFromHost
     */
    handleDisconnection = ({ reason }) => {
        console.log(`[MultiplayerClientCoordinator] Disconnected: ${reason}`);
        
        // Only handle if we're in multiplayer client mode
        if (this.currentGameMode !== 'multiplayer-client') return;
        
        // Clean up resources
        this.resetState();
        
        // Show disconnection dialog
        eventBus.emit(Events.UI.ShowDialog, { 
            dialogName: 'disconnection-dialog',
            data: { reason: reason }
        });
    }

    /**
     * Handles the detection of a valid join code from the URL.
     * Initiates the connection attempt via WebRTCManager.
     * 
     * @param {object} payload Event payload
     * @param {string} payload.joinCode The 6-digit join code.
     * @private
     * @event Events.System.ValidJoinCodeDetected
     */
    handleValidJoinCodeDetected = ({ joinCode }) => {
        console.log(`[MultiplayerClientCoordinator] ValidJoinCodeDetected received: ${joinCode}`);

        // Check if already in a game or connection process
        if (webRTCManager.status !== ConnectionStatus.DISCONNECTED || this.activeGame) {
            console.warn("[MultiplayerClientCoordinator] Cannot initiate join via URL, connection/game already active.", { status: webRTCManager.status, activeGame: !!this.activeGame });
            // Optionally show feedback, although the UIManager might already be showing the relevant view
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorJoinWhileActive', 'Cannot join, connection already active.'), level: 'warn' });
            return;
        }

        // NOTE: Player name will be set when the user interacts with the JoinGame view,
        // triggered by the UIManager showing it.
        this.playerName = null; // Ensure player name is reset
        this.currentGameMode = 'multiplayer-client'; // Set expected mode

        console.log(`[MultiplayerClientCoordinator] Initiating connection to host via WebRTCManager with code: ${joinCode}`);
        // Use the singleton manager to initiate connection - name will be provided later via UI interaction
        multiplayerClientManager.initiateConnection(joinCode, null); // Pass null for name initially
        
        // UIManager is responsible for showing JoinLobbyComponent based on the same event.
        // This coordinator just kicks off the connection in the background.
    }

    /**
     * Handles failures during the initial join process reported by MultiplayerClientManager.
     * Updates the UI (JoinGame view) to reflect the error.
     * @param {object} payload 
     * @param {string} payload.reason 
     * @private
     * @event Events.Multiplayer.Client.JoinFailed
     */
    handleJoinFailed = ({ reason }) => {
        console.warn(`[MultiplayerClientCoordinator] JoinFailed reported: ${reason}`);
        this.resetState(); // Reset coordinator state
        // Update JoinGame view state to show error
        eventBus.emit(Events.UI.JoinGame.ConnectionFailed, { error: reason });
    }

    /**
     * Resets the coordinator's internal state.
     * Destroys active client manager and game if they exist.
     * Does NOT directly interact with the client manager singleton here, 
     * assumes disconnect/cleanup is handled elsewhere (e.g., via manager.disconnect()).
     * @private
     */
    resetState = () => {
        console.log("[MultiplayerClientCoordinator] Resetting coordinator state.");
        if (this.activeGame) {
            this.activeGame.destroy();
            this.activeGame = null;
        }
        this.currentGameMode = null;
        this.playerName = null;
        // Emit event to hide the waiting dialog instead of calling directly
        eventBus.emit(Events.System.HideWaitingDialog);
    }
}

export default MultiplayerClientCoordinator;
