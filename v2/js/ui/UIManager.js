import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
// Import BaseComponent if needed for type hints, or specific components later
import BaseComponent from '../components/base-component.js';

// --- Import View Component Classes (from components folder) ---
import MainMenuComponent from '../components/main-menu-component.js';
import MultiplayerChoiceComponent from '../components/multiplayer-choice-component.js';
import HostLobbyComponent from '../components/host-lobby-component.js';
import JoinLobbyComponent from '../components/join-lobby-component.js';
import GameAreaComponent from '../components/game-area-component.js';
import HighscoresComponent from '../components/highscores-component.js';
import CustomQuestionsComponent from '../components/custom-questions-component.js';
import AboutComponent from '../components/about-component.js';
import LoadingComponent from '../components/loading-component.js';
import ToastComponent from '../components/toast-component.js';
// Potentially SheetSelectionComponent if used
import SheetSelectionComponent from '../components/sheet-selection-component.js'; 

// --- Import Game Area Component Classes ---
import QuestionDisplayComponent from '../components/question-display-component.js';
import AnswerListComponent from '../components/answer-list-component.js';
import TimerDisplayComponent from '../components/timer-display-component.js';
import ProgressDisplayComponent from '../components/progress-display-component.js';
import ScoreDisplayComponent from '../components/score-display-component.js';
import GameFeedbackComponent from '../components/game-feedback-component.js';
import PlayerListComponent from '../components/player-list-component.js';
import GameNavigationComponent from '../components/game-navigation-component.js'; // Ensure this is imported if needed

// --- Import Dialog Component Classes (from dialogs folder) ---
import BaseDialog from '../dialogs/base-dialog.js'; // Import BaseDialog for type checking
import SinglePlayerEndDialog from '../dialogs/single-player-end-dialog.js';
import MultiplayerEndDialog from '../dialogs/multiplayer-end-dialog.js';
import PracticeEndDialog from '../dialogs/practice-end-dialog.js';
import NamePromptDialog from '../dialogs/name-prompt-dialog.js';
import DisconnectionDialog from '../dialogs/disconnection-dialog.js';
import ErrorDialog from '../dialogs/error-dialog.js';
import ConfirmationDialog from '../dialogs/confirmation-dialog.js'; // Import the new dialog
import Views from '../core/view-constants.js'; // Ensure Views is imported

// --- Import Services ---
import highscoreManager from '../services/HighscoreManager.js'; // Import HighscoreManager

/**
 * Manages the overall UI state, including:
 * - Instantiating and holding references to all major UI view components and dialogs.
 * - Handling view transitions based on Navigation events.
 * - Showing/hiding view components as needed (Dialogs manage their own visibility).
 */
class UIManager {
    constructor() {
        console.info("[UIManager] Initializing...");
        /** @type {Map<string, BaseComponent | BaseDialog>} */ 
        this.components = new Map();
        this.activeViewName = null;

        document.addEventListener('DOMContentLoaded', () => {
            console.log("[UIManager] DOM Content Loaded. Initializing components...");
            this.initializeComponents();
            this.registerListeners();
             console.info("[UIManager] Initialization complete.");
        });
    }

    /**
     * Instantiates all the necessary UI components and dialogs.
     * @private
     */
    initializeComponents() {
        console.log("[UIManager] Instantiating UI components...");
        try {
            // --- Instantiate View Components (extend BaseComponent) --- 
            this.registerComponent(new MainMenuComponent());
            this.registerComponent(new MultiplayerChoiceComponent());
            this.registerComponent(new HostLobbyComponent());
            this.registerComponent(new JoinLobbyComponent());
            this.registerComponent(new GameAreaComponent());
            this.registerComponent(new HighscoresComponent());
            this.registerComponent(new CustomQuestionsComponent());
            this.registerComponent(new AboutComponent());
            this.registerComponent(new SheetSelectionComponent()); // If used

            // --- Instantiate Utility/Overlay Components (extend BaseComponent) ---
            this.registerComponent(new LoadingComponent());
            this.registerComponent(new ToastComponent());
            
            // --- Instantiate Game Area Components ---
            // Note: These are part of the 'GameArea' view but are registered
            // individually to manage their specific elements. GameAreaComponent
            // might just be a container or removed if not needed.
            this.registerComponent(new QuestionDisplayComponent()); // Assumes #question selector internally
            this.registerComponent(new AnswerListComponent());       // Assumes #answerList selector internally
            this.registerComponent(new TimerDisplayComponent());     // Assumes #timerDisplay selector internally
            this.registerComponent(new ProgressDisplayComponent());  // Assumes #progressDisplay selector internally
            this.registerComponent(new ScoreDisplayComponent());     // Assumes #scoreDisplay selector internally
            this.registerComponent(new GameFeedbackComponent());   // Assumes #gameFeedback selector internally
            this.registerComponent(new PlayerListComponent());     // Assumes #playerList selector internally
            this.registerComponent(new GameNavigationComponent()); // Assumes #gameNavigation/#stopGame selectors internally

            // --- Instantiate Dialog Components (extend BaseDialog) ---
            this.registerComponent(new SinglePlayerEndDialog());
            this.registerComponent(new MultiplayerEndDialog());
            this.registerComponent(new PracticeEndDialog());
            this.registerComponent(new NamePromptDialog());
            this.registerComponent(new DisconnectionDialog());
            this.registerComponent(new ErrorDialog());
            this.registerComponent(new ConfirmationDialog()); // Register the new dialog
            
            // Ensure all VIEW components are initially hidden (BaseComponent handles this partly)
            this.hideAllViews(true); // Pass flag to skip hiding Loading component initially
            console.log("[UIManager] View components hidden initially (except Loading). Dialogs start closed.");

        } catch (error) {
            console.error("[UIManager] Error initializing components:", error);
        }
    }

