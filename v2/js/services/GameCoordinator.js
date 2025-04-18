import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views constants
import ErrorDialog from '../dialogs/error-dialog.js'; // Assuming ErrorDialog export
// Import the default export object from miscUtils
import miscUtils from '../utils/miscUtils.js'; 
// <<< ADD Import for ConnectionStatus >>>
import { ConnectionStatus } from '../core/connection-constants.js';

// Import game mode classes
import SinglePlayerGame from '../game/SinglePlayerGame.js'; // Corrected path case
import MultiplayerGame from '../game/MultiplayerGame.js'; // Corrected path case
import PracticeGame from '../game/PracticeGame.js';     // Corrected path case

// Import services
import questionsManager from './QuestionsManager.js'; // Import QuestionsManager
import webRTCManager from './WebRTCManager.js';      // Assuming singleton
import uiManager from '../ui/UIManager.js';          // Import UIManager to access components
import NamePromptDialog from '../dialogs/name-prompt-dialog.js'; // Import for type check
import WaitingDialog from '../dialogs/waiting-dialog.js'; // Import WaitingDialog

import MultiplayerHostManager from './MultiplayerHostManager.js';
import MultiplayerClientManager from './MultiplayerClientManager.js';
// Import MultiplayerLobbyDialog for type hints or direct showing if needed
import MultiplayerLobbyDialog from '../dialogs/multiplayer-lobby-dialog.js'; 
import { MSG_TYPE } from '../core/message-types.js'; // NEW Import from isolated file
import QuizEngine from '../services/QuizEngine.js'; // Import class
import highscoreManager from './HighscoreManager.js'; // Import the singleton instance

/**
 * Coordinates the creation and management of different game modes.
 * Supports ASYNCHRONOUS multiplayer flow.
 */
class GameCoordinator {
    /**
     * Initializes the GameCoordinator.
     * @param {QuestionsManager} questionsManagerInstance - An instance of the QuestionsManager.
     * @param {MultiplayerClientManager} multiplayerClientManagerInstance - An instance of MultiplayerClientManager.
     */
    constructor(questionsManagerInstance, multiplayerClientManagerInstance) {
        console.info("[GameCoordinator ASYNC] Initializing...");

        // Assign injected dependencies
        this.questionsManager = questionsManagerInstance || questionsManager; // Use singleton as fallback
        this.multiplayerClientManager = multiplayerClientManagerInstance;
        this.webRTCManager = webRTCManager; // Store the singleton instance

        if (!this.questionsManager) {
             console.error("[GameCoordinator] FATAL: QuestionsManager instance is missing!");
             // Handle critical error - maybe show an error message and halt?
        }
        if (!this.multiplayerClientManager) {
             console.warn("[GameCoordinator] MultiplayerClientManager instance not provided. Client functionality might be limited.");
             // This might be acceptable if only single-player is used, but warn anyway.
        }

        this.activeGame = null; // Reference to the currently active game instance
        this.activeHostManager = null; // Reference to the active MultiplayerHostManager
        this.pendingHostInfo = null; // Store temporary info while host lobby is active
        this.pendingJoinInfo = null; // Store temporary info while join process is active
        this.currentGameMode = null; // 'single', 'practice', 'multiplayer-host', 'multiplayer-client'

        this.localPlayerName = null; // Stores the name of the local player (for client)
        this.currentPlayerList = new Map(); // Store the current player list (client-side)

        // Load player name early
        this._loadPlayerName();

        // Bind methods BEFORE registering listeners
        this._bindMethods(); 
        // Register listeners AFTER binding
        this.registerListeners(); 
    }

    /**
     * Binds methods used as event handlers to the correct `this` context.
     * @private
     */
    _bindMethods() {
        // Bind all methods used as event handlers
        this.handleRequestSinglePlayer = this.handleRequestSinglePlayer.bind(this);
        this.handleRequestPractice = this.handleRequestPractice.bind(this);
        this.handleRequestMultiplayerChoice = this.handleRequestMultiplayerChoice.bind(this);
        this.handleStartRequested = this.handleStartRequested.bind(this);
        this.handleStartMultiplayerHost = this.handleStartMultiplayerHost.bind(this);
        this.handleShowJoinLobby = this.handleShowJoinLobby.bind(this);
        this.handleJoinMultiplayerAttempt = this.handleJoinMultiplayerAttempt.bind(this);
        this.handleHostStartGame = this.handleHostStartGame.bind(this);
        this.handleClientConfirmJoin = this.handleClientConfirmJoin.bind(this);
        this.handleLobbyCancel = this.handleLobbyCancel.bind(this); // Bind the cancel handler
        this.handleLeaveGame = this.handleLeaveGame.bind(this);
        this.handleWebRTCConnectionFailure = this.handleWebRTCConnectionFailure.bind(this);
        this.handleClientReceivedGameInfo = this.handleClientReceivedGameInfo.bind(this);
        this._handleValidJoinCodeDetected = this._handleValidJoinCodeDetected.bind(this);
        this._handleClientConnectedToHost = this._handleClientConnectedToHost.bind(this);
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        this._handleWebRTCMessageReceived = this._handleWebRTCMessageReceived.bind(this); // ADD: Bind the new handler
        // ADD: Bind handler for local player finishing
        this._handleLocalPlayerFinished = this._handleLocalPlayerFinished.bind(this); 
        // ADD: Bind handler for saving score
        this.handleSaveHighscore = this.handleSaveHighscore.bind(this);
        // +++ ADD: Bind handler for Host Waiting +++
        this._handleHostWaiting = this._handleHostWaiting.bind(this);
        this._handleMultiplayerDialogClosed = this._handleMultiplayerDialogClosed.bind(this); // Bind new handler
    }

    /**
     * Registers listeners for UI events that trigger game starts.
     * Uses pre-bound methods from _bindMethods.
     * @private
     */
    registerListeners() {
        console.info("[GameCoordinator ASYNC] Registering event listeners...");
        // Listen for UI events signaling intent - Use pre-bound methods
        eventBus.on(Events.UI.MainMenu.StartSinglePlayerClicked, this.handleRequestSinglePlayer);
        eventBus.on(Events.UI.MainMenu.StartPracticeClicked, this.handleRequestPractice);
        eventBus.on(Events.UI.MainMenu.JoinMultiplayerClicked, this.handleRequestMultiplayerChoice);

        // Listen for generic StartRequested event (likely from SheetSelection or future direct starts)
        eventBus.on(Events.Game.StartRequested, this.handleStartRequested); 

        // Multiplayer specific UI flows
        eventBus.on(Events.UI.MultiplayerChoice.HostClicked, this.handleStartMultiplayerHost);
        eventBus.on(Events.UI.MultiplayerChoice.JoinClicked, this.handleShowJoinLobby); 
        eventBus.on(Events.UI.JoinLobby.SubmitCodeClicked, this.handleJoinMultiplayerAttempt);
        eventBus.on(Events.UI.HostLobby.StartGameClicked, this.handleHostStartGame);
        eventBus.on(Events.UI.JoinLobby.ConfirmClicked, this.handleClientConfirmJoin);
        eventBus.on(Events.UI.HostLobby.CancelClicked, this.handleLobbyCancel); // Add listener
        eventBus.on(Events.UI.JoinLobby.CancelClicked, this.handleLobbyCancel); // Add listener (uses same handler)
        eventBus.on(Events.UI.MultiplayerLobby.LeaveClicked, this.handleLobbyCancel); // ADDED: Treat leaving lobby same as cancelling

        // Listen for game lifecycle events to clean up
        eventBus.on(Events.Game.Finished, (payload) => this.handleGameFinished(payload));
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleLeaveGame); 
        eventBus.on(Events.WebRTC.ConnectionFailed, this.handleWebRTCConnectionFailure);

