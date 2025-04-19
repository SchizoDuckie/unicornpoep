import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import miscUtils from '../utils/miscUtils.js';
import QuizEngine from '../services/QuizEngine.js';
import SinglePlayerGame from '../game/SinglePlayerGame.js';
import highscoreManager from '../services/HighscoreManager.js';

/**
 * Class SinglePlayerGameCoordinator.
 * 
 * Coordinates activities for single player games including initialization,
 * game flow management, and cleanup. Acts as the primary coordinator for
 * single player game lifecycle events.
 * 
 * @property {QuizEngine|null} quizEngine The quiz engine instance used for the current game
 * @property {SinglePlayerGame|null} activeGame The currently active single player game instance, if any
 * @property {string|null} currentGameMode The current game mode (should be 'single-player' when active)
 * @property {Object|null} pendingGameSettings Pending settings for a game about to start
 */
class SinglePlayerGameCoordinator {
    /**
     * Initializes the coordinator.
     * Sets up initial state and registers event listeners.
     */
    constructor() {
        console.info("[SinglePlayerGameCoordinator] Initializing...");
        
        this.quizEngine = null;
        this.activeGame = null;
        this.currentGameMode = null;
        this.pendingGameSettings = null;
        
        this.registerListeners();
    }

    /**
     * Registers listeners for single player game related events.
     * @private
     */
    registerListeners() {
        console.info("[SinglePlayerGameCoordinator] Registering listeners...");
        
        // Main menu selection
        eventBus.on(Events.UI.MainMenu.SinglePlayerClicked, this.handleSinglePlayerClicked);
        
        // Game setup
        eventBus.on(Events.Game.StartRequested, this.handleGameStartRequested);
        eventBus.on(Events.UI.GameSetup.CancelSetupClicked, this.handleCancelSetup);
        
        // Game flow
        eventBus.on(Events.Game.Finished, this.handleGameFinished);
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        eventBus.on(Events.UI.Dialog.SaveScoreClicked, this._handleSaveScore);
        
        console.info("[SinglePlayerGameCoordinator] Listeners registered.");
    }