    /**
     * Registers a component instance.
     * Accepts BaseComponent or BaseDialog instances.
     * @param {BaseComponent | BaseDialog} componentInstance
     * @private
     */
    registerComponent(componentInstance) {
        if (!componentInstance || !componentInstance.name) {
            console.error("[UIManager] Cannot register invalid component instance:", componentInstance);
            return;
        }
         // Check if it extends BaseComponent or BaseDialog
        if (!(componentInstance instanceof BaseComponent)) { 
             console.warn(`[UIManager] Component '${componentInstance.name}' does not extend BaseComponent or BaseDialog.`);
        }
        if (this.components.has(componentInstance.name)) {
            console.warn(`[UIManager] Component '${componentInstance.name}' already registered. Overwriting.`);
        }
        // --- DEBUG LOGGING --- 
        console.log(`[UIManager DEBUG] Attempting to set component with name: "${componentInstance.name}"`, componentInstance);
        // --- END DEBUG LOGGING --- 
        this.components.set(componentInstance.name, componentInstance);
        console.debug(`[UIManager] Registered component: '${componentInstance.name}'`);
    }

    /**
     * Registers listeners for navigation events.
     * @private
     */
    registerListeners() {
        console.log("[UIManager] Registering UIManager event listeners...");
        eventBus.on(Events.Navigation.ShowView, this.handleShowView.bind(this));
         // Listen for requests to go back to the main menu from dialogs
        eventBus.on(Events.UI.EndDialog.ReturnToMenuClicked, () => {
            console.log("[UIManager] ReturnToMenuClicked received, showing MainMenu.");
             // Ensure any active game is cleaned up first (GameCoordinator should handle this)
            this.handleShowView({ viewName: Views.MainMenu });
        });

        // --- Listen for Game State Changes ---
        eventBus.on(Events.Game.Started, ({ mode }) => {
            console.log(`[UIManager] Game Started (mode: ${mode}), showing GameArea.`);
            // Automatically show the GameArea view when any game starts
            this.handleShowView({ viewName: Views.GameArea });
        });

        // --- Listen for Highscore Actions ---
        // Listen for the request to view highscores (from Main Menu)
        eventBus.on(Events.UI.MainMenu.HighscoresClicked, () => {
            console.log("[UIManager] HighscoresClicked received. Loading scores and showing view.");
            // Navigate to the view first (it will show a loading state or empty list initially)
            this.handleShowView({ viewName: Views.Highscores });
            // Tell the manager to load and emit the scores
            highscoreManager.loadAndEmitAllScores();
        });

        // Listen for the request to save a highscore (from End Dialogs)
        // Note: Assuming Events.UI.EndDialog.SaveScoreClicked exists and has the correct payload
        eventBus.on(Events.UI.EndDialog.SaveScoreClicked, (payload) => {
            console.log("[UIManager] SaveScoreClicked received with payload:", payload);
            const { name, score, gameName, mode, difficulty } = payload;
            // Validate payload before calling manager
            if (name !== undefined && score !== undefined && gameName !== undefined && mode !== undefined && difficulty !== undefined) {
                 // Call the highscore manager to add the score
                 const saved = highscoreManager.addHighscore(name, score, gameName, mode, difficulty);
                 // Optionally provide feedback based on whether it was saved
                 if (saved) {
                     eventBus.emit(Events.System.ShowFeedback, { message: 'Highscore saved!', level: 'success' });
                 } else {
                      // HighscoreManager logs reasons for not saving (practice, low score, error)
                      // Maybe a generic feedback here, or rely on HighscoreManager's logs/feedback?
                      // eventBus.emit(Events.System.ShowFeedback, { message: 'Score did not qualify for highscores.', level: 'info' });
                 }
                 // Usually, after saving, we navigate back to the main menu
                 this.handleShowView({ viewName: Views.MainMenu });
            } else {
                 console.error("[UIManager] Invalid payload received for SaveScoreClicked:", payload);
                 eventBus.emit(Events.System.ShowFeedback, { message: 'Error saving highscore: Invalid data.', level: 'error' });
                 // Navigate back to main menu even on error to avoid getting stuck
                 this.handleShowView({ viewName: Views.MainMenu });
            }
        });
    }

