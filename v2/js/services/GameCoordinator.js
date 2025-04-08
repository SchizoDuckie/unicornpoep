import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views constants

// Import game mode classes
import SinglePlayerGame from '../game/SinglePlayerGame.js'; // Corrected path case
import MultiplayerGame from '../game/MultiplayerGame.js'; // Corrected path case
import PracticeGame from '../game/PracticeGame.js';     // Corrected path case

// Import services
import questionsManager from './QuestionsManager.js'; // Import QuestionsManager
import webRTCManager from './WebRTCManager.js';      // Assuming singleton

/**
 * Coordinates the creation and management of different game modes.
 * Listens for UI events requesting a game start and instantiates
 * the appropriate game controller class.
 */
class GameCoordinator {
    /**
     * Initializes the GameCoordinator.
     * @param {QuestionsManager} questionsManagerInstance - An instance of the QuestionsManager.
     */
    constructor(questionsManagerInstance) {
        console.info("[GameCoordinator] Initializing...");
        if (!questionsManagerInstance) {
            // Fallback to import if not provided (consider dependency injection pattern later)
             console.warn("[GameCoordinator] QuestionsManager instance not provided, attempting to import singleton.");
             this.questionsManager = questionsManager; 
        } else {
             this.questionsManager = questionsManagerInstance;
        }
        this.activeGame = null; // Reference to the currently active game instance
        this.pendingHostInfo = null; // Store temporary info while host lobby is active
        this.pendingJoinInfo = null; // Store temporary info while join process is active

        this.registerListeners();
    }