    /**
     * Handles the single player button click from the main menu.
     * Shows the game setup screen.
     * 
     * @private
     * @event Events.UI.MainMenu.SinglePlayerClicked
     * @throws Shows warning feedback if a game is already in progress
     */
    handleSinglePlayerClicked = () => {
        console.log("[SinglePlayerGameCoordinator] SinglePlayerClicked received.");
        
        if (this.activeGame) {
            console.warn("[SinglePlayerGameCoordinator] Cannot start new game, a game is already in progress.");
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnGameInProgress'), level: 'warn' });
            return;
        }
        
        // Show game setup screen
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'single' } });
    }

    /**
     * Handles the start game button click from the game setup screen.
     * Initializes and starts a new single player game with the specified settings.
     
     */
    handleGameStartRequested = async ({ mode, settings, playerName }) => {
        if (mode !== 'single') {
            return;
        }
        
        console.log(`[SinglePLayerGamecoord ] GameStartRequested received for local mode:`, { settings, playerName });
        // Validate incoming settings
        if (!settings || !settings.sheetIds || !Array.isArray(settings.sheetIds) || settings.sheetIds.length === 0) {
            console.error("[MultiplayerHostCoordinator] Invalid settings received. Missing or empty sheetIds:", settings);
            debugger;
            return;
        }

        // Store player name and settings for later use when host is initialized
        this.playerName = playerName;
      
        
        console.log("[SinglePlayerGameCoordinator] Stored pendingGameSettings:", this.pendingGameSettings);

               
        
        if (this.activeGame) {
            console.warn("[SinglePlayerGameCoordinator] Cannot start single player game, already hosting a session.");
            debugger
            return;
        }
        
        
        try {
            // Initialize quiz engine
            this.quizEngine = QuizEngine.getInstance();
            
            // Load questions based on settings
            await this.quizEngine.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
            
            // Create and start the game
            this.activeGame = new SinglePlayerGame(settings, this.quizEngine, playerName);
            this.currentGameMode = 'single-player';
            
            // Start the game and navigate to game area
            await this.activeGame.start();
            
            // Note: Game handles navigation to game area
            
        } catch (error) {
            console.error(`[SinglePlayerGameCoordinator] Error starting game: ${error.message}`, error);
            this.resetState();
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('genericInternalError'), level: 'error' });
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
        console.log("[SinglePlayerGameCoordinator] CancelSetupClicked received.");
        this.pendingGameSettings = null;
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Handles the Game.Finished event.
     * Performs cleanup after a game has ended.
     * 
     * @param {Object} payload Event payload
     * @param {string} payload.mode The game mode that finished
     * @private
     * @event Events.Game.Finished
     */
    handleGameFinished = ({ mode }) => {
        if (mode !== 'single-player') return;
        
        console.log("[SinglePlayerGameCoordinator] Game.Finished received.");
        
        // Clean up game resources but keep results
        // Navigation to results screen is handled by the game
        
        // We don't fully reset state here because the game results may still be needed
        // The state will be fully reset when returning to main menu or starting a new game
    }

    /**
     * Handles the user leaving the game.
     * Resets the state and returns to main menu.
     * 
     * @private
     * @event Events.UI.GameArea.LeaveGameClicked
     */
    handleLeaveGame = () => {
        if (this.currentGameMode !== 'single-player') return;
        
        console.log("[SinglePlayerGameCoordinator] LeaveGameClicked received.");
        
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Resets the coordinator's internal state.
     * Destroys active game and quiz engine if they exist.
     * @private
     */
    resetState = () => {
        console.log("[SinglePlayerGameCoordinator] Resetting state...");
        
        // Clean up active game
        if (this.activeGame) {
            if (typeof this.activeGame.destroy === 'function') {
                this.activeGame.destroy();
            }
            this.activeGame = null;
        }
        
        // Clean up quiz engine
        if (this.quizEngine) {
            if (typeof this.quizEngine.destroy === 'function') {
                this.quizEngine.destroy();
            }
            this.quizEngine = null;
        }
        
        this.currentGameMode = null;
        this.pendingGameSettings = null;
        
        console.log("[SinglePlayerGameCoordinator] State reset complete.");
    }

    /**
     * Handles the save score event from the end dialog.
     * Calls the HighscoreManager to save the score.
     *
     * @param {object} payload Event payload from SaveScoreClicked
     * @param {string} payload.name Player name
     * @param {number} payload.score Final score
     * @param {string} payload.gameName Name of the game played
     * @param {string} payload.mode Game mode ('single')
     * @param {string} payload.difficulty Game difficulty
     * @private
     * @event Events.UI.Dialog.SaveScoreClicked
     */
    _handleSaveScore = ({ name, score, gameName, mode, difficulty }) => {
        console.log(`[SinglePlayerGameCoordinator] SaveScoreClicked received. Name: ${name}, Score: ${score}, Game: ${gameName}, Mode: ${mode}, Diff: ${difficulty}`);
        try {
            const saved = highscoreManager.addHighscore(name, score, gameName, mode, difficulty);
            if (saved) {
                eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveSuccess'), level: 'success' });
            } else {
                // Optional: Provide feedback if score wasn't high enough?
                // Currently, HighscoreManager logs this.
                 console.log('[SinglePlayerGameCoordinator] Score did not qualify or was not saved.');
            }
            // After attempting save, navigate to highscores or main menu
            // For now, let's go to highscores to see the result
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Highscores }); 
        } catch (error) {
            console.error(`[SinglePlayerGameCoordinator] Error calling addHighscore:`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveError'), level: 'error' });
            // Fallback to main menu on error
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); 
        }
    }
}

export default SinglePlayerGameCoordinator;