    /**
     * Handles the ShowView navigation event.
     * Hides the current view (if any) and shows the requested view.
     * Does NOT handle Dialog components (they trigger themselves via events like Game.Finished).
     * @param {object} payload - Event payload.
     * @param {string} payload.viewName - The name of the VIEW component to show.
     * @param {any} [payload.data] - Optional data to pass to the component's show or prepareToShow method.
     * @private
     */
    handleShowView({ viewName, data }) {
        console.log(`[UIManager] Received ShowView event for: '${viewName}'`, data ? `with data:` : '', data || '');

        const targetComponent = this.components.get(viewName);

        // Ignore requests for dialog components - they trigger themselves
         if (targetComponent instanceof BaseDialog) { 
             console.warn(`[UIManager] Ignoring ShowView request for dialog component: ${viewName}. Dialogs are shown via game events or programmatic calls.`);
             return;
         }

        if (!targetComponent) {
             console.error(`[UIManager] Cannot show view: Component '${viewName}' not found or not registered.`);
             eventBus.emit(Events.System.ShowFeedback, { message: `UI Error: View '${viewName}' not found.`, level: 'error' }); 
             return;
        }
         // Ensure target is a BaseComponent (not a dialog at this point)
         if (!(targetComponent instanceof BaseComponent)) {
            console.error(`[UIManager] Cannot show view: Component '${viewName}' is not a BaseComponent instance.`);
            return;
        }
        
        // --- Special handling for Lobby view switching --- (Kept from previous version)
        const isTargetLobby = viewName === 'HostLobby' || viewName === 'JoinLobby';
        const isCurrentLobby = this.activeViewName === 'HostLobby' || this.activeViewName === 'JoinLobby';
        const currentComponent = this.components.get(this.activeViewName);

        if (isTargetLobby && isCurrentLobby && viewName !== this.activeViewName) {
             console.log(`[UIManager] Switching within lobby components: ${this.activeViewName} -> ${viewName}`);
             // Hide the current lobby component (assuming they manage their internal views)
             if (currentComponent instanceof BaseComponent) {
                  currentComponent.hide(); 
             }
            // Prepare and show the target lobby component
            if (data && typeof targetComponent.prepareToShow === 'function') {
                targetComponent.prepareToShow(data);
            }
            targetComponent.show();
            const oldViewName = this.activeViewName;
            this.activeViewName = viewName;
            eventBus.emit(Events.System.StateChange, { oldState: oldViewName, newState: viewName });
            return; // Stop standard switching
        }

        // --- Standard View Switching Logic --- 
        if (viewName === this.activeViewName) {
            console.warn(`[UIManager] View '${viewName}' is already active.`);
            // Still allow data updates for the active view
            if (data && typeof targetComponent.updateData === 'function') {
                 console.log(`[UIManager] Updating data for active view '${viewName}'...`);
                 targetComponent.updateData(data);
            } else if (data && typeof targetComponent.prepareToShow === 'function') {
                // Fallback: Use prepareToShow if updateData doesn't exist
                 console.log(`[UIManager] Updating data using prepareToShow for active view '${viewName}'...`);
                 targetComponent.prepareToShow(data);
            }
            return;
        }

        // Hide the currently active VIEW component (if it's a BaseComponent)
        if (currentComponent instanceof BaseComponent) {
             // Skip hiding Loading component unless explicitly targeted?
             // Let's always hide the current view unless it IS the loading component
            if (currentComponent.name !== 'Loading') {
                currentComponent.hide();
            }
        }

        // Prepare and show the target VIEW component
        if (data && typeof targetComponent.prepareToShow === 'function') {
            console.log(`[UIManager] Calling prepareToShow for '${viewName}'...`);
            targetComponent.prepareToShow(data); // Call prepare before showing
        }
        targetComponent.show(); // Handles making the root element visible

        // If the target isn't the loading component itself, hide the loading component
        if (viewName !== 'Loading') {
             const loadingComp = this.components.get('Loading');
             if (loadingComp instanceof BaseComponent) loadingComp.hide();
        }

        const oldViewName = this.activeViewName;
        this.activeViewName = viewName;
        console.info(`[UIManager] Switched view from '${oldViewName || 'none'}' to '${viewName}'`);
        eventBus.emit(Events.System.StateChange, { oldState: oldViewName, newState: viewName });
    }

    /**
     * Hides all registered VIEW components (BaseComponent instances).
     * Does not affect Dialogs (BaseDialog instances).
     * @param {boolean} [skipLoading=false] - If true, does not hide the Loading component.
     * @private
     */
    hideAllViews(skipLoading = false) {
        this.components.forEach((component, name) => {
            // Only hide BaseComponent instances (views), not BaseDialog instances
             if (component instanceof BaseComponent && !(component instanceof BaseDialog)) {
                 if (skipLoading && name === 'Loading') {
                     return; // Skip hiding loading component if requested
                 }
                component.hide();
             }
        });
        if (!skipLoading || this.activeViewName === 'Loading') {
             this.activeViewName = null;
        }
    }

    /**
     * Gets a reference to a registered component (View or Dialog).
     * @param {string} componentName - The name of the component.
     * @returns {BaseComponent | BaseDialog | undefined}
     */
    getComponent(componentName) {
        return this.components.get(componentName);
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager;
