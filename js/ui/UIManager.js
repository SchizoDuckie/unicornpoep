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
import CountdownComponent from '../components/countdown-component.js';
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
import WaitingDialog from '../dialogs/waiting-dialog.js'; // <-- Add this import
import MultiplayerLobbyDialog from '../dialogs/multiplayer-lobby-dialog.js'; // <-- ADDED
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
            // Check initial hash on load
            this.checkInitialHash(); 
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
            this.registerComponent(new CountdownComponent());
            
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
            this.registerComponent(new WaitingDialog()); // <-- Add this registration
            this.registerComponent(new MultiplayerLobbyDialog()); // <-- ADDED
            
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
     * Registers listeners for navigation events AND handles hash changes.
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
        eventBus.on(Events.Game.Started, () => {
            console.log("[UIManager] Game.Started received, showing GameArea.");
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

        // --- ADDED: Listen for About Actions ---
        eventBus.on(Events.UI.MainMenu.AboutClicked, () => {
            console.log("[UIManager] AboutClicked received, showing AboutComponent.");
            this.handleShowView({ viewName: Views.About }); // Use the view constant
        });
    }

    /**
     * Checks the initial URL state (query parameters) on page load 
     * and triggers the appropriate initial view or action.
     * Priority: ?join= > default view
     * @private
     */
    checkInitialHash() {
        console.log(`[UIManager DEBUG] checkInitialHash running. URL: ${window.location.href}`);

        // --- MINIMAL ADDITION V3: Check for ?join= parameter ---
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');

        if (joinCode) {
            if (/^[0-9]{6}$/.test(joinCode)) {
                // Valid Join Code Found - Emit event and return true
                console.log(`[UIManager] Initial URL has valid join code: ${joinCode}. Emitting event.`);
                eventBus.emit(Events.System.ValidJoinCodeDetected, { joinCode: joinCode });
                return true; // Indicate that initial navigation was handled
            } else {
                // Invalid Join Code Found - Warn, clean URL, and fall through to return false
                console.warn(`[UIManager] Invalid join code format in URL parameter: ?join=${joinCode}. Ignoring join, proceeding with default.`);
                const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]join=[^&]+/, '').replace(/^&/, '?'); // Remove join param
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl); // Clean invalid param
                // Let execution fall through to return false
            }
        }
        // --- END MINIMAL ADDITION V3 ---

        // --- No valid join code found or handled, return false --- 
        return false;
    }

    /**
     * Handles the ShowView navigation event.
     * Hides the current view (if any) and shows the requested view.
     * @param {object} payload - Event payload.
     * @param {string} payload.viewName - The name of the VIEW component to show.
     * @param {any} [payload.data] - Optional data to pass to the component.
     * @private
     */
    handleShowView({ viewName, data }) {
        console.log(`[UIManager] Received ShowView event for: '${viewName}'`, data ? `with data:` : '', data || '');

        // <<< ADD: Ensure WaitingDialog is hidden when navigating TO MainMenu >>>
        if (viewName === Views.MainMenu) {
            const waitingDialog = this.getComponent('WaitingDialog');
            if (waitingDialog && waitingDialog.isOpen) {
                console.log("[UIManager] Hiding WaitingDialog because MainMenu is being shown.");
                waitingDialog.hide();
            }
        }
    

        // --- DEBUGGING --- 
        // Check if we are trying to navigate back to MainMenu unexpectedly
        // Let's assume a property like `this.isGameActive` is set by GameCoordinator or MultiplayerGame
        // For now, let's use a simple check based on currently visible component
        const gameAreaComp = this.getComponent('GameAreaComponent');
        const isGameAreaVisible = gameAreaComp && gameAreaComp.isVisible;
        
        if (viewName === Views.MainMenu && isGameAreaVisible) {
             console.warn(`[UIManager DEBUG] !!! Unexpected navigation to MainMenu while GameArea was visible!`);
             console.trace("Navigation Trace"); // Log stack trace to see who called showView
            // debugger; // Uncomment this line to pause execution here in browser DevTools
        }
        // --- END DEBUGGING ---

        const targetComponent = this.components.get(viewName);

        if (!targetComponent) {
            console.error(`[UIManager] UI Error: View component named '${viewName}' not found.`);
            eventBus.emit(Events.System.ShowFeedback, {
                message: `Error navigating: View '${viewName}' does not exist.`,
                level: 'error'
            });
            // Optionally navigate to a default/error view or just log
            return; 
        }

        // --- Ensure Loading component is hidden --- 
        const loadingComponent = this.components.get(Views.Loading);
        if (loadingComponent && viewName !== Views.Loading) {
            loadingComponent.hide(); // Hide loading if showing any other view
        }
        // --- End Loading check ---

        // Hide the previously active view if there was one
        if (this.activeViewName && this.activeViewName !== viewName) {
            const previousComponent = this.components.get(this.activeViewName);
            if (previousComponent && typeof previousComponent.hide === 'function') {
                previousComponent.hide();
            }
        }

        // Show the target view
        if (typeof targetComponent.show === 'function') {
            targetComponent.show(data); // Pass data if the show method accepts it
            this.activeViewName = viewName;
             // Emit state change event
             eventBus.emit(Events.System.StateChange, { newState: viewName, oldState: this.activeViewName });

            console.log(`[UIManager] Switched view to: '${viewName}'`);
        } else {
            console.error(`[UIManager] Target component '${viewName}' does not have a show() method.`);
        }

        // Update hash for bookmarking/back button (simple approach)
        // Avoid changing hash if it was triggered BY hashchange itself
        // A more robust router would handle this better.
        // if (window.location.hash !== `#${viewName}`) {
        //     window.location.hash = `#${viewName}`;
        // }
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
