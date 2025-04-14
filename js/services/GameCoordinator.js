import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import ErrorDialog from '../dialogs/error-dialog.js';
import miscUtils from '../utils/miscUtils.js';
import { ConnectionStatus } from '../core/connection-constants.js';

// Game mode classes
import SinglePlayerGame from '../game/SinglePlayerGame.js';
import MultiplayerGame from '../game/MultiplayerGame.js';
import PracticeGame from '../game/PracticeGame.js';

// Services
import questionsManager from './QuestionsManager.js';
import webRTCManager from './WebRTCManager.js';
import uiManager from '../ui/UIManager.js';
import highscoreManager from './HighscoreManager.js';

// Dialogs
import NamePromptDialog from '../dialogs/name-prompt-dialog.js';
import WaitingDialog from '../dialogs/waiting-dialog.js';
import MultiplayerLobbyDialog from '../dialogs/multiplayer-lobby-dialog.js';

// Constants
import { MSG_TYPE } from '../core/message-types.js';

// Service Classes
import MultiplayerHostManager from './MultiplayerHostManager.js';
import MultiplayerClientManager from './MultiplayerClientManager.js';
import QuizEngine from '../services/QuizEngine.js';

/**
 * Coordinates the creation and management of different game modes (single-player,
 * practice, multiplayer host, multiplayer client). Handles the overall game
 * lifecycle, including starting, finishing, and managing related services like
 * WebRTC and UI interactions.
 * Supports an asynchronous multiplayer flow.
 *
 * @property {QuestionsManager} questionsManager - Service for fetching and managing quiz questions.
 * @property {MultiplayerClientManager} multiplayerClientManager - Service for managing client-side multiplayer logic.
 * @property {WebRTCManager} webRTCManager - Service for handling WebRTC connections.
 * @property {BaseGameMode|null} activeGame - Reference to the currently active game instance (SinglePlayerGame, MultiplayerGame, etc.). Null if no game is active.
 * @property {MultiplayerHostManager|null} activeHostManager - Reference to the active MultiplayerHostManager when acting as a host. Null otherwise.
 * @property {object|null} pendingHostInfo - Temporary storage for host information (playerName, settings) while the host lobby is being set up. Null otherwise.
 * @property {object|null} pendingJoinInfo - Temporary storage for client join information (hostId, playerName, gameData) during the join process. Null otherwise.
 * @property {'single'|'practice'|'multiplayer-host'|'multiplayer-client'|null} currentGameMode - Tracks the current game mode being played or managed. Null if no game is active.
 * @property {string|null} localPlayerName - Stores the name of the local player, used primarily in client mode and loaded from localStorage.
 * @property {Map<string, object>} currentPlayerList - Stores the current list of players in a multiplayer game (client-side cache). Maps peerId to player data.
 */
class GameCoordinator {
    /**
     * Initializes the GameCoordinator, sets up dependencies, loads the player name,
     * binds event handlers, and registers listeners.
     *
     * @param {QuestionsManager} questionsManagerInstance - An instance of the QuestionsManager.
     * @param {MultiplayerClientManager} multiplayerClientManagerInstance - An instance of MultiplayerClientManager.
     */
    constructor(questionsManagerInstance, multiplayerClientManagerInstance) {
        console.info("[GameCoordinator ASYNC] Initializing...");

        this.questionsManager = questionsManagerInstance || questionsManager; // Use singleton as fallback
        this.multiplayerClientManager = multiplayerClientManagerInstance;
        this.webRTCManager = webRTCManager; // Store the singleton instance

        if (!this.questionsManager) {
             console.error("[GameCoordinator] FATAL: QuestionsManager instance is missing!");
        }
        if (!this.multiplayerClientManager) {
             console.warn("[GameCoordinator] MultiplayerClientManager instance not provided. Client functionality might be limited.");
        }

        this.activeGame = null;
        this.activeHostManager = null;
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;
        this.currentGameMode = null;

        this.localPlayerName = null;
        this.currentPlayerList = new Map();

        this._loadPlayerName();
        this._bindMethods();
        this.registerListeners();
    }

