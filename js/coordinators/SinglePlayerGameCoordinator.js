import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import miscUtils from '../utils/miscUtils.js';
import QuizEngine from '../services/QuizEngine.js';
import SinglePlayerGame from '../game/SinglePlayerGame.js';
import highscoreManager from '../services/HighscoreManager.js';
import uiManager from '../ui/UIManager.js';

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
        eventBus.on(Events.UI.MainMenu.StartPracticeClicked, this.handlePracticeClicked);
        
        // Game setup
        eventBus.on(Events.Game.StartRequested, this.handleGameStartRequested);
        eventBus.on(Events.UI.GameSetup.CancelSetupClicked, this.handleCancelSetup);
        
        // Game flow
        eventBus.on(Events.Game.Finished, this.handleGameFinished);
        eventBus.on(Events.UI.GameArea.LeaveGameClicked, this.handleLeaveGame);
        eventBus.on(Events.UI.Dialog.SaveScoreClicked, this._handleSaveScore);
        eventBus.on(Events.UI.EndDialog.RestartPracticeClicked, this._handleRestartPractice);
        
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
     * Handles the practice button click from the main menu.
     * Shows the game setup screen for practice mode.
     * 
     * @private
     * @event Events.UI.MainMenu.StartPracticeClicked
     * @throws Shows warning feedback if a game is already in progress
     */
    handlePracticeClicked = () => {
        if (this.activeGame) {
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('warnGameInProgress'), level: 'warn' });
            return;
        }
        
        // Show game setup screen for practice mode
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'practice' } });
    }

    /**
     * Handles the start game button click from the game setup screen.
     * Initializes and starts a new single player game with the specified settings.
     */
    handleGameStartRequested = async ({ mode, settings, playerName }) => {
        if (mode !== 'single' && mode !== 'practice') {
            return;
        }
        
        console.log(`[SinglePlayerGameCoordinator] GameStartRequested received for local mode: ${mode}`, { settings, playerName });
        // Validate incoming settings
        if (!settings || !settings.sheetIds || !Array.isArray(settings.sheetIds) || settings.sheetIds.length === 0) {
            console.error("[SinglePlayerGameCoordinator] Invalid settings received. Missing or empty sheetIds:", settings);
            return;
        }

        this.playerName = playerName;
      
        console.log("[SinglePlayerGameCoordinator] Stored pendingGameSettings:", this.pendingGameSettings);

        if (this.activeGame) {
            console.warn("[SinglePlayerGameCoordinator] Cannot start new game, already active.");
            return;
        }
        
        try {
            this.quizEngine = QuizEngine.getInstance();
            
            await this.quizEngine.loadQuestionsFromManager(settings.sheetIds, settings.difficulty);
            
            this.activeGame = new SinglePlayerGame(settings, this.quizEngine, playerName, mode);
            this.currentGameMode = mode;
            
            await this.activeGame.start();
            
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
     * @param {object} payload.results The results of the game
     * @private
     * @event Events.Game.Finished
     */
    handleGameFinished = ({ mode, results }) => {
        if (mode !== 'single' && mode !== 'practice') return; 
        
        if (results) {
            const dialogView = (mode === 'practice') ? Views.PracticeEndDialog : Views.SinglePlayerEndDialog;
            uiManager.showDialog(dialogView, results);
        } else {
            console.warn(`[SinglePlayerGameCoordinator] Game.Finished (mode: ${mode}) received, but no results payload found. Cannot show end dialog.`);
            this.resetState();
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            return; 
        }
        
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
        if (this.currentGameMode !== 'single' && this.currentGameMode !== 'practice') return;
        
        console.log(`[SinglePlayerGameCoordinator] LeaveGameClicked received for mode: ${this.currentGameMode}.`);
        
        this.resetState();
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Resets the coordinator's internal state.
     * Destroys active game and nullifies quiz engine reference.
     * @private
     */
    resetState = () => {
        if (this.activeGame) {
            this.activeGame.destroy();
            this.activeGame = null;
        }
        
        this.quizEngine = null; 
        
        this.currentGameMode = null;
        this.pendingGameSettings = null;
    }

    /**
     * Handles the save score event from the end dialog.
     * Calls the HighscoreManager to save the score.
     *
     * @param {object} payload Event payload from SaveScoreClicked
     * @param {string} payload.name Player name
     * @param {number} payload.score Final score
     * @param {string} payload.gameName Name of the game played (sheet key)
     * @param {string} payload.mode Game mode ('single')
     * @param {string} payload.difficulty Game difficulty
     * @private
     * @event Events.UI.Dialog.SaveScoreClicked
     */
    _handleSaveScore = ({ name, score, gameName, mode, difficulty }) => {
        try {
            const saved = highscoreManager.addHighscore(name, score, gameName, mode, difficulty); 
            if (saved) {
                eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveSuccess'), level: 'success' });
            } 
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Highscores }); 
        } catch (error) {
            console.error(`[SinglePlayerGameCoordinator] Error calling addHighscore:`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveError'), level: 'error' });
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); 
        }
    }

    /**
     * Handles the restart practice event from the end dialog.
     * Navigates back to the sheet selection screen for practice mode.
     * Assumes the user might want to change settings.
     * 
     * @private
     * @event Events.UI.EndDialog.RestartPracticeClicked
     */
    _handleRestartPractice = () => {
        // Reset state just in case (should already be reset by handleGameFinished)
        this.resetState(); 
        // Show sheet selection again for practice mode
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.SheetSelection, data: { mode: 'practice' } });
    }
}

export default SinglePlayerGameCoordinator;
