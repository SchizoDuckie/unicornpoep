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
import highscoreManager from '../services/HighscoreManager.js';

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
     
        eventBus.on(Events.System.ValidJoinCodeDetected, this.handleValidJoinCodeDetected);
        
        // Main menu
        eventBus.on(Events.UI.MainMenu.JoinGameClicked, this.handleJoinGameClicked);
        
        // Multiplayer choice events
        eventBus.on(Events.UI.MultiplayerChoice.JoinClicked, this.handleJoinClicked);
        
        // Join game screen / Join Lobby Component
        eventBus.on(Events.UI.JoinLobby.SubmitCodeClicked, this.handleJoinLobbySubmitCodeClicked);
        eventBus.on(Events.UI.JoinGame.CancelJoinClicked, this.handleCancelJoin);
        eventBus.on(Events.Multiplayer.Client.JoinFailed, this.handleJoinFailed);
        
        // Add a direct listener for connection failures
        eventBus.on(Events.WebRTC.ConnectionFailed, this.handleConnectionFailed);
        
        // Lobby
        eventBus.on(Events.UI.Lobby.LeaveGameClicked, this.handleLeaveLobby);
        
        // Game flow
        eventBus.on(Events.Game.Finished, this.handleGameFinished);
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        // Add listener for LocalPlayerFinished event
        eventBus.on(Events.Game.LocalPlayerFinished, this.handleLocalPlayerFinished);
        
        // Connection events (Now defined in event-constants.js)
        eventBus.on(Events.Multiplayer.GameStarted, this.handleMultiplayerGameStarted);
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnection);
        
        // Listen for Game Over Command
        eventBus.on(Events.Multiplayer.Client.GameOverCommandReceived, this._handleGameOverCommand);
        
        // Listen for End Dialog Close
        eventBus.on(Events.UI.EndDialog.ReturnToMenuClicked, this.handleReturnToMenuClicked);
        
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
            // Clean up existing connections first
            multiplayerClientManager.disconnect();
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnAlreadyConnected'), level: 'warn' });
            return;
        }
        
        // Store the player name
        this.playerName = playerName;
        
        // Show the join game screen (JoinLobbyComponent)
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.JoinLobby, 
            data: { playerName: playerName } // Pass name if JoinLobbyComponent needs it
        });
    }

    /**
     * Handles the code submission from the JoinLobbyComponent UI.
     * Attempts to connect to a host with the given game code and stored player name.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.code The game code entered by the user
     * @param {string} [payload.playerName] The player name, if provided from the component
     * @private
     * @event Events.UI.JoinLobby.SubmitCodeClicked
     * @throws Shows error feedback if connection fails
     */
    handleJoinLobbySubmitCodeClicked = ({ code, playerName }) => {
        console.log(`[MultiplayerClientCoordinator] SubmitCodeClicked received with code: ${code}`);

        // Update: Accept playerName from the JoinLobbyComponent if provided
        if (playerName) {
            this.playerName = playerName;
        }

        if (!this.playerName) {
            
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorMissingPlayerName'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Go back to main menu
            return;
        }

        if (this.activeGame || webRTCManager.status !== ConnectionStatus.DISCONNECTED) {
            console.warn("[MultiplayerClientCoordinator] Already connected or in a game.");
            // Clean up existing connections first
            multiplayerClientManager.disconnect();
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnAlreadyConnected'), level: 'warn' });
            return;
        }
        

        try {
            // Use the singleton manager to initiate the connection with the code and stored player name
            multiplayerClientManager.initiateConnection(code, this.playerName);
            this.currentGameMode = 'multiplayer-client';
            console.log(`[MultiplayerClientCoordinator] Connection initiated to ${code} for player ${this.playerName}. Waiting for connection events.`);
            
        } catch (error) {
            console.error(`[MultiplayerClientCoordinator] Connection initiation error: ${error.message}`, error);
            this.resetState(); // Ensure state is clean after failure
            // Provide feedback via JoinLobbyComponent or generic error
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorConnecting', `Failed to initiate connection: ${error.message}`), level: 'error' });
            // Optionally notify the component directly if needed:
            // eventBus.emit(Events.UI.JoinLobby.ConnectionFailed, { error: error.message });
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
        // Make sure WebRTC connections are closed
        multiplayerClientManager.disconnect();
        this.playerName = null;
        this.resetState();
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
        
        // Ensure player name is available (retrieve if needed)
        if (!this.playerName) {
            // Try fetching from manager as a fallback
            this.playerName = multiplayerClientManager.getPlayerName(); 
            if (!this.playerName) {
                console.error("[MultiplayerClientCoordinator] Player name not found after game start and couldn't retrieve from manager.");
                // Handle critical error - perhaps disconnect?
                eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorMissingPlayerName'), level: 'error' });
                this.resetState();
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                return;
            }
            console.warn(`[MultiplayerClientCoordinator] Player name was missing but recovered from manager: ${this.playerName}`);
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
            const clientQuizEngine = QuizEngine.createInstance(gameData);
            
            const gameSettings = { difficulty: gameData.difficulty }; 
            this.activeGame = new MultiplayerClientGame(
                gameSettings,             // Settings object
                clientQuizEngine,         // The engine instance created by the factory method
                this.playerName,           // Local player name
                gameData.hostId            // Host's PeerJS ID
            );
            this.currentGameMode = 'multiplayer-client';
            await this.activeGame.start(); // Start is async in BaseGameMode
            
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
        this.resetState();
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

        
        if (webRTCManager.status !== ConnectionStatus.DISCONNECTED || this.activeGame) {
            console.warn("[MultiplayerClientCoordinator] Cannot initiate join via URL, connection/game already active.", { status: webRTCManager.status, activeGame: !!this.activeGame });
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorJoinWhileActive', 'Cannot join, connection already active.'), level: 'warn' });
            return;
        }


        this.playerName = localStorage.getItem('unicornPoepUserName') || miscUtils.generateRandomPlayerName();
        this.currentGameMode = 'multiplayer-client'; // Set expected mode

        console.log(`[MultiplayerClientCoordinator] Initiating connection to host via WebRTCManager with code: ${joinCode}`);

        multiplayerClientManager.initiateConnection(joinCode, this.playerName);

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
        console.log(`[MultiplayerClientCoordinator] Join failed: ${reason}`);
        multiplayerClientManager.disconnect();
        this.resetState(); 
        
        // Update JoinGame view state to show error
        eventBus.emit(Events.UI.JoinGame.ConnectionFailed, { error: reason });
    }

    /**
     * Handles WebRTC connection failures to ensure the state is reset properly.
     * @param {object} payload Error information
     * @private
     * @event Events.WebRTC.ConnectionFailed
     */
    handleConnectionFailed = (payload) => {
        console.log(`[MultiplayerClientCoordinator] WebRTC connection failed:`, payload);
        
        // When a connection fails, ensure we disconnect and reset the state
        if (this.currentGameMode === 'multiplayer-client') {
            // Store the current player name before resetting state
            const currentPlayerName = this.playerName;
            multiplayerClientManager.disconnect();
            this.resetState(true); // Pass true to preserve player name
            this.playerName = currentPlayerName;
        }
    }

    /**
     * Resets the coordinator's internal state.
     * Destroys active client manager and game if they exist.
     * Does NOT directly interact with the client manager singleton here, 
     * assumes disconnect/cleanup is handled elsewhere (e.g., via manager.disconnect()).
     * @param {boolean} [preservePlayerName=false] - If true, won't reset the playerName
     * @private
     */
    resetState = (preservePlayerName = false) => {
        if (this.activeGame) {
            this.activeGame.destroy();
            this.activeGame = null;
        }
        this.currentGameMode = null;
        
        // Only reset playerName if we're not preserving it
        if (!preservePlayerName) {
            this.playerName = null;
        }
        
        eventBus.emit(Events.System.HideWaitingDialog);
    }

    /**
     * Handles the LocalPlayerFinished event.
     * Shows the waiting dialog when a client finishes their questions.
     * 
     * @param {Object} payload Event payload
     * @param {number} payload.score The final score achieved by the local client
     * @private
     * @event Events.Game.LocalPlayerFinished
     */
    handleLocalPlayerFinished = ({ score }) => {
        const waitMessage = miscUtils.getTextTemplate('mpClientWaitOthers', 'Je bent klaar! We wachten op de andere spelers');
        eventBus.emit(Events.System.ShowWaitingDialog, { 
            message: waitMessage 
        });
    }
    
    /**
     * Handles the GameOverCommand received from the host.
     * Shows the end dialog with results and attempts to save the highscore.
     * @param {object} payload
     * @param {object} payload.results - Final game results including players and settings.
     * @private
     */
    _handleGameOverCommand = ({ results }) => {
        eventBus.emit(Events.System.HideWaitingDialog);

        // Inject localPlayerId into results before showing dialog
        const resultsWithContext = {
            ...results,
            localPlayerId: webRTCManager.getMyPeerId() // Add local ID here
        };

        uiManager.showDialog(Views.MultiplayerEndDialog, resultsWithContext);
        
        if (results && results.winner) {
            const winnerName = results.winner.name || 'Unknown Winner';
            const winnerScore = results.winner.score;

            if (typeof winnerScore === 'number' && winnerScore > 0 && this.activeGame && this.activeGame.settings) {
                const sheetKey = this.activeGame.settings.sheetIds ? this.activeGame.settings.sheetIds.join(',') : 'unknown_sheets';
                const difficulty = this.activeGame.settings.difficulty;
                
                highscoreManager.addHighscore(winnerName, winnerScore, sheetKey, 'multiplayer', difficulty);
                
            } 
            
        } 
        
        this.resetState(); 
    }
    
    /**
     * Handles the ReturnToMenuClicked event from the end dialog.
     * Navigates back to the main menu.
     * @private
     */
    handleReturnToMenuClicked = () => {
        this.resetState(); 
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }
}

// Export the class, not an instance, as per user requirement
export default MultiplayerClientCoordinator;
