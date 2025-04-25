import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import miscUtils from '../utils/miscUtils.js';
import MultiplayerHostManager from '../services/MultiplayerHostManager.js';
import webRTCManager from '../services/WebRTCManager.js';
import QuizEngine from '../services/QuizEngine.js';
import MultiplayerHostGame from '../game/MultiplayerHostGame.js';
import uiManager from '../ui/UIManager.js';
import highscoreManager from '../services/HighscoreManager.js';

/**
 * Class MultiplayerHostCoordinator
 * 
 * Coordinates activities for hosting multiplayer games including server setup,
 * player management, game flow, and session termination. Acts as the main coordinator
 * between the UI, game logic, and multiplayer server when this client is the host.
 * 
 * @property {MultiplayerHostManager|null} activeHostManager The active host manager instance for the multiplayer session
 * @property {QuizEngine|null} quizEngine The quiz engine instance used for the current game
 * @property {string|null} currentGameMode The current game mode (should be 'multiplayer-host' when active)
 * @property {Object|null} pendingGameSettings Pending settings for a game about to start
 * @property {string|null} pendingJoinCode The join code received but waiting for navigation.
 * @property {string} playerName The local player's name
 */
class MultiplayerHostCoordinator {
    /**
     * Initializes the coordinator.
     * Sets up initial state and registers event listeners.
     */
    constructor() {
        console.info("[MultiplayerHostCoordinator] Initializing...");
        
    this.activeHostManager = null;
        this.activeGame = null;
        this.quizEngine = null;
        this.currentGameMode = null;
        this.pendingGameSettings = null;
        this.pendingJoinCode = null;
        this.playerName = null;
        
        this.registerListeners();
    }