        // Listen for game info received by client to store settings
        eventBus.on(Events.Multiplayer.Client.GameInfoReceived, this.handleClientReceivedGameInfo);

        // Listen for join code detected in URL
        eventBus.on(Events.System.ValidJoinCodeDetected, this._handleValidJoinCodeDetected);

        // Listen for connection events from WebRTCManager
        eventBus.on(Events.Multiplayer.Client.ConnectedToHost, this._handleClientConnectedToHost);

        // --- ADD: Listener for raw WebRTC messages (for GAME_INFO etc.) ---
        eventBus.on(Events.WebRTC.MessageReceived, this._handleWebRTCMessageReceived);

        // --- ADD: Listener for player list updates (host side) ---
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate.bind(this));

        // ADD: Listen for the local client finishing their game
        eventBus.on(Events.Game.LocalPlayerFinished, this._handleLocalPlayerFinished);

        // +++ ADDED: Listen for Host Waiting event +++
        eventBus.on(Events.Multiplayer.HostWaiting, this._handleHostWaiting);
        
        // +++ ADDED: Listen for Save Score click +++
        eventBus.on(Events.UI.EndDialog.SaveScoreClicked, this.handleSaveHighscore);

        // +++ ADDED: Listen for Multiplayer End Dialog Closed event +++
        eventBus.on(Events.UI.MultiplayerEndDialog.Closed, this._handleMultiplayerDialogClosed);

        // <<< Add Listener for Play Again Click >>>
        eventBus.on(Events.UI.MultiplayerEndDialog.PlayAgainClicked, this._handlePlayAgainRequest);

        console.info("[GameCoordinator ASYNC] Event listeners registered.");
    }

    /**
     * Handles the request to start a single-player game from the Main Menu.
     * Navigates to the SheetSelection view.
     * @private
     */
    handleRequestSinglePlayer() {
        console.log("[GameCoordinator] Received StartSinglePlayerClicked from MainMenu. Navigating to Sheet Selection.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to sheet selection, a game is active.");
            // Use template for feedback
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        // Navigate to Sheet Selection, passing the intended mode
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'single' } });
    }
    
    /**
     * Handles the request to start a practice game from the Main Menu.
     * Navigates to the SheetSelection view.
     * @private
     */
    handleRequestPractice() {
        console.log("[GameCoordinator] Received StartPracticeClicked from MainMenu. Navigating to Sheet Selection.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to sheet selection, a game is active.");
            // Use template for feedback
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        // Navigate to Sheet Selection, passing the intended mode
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'practice' } });
    }

    /**
     * Handles the generic request to start a game, typically from SheetSelectionComponent.
     * @param {object} payload - Event payload from Events.Game.StartRequested
     * @param {'single' | 'practice' | 'multiplayer-host' | 'multiplayer-join'} payload.mode - The requested game mode.
     * @param {object} payload.settings - Game settings (e.g., sheetIds, difficulty).
     * @param {string} [payload.playerName] - Player's name (may be needed for some modes).
     * @param {string} [payload.hostId] - Host ID if joining.
     * @private
     */
    async handleStartRequested({ mode, settings, playerName, hostId }) {
        console.log(`[GameCoordinator ASYNC] Received Game.StartRequested. Mode: ${mode}`, { settings, playerName, hostId });
        if (this.activeGame || this.activeHostManager) { // Check both active game and host manager
            console.warn("[GameCoordinator ASYNC] Cannot start new game/host, another session is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorStartWhileActive'), level: 'error' }); 
            return;
        }

        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        await new Promise(resolve => setTimeout(resolve, 100)); 

        try {
            let quizEngineInstance;
            switch (mode) {
                case 'single':
                    console.log(`[GameCoordinator ASYNC] Starting Single Player game with settings:`, settings);
                    // Get the SINGLETON engine instance
                    quizEngineInstance = QuizEngine.getInstance();
                    // Load questions into the SINGLETON instance
                    await quizEngineInstance.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
                    if (quizEngineInstance.getQuestionCount() === 0) {
                         throw new Error("No questions loaded for selected sheets/difficulty.");
                    }
                    
                    const spPlayerName = playerName || miscUtils.getTextTemplate('defaultPlayerName'); 
                    // Create game instance, passing the SINGLETON engine
                    this.activeGame = new SinglePlayerGame(settings, quizEngineInstance, spPlayerName);
                    // BaseGameMode start() will now use the passed (and loaded) instance
                    await this.activeGame.start(); 
                    break;
                case 'practice':
                    console.log(`[GameCoordinator ASYNC] Starting Practice game with settings:`, settings);
                     // Get the SINGLETON engine instance
                     quizEngineInstance = QuizEngine.getInstance();
                     // Load questions into the SINGLETON instance
                     await quizEngineInstance.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
                     if (quizEngineInstance.getQuestionCount() === 0) {
                          throw new Error("No questions loaded for selected sheets/difficulty.");
                     }
                    // Create game instance, passing the SINGLETON engine
                    this.activeGame = new PracticeGame(settings, quizEngineInstance); // Assuming PracticeGame constructor is similar
                    await this.activeGame.start(); 
                    break;
                case 'multiplayer-host':
                    // ... (existing multiplayer-host logic remains largely the same) ...
                    // It fetches questionsData, starts WebRTCManager, then creates MultiplayerHostManager
                    // MultiplayerHostManager internally uses QuizEngine.getInstance() for its logic
                    // And MultiplayerGame (Host) constructor also gets the singleton instance passed.
                    // So, no QuizEngine instance needs explicit handling here for the *host* flow.
                    console.log(`[GameCoordinator ASYNC] Handling StartRequested for multiplayer-host. Player: ${playerName}, Settings:`, settings);
                    // ... (rest of host logic: validation, fetch questions, start WebRTC, create Host Manager) ...
                     // Fetch the full question data for the selected sheets
                    let hostQuestionsData = null;
                    try {
                         // ... fetch logic using this.questionsManager ...
                          if (!settings || !Array.isArray(settings.sheetIds) || settings.sheetIds.length === 0) {
                               throw new Error("No sheet IDs selected.");
                          } 
                          console.log(`[GameCoordinator ASYNC] Fetching questions for sheets:`, settings.sheetIds);
                          hostQuestionsData = await this.questionsManager.getQuestionsForSheets(settings.sheetIds);
                          console.log(`[GameCoordinator ASYNC] Fetched questions data:`, hostQuestionsData);
                         
                    } catch (fetchError) { /* ... error handling ... */ return; }

                    if (!hostQuestionsData || !hostQuestionsData.sheets || hostQuestionsData.sheets.length === 0) { /* ... error handling ... */ return; }
                    
                    console.log(`[GameCoordinator ASYNC] Starting WebRTC host for ${playerName}...`);
                    try {
                         // Pass fetched questionsData and difficulty to WebRTCManager
                         await webRTCManager.startHost(playerName, hostQuestionsData, settings.difficulty); 
                    } catch (rtcError) { /* ... error handling ... */ return; }
                    
                    const hostId = webRTCManager.getMyPeerId();
                    if (!hostId) { /* ... error handling ... */ return; }
                    
                    // ---- Store Complete Settings in pendingHostInfo ----
                    this.pendingHostInfo = { 
                        playerName: playerName, 
                        settings: settings // Now includes sheetIds from the event
                    };
                    console.log(`[GameCoordinator ASYNC] Stored complete pending host info:`, this.pendingHostInfo);
                    // ---- End Store ----

                    // Create and initialize MultiplayerHostManager (it uses singleton QuizEngine internally)
                    try {
                        console.log(`[GameCoordinator ASYNC] Creating MultiplayerHostManager for host ${hostId} with name ${playerName}`);
                        // Host Manager doesn't need the QuizEngine instance passed, uses singleton
                        const hostManager = new MultiplayerHostManager(playerName, settings.sheetIds, settings.difficulty, hostId);
                        console.log("[GameCoordinator ASYNC] Initializing MultiplayerHostManager...");
                        await hostManager.initialize(); // Loads questions into singleton engine
                        console.log("[GameCoordinator ASYNC] Starting hosting listeners in MultiplayerHostManager...");
                        hostManager.startHosting();
                        this.activeHostManager = hostManager;
                        this.currentGameMode = 'multiplayer-host';
                    } catch (hostManagerError) { /* ... error handling ... */ return; }

                    console.log("[GameCoordinator ASYNC] Navigating to Host Lobby.");
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.HostLobby });
                    break;
                case 'multiplayer-join':
                     console.error("[GameCoordinator ASYNC] Internal Error: Attempted to join multiplayer via unsupported StartRequested event. Use MultiplayerChoice -> JoinClicked flow.");
                     // Log detailed error, show generic feedback
                     eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    break;
                default:
                    // Log detailed error, show generic feedback
                    console.error(`[GameCoordinator ASYNC] Internal Error: Unknown game mode requested: ${mode}`);
                    eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    return; // Exit early
            }
            console.log(`[GameCoordinator ASYNC] ${mode} game instance created and started or host manager initialized.`);
        } catch (error) {
            // ... (existing error handling remains the same) ...
            console.error(`[GameCoordinator ASYNC] Error during game start process for mode \'${mode}\':`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: error.message || miscUtils.getTextTemplate('gameErrorGenericStartFail'), level: 'error' });
            this.resetCoordinatorState(); // Use central reset function
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Fallback to main menu
        }
    }

    /**
     * Handles the request to navigate to the Multiplayer Choice screen.
     * @private
     */
     handleRequestMultiplayerChoice() {
        console.log("[GameCoordinator] Received JoinMultiplayerClicked from MainMenu. Navigating to MP Choice.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to MP choice, a game is active.");
             // Use template for feedback
             eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        // Navigate directly to Multiplayer Choice
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
     }

    /**
     * Handles the Host button click from the Multiplayer Choice view.
     * Stores initial host info and navigates to Sheet Selection.
     * @param {object} payload - From Events.UI.MultiplayerChoice.HostClicked.
     * @param {string} payload.playerName - The host's chosen name.
     * @param {object} payload.settings - Initial settings (likely just difficulty).
     * @private
     */
    handleStartMultiplayerHost({ playerName, settings }) {
        console.log(`[GameCoordinator] Received HostClicked from MultiplayerChoice. Player: ${playerName}`, settings);
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to host sheet selection, a game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }

        if (!playerName) {
            console.error("[GameCoordinator] HostClicked event missing player name.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            return;
        }

        // Store initial info (playerName and difficulty)
        // sheetIds will be added later by SheetSelectionComponent
        this.pendingHostInfo = { 
            playerName: playerName, 
            settings: settings || { difficulty: 'medium' } // Ensure settings object exists
        }; 
        console.log("[GameCoordinator] Stored pending host info:", this.pendingHostInfo);

        // Navigate to Sheet Selection, passing the mode and player name
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.SheetSelection, 
            data: { 
                mode: 'multiplayer-host',
                playerName: playerName, // Pass name so SheetSelection knows who is hosting
                difficulty: settings.difficulty 
            } 
        });
    }

    /**
     * Handles the Join button click from the Multiplayer Choice view.
     * Navigates the user to the Join Lobby view.
     * @param {object} payload - From Events.UI.MultiplayerChoice.JoinClicked.
     * @param {string} payload.playerName - The player's chosen name.
     * @private
     */
    handleShowJoinLobby({ playerName }) {
        console.log(`[GameCoordinator] Received JoinClicked from MultiplayerChoice. Player: ${playerName}. Navigating to Join Lobby.`);
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to join lobby, a game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }

        if (!playerName) {
            console.error("[GameCoordinator] JoinClicked event missing player name.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            return;
        }

        // Navigate to Join Lobby, passing the player name
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.JoinLobby, 
            data: { 
                playerName: playerName 
            } 
        });
    }

    /**
     * Handles the detection of a valid join code in the URL parameters.
     * Retrieves player name, navigates to Join Lobby (connecting state),
     * and triggers the connection attempt.
     * @param {object} payload - From Events.System.ValidJoinCodeDetected.
     * @param {string} payload.code - The valid 6-digit join code.
     * @private
     */
    _handleValidJoinCodeDetected({ joinCode }) {
        console.log('[DEBUG] Raw arguments received in _handleValidJoinCodeDetected:', arguments); // Added for debugging
        console.log(`[GameCoordinator] Received ValidJoinCodeDetected event. Code: ${joinCode}`);
        // Ensure player name is loaded/generated first
        if (!this.localPlayerName) {
            this._loadPlayerName();
        }
        // Use the CORRECT function name via miscUtils default import
        const playerName = this.localPlayerName || miscUtils.generateRandomPlayerName(); 
        
        // Show Join Lobby with connecting state
        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.JoinLobby,
            data: { playerName: playerName, joinCode: joinCode, showConnecting: true }
        });
        // Automatically trigger the connection attempt
        this.handleJoinMultiplayerAttempt({ code: joinCode, playerName: playerName });
    }

    /**
     * Handles the *initial attempt* to join via code submission (manual or from URL).
     * Triggers WebRTC connection attempt.
     * @param {object} payload - From Events.UI.JoinLobby.SubmitCodeClicked.
     * @param {string} payload.code - Submitted host code.
     * @param {string} payload.playerName - Joining player's name.
     * @private
     */
    async handleJoinMultiplayerAttempt({ code, playerName }) {
        console.log(`[GameCoordinator] Received Join SubmitCodeClicked event. Code: ${code}, Player: ${playerName}`);
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot join, a game/connection is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorJoinWhileActive'), level: 'error' });
            return;
        }
        if (!code || code.length !== 6 || !playerName) {
            console.error("[GameCoordinator] Invalid join attempt data.", { code, playerName });
            eventBus.emit(Events.UI.JoinLobby.Error, { message: miscUtils.getTextTemplate('joinErrorInvalidInput') });
            return;
        }

        // Store the local player name AND initialize pending join info
        this.localPlayerName = playerName;
        this.pendingJoinInfo = { 
            hostId: code, // Store the target host ID
            playerName: playerName, // Store the name used for this attempt
            questionsData: null, // Will be populated by GameInfoReceived
            difficulty: null,    // Will be populated by GameInfoReceived
            players: null        // Will be populated by GameInfoReceived
        };
        console.log(`[GameCoordinator] Initialized pendingJoinInfo for host ${code}`);

        console.log(`[GameCoordinator] Attempting WebRTC client connection to host: ${code}`);
        // Start connection attempt (WebRTCManager will handle the UI updates via events)
        this.webRTCManager.connectToHost(code, playerName);
    }

     /**
     * Handles the host clicking "Start Game" in the Host Lobby.
     * Creates and starts the MultiplayerGame instance (host side).
     * @private
     */
    async handleHostStartGame() {
        console.log("[GameCoordinator] Received StartGameClicked from HostLobby.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Host StartGameClicked ignored, a game is already active.");
             // Use template for feedback
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }

        if (!this.pendingHostInfo || !this.pendingHostInfo.playerName || !this.pendingHostInfo.settings || !this.pendingHostInfo.settings.sheetIds) {
            console.error("[GameCoordinator] Internal Error: Host clicked Start Game, but pendingHostInfo is missing or incomplete (needs sheetIds!).", this.pendingHostInfo);
            // Use template for feedback
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Go back home
            this.pendingHostInfo = null; // Clear partial info
            return;
        }

        // Get the peer ID early to avoid redeclaration
        const myPeerId = webRTCManager.getMyPeerId();
        
        // Check if any clients are connected
        const players = webRTCManager.getConnectedPlayers();
        let totalClientCount = 0;
        
        if (players && players.size > 0) {
            players.forEach((playerData, peerId) => {
                // Skip the host in the count
                if (peerId !== myPeerId) {
                    totalClientCount++;
                }
            });
        }
        
        // Ensure there's at least one client connected
        if (totalClientCount === 0) {
            console.warn("[GameCoordinator] Host tried to start game without any connected clients.");
            eventBus.emit(Events.System.ShowFeedback, { 
                message: miscUtils.getTextTemplate('mpHostErrorNoClients') || "Cannot start game without players", 
                level: 'error'
            });
            return;
        }

        // Retrieve stored info
        const { playerName, settings } = this.pendingHostInfo;

        if (!myPeerId) {
            console.error("[GameCoordinator] Internal Error: Host clicked Start Game, but WebRTCManager has no local peer ID.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorNoIdOnStart'), level: 'error' }); 
            // Potentially try to re-init or guide user?
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.pendingHostInfo = null; // Clear pending info
            return;
        }

        console.log(`[GameCoordinator] Starting Multiplayer Game as Host. Player: ${playerName}, HostID: ${myPeerId}, Settings:`, settings);
        this.pendingHostInfo = null; // Clear pending info now that we're starting the game

        // --- Ensure HostManager exists and tell it to start the game sequence --- 
        if (!this.activeHostManager) {
            console.error("[GameCoordinator] Critical Error: handleHostStartGame called without an active HostManager.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return; // Stop execution
        }
        
        // Tell the manager to stop lobby listeners and broadcast GAME_START
        if (typeof this.activeHostManager.initiateGameStart === 'function') {
             this.activeHostManager.initiateGameStart();
         } else {
             console.error("[GameCoordinator] Error: activeHostManager missing initiateGameStart method!");
             eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
             return; // Stop execution
         }
        // --- End HostManager Start --- 

        // Show loading screen WHILE the game instance is created/started
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow loading screen to render

        try {
             // Game Instance Creation (Host)
            // This should happen AFTER HostManager has broadcasted GAME_START
            console.log("[GameCoordinator] Creating host MultiplayerGame instance...");
            this.activeGame = new MultiplayerGame(
                true,                 // isHost
                playerName,
                settings,             // Host expects settings
                settings.difficulty,
                myPeerId,
                webRTCManager
            );
            await this.activeGame.start(); // This emits Game.Started -> Navigates UI
            this.currentGameMode = 'multiplayer-host'; // Set mode tracking AFTER successful start

        } catch (error) {
            console.error("[GameCoordinator] Error starting Multiplayer Game (Host):", error);
            // Use template for feedback
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' }); 
            this.activeGame = null; // Nullify on error
            webRTCManager.closeConnection(); // Attempt to clean up WebRTC
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Back to menu
        }
    }

    /**
     * Handles receiving game info from the host (forwarded by MultiplayerClientManager).
     * Stores the info if the host ID matches the pending join attempt.
     * @param {object} payload - From Events.Multiplayer.Client.GameInfoReceived.
     * @param {object} payload.questionsData - The full question data.
     * @param {string} payload.difficulty - Game difficulty.
     * @param {Map<string, object>} payload.players - Current player list.
     * @param {string} payload.hostId - Host's PeerJS ID.
     * @private
     */
    handleClientReceivedGameInfo({ questionsData, difficulty, players, hostId }) {
        console.log(`[GameCoordinator] Client received Game Info from host ${hostId}`, { questionsData, difficulty, players });

        if (!this.pendingJoinInfo || this.pendingJoinInfo.hostId !== hostId) {
            console.warn("[GameCoordinator] Received GameInfo, but no matching pendingJoinInfo found or hostId mismatch.", 
                         { expectedHost: this.pendingJoinInfo?.hostId, receivedHost: hostId });
            // This might happen if the join process was cancelled or timed out just before info arrived.
            return;
        }

        // Store the received game details in the pending info
        this.pendingJoinInfo.questionsData = questionsData; 
        this.pendingJoinInfo.difficulty = difficulty;
        this.pendingJoinInfo.players = players; // Store players map as well
        console.log("[GameCoordinator] Stored game details in pendingJoinInfo.");
        
        // JoinLobbyComponent also listens for GameInfoReceived directly to display info.
    }

    /**
     * Handles the client confirming they want to join after seeing game info.
     * Sent by JoinLobbyComponent when the confirm button is clicked.
     * Triggers the sending of the c_requestJoin message to the host.
     * @param {object} payload - Event payload from Events.UI.JoinLobby.ConfirmClicked.
     * @param {string} payload.playerName - The name the player confirmed with.
     * @private
     */
    handleClientConfirmJoin({ playerName }) {
        if (!this.pendingJoinInfo || !this.pendingJoinInfo.hostId) {
            console.error("[GameCoordinator] handleClientConfirmJoin called, but no pending join info or hostId found.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        const hostId = this.pendingJoinInfo.hostId;
        console.log(`[GameCoordinator] Client confirmed join. Host ID: ${hostId}, Player Name: ${playerName}`);

        // Update the stored player name for this join attempt
        this.pendingJoinInfo.playerName = playerName;

        // Tell WebRTCManager (via Client Manager) to send the join request
        try {
            if (!this.multiplayerClientManager) {
                throw new Error("MultiplayerClientManager is not available.");
            }
            console.log(`[GameCoordinator] Sending c_requestJoin message to host ${hostId}`);
            this.multiplayerClientManager.sendJoinRequest(playerName);
        } catch (error) {
            console.error("[GameCoordinator] Error sending join request:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: `Error joining game: ${error.message || 'Network issue'}`, level: 'error' });
            // Don't necessarily navigate away, let user retry?
            // Maybe reset state partially?
            this.resetCoordinatorState(); // For now, reset fully and go to main menu
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        // Successfully sent join request. Now show the lobby/waiting dialog.
        console.log("[GameCoordinator] Join request sent. Showing Multiplayer Lobby Dialog.");
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.MultiplayerLobby, // Use constant
            data: { 
                // Pass any initial data needed by the lobby dialog?
                // e.g., maybe the player list received in GameInfo?
                players: this.pendingJoinInfo.lastReceivedGameInfo?.players, 
                localPlayerId: webRTCManager.peerId // Pass local ID for highlighting
            } 
        });
        
        // No longer need the JoinLobby component view active.
        // (It should have hidden itself already when emitting the event).
    }

    /**
     * Handles cancelling the host or join lobby process OR leaving the client waiting lobby.
     * Cleans up any pending state and navigates back to the main menu.
     * @private
     */
    handleLobbyCancel() {
        console.log("[GameCoordinator] Lobby cancelled or left.");
        const wasHost = this.pendingHostInfo !== null;
        const wasJoining = this.pendingJoinInfo !== null;

        // Reset pending states
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;

        // Close WebRTC connection if it was initiated
        if (wasHost || wasJoining) {
            webRTCManager.closeConnection(); // Close connection if host/client init started
        }

        // Ensure any active game instance is cleaned up (shouldn't be one, but safety)
        this.resetCoordinatorState();

        // Navigate back to the main menu
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Instantiates and starts a MultiplayerGame instance (either host or client).
     * @param {boolean} isHost - True if starting as host, false as client.
     * @param {string} playerName - Local player's name.
     * @param {object} gameData - Either settings (host) or questionsData (client).
     * @param {string} difficulty - Game difficulty (used by both).
     * @param {string} peerId - Own ID if host, Host's ID if client.
     * @private
     */
    async startMultiplayerGameInstance(isHost, playerName, gameData, difficulty, peerId) {
        // REMOVED: Loading screen display. Client stays on JoinLobby waiting view.
        // eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        // await new Promise(resolve => setTimeout(resolve, 100)); 

        try {
             // Structure the gameData argument based on role
             let constructorGameData;
             if (isHost) {
                 // Host expects the settings object directly
                 constructorGameData = gameData; 
             } else {
                 // Client expects an object like { questionsData: ... }
                 // Ensure gameData passed here is the actual questions object
                 if (!gameData || !Array.isArray(gameData.sheets)) { 
                     console.error("[GameCoordinator] Invalid questions data provided for client instance:", gameData);
                     throw new Error("Internal error: Invalid questions data format for client.");
                 }
                 constructorGameData = { questionsData: gameData }; // Wrap it
             }

             // Pass difficulty to constructor for both host and client
             // Pass the correctly structured constructorGameData
             this.activeGame = new MultiplayerGame(isHost, playerName, constructorGameData, difficulty, peerId, webRTCManager);
             
             this.currentGameMode = isHost ? 'multiplayer-host' : 'multiplayer-client'; // Set mode tracking
             
             await this.activeGame.start();
            // Navigation to GameArea happens via Game.Started event
        } catch (error) {
            console.error(`[GameCoordinator] Error starting Multiplayer Game (${isHost ? 'Host' : 'Client'}):`, error);
             const errorMsg = isHost ? miscUtils.getTextTemplate('mpHostErrorGameStartFail') : miscUtils.getTextTemplate('mpClientErrorGameStartFail');
             eventBus.emit(Events.System.ShowFeedback, { message: errorMsg, level: 'error' }); 
            this.activeGame = null; // Nullify on error
            if (!isHost) { // Only close connection if client fails to start game instance
                 webRTCManager.closeConnection(); 
            }
            // Ensure navigation back to MainMenu on error, NOT loading
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Back to menu
        }
    }

    // --- Game Lifecycle Handlers --- 

    /**
     * Handles the end of any game mode.
     * Cleans up the active game instance.
     * NOTE: For multiplayer clients, final cleanup is deferred until GAME_OVER is received from host.
     * @private
     */
    handleGameFinished({ mode, results }) {
        console.log(`[GameCoordinator ASYNC] Received Game.Finished event for mode: ${mode}`, results);

        // --- Client Ignore Host's Local Finish ---
        if (this.currentGameMode === 'multiplayer-client' && mode === 'multiplayer-host') {
            console.log("[GameCoordinator Client] Ignored host's local Game.Finished event. Waiting for GAME_OVER message.");
            return; // Client waits for the GAME_OVER message via WebRTC
        }
        // --- End Ignore ---

        const wasMultiplayerClient = (mode === 'multiplayer-client');

        if (this.activeGame) {
            // If it's NOT the client finishing its local loop, clean up now.
            if (!wasMultiplayerClient) {
                 console.log(`[GameCoordinator ASYNC] Cleaning up active ${mode} game.`);

                 // Store results before potentially destroying the game object that holds them
                 // Use optional chaining for safety in case results are missing
                 const finalResults = results || this.activeGame?.getFinalResults?.();

                 if (typeof this.activeGame.destroy === 'function') {
                     this.activeGame.destroy();
                 }
                 this.activeGame = null;
                 this.currentGameMode = null;

                 // --- HIDE Waiting Dialog if open ---
                 /** @type {import('../dialogs/waiting-dialog').default | undefined} */
                 const waitingDialog = uiManager.getComponent('WaitingDialog');
                 if (waitingDialog && waitingDialog.isOpen) { // Check if it's actually open
                     console.log("[GameCoordinator ASYNC] Hiding WaitingDialog before showing End Dialog.");
                     waitingDialog.hide(); // Use hide() instead of close() if that's the method
                 }
                 // --- END HIDE Waiting Dialog ---

                 // --- Show Appropriate End Dialog ---
                 if (mode === 'single') {
                     console.log("[GameCoordinator ASYNC] Requesting UIManager show Single Player End Dialog.");
                     
                     // *** Construct payload assuming finalResults is valid (NO extra validation here) ***
                     const dialogData = {
                         // Pass existing top-level properties 
                         score: finalResults.score,
                         playerName: finalResults.playerName,
                         correctAnswers: finalResults.correctAnswers,
                         totalQuestions: finalResults.totalQuestions,
                         eligibleForHighscore: finalResults.eligibleForHighscore,
                         // Assign difficulty and constructed gameName directly from settings
                         difficulty: finalResults.settings.difficulty, 
                         gameName: finalResults.settings.sheetIds.join(', '),
                         mode: 'single' // Explicitly set mode for the dialog
                     };
                     // *** END CONSTRUCTION ***
                     
                     eventBus.emit(Events.Navigation.ShowView, {
                         viewName: Views.SinglePlayerEndDialog,
                         data: dialogData // Use the constructed data object
                     });
                 } else if (mode === 'multiplayer-host') {
                      console.log("[GameCoordinator ASYNC] Processing Multiplayer Host finish.");

                      // --- SAVE Multiplayer Highscore (WINNER ONLY) ---
                      if (finalResults && finalResults.winner && finalResults.winner.score > 0) {
                          const winner = finalResults.winner;
                          console.log(`[GameCoordinator ASYNC] Multiplayer winner: ${winner.name}, Score: ${winner.score}. Attempting to save highscore.`);
                          try {
                              // CORRECTED: Use the correct method name 'addHighscore'
                              highscoreManager.addHighscore(
                                  winner.name,
                                  winner.score,
                                  finalResults.gameName || 'Multiplayer Game',
                                  'multiplayer', // Set mode correctly
                                  finalResults.difficulty || 'unknown'
                              );
                              console.log("[GameCoordinator ASYNC] Highscore save request sent for winner.");
                          } catch (error) {
                               console.error(`[GameCoordinator ASYNC] Error saving highscore for winner ${winner.name}:`, error);
                               eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveErrorGeneric') || 'Failed to save score.', level: 'error' });
                          }
                      } else {
                          console.log("[GameCoordinator ASYNC] No single winner found or winner score is 0. No highscore saved.");
                      }
                      // --- END SAVE Multiplayer Highscore ---

                      // --- Show Multiplayer End Dialog ---
                      console.log("[GameCoordinator ASYNC] Requesting UIManager show Multiplayer End Dialog.");
                      eventBus.emit(Events.Navigation.ShowView, {
                          viewName: Views.MultiplayerEndDialog,
                          data: finalResults || {}
                      });
                      // --- END Show Multiplayer End Dialog ---

                 } else if (mode === 'practice') {
                     console.log("[GameCoordinator ASYNC] Requesting UIManager show PracticeEndDialog.");
                     eventBus.emit(Events.Navigation.ShowView, {
                         viewName: Views.PracticeEndDialog,
                         data: finalResults || {}
                     });
                 }
                 // --- End Show Appropriate End Dialog ---

                 // Close connection if host finished
                 if (mode === 'multiplayer-host') {
                     console.log("[GameCoordinator ASYNC] Closing WebRTC connection after Host game finished and processed.");
                     webRTCManager.closeConnection();
                 }

            } else {
                 // Client finished locally - wait for GAME_OVER
                 console.log(`[GameCoordinator ASYNC] Client finished locally. Waiting for GAME_OVER from host for final cleanup.`);
            }
        } else {
            console.warn("[GameCoordinator ASYNC] Game.Finished received, but no active game found.");
            // Ensure connection is closed if necessary based on mode
             if (mode === 'multiplayer-host' || mode === 'multiplayer-client') {
                 webRTCManager.closeConnection();
             }
        }
    }

    /**
     * Handles the user explicitly leaving the game.
     * @private
     */
    handleLeaveGame() {
        console.log("[GameCoordinator] Received request to leave game.");
        if (this.activeGame) {
            console.log("[GameCoordinator] Destroying active game due to leave request.");
            
            // --- Provide feedback on leave --- 
            const mode = this.currentGameMode; // Get current mode before destroying
            if (typeof this.activeGame.destroy === 'function') {
                 this.activeGame.destroy(); // This now sends CLIENT_LEFT if applicable
             }
            this.activeGame = null;
            this.currentGameMode = null;

            // Show feedback AFTER attempting destruction/notification
            let feedbackKey = 'gameLeftFeedbackGeneric';
            if (mode === 'multiplayer-client') {
                 feedbackKey = 'gameLeftFeedbackClient';
            } else if (mode === 'multiplayer-host') {
                 feedbackKey = 'gameLeftFeedbackHost';
            }
            const feedbackMessage = miscUtils.getTextTemplate(feedbackKey);
            if (feedbackMessage) {
                eventBus.emit(Events.System.ShowFeedback, { message: feedbackMessage, level: 'info' });
            }
            // --- End Feedback ---

            // Navigate immediately back to main menu
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            // WebRTC connection is closed within the game's destroy() method now
            // webRTCManager.closeConnection(); 
        } else {
            console.warn("[GameCoordinator] LeaveGame request received, but no active game found.");
             // Ensure navigation back if somehow stuck
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles WebRTC connection failures reported by WebRTCManager.
     * @param {object} payload - Event payload from Events.WebRTC.ConnectionFailed
     * @param {Error} payload.error - The error object.
     * @param {string} payload.context - Context where failure occurred.
     * @param {string} [payload.peerId] - Peer ID involved, if applicable.
     * @private
     */
    handleWebRTCConnectionFailure({ error, context, peerId }) {
        console.error(`[GameCoordinator] WebRTC Connection Failure. Context: ${context}, Peer: ${peerId}`, error);
        // Clean up any pending operations
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;
        // If a game was active, destroy it (though maybe WebRTCManager already did?)
        if (this.activeGame) {
            console.warn("[GameCoordinator] Destroying active game due to WebRTC failure.");
             if (this.activeGame && typeof this.activeGame.destroy === 'function') {
                  this.activeGame.destroy();
              }
            this.activeGame = null;
        }
        // Ensure connection is closed by WebRTCManager
        webRTCManager.closeConnection(); 
        
        // Show appropriate error dialog based on context
        let errorKey = 'errorDialogGenericConnection'; // Default key
        if (error.type === 'peer-unavailable') {
            errorKey = 'errorDialogHostUnavailable'; 
        } else if (error.type === 'network' || error.message === 'Lost connection to signaling server.') {
            errorKey = 'errorDialogNetwork';
        }
        
        /** @type {ErrorDialog} */
        const errorDialog = uiManager.getComponent('ErrorDialog'); // Use hardcoded name
        if (errorDialog) {
            // Construct the message string before showing
            const baseMessage = miscUtils.getTextTemplate(errorKey);
            // Show ONLY the user-friendly message in the dialog
            errorDialog.show(baseMessage);
        } else {
            // Fallback if dialog isn't available
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate(errorKey), level: 'error' });
        }

        // Ensure UI is back at the main menu *after* showing the dialog
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Resets the coordinator's internal state.
     * @private
     */
    resetCoordinatorState() {
        console.log("[GameCoordinator ASYNC] Resetting state...");
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;
        // Only destroy activeGame if it hasn't been handled already
        if (this.activeGame && typeof this.activeGame.destroy === 'function') {
            console.warn("[GameCoordinator ASYNC] resetCoordinatorState called with active game - destroying.");
             this.activeGame.destroy(); 
        }
        if (this.activeHostManager && typeof this.activeHostManager.destroy === 'function') {
             this.activeHostManager.destroy();
        }
        this.activeGame = null;
        this.currentGameMode = null;
        this.activeHostManager = null; 
        webRTCManager.closeConnection();
        console.log("[GameCoordinator ASYNC] State reset complete.");
    }

    // --- New method to handle player list updates and forward to UI ---
    /**
     * Handles player list updates from MultiplayerHostManager.
     * Updates the Host Lobby component if it's active.
     * @param {object} payload - From Events.Multiplayer.Common.PlayerListUpdated.
     * @param {Map<string, object>} payload.players - The updated player map.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        // Only relevant if this instance is potentially hosting (pendingHostInfo exists)
        if (this.pendingHostInfo) {
            /** @type {HostLobbyComponent | undefined} */
            const hostLobbyComp = uiManager.getComponent('HostLobby');
            if (hostLobbyComp && hostLobbyComp.isVisible) {
                 console.debug("[GameCoordinator] Forwarding PlayerListUpdate to HostLobbyComponent.", players);
                 hostLobbyComp.updateDisplay(players);
            } else {
                 console.debug("[GameCoordinator] Received PlayerListUpdate, but HostLobbyComponent not visible or found.");
            }
        }
    }

    // New method to handle connection events from WebRTCManager
    _handleClientConnectedToHost({ hostId }) {
        console.log(`[GameCoordinator] Client connected to host. Host ID: ${hostId}`);
        // Connection is open, but we wait for GAME_INFO before sending c_requestJoin
        // This ensures the host has our initial player entry from metadata
        // before we try to update the name.
    }

    /**
     * Handles incoming raw WebRTC messages for the CLIENT.
     * Starts game on GAME_START, handles GAME_OVER (saves score, triggers final cleanup via dialog).
     * @private
     */
    async _handleWebRTCMessageReceived({ msg, sender }) {
        if (!msg || !msg.type || this.webRTCManager.isHost) return;
        const type = msg.type;
        const payload = msg.payload;
        const hostId = this.pendingJoinInfo?.hostId || this.webRTCManager.hostPeerId;
        if (sender !== hostId) { /* ... warning ... */ return; }
        // console.log(`[GameCoordinator Client ASYNC] Received message Type: ${type} from Host ${sender}`); // Reduce noise

        switch (type) {
            case MSG_TYPE.GAME_START:
                console.log(`[GameCoordinator] Received GAME_START from host ${sender}`);

                // Ensure we are in a state expecting a game start (i.e., pending join)
                if (!this.pendingJoinInfo || this.pendingJoinInfo.hostId !== sender) {
                    console.warn("[GameCoordinator] Received GAME_START, but not in a valid pending join state or hostId mismatch.", { pendingHost: this.pendingJoinInfo?.hostId, receivedHost: sender });
                    // Ignore if we weren't expecting this host to start a game for us.
                    return;
                }

                // Fetch game data and difficulty STASHED during join process
                const storedInfo = this.pendingJoinInfo; // Get the stored info object

                // --- NO OPTIONAL CHAINING: Rely on prior null check --- 
                const gameData = storedInfo.questionsData; // Read directly using correct property name
                const difficulty = storedInfo.difficulty;   // Read directly
                const playerName = storedInfo.playerName;   // Already correct
                const hostId = storedInfo.hostId;         // Already correct
                // --- END CORRECTION ---

                // Verify we have everything needed
                if (!playerName || !hostId || !gameData || !difficulty) {
                    // Keep this detailed log for debugging if issues persist
                     console.error("[GameCoordinator] GAME_START received, but essential pending join info is missing!", 
                                   { pendingJoinInfo: storedInfo, // Log the whole object
                                     hasPlayerName: !!playerName, 
                                     hasHostId: !!hostId, 
                                     hasGameData: !!gameData, // Check the corrected variable
                                     hasDifficulty: !!difficulty }); // Check the corrected variable
                    
                     eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpClientErrorMissingJoinData'), level: 'error' });
                     this.resetCoordinatorState(); // Clean up failed join attempt
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Go back to safety
                    return;
                }

                console.log(`[GameCoordinator] All required info present for GAME_START. Starting client game instance.`);
                // Show loading temporarily? Client should be on MultiplayerLobby view.
                // No, client stays on the waiting lobby until Game.Started -> GameArea navigation

                // Start the CLIENT-side MultiplayerGame instance
                await this.startMultiplayerGameInstance(
                    false,          // isHost = false
                    playerName,
                    gameData,       // Pass the questions data object
                    difficulty,
                    hostId          // Pass the host's ID
                );

                // Clear the pending join info AFTER successfully starting the game instance
                // (startMultiplayerGameInstance sets this.activeGame)
                if (this.activeGame) {
                    console.log("[GameCoordinator] Client game instance started, clearing pendingJoinInfo.");
                    this.pendingJoinInfo = null; 
                } else {
                    // This case should be handled inside startMultiplayerGameInstance (it navigates to MainMenu)
                    console.error("[GameCoordinator] Failed to start client game instance after GAME_START, pendingJoinInfo not cleared.");
                }
                break;

            case MSG_TYPE.GAME_OVER:
                console.log(`[GameCoordinator Client ASYNC] Received GAME_OVER.`, payload);

                // *** Hide the WaitingDialog FIRST ***
                const waitingDialog = uiManager.getComponent('WaitingDialog');
                if (waitingDialog) {
                    waitingDialog.hide();
                }

                // Stop active client game if it exists
                if (this.activeGame && !this.activeGame.isFinished) {
                    // Ensure client game resources are cleaned up (e.g., timers)
                    this.activeGame.finishGame(true); // Use flag to signal final cleanup
                }

                // Save just the local player's score if they're playing
                if (this.localPlayerName) {
                    console.log(`[GameCoordinator Client ASYNC] Game over. Saving local player score.`);
                    try {
                        // Ensure all necessary data is present for saving
                        if (payload.gameName && payload.difficulty && typeof this.activeGame?.score === 'number') {
                            await highscoreManager.addHighscore(
                                this.localPlayerName,
                                this.activeGame.score,
                                payload.gameName, 
                                'multiplayer', // Use generic mode
                                payload.difficulty
                            );
                            console.log("[GameCoordinator Client ASYNC] Local player's highscore saved.");
                        } else {
                            console.warn("[GameCoordinator Client ASYNC] Missing data required to save local highscore on GAME_OVER.");
                        }
                    } catch (error) {
                        console.error("[GameCoordinator Client ASYNC] Error saving local highscore on GAME_OVER:", error);
                        eventBus.emit(Events.System.ShowFeedback, { message: 'Error saving local highscore.', level: 'error' });
                    }
                }

                // Show MultiplayerEndDialog for the client
                console.log("[GameCoordinator Client ASYNC] Requesting UIManager show MultiplayerEndDialog for Client.");
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerEndDialog, data: payload });

                // Reset coordinator state related to the active game
                this.activeGame = null; // Nullify active game *after* processing GAME_OVER
                this.currentGameMode = null;
                break;

            // Handle dedicated score update message from host
            case MSG_TYPE.H_PLAYER_SCORES_UPDATE:
                console.log(`[GameCoordinator Client ASYNC] Received player scores update from host`, payload);
                
                // Check if this contains the winner information
                if (payload.winner && payload.winner.name && typeof payload.winner.score === 'number') {
                    try {
                        console.log(`[GameCoordinator Client ASYNC] Saving winner's (${payload.winner.name}) score: ${payload.winner.score}`);
                        if (payload.gameName && payload.difficulty) {
                            await highscoreManager.addHighscore(
                                payload.winner.name,
                                payload.winner.score,
                                payload.gameName,
                                'multiplayer',
                                payload.difficulty
                            );
                            console.log(`[GameCoordinator Client ASYNC] Winner's highscore saved successfully.`);
                        } else {
                            console.warn("[GameCoordinator Client ASYNC] Missing game info for saving winner's score", payload);
                        }
                    } catch (error) {
                        console.error("[GameCoordinator Client ASYNC] Error saving winner's highscore:", error);
                    }
                }
                
                // Update player list if applicable
                if (payload.players) {
                    this._handlePlayerListUpdate({ players: payload.players });
                }
                break;

            case MSG_TYPE.PLAYER_LIST_UPDATE:
                // Handle lobby updates if client is still in the lobby view
                if (this.pendingJoinInfo && !this.activeGame) {
                     /** @type {MultiplayerLobbyDialog | undefined} */
                    const lobbyDialog = uiManager.getComponent('MultiplayerLobbyDialog');
                    if (lobbyDialog && lobbyDialog.isVisible && payload && payload.players) {
                         try {
                             const playersMap = new Map(Object.entries(payload.players));
                             lobbyDialog._renderPlayerList(playersMap, webRTCManager.getMyPeerId());
                         } catch (mapError) {
                             console.error("[GameCoordinator Client ASYNC] Error parsing player list update:", mapError, payload.players);
                         }
                    }
                }
                 break;

            // <<< Handle Host Restarting Lobby for Rematch >>>
            case MSG_TYPE.H_RESTARTING_LOBBY:
                console.log("[GameCoordinator Client ASYNC] Host signaled lobby restart for rematch.");
                // Navigate back to the lobby dialog view
                eventBus.emit(Events.Navigation.ShowView, {
                     viewName: Views.MultiplayerLobby,
                     // Pass the current player list if available? Or let lobby fetch?
                     // data: { players: this.currentPlayerList } 
                });
                // Clear any previous active game state if necessary (should be null already)
                this.activeGame = null;
                this.currentGameMode = null;
                break;
            // <<< End Handle Lobby Restart >>>

            default:
                // Log unexpected types, but don't error out
                console.log(`[GameCoordinator Client ASYNC] Received unhandled message type '${type}' from host ${sender}.`);
        }
    }

    /**
     * Handles the local client finishing their game.
     * Sends CLIENT_FINISHED message to host (done in MultiplayerGame)
     * and shows the waiting dialog.
     * @param {object} payload - From Events.Game.LocalPlayerFinished
     * @param {number} payload.score - The final score achieved by the local client.
     * @private
     */
    _handleLocalPlayerFinished({ score }) {
         console.log(`[GameCoordinator Client ASYNC] LocalPlayerFinished event received. Final score: ${score}`);
         if (this.currentGameMode !== 'multiplayer-client' || !this.activeGame) {
             console.warn("[GameCoordinator Client ASYNC] LocalPlayerFinished ignored: not in active client game mode or game inactive.");
             return;
         }

         // Show waiting dialog - keep it simple
         const waitingDialog = uiManager.getComponent('WaitingDialog');
         if (waitingDialog) {
             const waitMessage = miscUtils.getTextTemplate('mpClientWaitOthers') || "Je bent klaar! We wachten op de andere spelers";
             waitingDialog.show(waitMessage);
         } else {
             console.error("[GameCoordinator Client ASYNC] WaitingDialog component not found!");
             eventBus.emit(Events.System.ShowFeedback, { 
                 message: 'Je bent klaar! Wachten op anderen...', 
                 level: 'info',
                 duration: 8000
             });
         }
     }

    /**
     * Handles the request to save a highscore, typically from the SinglePlayerEndDialog.
     * Validates data, calls the HighscoreManager, provides feedback, and navigates.
     * Now uses arrow function syntax for automatic `this` binding and is async.
     * @param {object} payload - Event payload from Events.UI.EndDialog.SaveScoreClicked
     * @param {string} [payload.playerName]
     * @param {number} [payload.score]
     * @param {string} [payload.gameName]
     * @param {string} [payload.mode]
     * @param {string} [payload.difficulty]
     * @private
     */
    handleSaveHighscore = async (payload) => { // Accept the whole payload object
        console.log(`[GameCoordinator] Received request to save highscore:`, payload); // Log the entire payload

        // *** CORRECTED CHECK: Use the mode from the event payload ***
        if (payload.mode !== 'single') { 
            console.warn(`[GameCoordinator] handleSaveHighscore called, but event payload mode is not 'single' (Mode: ${payload.mode}). Ignoring.`);
            // This prevents saving scores if the event somehow comes from a non-single-player context.
            return; 
        }

        // --- Strengthened Validation ---
        // Access properties via the payload object
        const isValid = payload.name && typeof payload.name === 'string' && payload.name.trim() !== '' && // Use payload.name
                        payload.score !== undefined && typeof payload.score === 'number' && payload.score >= 0 && // Added score >= 0 check
                        payload.gameName && typeof payload.gameName === 'string' &&
                        payload.difficulty && typeof payload.difficulty === 'string';

        if (!isValid) {
            console.error("[GameCoordinator] Attempted to save highscore with invalid or incomplete data.", payload);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveErrorInvalidData') || 'Fout bij opslaan: Ongeldige gegevens.', level: 'error' });
            // Navigate back to main menu even on error to avoid getting stuck?
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        // --- Perform Save, Feedback, and Navigation (Single-Player ONLY) ---
        try {
            console.log("[GameCoordinator] Saving highscore for single-player game...");
            // Call the correct method on the manager instance using payload properties
            await highscoreManager.addHighscore(payload.name, payload.score, payload.gameName, payload.mode, payload.difficulty); // Use payload.name
            eventBus.emit(Events.System.ShowFeedback, { message: 'Highscore opgeslagen!', level: 'success' }); // Use appropriate message
        } catch (error) {
            console.error("[GameCoordinator] Error saving highscore:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveError') || 'Kon highscore niet opslaan.', level: 'error' });
            // Optionally, add more specific error messages based on error type
        } finally {
            // Always navigate back to main menu after attempting save (success or fail) in single player
            console.log("[GameCoordinator] Navigating back to Main Menu after save attempt.");
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            // Also ensure game state is fully reset if needed after SP game
            this.resetCoordinatorState(); 
        }
    }

    /** 
     * Tries to load the player name from localStorage.
     * If not found, generates a new random name and saves it.
     * @private 
     */
    _loadPlayerName() {
        let name = localStorage.getItem('playerName');
        if (!name) {
            // Use the CORRECT function name via miscUtils default import
            name = miscUtils.generateRandomPlayerName(); 
            this._savePlayerName(name); // Save the generated name
        }
        this.localPlayerName = name;
        console.log(`[GameCoordinator] Player name set to: ${this.localPlayerName}`);
    }

    /** Saves the player name to localStorage. @private */
    _savePlayerName(name) {
        if (name && typeof name === 'string') {
            //localStorage.setItem('playerName', name);
        } else {
            console.warn("[GameCoordinator] Attempted to save invalid player name.");
        }
    }

    // +++ ADDED: Handler for Host Waiting +++
    /**
     * Handles the event when the host is waiting for clients to finish.
     * @param {object} payload - The payload from the HostWaiting event.
     * @param {string} [payload.messageKey] - Optional message key for translation.
     * @private
     */
    _handleHostWaiting(payload) {
        console.log(`[GameCoordinator DEBUG] _handleHostWaiting called with payload:`, payload);
        console.log(`[GameCoordinator DEBUG] Current game mode: ${this.currentGameMode}, Active game exists: ${!!this.activeGame}`);

        // If game is not active, don't show dialog
        if (!this.activeGame) {
            console.log("[GameCoordinator] _handleHostWaiting called, but game is not active. Ignoring.");
            return;
        }

        // Different message template based on role
        const messageKey = this.currentGameMode === 'multiplayer-host' ? 
                          'mpHostWaitOthers' : 'mpClientWaitOthers';
        const message = miscUtils.getTextTemplate(payload?.messageKey || messageKey) || "Waiting for other players...";

        console.log(`[GameCoordinator] ${this.currentGameMode} waiting for others. Showing WaitingDialog with message: "${message}"`);

        /** @type {import('../dialogs/waiting-dialog.js').default | undefined} */
        const waitingDialog = uiManager.getComponent('WaitingDialog');
        console.log(`[GameCoordinator DEBUG] WaitingDialog component found: ${!!waitingDialog}`);
        
        if (waitingDialog) {
            try {
                waitingDialog.show(message);
                console.log("[GameCoordinator] WaitingDialog shown. Current isOpen state:", waitingDialog.isOpen);
            } catch (error) {
                console.error("[GameCoordinator] Error showing WaitingDialog:", error);
            }
        } else {
            console.error("[GameCoordinator] WaitingDialog component not found.");
        }
    }
    // --- END CHANGE ---

    /**
     * Handles the closing of the Multiplayer End Dialog.
     * Performs final state cleanup and navigates to the main menu.
     * @private
     */
    _handleMultiplayerDialogClosed() {
        console.log("[GameCoordinator] MultiplayerEndDialog closed. Cleaning up multiplayer state if needed.");

        // <<< Explicitly hide WaitingDialog FIRST >>>
        try {
            const waitingDialog = uiManager.getComponent('WaitingDialog');
            if (waitingDialog && waitingDialog.isOpen) { 
                console.log("[GameCoordinator] Force-hiding WaitingDialog on MP Dialog close.");
                waitingDialog.hide();
                 // Optional: Check if it actually closed
                 if (waitingDialog.isOpen) {
                     console.warn("[GameCoordinator] WaitingDialog did NOT hide after calling hide()!");
                 }
            } else {
                 console.log("[GameCoordinator] WaitingDialog not found or not open during MP Dialog close.");
            }
        } catch (error) {
            console.error("[GameCoordinator] Error trying to hide WaitingDialog:", error);
        }
        // <<< END HIDE >>>

        // Stop the WebRTCManager's timeout check if it's running (client-side)
        if (this.webRTCManager.isClient && this.webRTCManager.status === ConnectionStatus.CONNECTED_CLIENT) { // Added status check for robustness
            console.log("[GameCoordinator] Stopping WebRTC timeout check as client left end dialog.");
            this.webRTCManager.stopTimeoutCheck(); // Assuming this method exists
        }
        
        // Optionally: Reset the client manager state if no rematch is planned immediately
        // if (this.multiplayerClientManager && this.multiplayerClientManager.isConnected()) {
        //     console.log("[GameCoordinator] Resetting MultiplayerClientManager state.");
        //     this.multiplayerClientManager.resetState();
        // }

        // Ensure any lingering game/mode state is cleared
        this.resetCoordinatorState();

        // <<< ADD NAVIGATION BACK TO MAIN MENU >>>
        console.log("[GameCoordinator] Navigating back to Main Menu after MP Dialog close.");
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the request to play again from the MultiplayerEndDialog.
     * Uses arrow function syntax for automatic `this` binding.
     * @private
     */
    _handlePlayAgainRequest = async () => { // <<< Changed to arrow function
        console.log("[GameCoordinator] Play Again requested.");
        
        if (this.webRTCManager.status !== ConnectionStatus.CONNECTED_CLIENT) { 
            console.error("[GameCoordinator] Cannot play again, not connected.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpErrorNotConnected'), level: 'error' });
            return;
        }
    };
}

export default GameCoordinator;