    /**
     * Binds methods used as event handlers to the correct `this` context.
     * This ensures that when these methods are called by the event bus,
     * `this` refers to the GameCoordinator instance.
     * @private
     */
    _bindMethods() {
        this.handleRequestSinglePlayer = this.handleRequestSinglePlayer.bind(this);
        this.handleRequestPractice = this.handleRequestPractice.bind(this);
        this.handleRequestMultiplayerChoice = this.handleRequestMultiplayerChoice.bind(this);
        this.handleStartRequested = this.handleStartRequested.bind(this);
        this.handleStartMultiplayerHost = this.handleStartMultiplayerHost.bind(this);
        this.handleHostStartGame = this.handleHostStartGame.bind(this);
        this.handleShowJoinLobby = this.handleShowJoinLobby.bind(this);
        this.handleJoinMultiplayerAttempt = this.handleJoinMultiplayerAttempt.bind(this);
        this.handleClientConfirmJoin = this.handleClientConfirmJoin.bind(this);
        this.handleClientReceivedGameInfo = this.handleClientReceivedGameInfo.bind(this);
        this.handleLobbyCancel = this.handleLobbyCancel.bind(this);
        this.handleLeaveGame = this.handleLeaveGame.bind(this);
        this.handleWebRTCConnectionFailure = this.handleWebRTCConnectionFailure.bind(this);
        this.handleSaveHighscore = this.handleSaveHighscore.bind(this);
        this._handleValidJoinCodeDetected = this._handleValidJoinCodeDetected.bind(this);
        this._handleClientConnectedToHost = this._handleClientConnectedToHost.bind(this);
        this._handlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);
        this._handleWebRTCMessageReceived = this._handleWebRTCMessageReceived.bind(this);
        this._handleLocalPlayerFinished = this._handleLocalPlayerFinished.bind(this);
        this._handleHostWaiting = this._handleHostWaiting.bind(this);
        this._handleMultiplayerDialogClosed = this._handleMultiplayerDialogClosed.bind(this);
    }

    /**
     * Registers listeners for various events emitted by the event bus.
     * These listeners trigger the corresponding handler methods in GameCoordinator.
     * Covers UI interactions, game lifecycle events, multiplayer connection events,
     * and dialog events.
     * @private
     */
    registerListeners() {
        console.info("[GameCoordinator] Registering event listeners...");

        eventBus.on(Events.UI.MainMenu.StartSinglePlayerClicked, this.handleRequestSinglePlayer);
        eventBus.on(Events.UI.MainMenu.StartPracticeClicked, this.handleRequestPractice);
        eventBus.on(Events.UI.MainMenu.JoinMultiplayerClicked, this.handleRequestMultiplayerChoice);
        eventBus.on(Events.Game.StartRequested, this.handleStartRequested);

        eventBus.on(Events.UI.MultiplayerChoice.HostClicked, this.handleStartMultiplayerHost);
        eventBus.on(Events.UI.MultiplayerChoice.JoinClicked, this.handleShowJoinLobby);
        eventBus.on(Events.UI.JoinLobby.SubmitCodeClicked, this.handleJoinMultiplayerAttempt);
        eventBus.on(Events.UI.HostLobby.StartGameClicked, this.handleHostStartGame);
        eventBus.on(Events.UI.JoinLobby.ConfirmClicked, this.handleClientConfirmJoin);
        eventBus.on(Events.UI.HostLobby.CancelClicked, this.handleLobbyCancel);
        eventBus.on(Events.UI.JoinLobby.CancelClicked, this.handleLobbyCancel);
        eventBus.on(Events.UI.MultiplayerLobby.LeaveClicked, this.handleLobbyCancel);

        eventBus.on(Events.Game.Finished, (payload) => this.handleGameFinished(payload));
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleLeaveGame);
        eventBus.on(Events.WebRTC.ConnectionFailed, this.handleWebRTCConnectionFailure);
        eventBus.on(Events.Game.LocalPlayerFinished, this._handleLocalPlayerFinished);
        eventBus.on(Events.UI.EndDialog.SaveScoreClicked, this.handleSaveHighscore);

        eventBus.on(Events.System.ValidJoinCodeDetected, this._handleValidJoinCodeDetected);
        eventBus.on(Events.Multiplayer.Client.ConnectedToHost, this._handleClientConnectedToHost);
        eventBus.on(Events.Multiplayer.Client.GameInfoReceived, this.handleClientReceivedGameInfo);
        eventBus.on(Events.WebRTC.MessageReceived, this._handleWebRTCMessageReceived);
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._handlePlayerListUpdate);
        eventBus.on(Events.Multiplayer.HostWaiting, this._handleHostWaiting);

        eventBus.on(Events.UI.MultiplayerEndDialog.Closed, this._handleMultiplayerDialogClosed);
        eventBus.on(Events.UI.MultiplayerEndDialog.PlayAgainClicked, this._handlePlayAgainRequest);

        console.info("[GameCoordinator] Event listeners registered.");
    }

    /**
     * Handles the request to start a single-player game (triggered from Main Menu).
     * Checks if a game is already active, shows feedback if so, otherwise navigates
     * to the Sheet Selection view with the mode set to 'single'.
     * @private
     */
    handleRequestSinglePlayer() {
        console.log("[GameCoordinator] Received StartSinglePlayerClicked from MainMenu. Navigating to Sheet Selection.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to sheet selection, a game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'single' } });
    }

    /**
     * Handles the request to start a practice game (triggered from Main Menu).
     * Checks if a game is already active, shows feedback if so, otherwise navigates
     * to the Sheet Selection view with the mode set to 'practice'.
     * @private
     */
    handleRequestPractice() {
        console.log("[GameCoordinator] Received StartPracticeClicked from MainMenu. Navigating to Sheet Selection.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to sheet selection, a game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'practice' } });
    }

    /**
     * Handles the generic request to start a game, typically triggered after sheet selection.
     * This acts as the main entry point for initiating any game mode based on the payload.
     * It loads questions, initializes the appropriate game instance (SinglePlayer, Practice)
     * or sets up the multiplayer host environment (MultiplayerHostManager).
     * Shows a loading screen during setup.
     *
     * @param {object} payload - Event payload from Events.Game.StartRequested.
     * @param {'single' | 'practice' | 'multiplayer-host' | 'multiplayer-join'} payload.mode - The requested game mode.
     * @param {object} payload.settings - Game settings (e.g., sheetIds, difficulty).
     * @param {string} [payload.playerName] - Player's name (required for some modes).
     * @param {string} [payload.hostId] - Host ID if joining (used in join flow, not here).
     * @private
     * @async
     */
    async handleStartRequested({ mode, settings, playerName, hostId }) {
        console.log(`[GameCoordinator ASYNC] Received Game.StartRequested. Mode: ${mode}`, { settings, playerName, hostId });
        if (this.activeGame || this.activeHostManager) {
            console.warn("[GameCoordinator ASYNC] Cannot start new game/host, another session is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorStartWhileActive'), level: 'error' });
            return;
        }

        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow loading UI update

        try {
            let quizEngineInstance;
            switch (mode) {
                case 'single':
                    console.log(`[GameCoordinator ASYNC] Starting Single Player game with settings:`, settings);
                    quizEngineInstance = QuizEngine.getInstance();
                    await quizEngineInstance.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
                    if (quizEngineInstance.getQuestionCount() === 0) {
                         throw new Error("No questions loaded for selected sheets/difficulty.");
                    }

                    const spPlayerName = playerName || miscUtils.getTextTemplate('defaultPlayerName');
                    this.activeGame = new SinglePlayerGame(settings, quizEngineInstance, spPlayerName);
                    await this.activeGame.start();
                    this.currentGameMode = 'single';
                    break;

                case 'practice':
                    console.log(`[GameCoordinator ASYNC] Starting Practice game with settings:`, settings);
                     quizEngineInstance = QuizEngine.getInstance();
                     await quizEngineInstance.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
                     if (quizEngineInstance.getQuestionCount() === 0) {
                          throw new Error("No questions loaded for selected sheets/difficulty.");
                     }
                    this.activeGame = new PracticeGame(settings, quizEngineInstance);
                    await this.activeGame.start();
                    this.currentGameMode = 'practice';
                    break;

                case 'multiplayer-host':
                    console.log(`[GameCoordinator ASYNC] Handling StartRequested for multiplayer-host. Player: ${playerName}, Settings:`, settings);
                    let hostQuestionsData = null;
                    try {
                          if (!settings || !Array.isArray(settings.sheetIds) || settings.sheetIds.length === 0) {
                               throw new Error("No sheet IDs selected.");
                          }
                          console.log(`[GameCoordinator ASYNC] Fetching questions for sheets:`, settings.sheetIds);
                          hostQuestionsData = await this.questionsManager.getQuestionsForSheets(settings.sheetIds);
                          console.log(`[GameCoordinator ASYNC] Fetched questions data:`, hostQuestionsData);

                    } catch (fetchError) {
                        console.error("[GameCoordinator ASYNC] Error fetching questions:", fetchError);
                        eventBus.emit(Events.System.ShowFeedback, { message: `Error loading questions: ${fetchError.message}`, level: 'error' });
                        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                        return;
                    }

                    if (!hostQuestionsData || !hostQuestionsData.sheets || hostQuestionsData.sheets.length === 0) {
                        console.error("[GameCoordinator ASYNC] No questions found for selected sheets.");
                        eventBus.emit(Events.System.ShowFeedback, { message: 'No questions found for the selected sheets.', level: 'error' });
                        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                        return;
                    }

                    console.log(`[GameCoordinator ASYNC] Starting WebRTC host for ${playerName}...`);
                    try {
                         await webRTCManager.startHost(playerName, hostQuestionsData, settings.difficulty);
                    } catch (rtcError) {
                        console.error("[GameCoordinator ASYNC] Error starting WebRTC host:", rtcError);
                        eventBus.emit(Events.System.ShowFeedback, { message: `Failed to start hosting: ${rtcError.message || 'Network error'}`, level: 'error' });
                        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                        return;
                     }

                    const hostPeerId = webRTCManager.getMyPeerId();
                    if (!hostPeerId) {
                        console.error("[GameCoordinator ASYNC] Failed to get host Peer ID after starting host.");
                        eventBus.emit(Events.System.ShowFeedback, { message: 'Failed to initialize hosting connection.', level: 'error' });
                        webRTCManager.closeConnection();
                        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                        return;
                    }

                    this.pendingHostInfo = {
                        playerName: playerName,
                        settings: settings // Includes sheetIds and difficulty
                    };
                    console.log(`[GameCoordinator ASYNC] Stored complete pending host info:`, this.pendingHostInfo);

                    try {
                        console.log(`[GameCoordinator ASYNC] Creating MultiplayerHostManager for host ${hostPeerId} with name ${playerName}`);
                        const hostManager = new MultiplayerHostManager(playerName, settings.sheetIds, settings.difficulty, hostPeerId);
                        console.log("[GameCoordinator ASYNC] Initializing MultiplayerHostManager...");
                        await hostManager.initialize(); // Loads questions into singleton QuizEngine
                        console.log("[GameCoordinator ASYNC] Starting hosting listeners in MultiplayerHostManager...");
                        hostManager.startHosting();
                        this.activeHostManager = hostManager;
                        this.currentGameMode = 'multiplayer-host'; // Mode tracked here for host *setup*
                    } catch (hostManagerError) {
                         console.error("[GameCoordinator ASYNC] Error initializing MultiplayerHostManager:", hostManagerError);
                         eventBus.emit(Events.System.ShowFeedback, { message: `Failed to set up host lobby: ${hostManagerError.message}`, level: 'error' });
                         webRTCManager.closeConnection(); // Clean up WebRTC
                         this.pendingHostInfo = null; // Clear pending info
                         eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                         return;
                    }

                    console.log("[GameCoordinator ASYNC] Navigating to Host Lobby.");
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.HostLobby });
                    break;

                case 'multiplayer-join':
                     // This case should not be reachable via StartRequested event. Joining happens via JoinClicked -> SubmitCodeClicked flow.
                     console.error("[GameCoordinator ASYNC] Internal Error: Attempted to join multiplayer via unsupported StartRequested event.");
                     eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    break;
                default:
                    console.error(`[GameCoordinator ASYNC] Internal Error: Unknown game mode requested: ${mode}`);
                    eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    return;
            }
            console.log(`[GameCoordinator ASYNC] ${mode} game instance created and started or host manager initialized.`);
        } catch (error) {
            console.error(`[GameCoordinator ASYNC] Error during game start process for mode '${mode}':`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: error.message || miscUtils.getTextTemplate('gameErrorGenericStartFail'), level: 'error' });
            this.resetCoordinatorState();
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the request to navigate to the Multiplayer Choice screen (triggered from Main Menu).
     * Checks if a game is already active before navigating.
     * @private
     */
     handleRequestMultiplayerChoice() {
        console.log("[GameCoordinator] Received JoinMultiplayerClicked from MainMenu. Navigating to MP Choice.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot navigate to MP choice, a game is active.");
             eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
     }

    /**
     * Handles the "Host" button click from the Multiplayer Choice view.
     * Stores the provided player name and initial settings (like difficulty)
     * in `pendingHostInfo` and navigates to the Sheet Selection view, passing
     * necessary data ('multiplayer-host' mode, playerName, difficulty).
     *
     * @param {object} payload - Event payload from Events.UI.MultiplayerChoice.HostClicked.
     * @param {string} payload.playerName - The host's chosen name.
     * @param {object} payload.settings - Initial settings (e.g., { difficulty: 'medium' }).
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

        this.pendingHostInfo = {
            playerName: playerName,
            settings: settings || { difficulty: 'medium' } // Ensure settings object exists, default difficulty
        };
        console.log("[GameCoordinator] Stored pending host info:", this.pendingHostInfo);

        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.SheetSelection,
            data: {
                mode: 'multiplayer-host',
                playerName: playerName, // Pass name so SheetSelection can display it/use it
                difficulty: settings.difficulty
            }
        });
    }

    /**
     * Handles the "Join" button click from the Multiplayer Choice view.
     * Navigates the user to the Join Lobby view, passing the chosen player name.
     *
     * @param {object} payload - Event payload from Events.UI.MultiplayerChoice.JoinClicked.
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

        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.JoinLobby,
            data: {
                playerName: playerName
            }
        });
    }

    /**
     * Handles the detection of a valid join code passed via URL parameters.
     * Ensures the player name is loaded (or generates one), navigates to the Join Lobby view
     * in a 'connecting' state, and automatically triggers the connection attempt using
     * `handleJoinMultiplayerAttempt`.
     *
     * @param {object} payload - Event payload from Events.System.ValidJoinCodeDetected.
     * @param {string} payload.joinCode - The valid 6-digit join code from the URL.
     * @private
     */
    _handleValidJoinCodeDetected({ joinCode }) {
        console.log(`[GameCoordinator] Received ValidJoinCodeDetected event. Code: ${joinCode}`);
        if (!this.localPlayerName) {
            this._loadPlayerName();
        }
        const playerName = this.localPlayerName || miscUtils.generateRandomPlayerName();

        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.JoinLobby,
            data: { playerName: playerName, joinCode: joinCode, showConnecting: true }
        });
        // Automatically trigger the connection attempt with the detected code
        this.handleJoinMultiplayerAttempt({ code: joinCode, playerName: playerName });
    }

    /**
     * Handles the initial attempt to join a multiplayer game, either via manual code
     * submission from the Join Lobby or automatically via URL parameter detection.
     * Validates input, stores necessary info (`hostId`, `playerName`) in `pendingJoinInfo`,
     * and initiates the WebRTC connection attempt via `WebRTCManager.connectToHost`.
     *
     * @param {object} payload - Event payload from Events.UI.JoinLobby.SubmitCodeClicked or internal call.
     * @param {string} payload.code - The 6-digit host code submitted or detected.
     * @param {string} payload.playerName - The joining player's name.
     * @private
     * @async
     */
    async handleJoinMultiplayerAttempt({ code, playerName }) {
        console.log(`[GameCoordinator] Received Join SubmitCodeClicked event. Code: ${code}, Player: ${playerName}`);
        if (this.activeGame || webRTCManager.status !== ConnectionStatus.DISCONNECTED) { // Check WebRTC status too
            console.warn("[GameCoordinator] Cannot join, a game/connection is active or connection attempt already in progress.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameErrorJoinWhileActive'), level: 'error' });
            return;
        }
        if (!code || code.length !== 6 || !playerName) {
            console.error("[GameCoordinator] Invalid join attempt data.", { code, playerName });
            eventBus.emit(Events.UI.JoinLobby.Error, { message: miscUtils.getTextTemplate('joinErrorInvalidInput') });
            return;
        }

        this.localPlayerName = playerName; // Store locally confirmed/used name
        this.pendingJoinInfo = {
            hostId: code,
            playerName: playerName,
            questionsData: null, // To be populated by GAME_INFO
            difficulty: null,    // To be populated by GAME_INFO
            players: null        // To be populated by GAME_INFO
        };
        console.log(`[GameCoordinator] Initialized pendingJoinInfo for host ${code}`);
        this.currentGameMode = 'multiplayer-client'; // Tentative mode during join attempt

        console.log(`[GameCoordinator] Attempting WebRTC client connection to host: ${code}`);
        this.webRTCManager.connectToHost(code, playerName); // WebRTCManager handles UI updates via events
    }

     /**
     * Handles the host clicking the "Start Game" button in the Host Lobby.
     * Validates that `pendingHostInfo` and `activeHostManager` are available,
     * checks for connected clients, tells the `activeHostManager` to initiate the game start
     * (which broadcasts GAME_START), shows a loading screen, creates the host-side
     * `MultiplayerGame` instance, and starts it.
     *
     * @private
     * @async
     */
    async handleHostStartGame() {
        console.log("[GameCoordinator] Received StartGameClicked from HostLobby.");
        if (this.activeGame) {
            console.warn("[GameCoordinator] Host StartGameClicked ignored, a game is already active.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('gameWarnAlreadyActive'), level: 'warn' });
            return;
        }

        if (!this.pendingHostInfo || !this.pendingHostInfo.playerName || !this.pendingHostInfo.settings || !this.pendingHostInfo.settings.sheetIds) {
            console.error("[GameCoordinator] Internal Error: Host clicked Start Game, but pendingHostInfo is missing or incomplete.", this.pendingHostInfo);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.resetCoordinatorState(); // Clean up partial state
            return;
        }

        const myPeerId = webRTCManager.getMyPeerId();
        if (!myPeerId) {
            console.error("[GameCoordinator] Internal Error: Host clicked Start Game, but WebRTCManager has no local peer ID.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpHostErrorNoIdOnStart'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.resetCoordinatorState();
            return;
        }

        // Check for connected clients via activeHostManager
        if (!this.activeHostManager) {
            console.error("[GameCoordinator] Critical Error: handleHostStartGame called without an active HostManager.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.resetCoordinatorState();
            return;
        }

        const connectedClientCount = this.activeHostManager.getConnectedClientCount();
        if (connectedClientCount === 0) {
            console.warn("[GameCoordinator] Host tried to start game without any connected clients.");
            eventBus.emit(Events.System.ShowFeedback, {
                message: miscUtils.getTextTemplate('mpHostErrorNoClients') || "Cannot start game without players",
                level: 'error'
            });
            return;
        }

        const { playerName, settings } = this.pendingHostInfo;
        this.pendingHostInfo = null; // Clear pending info as we proceed

        console.log(`[GameCoordinator] Telling Host Manager to initiate game start...`);
        try {
             this.activeHostManager.initiateGameStart(); // Broadcasts GAME_START
         } catch (error) {
             console.error("[GameCoordinator] Error initiating game start via HostManager:", error);
             eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
             // No need to resetCoordinatorState here, as hostManager might still be active, let user retry?
             return;
         }

        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        await new Promise(resolve => setTimeout(resolve, 100)); // Allow loading screen render

        try {
            console.log(`[GameCoordinator] Creating host MultiplayerGame instance. Player: ${playerName}, HostID: ${myPeerId}, Settings:`, settings);
            // Host provides settings directly, not wrapped { questionsData: ... }
            this.activeGame = new MultiplayerGame(
                true,                   // isHost
                playerName,
                settings,               // Pass settings object
                settings.difficulty,    // Pass difficulty explicitly
                myPeerId,
                webRTCManager
            );
            await this.activeGame.start(); // Starts game logic, emits Game.Started event -> UI navigation
            // currentGameMode should be updated by the game instance or startMultiplayerGameInstance
            console.log("[GameCoordinator] Host MultiplayerGame instance started.");

        } catch (error) {
            console.error("[GameCoordinator] Error starting Multiplayer Game (Host):", error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            this.resetCoordinatorState(); // Full reset on host game start failure
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles receiving the initial game information message (GAME_INFO) from the host,
     * typically forwarded by `MultiplayerClientManager`. Stores the received
     * `questionsData`, `difficulty`, and `players` list in `pendingJoinInfo` if the
     * sender's `hostId` matches the one stored during the join attempt.
     * The JoinLobbyComponent also listens for this event to display the info.
     *
     * @param {object} payload - Event payload from Events.Multiplayer.Client.GameInfoReceived.
     * @param {object} payload.questionsData - The full question data object (including sheets, questions).
     * @param {string} payload.difficulty - Game difficulty string ('easy', 'medium', 'hard').
     * @param {Map<string, object>} payload.players - Map of currently connected players (peerId -> { name, score, isHost, ... }).
     * @param {string} payload.hostId - The PeerJS ID of the host who sent the info.
     * @private
     */
    handleClientReceivedGameInfo({ questionsData, difficulty, players, hostId }) {
        console.log(`[GameCoordinator] Client received Game Info from host ${hostId}`, { difficulty, playersCount: players?.size });

        if (!this.pendingJoinInfo || this.pendingJoinInfo.hostId !== hostId) {
            console.warn("[GameCoordinator] Received GameInfo, but no matching pendingJoinInfo found or hostId mismatch.",
                         { expectedHost: this.pendingJoinInfo?.hostId, receivedHost: hostId });
            // Could happen if join cancelled/timed out right before info arrived. Ignore it.
            return;
        }

        // Validate received data (basic checks)
        if (!questionsData || !difficulty || !players) {
             console.error("[GameCoordinator] Received incomplete GameInfo from host.", { questionsData, difficulty, players });
             eventBus.emit(Events.System.ShowFeedback, { message: 'Received invalid game information from host.', level: 'error' });
             this.resetCoordinatorState(); // Abort join process
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
             return;
         }

        this.pendingJoinInfo.questionsData = questionsData;
        this.pendingJoinInfo.difficulty = difficulty;
        this.pendingJoinInfo.players = players;
        console.log("[GameCoordinator] Stored game details in pendingJoinInfo.");
    }

    /**
     * Handles the client clicking the "Confirm Join" button in the Join Lobby, after
     * receiving and viewing the game info. Updates the `playerName` in `pendingJoinInfo`
     * if changed, then triggers the sending of the `c_requestJoin` message to the host
     * via `MultiplayerClientManager`. Finally, navigates to the Multiplayer Lobby/Waiting view.
     *
     * @param {object} payload - Event payload from Events.UI.JoinLobby.ConfirmClicked.
     * @param {string} payload.playerName - The name the player confirmed or entered.
     * @private
     */
    handleClientConfirmJoin({ playerName }) {
        if (!this.pendingJoinInfo || !this.pendingJoinInfo.hostId) {
            console.error("[GameCoordinator] handleClientConfirmJoin called, but no pending join info or hostId found.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
            this.resetCoordinatorState();
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        const hostId = this.pendingJoinInfo.hostId;
        console.log(`[GameCoordinator] Client confirmed join. Host ID: ${hostId}, Player Name: ${playerName}`);

        // Update local name and pending name if changed in dialog
        this.localPlayerName = playerName;
        this.pendingJoinInfo.playerName = playerName;

        try {
            if (!this.multiplayerClientManager) {
                throw new Error("MultiplayerClientManager is not available.");
            }
            console.log(`[GameCoordinator] Sending c_requestJoin message to host ${hostId}`);
            this.multiplayerClientManager.sendJoinRequest(playerName); // Sends request via WebRTCManager
        } catch (error) {
            console.error("[GameCoordinator] Error sending join request:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: `Error joining game: ${error.message || 'Network issue'}`, level: 'error' });
            this.resetCoordinatorState(); // Reset fully on failure to send join request
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return;
        }

        console.log("[GameCoordinator] Join request sent. Showing Multiplayer Lobby Dialog.");
        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.MultiplayerLobby,
            data: {
                // Pass initial player list if available from GAME_INFO
                players: this.pendingJoinInfo.players,
                localPlayerId: webRTCManager.getMyPeerId() // Pass local ID for UI highlighting
            }
        });
        // The JoinLobby component should hide itself upon emitting ConfirmClicked.
    }

    /**
     * Handles the user cancelling out of a lobby (Host, Join, or Multiplayer Waiting).
     * Clears any pending host or join information, closes the WebRTC connection if active,
     * resets the coordinator state, and navigates back to the Main Menu.
     * @private
     */
    handleLobbyCancel() {
        console.log("[GameCoordinator] Lobby cancelled or left.");
        const wasHostSetup = this.pendingHostInfo !== null || this.activeHostManager !== null;
        const wasJoining = this.pendingJoinInfo !== null;

        if (wasHostSetup && this.activeHostManager) {
             console.log("[GameCoordinator] Telling active HostManager to notify clients of cancellation.");
             // HostManager should handle sending notifications if needed
             this.activeHostManager.handleHostCancel();
         }

        this.resetCoordinatorState(); // Central function handles clearing state and closing WebRTC

        // Navigate back to the main menu
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Instantiates and starts a `MultiplayerGame` instance, configured for either
     * host or client role based on parameters. This is typically called internally
     * after receiving necessary setup information (e.g., GAME_START message for client).
     * Note: This method seems potentially redundant or overlapping with logic in
     * `handleHostStartGame` and `_handleWebRTCMessageReceived`. Review if it can be removed
     * or refactored. Kept for now assuming it might be used in a flow not immediately apparent.
     *
     * @param {boolean} isHost - True if starting as host, false as client.
     * @param {string} playerName - Local player's name.
     * @param {object} gameData - For host: the settings object. For client: the { questionsData: ... } object.
     * @param {string} difficulty - Game difficulty string ('easy', 'medium', 'hard').
     * @param {string} peerId - Own PeerJS ID if host, Host's PeerJS ID if client.
     * @private
     * @async
     */
    async startMultiplayerGameInstance(isHost, playerName, gameData, difficulty, peerId) {
        console.warn("[GameCoordinator] startMultiplayerGameInstance called. Review if this method is necessary."); // Add warning
        try {
             let constructorGameData;
             if (isHost) {
                 // Host expects settings object directly
                 if (!gameData || !gameData.sheetIds) { // Basic validation for host settings
                      console.error("[GameCoordinator] Invalid settings data provided for host instance:", gameData);
                      throw new Error("Internal error: Invalid settings data format for host.");
                  }
                 constructorGameData = gameData;
             } else {
                 // Client expects { questionsData: ... }
                 if (!gameData || !gameData.questionsData || !Array.isArray(gameData.questionsData.sheets)) { // Validation for client data structure
                     console.error("[GameCoordinator] Invalid questions data provided for client instance:", gameData);
                     throw new Error("Internal error: Invalid questions data format for client.");
                 }
                 constructorGameData = gameData; // Pass the already structured { questionsData: ... } object
             }

             this.activeGame = new MultiplayerGame(isHost, playerName, constructorGameData, difficulty, peerId, webRTCManager);
             this.currentGameMode = isHost ? 'multiplayer-host' : 'multiplayer-client';
             await this.activeGame.start();
             // Navigation to GameArea should be handled by the Game.Started event emitted from activeGame.start()

        } catch (error) {
            console.error(`[GameCoordinator] Error starting Multiplayer Game (${isHost ? 'Host' : 'Client'}) in startMultiplayerGameInstance:`, error);
             const errorMsgKey = isHost ? 'mpHostErrorGameStartFail' : 'mpClientErrorGameStartFail';
             const errorMsg = miscUtils.getTextTemplate(errorMsgKey) || 'Failed to start multiplayer game.';
             eventBus.emit(Events.System.ShowFeedback, { message: errorMsg, level: 'error' });
             this.resetCoordinatorState(); // Reset state on failure
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the 'Game.Finished' event emitted by an active game instance.
     * Cleans up the `activeGame` reference, resets `currentGameMode`, hides any
     * lingering waiting dialogs, and closes the WebRTC connection if it was a
     * multiplayer game. Client instances ignore finish events originating from the host's
     * local game instance to prevent premature cleanup.
     *
     * @param {object} eventData - Event payload from Events.Game.Finished.
     * @param {string} eventData.mode - The game mode that finished (e.g., 'single', 'multiplayer-host').
     * @param {object} [eventData.results] - Optional results data from the game.
     * @private
     */
    handleGameFinished({ mode, results }) {
        console.log(`[GameCoordinator] Received Game.Finished event for mode: ${mode}`);

        // Client should only process its own finish or a GAME_OVER message, not the host's local finish event.
        if (this.currentGameMode === 'multiplayer-client' && mode === 'multiplayer-host') {
            console.log("[GameCoordinator] Client ignored host's local Game.Finished event.");
            return;
        }

        if (this.activeGame) {
            console.log(`[GameCoordinator] Cleaning up active ${mode} game.`);

            // Destroy the game instance (should handle internal cleanup)
            if (typeof this.activeGame.destroy === 'function') {
                this.activeGame.destroy();
            } else {
                 console.warn(`[GameCoordinator] Active game object for mode ${mode} lacks a destroy method.`);
             }

            this.activeGame = null;
            this.currentGameMode = null;

            // Hide waiting dialogs (safety check)
            const waitingDialog = uiManager.getComponent('WaitingDialog');
            if (waitingDialog && waitingDialog.isOpen) {
                console.log("[GameCoordinator] Hiding WaitingDialog after Game.Finished.");
                waitingDialog.hide();
            }

            // Close WebRTC only if coordinator initiated it (or managed host/client state)
            // Game instances might close their own connections in destroy(), but this is a fallback.
            if (mode && mode.startsWith('multiplayer')) {
                 console.log("[GameCoordinator] Closing WebRTC connection after multiplayer game finished.");
                 webRTCManager.closeConnection();
             }
        } else {
            console.warn("[GameCoordinator] Game.Finished received, but no active game found. Mode:", mode);
        }
        // Navigation after game finish is handled by the game instance itself (e.g., showing EndDialog)
        // or by GAME_OVER message handler for clients.
    }

    /**
     * Handles the user explicitly leaving the game (e.g., clicking a "Leave" button)
     * or a client disconnecting from the host during a game.
     * Destroys the active game instance (which should notify other players if multiplayer),
     * resets coordinator state, provides user feedback, and navigates to the Main Menu.
     * @private
     */
    handleLeaveGame() {
        console.log("[GameCoordinator] Received request to leave game or client disconnected.");
        if (this.activeGame) {
            const mode = this.currentGameMode;
            console.log(`[GameCoordinator] Destroying active ${mode} game due to leave/disconnect request.`);

            if (typeof this.activeGame.destroy === 'function') {
                 this.activeGame.destroy(); // MultiplayerGame.destroy handles sending CLIENT_LEFT/closing connection
             } else {
                  console.warn(`[GameCoordinator] Active game object for mode ${mode} lacks a destroy method.`);
                  // Manually close connection if destroy is missing for MP game
                  if (mode && mode.startsWith('multiplayer')) {
                      webRTCManager.closeConnection();
                  }
              }
            this.activeGame = null; // Clear reference immediately
            this.currentGameMode = null;

            // Provide feedback *after* attempting destruction/notification
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

            // Always navigate back to main menu after leaving
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        } else {
            console.warn("[GameCoordinator] LeaveGame/Disconnect request received, but no active game found.");
             // Ensure navigation back if somehow stuck without an active game
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
        // Ensure full state reset in case something was missed
        this.resetCoordinatorState();
    }

    /**
     * Handles WebRTC connection failures reported by `WebRTCManager`.
     * Cleans up any pending host/join info, destroys any active game, ensures the
     * WebRTC connection is closed, shows an appropriate error dialog to the user,
     * and navigates back to the Main Menu.
     *
     * @param {object} payload - Event payload from Events.WebRTC.ConnectionFailed.
     * @param {Error} payload.error - The error object detailing the failure.
     * @param {string} payload.context - Context string indicating where the failure occurred (e.g., 'host-start', 'client-connect').
     * @param {string} [payload.peerId] - The PeerJS ID involved in the failure, if applicable.
     * @private
     */
    handleWebRTCConnectionFailure({ error, context, peerId }) {
        console.error(`[GameCoordinator] WebRTC Connection Failure. Context: ${context}, Peer: ${peerId}`, error);

        // Clean up any active game first
        if (this.activeGame) {
            console.warn("[GameCoordinator] Destroying active game due to WebRTC failure.");
             if (typeof this.activeGame.destroy === 'function') {
                  this.activeGame.destroy(); // Let game handle its cleanup if possible
              }
            this.activeGame = null; // Ensure it's nulled regardless
        }

        // Reset pending states and ensure connection is closed
        this.resetCoordinatorState();

        // Determine user-friendly error message
        let errorKey = 'errorDialogGenericConnection'; // Default
        if (error && error.type) { // PeerJS errors often have a 'type' property
             switch (error.type) {
                 case 'peer-unavailable':
                 case 'peer-not-found': // Added possible variant
                     errorKey = 'errorDialogHostUnavailable';
                     break;
                 case 'network':
                     errorKey = 'errorDialogNetwork';
                     break;
                 case 'webrtc': // Generic WebRTC issue
                     errorKey = 'errorDialogWebRTC';
                     break;
                 case 'disconnected': // Server connection lost
                 case 'server-error':
                     errorKey = 'errorDialogSignaling';
                     break;
                 // Add more specific PeerJS error types if needed
             }
        } else if (error && error.message === 'Lost connection to signaling server.') {
            // Handle specific message if type is missing
             errorKey = 'errorDialogSignaling';
         }

        // Show error dialog
        /** @type {ErrorDialog} */
        const errorDialog = uiManager.getComponent('ErrorDialog');
        if (errorDialog) {
            const baseMessage = miscUtils.getTextTemplate(errorKey) || 'A network connection error occurred.';
            errorDialog.show(baseMessage); // Show only user-friendly message
        } else {
            // Fallback if dialog component isn't ready/available
            const fallbackMessage = miscUtils.getTextTemplate(errorKey) || 'Connection Error';
            eventBus.emit(Events.System.ShowFeedback, { message: fallbackMessage, level: 'error' });
        }

        // Ensure UI returns to main menu after showing error
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Resets the coordinator's internal state, cleaning up pending information,
     * destroying any active game or host manager instances, and closing the
     * WebRTC connection. This is used as a central cleanup function in various
     * error or cancellation scenarios.
     * @private
     */
    resetCoordinatorState() {
        console.log("[GameCoordinator ASYNC] Resetting state...");
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;

        if (this.activeGame) {
            console.warn("[GameCoordinator ASYNC] resetCoordinatorState called with active game - destroying.");
             if (typeof this.activeGame.destroy === 'function') {
                 this.activeGame.destroy();
             }
             this.activeGame = null;
        }
        if (this.activeHostManager) {
            console.warn("[GameCoordinator ASYNC] resetCoordinatorState called with active host manager - destroying.");
             if (typeof this.activeHostManager.destroy === 'function') {
                 this.activeHostManager.destroy();
             }
             this.activeHostManager = null;
        }

        this.currentGameMode = null;
        webRTCManager.closeConnection(); // Ensure connection is always closed on reset
        console.log("[GameCoordinator ASYNC] State reset complete.");
    }

    /**
     * Handles player list updates, typically received from `MultiplayerHostManager`
     * or via WebRTC message (H_PLAYER_SCORES_UPDATE). If the Host Lobby component
     * is currently visible (meaning the host is still in the setup phase), it forwards
     * the updated player list to that component for display.
     *
     * @param {object} payload - Event payload from Events.Multiplayer.Common.PlayerListUpdated or message data.
     * @param {Map<string, object>} payload.players - The updated player map (peerId -> playerData).
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        // Update is relevant for both host during setup and client during game/lobby
        if (this.currentGameMode === 'multiplayer-host' && this.activeHostManager && !this.activeGame) {
            // Host is in lobby phase
            const hostLobbyComp = uiManager.getComponent('HostLobby');
            if (hostLobbyComp && hostLobbyComp.isVisible) {
                 console.log("[GameCoordinator] Forwarding PlayerListUpdate to HostLobbyComponent");
                 hostLobbyComp.updateDisplay(players);
            }
        } else if (this.currentGameMode === 'multiplayer-client') {
            // Client might be in lobby or game - update MultiplayerLobbyDialog if visible
             const mpLobbyComp = uiManager.getComponent('MultiplayerLobby');
             if (mpLobbyComp && mpLobbyComp.isVisible) {
                 console.log("[GameCoordinator] Forwarding PlayerListUpdate to MultiplayerLobbyDialog");
                 mpLobbyComp.updatePlayerList(players);
             }
             // Also potentially update GameAreaComponent if game is active? (Needs checking if GameArea displays scores)
             // Cache the list locally for client regardless
             this.currentPlayerList = players;
             console.log("[GameCoordinator] Updated local player list cache for client.");
        }
    }

    /**
     * Handles the successful establishment of a WebRTC connection from a client to a host.
     * This event signifies the connection is open, but the client typically waits for
     * the GAME_INFO message before proceeding with the join request (`c_requestJoin`).
     * This handler primarily logs the successful connection.
     *
     * @param {object} payload - Event payload from Events.Multiplayer.Client.ConnectedToHost.
     * @param {string} payload.hostId - The PeerJS ID of the host the client connected to.
     * @private
     */
    _handleClientConnectedToHost({ hostId }) {
        console.log(`[GameCoordinator] Client successfully connected to host via WebRTC. Host ID: ${hostId}`);
        // The client now waits for the GAME_INFO message from the host before confirming the join.
    }

    /**
     * Processes WebRTC messages received specifically when operating as a client.
     * Ignores messages if operating as a host or if the sender is not the expected host.
     * Handles key messages like GAME_START (initiates client-side game), GAME_OVER
     * (cleans up, saves score, shows results), H_PLAYER_SCORES_UPDATE (updates lobby/UI),
     * and H_RESTARTING_LOBBY (navigates back to lobby for rematch).
     *
     * @param {object} payload - The message event payload from Events.WebRTC.MessageReceived.
     * @param {object} payload.msg - The message data object.
     * @param {string} payload.msg.type - The message type (e.g., MSG_TYPE.GAME_START).
     * @param {*} [payload.msg.payload] - The content/data associated with the message type.
     * @param {string} payload.sender - The PeerJS ID of the sender.
     * @private
     * @async
     */
    async _handleWebRTCMessageReceived({ msg, sender }) {
        // Only process messages if we are a client and the message is valid
        if (!msg || !msg.type || this.currentGameMode !== 'multiplayer-client') return;

        const expectedHostId = this.pendingJoinInfo?.hostId || this.webRTCManager.hostPeerId;

        // Ignore messages not from the expected host
        if (sender !== expectedHostId) {
            console.warn(`[GameCoordinator] Client received message from unexpected sender ${sender}, expected ${expectedHostId}. Ignored.`);
            return;
        }

        const type = msg.type;
        const messagePayload = msg.payload; // Renamed to avoid conflict with outer scope 'payload'

        switch (type) {
            case MSG_TYPE.GAME_START:
                console.log(`[GameCoordinator] Client received GAME_START from host ${sender}`);

                if (!this.pendingJoinInfo || this.pendingJoinInfo.hostId !== sender) {
                    console.warn("[GameCoordinator] Received GAME_START, but not in a valid pending join state or host ID mismatch.");
                    this.resetCoordinatorState();
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    return;
                }

                // Extract necessary info stored during join process
                const { questionsData, difficulty, playerName, hostId } = this.pendingJoinInfo;

                if (!playerName || !hostId || !questionsData || !difficulty) {
                    console.error("[GameCoordinator] Cannot start client game: GAME_START received but pending join info is incomplete.", this.pendingJoinInfo);
                    eventBus.emit(Events.System.ShowFeedback, {
                        message: miscUtils.getTextTemplate('mpClientErrorMissingJoinData'),
                        level: 'error'
                    });
                    this.resetCoordinatorState();
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    return;
                }

                console.log(`[GameCoordinator] Starting client game instance for player ${playerName}, host ${hostId}`);
                try {
                    // Use the structured data expected by MultiplayerGame constructor for clients
                    const gameInstanceData = { questionsData: questionsData };
                    this.activeGame = new MultiplayerGame(
                        false,              // isHost = false
                        playerName,
                        gameInstanceData,   // Pass the { questionsData: ... } object
                        difficulty,
                        hostId,             // Pass the host's ID
                        webRTCManager
                    );
                    await this.activeGame.start(); // Starts game, emits Game.Started -> UI navigation

                    if (this.activeGame) {
                        console.log("[GameCoordinator] Client game started successfully. Clearing pending join info.");
                        this.pendingJoinInfo = null; // Clear pending info only on successful start
                    } else {
                         // Should not happen if start() doesn't throw, but safety check
                         throw new Error("Failed to initialize activeGame instance after start call.");
                     }

                } catch (error) {
                     console.error("[GameCoordinator] Error starting client MultiplayerGame instance:", error);
                     eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('mpClientErrorGameStartFail'), level: 'error' });
                     this.resetCoordinatorState(); // Reset fully on client game start failure
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                }
                break;

            case MSG_TYPE.GAME_OVER:
                console.log(`[GameCoordinator] Client received GAME_OVER from host ${sender}`, messagePayload);

                // Hide any waiting dialog
                const waitingDialog = uiManager.getComponent('WaitingDialog');
                if (waitingDialog && waitingDialog.isOpen) {
                    waitingDialog.hide();
                }

                // Finalize local game state if not already finished
                if (this.activeGame && !this.activeGame.isFinished) {
                    console.log("[GameCoordinator] Forcing local game finish due to GAME_OVER message.");
                    // Pass flag to indicate it's due to host signal, not local completion
                    this.activeGame.finishGame(true);
                }

                // Attempt to save local player's highscore
                if (this.localPlayerName && messagePayload && messagePayload.gameName && messagePayload.difficulty && this.activeGame) {
                    try {
                        // Ensure score is a number before saving
                        const finalScore = typeof this.activeGame.score === 'number' ? this.activeGame.score : 0;
                        console.log(`[GameCoordinator] Attempting to save local multiplayer highscore. Name: ${this.localPlayerName}, Score: ${finalScore}`);
                        await highscoreManager.addHighscore(
                            this.localPlayerName,
                            finalScore,
                            messagePayload.gameName,
                            'multiplayer', // Explicitly mode 'multiplayer'
                            messagePayload.difficulty
                        );
                        console.log("[GameCoordinator] Local player multiplayer highscore saved.");
                    } catch (error) {
                        console.error("[GameCoordinator] Error saving local multiplayer highscore:", error);
                        eventBus.emit(Events.System.ShowFeedback, {
                            message: 'Error saving your highscore.', // User-friendly message
                            level: 'error'
                        });
                    }
                } else {
                    console.warn("[GameCoordinator] Could not save local highscore after GAME_OVER: missing data.", {
                        hasName: !!this.localPlayerName, hasPayload: !!messagePayload, hasGame: !!this.activeGame, score: this.activeGame?.score
                    });
                }

                // Show the multiplayer results dialog using data from GAME_OVER payload
                if (messagePayload) {
                    eventBus.emit(Events.Navigation.ShowView, {
                        viewName: Views.MultiplayerEndDialog,
                        data: messagePayload // Contains final scores, rankings etc. from host
                    });
                } else {
                    console.error("[GameCoordinator] GAME_OVER received without payload, cannot show results dialog.");
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Fallback
                }

                // Clean up state after handling GAME_OVER
                this.activeGame = null; // Clear game reference
                this.currentGameMode = null; // Reset mode
                // WebRTC connection closure might be handled by MultiplayerEndDialog closing or resetCoordinatorState
                break;

            case MSG_TYPE.H_PLAYER_SCORES_UPDATE:
                // Forward score updates to UI (e.g., Multiplayer Lobby)
                if (messagePayload && messagePayload.players instanceof Map) {
                    console.log("[GameCoordinator] Received H_PLAYER_SCORES_UPDATE from host.");
                    this._handlePlayerListUpdate({ players: messagePayload.players });
                } else {
                     console.warn("[GameCoordinator] Received invalid H_PLAYER_SCORES_UPDATE payload:", messagePayload);
                 }
                break;

            case MSG_TYPE.H_RESTARTING_LOBBY:
                // Handle host initiating a rematch
                console.log("[GameCoordinator] Host signaled lobby restart for rematch (H_RESTARTING_LOBBY).");

                // Clean up current game state before going back to lobby
                if (this.activeGame) {
                    if (typeof this.activeGame.destroy === 'function') this.activeGame.destroy();
                    this.activeGame = null;
                }
                this.currentGameMode = 'multiplayer-client'; // Still a client, but back in lobby state
                this.pendingJoinInfo = null; // Clear old pending info, host will send new GAME_INFO

                // Navigate back to the Multiplayer Lobby view
                eventBus.emit(Events.Navigation.ShowView, {
                    viewName: Views.MultiplayerLobby
                    // Lobby component should show a "Waiting for host..." state initially
                });
                break;

            default:
                console.log(`[GameCoordinator] Client received unhandled message type '${type}' from host ${sender}.`);
        }
    }

    /**
     * Handles the `Events.Game.LocalPlayerFinished` event, typically emitted by the
     * client-side `MultiplayerGame` instance when the local player answers all questions.
     * If operating as a client in an active game, it shows a "Waiting for other players" dialog.
     * The actual `CLIENT_FINISHED` message sending is handled within the `MultiplayerGame` instance itself.
     *
     * @param {object} payload - Event payload from Events.Game.LocalPlayerFinished.
     * @param {number} payload.score - The final score achieved by the local client player.
     * @private
     */
    _handleLocalPlayerFinished({ score }) {
         console.log(`[GameCoordinator Client ASYNC] LocalPlayerFinished event received. Final score: ${score}`);
         if (this.currentGameMode !== 'multiplayer-client' || !this.activeGame) {
             console.warn("[GameCoordinator Client ASYNC] LocalPlayerFinished ignored: not in active client game mode or game inactive.");
             return;
         }

         // Show the waiting dialog while waiting for host's GAME_OVER
         const waitingDialog = uiManager.getComponent('WaitingDialog');
         if (waitingDialog) {
             const waitMessage = miscUtils.getTextTemplate('mpClientWaitOthers') || "Waiting for other players to finish...";
             waitingDialog.show(waitMessage);
         } else {
             console.error("[GameCoordinator Client ASYNC] WaitingDialog component not found! Cannot show waiting message.");
             // Provide fallback feedback
             eventBus.emit(Events.System.ShowFeedback, {
                 message: 'You finished! Waiting for others...',
                 level: 'info',
                 duration: 8000 // Longer duration
             });
         }
     }

    /**
     * Handles the request to save a highscore, typically triggered from the
     * `SinglePlayerEndDialog`. Validates the incoming payload data (name, score, gameName, mode, difficulty),
     * calls the `HighscoreManager` to add the score, provides user feedback (success/error),
     * and finally navigates back to the Main Menu. This handler specifically checks
     * if the originating mode was 'single' and ignores requests from other modes.
     * Uses arrow function syntax for automatic `this` binding and is async.
     *
     * @param {object} payload - Event payload from Events.UI.EndDialog.SaveScoreClicked.
     * @param {string} [payload.name] - Player's name.
     * @param {number} [payload.score] - Achieved score.
     * @param {string} [payload.gameName] - Name of the game/quiz sheet.
     * @param {string} [payload.mode] - The game mode ('single').
     * @param {string} [payload.difficulty] - Difficulty level.
     * @private
     * @async
     */
    handleSaveHighscore = async (payload) => {
        console.log(`[GameCoordinator] Received request to save highscore:`, payload);

        // Only handle highscore saving explicitly for single-player mode via this event
        if (payload.mode !== 'single') {
            console.warn(`[GameCoordinator] handleSaveHighscore called, but event payload mode is not 'single' (Mode: ${payload.mode}). Ignoring.`);
            return;
        }

        // Validate essential data from payload
        const isValid = payload.name && typeof payload.name === 'string' && payload.name.trim() !== '' &&
                        payload.score !== undefined && typeof payload.score === 'number' && payload.score >= 0 &&
                        payload.gameName && typeof payload.gameName === 'string' &&
                        payload.difficulty && typeof payload.difficulty === 'string';

        if (!isValid) {
            console.error("[GameCoordinator] Attempted to save single-player highscore with invalid or incomplete data.", payload);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveErrorInvalidData') || 'Error saving: Invalid data.', level: 'error' });
            // Navigate back even on validation error to prevent getting stuck
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.resetCoordinatorState(); // Ensure state is clean
            return;
        }

        // Proceed with saving for single-player
        try {
            console.log("[GameCoordinator] Saving highscore for single-player game...");
            await highscoreManager.addHighscore(payload.name, payload.score, payload.gameName, payload.mode, payload.difficulty);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Highscore saved!', level: 'success' });
        } catch (error) {
            console.error("[GameCoordinator] Error saving single-player highscore:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveError') || 'Could not save highscore.', level: 'error' });
        } finally {
            // Always navigate back to main menu after attempting save for single player
            console.log("[GameCoordinator] Navigating back to Main Menu after single-player save attempt.");
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            this.resetCoordinatorState(); // Ensure game state is fully reset
        }
    }

    /**
     * Tries to load the player name from localStorage using the key 'playerName'.
     * If no name is found, it generates a new random name using `miscUtils.generateRandomPlayerName()`,
     * saves it back to localStorage, and then sets `this.localPlayerName`.
     * @private
     */
    _loadPlayerName() {
        let name = localStorage.getItem('playerName');
        if (!name || name.trim() === '') { // Added trim check for empty strings
            name = miscUtils.generateRandomPlayerName();
            console.log(`[GameCoordinator] No valid player name found in localStorage, generated: ${name}`);
            this._savePlayerName(name);
        }
        this.localPlayerName = name;
        console.log(`[GameCoordinator] Player name loaded/set to: ${this.localPlayerName}`);
    }

    /**
     * Saves the provided player name to localStorage under the key 'playerName'.
     * Includes basic validation to ensure the name is a non-empty string.
     * @param {string} name - The player name to save.
     * @private
     */
    _savePlayerName(name) {
        if (name && typeof name === 'string' && name.trim() !== '') {
            try {
                 localStorage.setItem('playerName', name.trim()); // Trim whitespace before saving
             } catch (error) {
                 console.error("[GameCoordinator] Error saving player name to localStorage:", error);
                 // Optionally notify user or handle quota exceeded errors
             }
        } else {
            console.warn("[GameCoordinator] Attempted to save invalid player name:", name);
        }
    }

    /**
     * Handles the `Events.Multiplayer.HostWaiting` event, typically emitted by the
     * host-side `MultiplayerGame` instance when the host finishes but waits for clients.
     * Shows the standard "WaitingDialog" with an appropriate message.
     *
     * @param {object} [payload] - Optional event payload.
     * @param {string} [payload.messageKey] - Optional specific message template key to use.
     * @private
     */
    _handleHostWaiting(payload) {
        if (!this.activeGame || this.currentGameMode !== 'multiplayer-host') {
            console.log("[GameCoordinator] _handleHostWaiting ignored: No active host game found.");
            return;
        }

        // Use specific key if provided, otherwise default host waiting message
        const messageKey = payload?.messageKey || 'mpHostWaitOthers';
        const message = miscUtils.getTextTemplate(messageKey) || "Waiting for other players...";

        console.log(`[GameCoordinator] Showing waiting dialog: "${message}"`);

        const waitingDialog = uiManager.getComponent('WaitingDialog');
        if (waitingDialog) {
            try {
                waitingDialog.show(message);
            } catch (error) {
                console.error("[GameCoordinator] Error showing WaitingDialog:", error);
            }
        } else {
            console.error("[GameCoordinator] WaitingDialog component not found.");
        }
    }

    /**
     * Handles the closing of the `MultiplayerEndDialog`. This signifies the end
     * of the multiplayer game flow for the current session. Performs final cleanup:
     * hides any lingering waiting dialog, stops WebRTC timeout checks for clients,
     * resets the coordinator state (which includes closing the connection), and
     * navigates the user back to the Main Menu.
     * @private
     */
    _handleMultiplayerDialogClosed() {
        console.log("[GameCoordinator] MultiplayerEndDialog closed. Performing final cleanup.");

        // Ensure waiting dialog is hidden
        try {
            const waitingDialog = uiManager.getComponent('WaitingDialog');
            if (waitingDialog && waitingDialog.isOpen) {
                console.log("[GameCoordinator] Hiding waiting dialog on MP EndDialog close.");
                waitingDialog.hide();
            }
        } catch (error) {
            console.error("[GameCoordinator] Error hiding WaitingDialog during cleanup:", error);
        }

        // Stop any client-side timeout checks if applicable
        if (this.webRTCManager.isClient) { // Check if it *was* a client
            this.webRTCManager.stopTimeoutCheck();
        }

        // Full state reset and connection closure
        this.resetCoordinatorState();

        // Navigate back to main menu
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the "Play Again" request from the `MultiplayerEndDialog`.
     * Currently, this checks if the client is still connected. If implementing
     * rematch functionality, this would trigger sending a message to the host
     * (e.g., CLIENT_REQUEST_REMATCH) or handling host-side logic.
     * Present implementation only logs and shows an error if not connected.
     * Uses arrow function syntax for automatic `this` binding.
     * @private
     */
    _handlePlayAgainRequest = () => {
        console.log("[GameCoordinator] Play Again requested from MultiplayerEndDialog.");

        // Basic check: Still connected as client?
        if (this.webRTCManager.status !== ConnectionStatus.CONNECTED_CLIENT) {
            console.error("[GameCoordinator] Cannot request Play Again: Client is not connected.");
            eventBus.emit(Events.System.ShowFeedback, {
                message: miscUtils.getTextTemplate('mpErrorNotConnected') || "Cannot play again: Not connected.",
                level: 'error'
            });
            // Maybe navigate back to main menu here? Or let dialog close handle it?
            // For now, let dialog close handle navigation via _handleMultiplayerDialogClosed.
            return;
        }

        // TODO: Implement actual Play Again / Rematch logic
        // - Client: Send CLIENT_REQUEST_REMATCH to host.
        // - Host: Handle requests, decide to restart, send H_RESTARTING_LOBBY.
        console.warn("[GameCoordinator] Play Again functionality not fully implemented.");
        eventBus.emit(Events.System.ShowFeedback, {
             message: "Rematch functionality is not yet available.",
             level: 'info'
         });
    };
}

export default GameCoordinator;