    /**
     * Registers event listeners for host-related events.
     * @private
     */
    registerListeners() {
        console.info("[MultiplayerHostCoordinator] Registering listeners...");
        
        // Main menu
        eventBus.on(Events.UI.MainMenu.HostMultiplayerClicked, this.handleCreateGameClicked);
        
        
        // Multiplayer choice events
        eventBus.on(Events.UI.MultiplayerChoice.HostClicked, this.handleHostClicked);
        
        // Game setup
        eventBus.on(Events.UI.GameSetup.StartGameClicked, this.handleStartMultiplayerGame);
        eventBus.on(Events.UI.GameSetup.CancelSetupClicked, this.handleCancelSetup);
        
        // Lobby
        eventBus.on(Events.UI.Lobby.StartGameClicked, this.handleLobbyStartGame);
        eventBus.on(Events.UI.Lobby.CancelGameClicked, this.handleLobbyCancel);
        
        // Game flow
        eventBus.on(Events.Game.Started, this._handleHostGameStarted);
        eventBus.on(Events.Game.Finished, this.handleGameFinished);
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        
        // Sheet Selection Completion
        eventBus.on(Events.Game.StartRequested, this.handleGameStartRequested);
        
        // Host Initialization Completion (gets join code)
        eventBus.on(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        // Host finished quiz, waiting for clients
        eventBus.on(Events.Multiplayer.Host.HostWaiting, this._handleHostWaiting);
        
        // Listen for End Dialog Close
        eventBus.on(Events.UI.EndDialog.ReturnToMenuClicked, this.handleReturnToMenuClicked);
        
        // Listen for WebRTC PeerDisconnected events
        eventBus.on(Events.WebRTC.PeerDisconnected, this.handlePeerDisconnected);
        
        console.info("[MultiplayerHostCoordinator] Listeners registered.");
    }

    /**
     * Handles the create game button click from the main menu.
     * Shows the game setup screen for multiplayer hosting.
     * 
     * @private
     * @event Events.UI.MainMenu.CreateGameClicked
     */
    handleCreateGameClicked = () => {
        console.log("[MultiplayerHostCoordinator] CreateGameClicked received.");
        
        if (this.activeHostManager || this.activeGame) {
            // this should basically not happen, but just in case
            this.resetState();
        }
        
        // Show game setup screen
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice, data: { mode: 'multiplayer-host' } });
    }


    /**
     * Handles the MultiplayerChoice HostClicked event to start the host game flow.
     * Shows the sheet selection screen to prepare for hosting a game.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.playerName The player name
     * @private
     * @event Events.UI.MultiplayerChoice.HostClicked
     */
    handleHostClicked = ({ playerName }) => {
        console.log(`[MultiplayerHostCoordinator] HostClicked received with player name: ${playerName}`);
        
        if (this.activeHostManager || this.activeGame) {
            console.warn("[MultiplayerHostCoordinator] Cannot host game, already in a session.");
            // Reset state to clear any lingering connections
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorHostWhileActive'), level: 'error' });
            return;
        }
        
        // Store the player name
        this.playerName = playerName;
        
        // Show the sheet selection screen to pick settings for the multiplayer game
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.SheetSelection, 
            data: { 
                mode: 'multiplayer-host',
                playerName: playerName
            }
        });
    }

    /**
     * Handles the start game button click from the game setup screen.
     * Initializes a multiplayer host server and navigates to the lobby.
     * 
     * @param {Object} payload Event payload containing game settings
     * @param {string} payload.difficulty The selected difficulty level
     * @param {number} payload.questionCount The number of questions for the game
     * @param {string[]} payload.categories Selected categories for the questions
     * @param {string} payload.playerName The host player's name
     * @param {number} payload.maxPlayers Maximum number of players allowed
     * @private
     * @event Events.UI.GameSetup.StartGameClicked
     * @throws Shows error feedback if server initialization fails
     */
    handleStartMultiplayerGame = async ({ difficulty, questionCount, categories, playerName, maxPlayers }) => {
        console.log("[MultiplayerHostCoordinator] StartGameClicked received:", 
            { difficulty, questionCount, categories, playerName, maxPlayers });
        
        if (this.activeHostManager || this.activeGame) {
            console.warn("[MultiplayerHostCoordinator] Cannot create game, already hosting a session.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        
        // Store settings temporarily
        this.pendingGameSettings = { difficulty, questionCount, categories, maxPlayers };
        this.playerName = playerName;
        
        // Show loading screen while server initializes
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        
        try {
            // Initialize host manager
            this.activeHostManager = new MultiplayerHostManager(playerName, maxPlayers);
            
            // Initialize quiz engine
            this.quizEngine = QuizEngine.getInstance();
            
            // Load questions based on settings
            await this.quizEngine.loadQuestionsFromManager(categories, difficulty);
            
            // Start hosting session
            await this.activeHostManager.startHosting();
            this.currentGameMode = 'multiplayer-host';
            
            // Navigate to lobby
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Lobby, data: { mode: 'host' } });
            
        } catch (error) {
            console.error(`[MultiplayerHostCoordinator] Error starting server: ${error.message}`, error);
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorInitFail'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the cancel setup button click from the game setup screen.
     * Returns to the main menu.
     * 
     * @private
     * @event Events.UI.GameSetup.CancelSetupClicked
     */
    handleCancelSetup = () => {
        console.log("[MultiplayerHostCoordinator] CancelSetupClicked received.");
        this.pendingGameSettings = null;
        this.playerName = null;
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the start game button click from the lobby.
     * Creates the MultiplayerHostGame instance and starts the game sequence (countdown + start).
     * Navigation happens when the Game.Started event is received later.
     *
     * @private
     * @event Events.UI.Lobby.StartGameClicked
     * @throws Shows error feedback if game initialization fails
     */
    handleLobbyStartGame = async () => {
        console.log("[MultiplayerHostCoordinator] LobbyStartGame received.");

        if (!this.activeHostManager) {
            console.error("[MultiplayerHostCoordinator] Cannot start game, no active host manager.");
            eventBus.emit(Events.System.ShowFeedback, { message: "Cannot start game, host session not active.", level: 'error' });
            return;
        }

        if (this.activeGame) {
            console.warn("[MultiplayerHostCoordinator] Game already started.");
            return;
        }

        // Get player count from the Manager (requires getPlayerList or similar method)
        const connectedPlayers = this.activeHostManager.getPlayerList ? this.activeHostManager.getPlayerList() : new Map(); // Fallback to empty map
        if (connectedPlayers.size < 1) { // Host counts as 1 player
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnLobbyNeedMorePlayers', 'Need at least one client to start.'), level: 'warn' });
            // Allow starting with just host for testing? Adjust check if needed.
            // return;
            console.warn("[MultiplayerHostCoordinator] Starting game with host only (for testing?).");
        }

        // --- NO Loading Screen Here - Countdown happens first ---
        // eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });

        try {
            // --- FIX: Instantiate MultiplayerHostGame ---
            const gameSettings = this.activeHostManager.getGameSettings(); // Need method in HostManager
            const quizEngineInstance = this.activeHostManager.getQuizEngine(); // Need method in HostManager
            const hostPeerId = this.activeHostManager.getHostPeerId(); // Need method in HostManager

            if (!gameSettings || !quizEngineInstance || !hostPeerId) {
                throw new Error("Missing required data from Host Manager to create game.");
            }

            console.log("[MultiplayerHostCoordinator] Creating MultiplayerHostGame instance...");
            this.activeGame = new MultiplayerHostGame(
                gameSettings,
                quizEngineInstance,
                this.playerName,
                hostPeerId
            );

            // --- FIX: Start the game sequence ---
            // This will broadcast countdown/start signals and start host logic after delay
            console.log("[MultiplayerHostCoordinator] Initiating game sequence...");
            this.activeGame.startGameSequence();

        } catch (error) {
            console.error(`[MultiplayerHostCoordinator] Error starting game sequence: ${error.message}`, error);
            // Reset game state if creation failed, but keep host manager active?
            this.activeGame = null;
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError', `Failed to start game: ${error.message}`), level: 'error' });
            // Maybe navigate back to lobby or main menu? Let's stay in lobby for now.
            // eventBus.emit(Events.Navigation.ShowView, { viewName: Views.HostLobby ... });
        }
    }

    /**
     * Handles the cancel button click from the lobby.
     * Terminates the hosting session and returns to main menu.
     * 
     * @private
     * @event Events.UI.Lobby.CancelGameClicked
     */
    handleLobbyCancel = () => {
        console.log("[MultiplayerHostCoordinator] LobbyCancelClicked received.");
        
        if (!this.activeHostManager) {
            console.warn("[MultiplayerHostCoordinator] No active host manager to cancel.");
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }
        
        // Reset state and go back to main menu
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the Game.Started event specifically for the host game mode.
     * Navigates the host UI to the GameArea view.
     *
     * @param {Object} payload Event payload
     * @param {string} payload.mode The game mode that started
     * @param {object} payload.settings The game settings
     * @private
     * @event Events.Game.Started
     */
    _handleHostGameStarted = ({ mode, settings }) => {
        // Only react if it's the host game starting
        if (mode !== 'multiplayer-host') {
            return;
        }

        console.log("[MultiplayerHostCoordinator] Host Game.Started event received. Navigating to Game Area.");

        // Navigate host to the game area view
        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.GameArea,
            data: { // Pass necessary data for GameAreaComponent setup
                gameMode: mode,
                role: 'host',
                playerName: this.playerName,
                settings: settings // Pass game settings if needed by UI
                // Add other data GameAreaComponent might need
            }
        });
    }

    /**
     * Handles the Game.Finished event.
     * Performs cleanup after a game has ended.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.mode The game mode that finished
     * @param {object} payload.results The results of the game
     * @private
     * @event Events.Game.Finished
     */
    handleGameFinished = ({ mode, results }) => {
        if (mode !== 'multiplayer-host') return;
        
        // --- REVISED HIGHSCORE SAVING LOGIC (Save Winner Only) ---
        if (results && results.winner) {
            const winnerName = results.winner.name || 'Unknown Winner';
            const winnerScore = results.winner.score;

            if (typeof winnerScore === 'number' && winnerScore > 0 && this.activeGame && this.activeGame.settings) {
                const sheetKey = this.activeGame.settings.sheetIds ? this.activeGame.settings.sheetIds.join(',') : 'unknown_sheets';
                const difficulty = this.activeGame.settings.difficulty;
                
                highscoreManager.addHighscore(winnerName, winnerScore, sheetKey, 'multiplayer', difficulty);
                
            } 
            
        } 
        // --- END REVISED HIGHSCORE SAVING LOGIC ---
        
        // Show the end dialog
        if (results) {
             const resultsWithContext = { ...results }; 
             uiManager.showDialog(Views.MultiplayerEndDialog, resultsWithContext);
         } else {
             console.warn("[MultiplayerHostCoordinator] Game.Finished received, but no results payload found. Cannot show end dialog.");
             this.resetState(); 
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
             return; 
         }

        // Clean up game instance, BUT KEEP Host Manager active for now
        if (this.activeGame) {
            this.activeGame.destroy(); 
            this.activeGame = null;
        }
        this.currentGameMode = null; // Mark game as inactive
    }

    /**
     * Handles the user leaving the game.
     * Resets the state and returns to main menu.
     * 
     * @private
     * @event Events.UI.GameArea.LeaveGameClicked
     */
    handleLeaveGame = () => {
        if (this.currentGameMode !== 'multiplayer-host') return;
        
        console.log("[MultiplayerHostCoordinator] LeaveGameClicked received.");
        
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the Game.StartRequested event emitted by SheetSelectionComponent.
     * Stores settings, shows loading, and initiates the host connection process via WebRTCManager.
     * The actual HostManager creation and navigation happens in handleHostInitialized.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.mode The requested game mode (should be 'multiplayer-host')
     * @param {Object} payload.settings Game settings (sheetIds, difficulty)
     * @param {string} payload.playerName The host player's name
     * @private
     * @event Events.Game.StartRequested
     */
    handleGameStartRequested = async ({ mode, settings, playerName }) => {
        if (mode !== 'multiplayer-host') {
            // This event isn't for us in this context
            return;
        }
        
        console.log(`[MultiplayerHostCoordinator] GameStartRequested received for host mode:`, { settings, playerName });

        if (this.activeHostManager || this.activeGame) {
            console.warn("[MultiplayerHostCoordinator] Cannot start host session, already active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorHostWhileActive'), level: 'error' });
            return;
        }

        // Validate incoming settings
        if (!settings || !settings.sheetIds || !Array.isArray(settings.sheetIds) || settings.sheetIds.length === 0) {
            console.error("[MultiplayerHostCoordinator] Invalid settings received. Missing or empty sheetIds:", settings);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInvalidInputError'), level: 'error' });
            return;
        }

        // Store player name and settings for later use when host is initialized
        this.playerName = playerName;
        // Ensure settings has all required properties with defaults if not provided
        this.pendingGameSettings = {
            sheetIds: settings.sheetIds,
            difficulty: settings.difficulty || 'medium'
        };
        
        console.log("[MultiplayerHostCoordinator] Stored pendingGameSettings:", this.pendingGameSettings);

        // Show loading indicator
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });

        // Initiate host connection process via WebRTCManager
        // The result (hostId/join code) will come back via the Host.Initialized event
        try {
            webRTCManager.startHost(this.playerName);
        } catch (error) {
            console.error(`[MultiplayerHostCoordinator] Error calling webRTCManager.startHost: ${error.message}`, error);
            this.resetState(); // Clean up on immediate failure
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorInitFail'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the Host.Initialized event from WebRTCManager, receiving the host ID (join code).
     * Creates and initializes the MultiplayerHostManager, then navigates to the Host Lobby view.
     *
     * @param {Object} payload Event payload
     * @param {string} payload.hostId The PeerJS ID assigned to the host (join code).
     * @private
     * @event Events.Multiplayer.Host.Initialized
     */
    handleHostInitialized = async ({ hostId }) => {
        console.log(`[MultiplayerHostCoordinator] Host Initialized with Join Code: ${hostId}`);
        
        // Store the join code temporarily if needed, maybe pass directly
        this.pendingJoinCode = hostId; 

        // Ensure we have a player name before navigating
        if (!this.playerName) {
            console.error("[MultiplayerHostCoordinator] Host initialized but player name is missing. Cannot navigate to lobby.");
            this.resetState(); // Reset on error
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        // Debug: Check what's in pendingGameSettings
        console.log("[MultiplayerHostCoordinator] pendingGameSettings:", this.pendingGameSettings);
        
        // Ensure pendingGameSettings has the required properties
        if (!this.pendingGameSettings) {
            console.error("[MultiplayerHostCoordinator] pendingGameSettings is null or undefined.");
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorInitFail'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }
        
        if (!this.pendingGameSettings.sheetIds || !Array.isArray(this.pendingGameSettings.sheetIds) || this.pendingGameSettings.sheetIds.length === 0) {
            console.error("[MultiplayerHostCoordinator] pendingGameSettings missing valid sheetIds:", this.pendingGameSettings);
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorInitFail'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }
        
        if (!this.pendingGameSettings.difficulty) {
            console.warn("[MultiplayerHostCoordinator] pendingGameSettings missing difficulty. Using default 'medium'.");
            this.pendingGameSettings.difficulty = 'medium';
        }

        // Now that we have the hostId, create and setup the Host Manager
        try {
            // 1. Create the manager instance, passing settings and the crucial hostId
            this.activeHostManager = new MultiplayerHostManager(this.playerName, this.pendingGameSettings, hostId);

            // 2. Initialize the manager (loads questions internally)
            await this.activeHostManager.initialize();

            // 3. Start the hosting process (sets up lobby listeners etc.)
            this.activeHostManager.startHosting(); 

            this.currentGameMode = 'multiplayer-host';

        } catch (error) {
            console.error(`[MultiplayerHostCoordinator] Error creating/initializing host manager: ${error.message}`, error);
            this.resetState(); // Clean up on failure
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorInitFail'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Go back to main menu on failure
            return; // Stop execution if manager setup failed
        }

        // Navigate to the Host Lobby view, passing the join code
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.HostLobby, // Ensure Views.HostLobby exists and is correct
            data: { 
                joinCode: hostId,
                playerName: this.playerName 
            } 
        });
    }

    /**
     * Handles the HostWaiting event from the host game instance.
     * Shows the waiting dialog for the host.
     * @param {object} payload - Event payload (currently unused, could contain list of waiting peers).
     * @private
     */
    _handleHostWaiting = (payload) => {
        if (this.currentGameMode !== 'multiplayer-host') return;

        console.log("[MultiplayerHostCoordinator] HostWaiting event received.", payload);
        eventBus.emit(Events.System.ShowWaitingDialog, { message: miscUtils.getTextTemplate('mpHostWaitOthers', 'You finished! Waiting for other players...') });
        
        // Check if there are any clients connected at all
        this._checkForAutoComplete();
    };

    /**
     * Checks if there are any clients connected while host is waiting.
     * If no clients are connected, automatically completes the game.
     * @private
     */
    _checkForAutoComplete = () => {
        // Only relevant when host is waiting for clients to finish
        if (!this.activeHostManager || !this.activeGame || this.currentGameMode !== 'multiplayer-host') {
            return;
        }
        
        // Check if the game instance has a waiting state flag we can check
        const isHostWaiting = this.activeGame.isHostFinished && this.activeGame.isHostFinished();
        if (!isHostWaiting) {
            return; // Host isn't in waiting state
        }
        
        // Get connected client count
        const connectedPlayers = this.activeHostManager.getPlayerList ? this.activeHostManager.getPlayerList() : new Map();
        const clientCount = connectedPlayers.size - 1; // Subtract 1 for the host itself
        
        console.log(`[MultiplayerHostCoordinator] Checking for auto-complete. Connected clients: ${clientCount}`);
        
        if (clientCount <= 0) {
            console.log("[MultiplayerHostCoordinator] No clients connected while host is waiting. Auto-completing game.");
            // Hide waiting dialog
            eventBus.emit(Events.System.HideWaitingDialog);
            
            // Force game completion by calling the game's complete method
            if (this.activeGame.forceGameCompletion && typeof this.activeGame.forceGameCompletion === 'function') {
                this.activeGame.forceGameCompletion();
            } else if (this.activeGame.endGame && typeof this.activeGame.endGame === 'function') {
                this.activeGame.endGame();
            } else {
                console.error("[MultiplayerHostCoordinator] No method available to force game completion.");
                // Fallback: reset state and return to main menu
                this.resetState();
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            }
        }
    }

    /**
     * Handles the ReturnToMenuClicked event from the end dialog.
     * Resets the state and navigates back to the main menu.
     * @private
     */
    handleReturnToMenuClicked = () => {
        // Ensure this handler only acts if we were in host mode
        if (this.activeHostManager) { // Check if host manager was active
             console.log("[MultiplayerHostCoordinator] ReturnToMenuClicked received. Resetting state and navigating to Main Menu.");
             this.resetState(); // Full cleanup now
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        } else {
            console.warn("[MultiplayerHostCoordinator] ReturnToMenuClicked received, but no active host manager found. Ignoring.");
        }
    }

    /**
     * Handles the WebRTC PeerDisconnected event for the host.
     * If the host peer is disconnected, attempts to recover by restarting the host session.
     * If a client disconnects while host is waiting, checks if all clients have disconnected.
     * @param {Object} payload - The event payload
     * @param {string} payload.peerId - The ID of the disconnected peer
     * @private
     */
    handlePeerDisconnected = ({ peerId }) => {
        console.log(`[MultiplayerHostCoordinator] PeerDisconnected event received for peer: ${peerId}`);
        
        // Check if we're actually in host mode
        if (this.currentGameMode !== 'multiplayer-host' || !this.activeHostManager) {
            console.log("[MultiplayerHostCoordinator] Ignoring PeerDisconnected event - not in host mode or no active host manager");
            return;
        }
        
        // Check if this is a host peer disconnection (the host's own peer)
        const hostPeerId = this.activeHostManager.getHostPeerId?.() || this.pendingJoinCode;
        if (peerId === hostPeerId) {
            console.warn("[MultiplayerHostCoordinator] Host peer itself disconnected. Attempting to recover...");
            
            // Save the current state before resetting
            const playerName = this.playerName;
            const gameSettings = this.pendingGameSettings || 
                (this.activeHostManager && typeof this.activeHostManager.getGameSettings === 'function' 
                ? this.activeHostManager.getGameSettings() 
                : null);
            const joinCode = this.pendingJoinCode;
            
            // Reset the state to clean up resources
            this.resetState();
            
            // Show a feedback message
            eventBus.emit(Events.System.ShowFeedback, { 
                message: miscUtils.getTextTemplate('mpHostReconnecting', 'Connection lost. Reconnecting...'), 
                level: 'warn' 
            });
            
            // If we have the needed data, try to restart the host session with the same code
            if (playerName && gameSettings && joinCode) {
                console.log("[MultiplayerHostCoordinator] Attempting to restart host session with same code");
                
                // Store the settings and player name
                this.playerName = playerName;
                this.pendingGameSettings = gameSettings;
                
                // Show loading screen during reconnection
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
                
                // Attempt to restart the host session
                setTimeout(() => {
                    // Attempt to restart WebRTC with the same code
                    try {
                        webRTCManager.startHost(playerName);
                    } catch (error) {
                        console.error(`[MultiplayerHostCoordinator] Failed to restart host session: ${error.message}`, error);
                        eventBus.emit(Events.System.ShowFeedback, { 
                            message: miscUtils.getTextTemplate('mpHostReconnectFailed', 'Failed to reconnect. Please try again.'), 
                            level: 'error' 
                        });
                        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    }
                }, 1000); // Brief delay to allow previous connections to fully close
            } else {
                console.error("[MultiplayerHostCoordinator] Unable to restart host - missing required data");
                eventBus.emit(Events.System.ShowFeedback, { 
                    message: miscUtils.getTextTemplate('mpHostReconnectFailed', 'Failed to reconnect. Please try again.'), 
                    level: 'error' 
                });
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            }
        } else {
            // This is a client disconnection
            console.log(`[MultiplayerHostCoordinator] Client peer disconnected: ${peerId}`);
            
            // Check if we need to auto-complete the game (if the host is waiting and all clients are gone)
            setTimeout(() => this._checkForAutoComplete(), 500); // Small delay to ensure player list is updated
        }
    }

    /**
     * Resets the coordinator's internal state.
     * Destroys active host manager and game if they exist.
     * @private
     */
    resetState = () => {
        console.log("[MultiplayerHostCoordinator] Resetting state...");
        
        // Close the WebRTC connection if it's still active
        if (webRTCManager.status !== 'disconnected') {
            webRTCManager.closeConnection();
        }
        
        // Clean up host manager
        if (this.activeHostManager) {
            if (typeof this.activeHostManager.destroy === 'function') {
                this.activeHostManager.destroy();
            } else if (typeof this.activeHostManager.stopHosting === 'function') {
                this.activeHostManager.stopHosting();
            }
            this.activeHostManager = null;
        }
        
        // Clean up quiz engine
        
        if (typeof this.quizEngine?.destroy === 'function') {
            this.quizEngine.destroy();
            
        }
        if (typeof this.activeGame?.destroy === 'function') {
            this.activeGame.destroy();
            
        }
        
        // Remove event listeners when resetting
        eventBus.off(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        // Also remove PeerDisconnected listener to avoid duplicates if we're reconnecting
        eventBus.off(Events.WebRTC.PeerDisconnected, this.handlePeerDisconnected);
        
        // Reset state variables
        this.activeGame = null;
        this.quizEngine = null;
        this.currentGameMode = null;
        this.pendingGameSettings = null;
        this.pendingJoinCode = null;
        
        console.log("[MultiplayerHostCoordinator] State reset complete.");
    }
}

export default MultiplayerHostCoordinator;