    /**
     * Registers listeners for UI events that trigger game starts.
     * @private
     */
    registerListeners() {
        // Listen for UI events signaling intent
        eventBus.on(Events.UI.MainMenu.StartSinglePlayerClicked, this.handleRequestSinglePlayer.bind(this));
        eventBus.on(Events.UI.MainMenu.StartPracticeClicked, this.handleRequestPractice.bind(this));
        eventBus.on(Events.UI.MainMenu.JoinMultiplayerClicked, this.handleRequestMultiplayerChoice.bind(this)); // Navigate to MP Choice screen

        // Listen for generic StartRequested event (likely from SheetSelection or future direct starts)
        eventBus.on(Events.Game.StartRequested, this.handleStartRequested.bind(this)); 

        // Multiplayer specific UI flows
        eventBus.on(Events.UI.MultiplayerChoice.HostClicked, this.handleStartMultiplayerHost.bind(this));
        eventBus.on(Events.UI.MultiplayerChoice.JoinClicked, this.handleShowJoinLobby.bind(this)); 
        eventBus.on(Events.UI.JoinLobby.SubmitCodeClicked, this.handleJoinMultiplayerAttempt.bind(this));
        eventBus.on(Events.UI.HostLobby.StartGameClicked, this.handleHostStartGame.bind(this));
        eventBus.on(Events.UI.JoinLobby.ConfirmClicked, this.handleClientConfirmJoin.bind(this));
        eventBus.on(Events.UI.HostLobby.CancelClicked, this.handleLobbyCancel.bind(this));
        eventBus.on(Events.UI.JoinLobby.CancelClicked, this.handleLobbyCancel.bind(this));

        // Listen for game lifecycle events to clean up
        eventBus.on(Events.Game.Finished, this.handleGameFinished.bind(this));
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame.bind(this));
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleLeaveGame.bind(this)); 
        eventBus.on(Events.WebRTC.ConnectionFailed, this.handleWebRTCConnectionFailure.bind(this));

        // Listen for game info received by client to store settings
        eventBus.on(Events.Multiplayer.Client.GameInfoReceived, this.handleClientReceivedGameInfo.bind(this));

        console.info("[GameCoordinator] Event listeners registered.");
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
            eventBus.emit(Events.System.ShowFeedback, { message: 'Je bent al in een spel!', level: 'warn' });
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
            eventBus.emit(Events.System.ShowFeedback, { message: 'Je bent al in een spel!', level: 'warn' });
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
        console.log(`[GameCoordinator] Received Game.StartRequested. Mode: ${mode}`, { settings, playerName, hostId });
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot start new game, another game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: 'Kan geen nieuw spel starten, er is al een spel bezig.', level: 'error' });
            return;
        }

        // Show loading indicator before potentially async operations
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });

        // Use a small delay to allow the loading screen to render
        await new Promise(resolve => setTimeout(resolve, 100)); 

        try {
            switch (mode) {
                case 'single':
                    console.log(`[GameCoordinator] Starting Single Player game with settings:`, settings);
                    // TODO: Get player name if not provided? Using placeholder for now.
                    const spPlayerName = playerName || 'Sanne'; 
                    this.activeGame = new SinglePlayerGame(settings, spPlayerName, this.questionsManager);
                    await this.activeGame.start(); // start() should be async if it loads questions
                    break;
                case 'practice':
                    console.log(`[GameCoordinator] Starting Practice game with settings:`, settings);
                    this.activeGame = new PracticeGame(settings, this.questionsManager);
                    await this.activeGame.start(); // start() should be async
                    break;
                case 'multiplayer-host':
                     console.error("[GameCoordinator] Starting multiplayer host via StartRequested is not the standard flow. Use MultiplayerChoice -> HostClicked.");
                     // If needed, could call handleStartMultiplayerHost here, but it's cleaner via UI events.
                     eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon multiplayer host niet starten via deze weg.' });
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    break;
                case 'multiplayer-join':
                     console.error("[GameCoordinator] Starting multiplayer join via StartRequested is not the standard flow. Use MultiplayerChoice -> JoinClicked.");
                     // If needed, could call handleShowJoinLobby here.
                     eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon niet meedoen met multiplayer via deze weg.' });
                     eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    break;
                default:
                    console.error(`[GameCoordinator] Unknown game mode requested: ${mode}`);
                    eventBus.emit(Events.System.ErrorOccurred, { message: `Onbekende spelmodus: ${mode}` });
                    eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                    return; // Exit early
            }
            // Navigation to GameArea should happen in response to the Game.Started event emitted by the specific game class instance.
            console.log(`[GameCoordinator] ${mode} game instance created and started.`);

        } catch (error) {
            console.error(`[GameCoordinator] Error starting ${mode} game:`, error);
            eventBus.emit(Events.System.ErrorOccurred, { message: `Kon ${mode} spel niet starten: ${error.message}`, error });
            this.activeGame = null; // Ensure activeGame is nullified on error
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Go back to main menu on error
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
             eventBus.emit(Events.System.ShowFeedback, { message: 'Je bent al in een spel!', level: 'warn' });
            return;
        }
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
     }

    // --- Multiplayer Flow Handlers (Keep existing, ensure they use pending info correctly) --- 

    /**
     * Handles the request to host a multiplayer game.
     * Initiates WebRTC hosting and navigates to Host Lobby.
     * @param {object} payload - From Events.UI.MultiplayerChoice.HostClicked.
     * @param {string} payload.playerName - Host's name.
     * @param {object} payload.settings - Game settings.
     * @private
     */
    handleStartMultiplayerHost({ playerName, settings }) {
        console.log("[GameCoordinator] Received HostClicked event.", { playerName, settings });
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot start host, another game is active.");
            eventBus.emit(Events.System.ShowFeedback, { message: 'Kan geen host starten, er is al een spel bezig.', level: 'error' });
            return;
        }
        // Store potential host info
        this.pendingHostInfo = { playerName, settings }; 

        // Show Host Lobby view FIRST (provides immediate feedback)
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.HostLobby, data: { playerName, settings } });

        // Initialize WebRTC hosting asynchronously
        try {
            console.log(`[GameCoordinator] Initializing Multiplayer Host via WebRTCManager...`);
            // WebRTCManager should initialize PeerJS and emit Host.Initialized with the hostId
            webRTCManager.startHost(playerName); 
            // Now we wait for Host.Initialized from WebRTCManager, or HostLobby.StartGameClicked from UI.
        } catch (error) {
            console.error("[GameCoordinator] Error initializing multiplayer host:", error);
            this.pendingHostInfo = null; // Clear pending info on error
            eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon het hosten niet starten.', error, context: 'Multiplayer Host Init' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    /**
     * Handles the click on "Join Game" in MultiplayerChoice.
     * Navigates to the Join Lobby view.
     * @param {object} payload - From Events.UI.MultiplayerChoice.JoinClicked.
     * @param {string} payload.playerName - Joining player's name.
     * @private
     */
    handleShowJoinLobby({ playerName }) {
         console.log(`[GameCoordinator] Received JoinClicked event. Player: ${playerName}`);
         if (this.activeGame) {
             console.warn("[GameCoordinator] Cannot show join lobby, a game is active.");
             eventBus.emit(Events.System.ShowFeedback, { message: 'Je bent al in een spel!', level: 'warn' });
             return;
         }
         this.pendingJoinInfo = { playerName }; // Store player name
         eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.JoinLobby, 
            data: { playerName: playerName } 
        });
    }

    /**
     * Handles the *initial attempt* to join via code submission.
     * Triggers WebRTC connection attempt.
     * @param {object} payload - From Events.UI.JoinLobby.SubmitCodeClicked.
     * @param {string} payload.code - Submitted host code.
     * @param {string} payload.playerName - Joining player's name.
     * @private
     */
    handleJoinMultiplayerAttempt({ code, playerName }) {
        console.log(`[GameCoordinator] Received SubmitCodeClicked event. Code: ${code}, Player: ${playerName}`);
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot join game, another game is active.");
             eventBus.emit(Events.System.ShowFeedback, { message: 'Kan niet meedoen, er is al een spel bezig.', level: 'error' });
            return;
        }
        // Store attempted host code and player name
        this.pendingJoinInfo = { ...(this.pendingJoinInfo || {}), hostId: code, playerName };

        // JoinLobbyComponent should show "Connecting..." state based on this event or navigation

        try {
            console.log(`[GameCoordinator] Attempting to join host ${code} as ${playerName} via WebRTCManager...`);
            // OLD: webRTCManager.initializeClient(code, playerName);
            // NEW: Call startClient. WebRTCManager will emit events based on connection success/failure.
            webRTCManager.startClient(code, playerName);
            // Now we wait for WebRTC.Client.ConnectedToHost or WebRTC.ConnectionFailed
        } catch (error) {
            console.error(`[GameCoordinator] Error initiating connection to host ${code}:`, error);
            this.pendingJoinInfo = null; // Clear pending info
            eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon geen verbinding maken met de host.', error, context: 'Multiplayer Join Init' });
            // Optionally emit specific UI event for Join Lobby to show failure
            eventBus.emit(Events.UI.JoinLobby.ConnectionFailed, { message: 'Kon geen verbinding maken.' }); 
            // Don't navigate away immediately, let JoinLobby show the error.
            // eventBus.emit(Events.Navigation.ShowView, { viewName: 'MultiplayerChoiceComponent' }); 
        }
    }

     /**
     * Handles the host clicking "Start Game" in the Host Lobby.
     * Instantiates the host-side MultiplayerGame.
     * @private
     */
    handleHostStartGame() {
        console.log("[GameCoordinator] Received StartGameClicked from Host Lobby.");
        if (!this.pendingHostInfo) { // Removed check for hostId as it might come later from WebRTCManager
            console.error("[GameCoordinator] Cannot start game: Missing pending host info.");
            eventBus.emit(Events.System.ErrorOccurred, { message: 'Fout bij starten spel: Host details missen.' });
            return;
        }
        if (this.activeGame) {
            console.warn("[GameCoordinator] Cannot start game, another game is active.");
            return;
        }

        // We need the actual hostId from WebRTCManager
        const hostId = webRTCManager.getMyPeerId(); 
        if (!hostId) {
             console.error("[GameCoordinator] Cannot start game: WebRTCManager has no host ID yet.");
             eventBus.emit(Events.System.ErrorOccurred, { message: 'Fout bij starten spel: Verbinding nog niet klaar.' });
             // Maybe re-emit Host.Initialized from WebRTCManager if it's ready but Coordinator missed it?
             // Or rely on UI disabling start button until Host.Initialized is received.
             return;
        }

        const { playerName, settings } = this.pendingHostInfo;
         console.log(`[GameCoordinator] Starting Multiplayer Game as Host. ID: ${hostId}`);
        this.startMultiplayerGameInstance(true, playerName, settings, hostId);
        this.pendingHostInfo = null; // Clear pending info
    }

    /**
     * Handles the client clicking "Confirm Join" in the Join Lobby.
     * Instantiates the client-side MultiplayerGame.
     * @private
     */
    handleClientConfirmJoin() {
        console.log("[GameCoordinator] Received ConfirmClicked from Join Lobby.");
        if (!this.pendingJoinInfo || !this.pendingJoinInfo.hostId || !this.pendingJoinInfo.settings) {
             console.error("[GameCoordinator] Cannot confirm join: Missing pending join info, hostId, or settings.");
             eventBus.emit(Events.System.ErrorOccurred, { message: 'Fout bij meedoen: Spel details missen.' });
             // Navigate back?
             eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
             return;
        }
         if (this.activeGame) {
             console.warn("[GameCoordinator] Cannot start game, another game is active.");
             return;
         }

        const { playerName, settings, hostId } = this.pendingJoinInfo;
         console.log(`[GameCoordinator] Starting Multiplayer Game as Client. Host ID: ${hostId}`);
        this.startMultiplayerGameInstance(false, playerName, settings, hostId);
        this.pendingJoinInfo = null; // Clear pending info
    }

    /**
     * Handles cancellation from either Host or Join lobby.
     * Cleans up pending state and WebRTC connections.
     * @private
     */
    handleLobbyCancel() {
        console.log("[GameCoordinator] Received CancelClicked from a lobby.");
        this.pendingHostInfo = null;
        this.pendingJoinInfo = null;
        
        // Tell WebRTCManager to close any pending/active connection
        // WebRTCManager should handle if it's host or client internally
        webRTCManager.closeConnection(); 
        console.log("[GameCoordinator] Pending info cleared, WebRTC connection closed.");

        // Navigate back to the main menu
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Instantiates and starts a MultiplayerGame instance (either host or client).
     * @param {boolean} isHost - True if starting as host, false as client.
     * @param {string} playerName - Local player's name.
     * @param {object} settings - Game settings.
     * @param {string} peerId - Own ID if host, Host's ID if client.
     * @private
     */
    async startMultiplayerGameInstance(isHost, playerName, settings, peerId) {
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Loading });
        await new Promise(resolve => setTimeout(resolve, 100)); 

        try {
            console.log(`[GameCoordinator] Instantiating MultiplayerGame. IsHost: ${isHost}`);
            // TODO: MultiplayerGame constructor needs updating based on its implementation
            // Assuming constructor signature: (settings, playerName, isHost, initialPeerId, questionsManager)
            // Passing questionsManager might only be needed by host?
            this.activeGame = new MultiplayerGame(settings, playerName, isHost, peerId, this.questionsManager);
            await this.activeGame.start(); // MultiplayerGame start() should handle network sync/events
            console.log(`[GameCoordinator] Multiplayer game instance created and started.`);
            // Game.Started event from MultiplayerGame will trigger navigation to GameArea
        } catch (error) {
            console.error(`[GameCoordinator] Error starting multiplayer game instance (isHost: ${isHost}):`, error);
            eventBus.emit(Events.System.ErrorOccurred, { message: 'Kon multiplayer spel niet starten.', error });
            this.activeGame = null;
            webRTCManager.closeConnection(); // Ensure connection is closed on error
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        }
    }

    // --- Game Lifecycle Handlers --- 

    /**
     * Handles the end of any game mode.
     * Cleans up the active game instance.
     * @param {object} payload - Event payload from Events.Game.Finished
     * @param {string} payload.mode - The mode that finished.
     * @param {object} payload.results - The game results.
     * @private
     */
    handleGameFinished({ mode, results }) {
        console.log(`[GameCoordinator] Received Game.Finished event for mode: ${mode}`, results);
        if (this.activeGame) {
            console.log(`[GameCoordinator] Cleaning up active ${mode} game.`);
            if (typeof this.activeGame.destroy === 'function') {
                this.activeGame.destroy();
            }
            this.activeGame = null;
            // Navigation to End Screen/Main Menu should be handled by UI listening to Game.Finished
        } else {
            console.warn("[GameCoordinator] Game.Finished received, but no active game found.");
        }
        // If it was a multiplayer game, ensure WebRTC connection is closed
         if (mode === 'multiplayer') {
             console.log("[GameCoordinator] Closing WebRTC connection after MP game finished.");
             webRTCManager.closeConnection();
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
            // Notify other players if multiplayer?
            // MultiplayerGame.destroy() might handle this via WebRTCManager?
             if (typeof this.activeGame.destroy === 'function') {
                 this.activeGame.destroy();
             }
            this.activeGame = null;
            // Navigate immediately back to main menu
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            // Close WebRTC if applicable (destroy should handle this ideally)
            webRTCManager.closeConnection(); 
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
             if (typeof this.activeGame.destroy === 'function') {
                 this.activeGame.destroy();
             }
            this.activeGame = null;
        }
        // Ensure connection is closed
        webRTCManager.closeConnection();
        
        // Show error feedback (WebRTCManager might also emit System.ErrorOccurred)
        // eventBus.emit(Events.System.ShowFeedback, { message: `Verbindingsfout: ${error.message}`, level: 'error' });

        // Navigate back to the main menu
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * [Client Only] Stores game settings received from the host.
     * This info is needed before the client can confirm the join.
     * @param {object} payload 
     * @param {object} payload.settings
     * @param {string} payload.hostId // Host's peer ID
     */
    handleClientReceivedGameInfo({ settings, hostId }) {
        console.log(`[GameCoordinator] Client received Game Info from host ${hostId}`, settings);
        if (this.pendingJoinInfo && this.pendingJoinInfo.hostId === hostId) {
            // Store the settings in the pending info object
            this.pendingJoinInfo.settings = settings;
            console.log(`[GameCoordinator] Stored settings in pendingJoinInfo.`);
        } else {
            console.warn(`[GameCoordinator] Received GameInfo, but no matching pendingJoinInfo found or hostId mismatch.`, 
                { expectedHost: this.pendingJoinInfo?.hostId, receivedHost: hostId });
            // This might happen if the client cancelled or connection dropped before info arrived.
            // Or if the GameInfo message format changes unexpectedly.
        }
        // Note: We do NOT start the game here. The user confirms via JoinLobbyComponent -> ConfirmClicked -> handleClientConfirmJoin
    }
}

// Create and export a singleton instance
const gameCoordinator = new GameCoordinator(questionsManager); // Pass imported questionsManager
export default gameCoordinator; 