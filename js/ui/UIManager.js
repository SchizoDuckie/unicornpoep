import Events from '../core/event-constants.js';
import eventBus from '../core/event-bus.js';
// Import RefactoredBaseComponent instead of BaseComponent
import RefactoredBaseComponent from '../components/RefactoredBaseComponent.js';


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

/**
 * Manages the overall UI state, including:
 * - Instantiating and holding references to all major UI view components and dialogs.
 * - Handling view transitions based on Navigation events.
 * - Showing/hiding view components as needed (Dialogs manage their own visibility).
 */
class UIManager extends RefactoredBaseComponent {
    /**
     * Selector and view name needed for RefactoredBaseComponent
     */
    static SELECTOR = 'body'; // Using body as the container for all UI components
    static VIEW_NAME = 'UIManager';
    
    static SELECTORS = {
        // No DOM elements to directly interact with 
    };

    constructor() {
        super();
        this.components = new Map();
        
        // Track navigation history for direction-based transitions
        this.navigationHistory = [];
        this.maxHistoryLength = 10; // Limit history length to save memory
        
        
    }

    /**
     * Tests if the View Transitions API is properly supported in the current browser
     * @returns {boolean} Whether the API is fully supported
     * @private
     */
    _checkViewTransitionsSupport() {
        return false;
        return 'startViewTransition' in document;
    }

    /**
     * Hides all registered VIEW components (BaseComponent instances).
     * Does not affect Dialogs (BaseDialog instances).
     * @param {boolean} [skipLoading=false] - If true, does not hide the Loading component.
     * @private
     */
    _hideAllViews(skipLoading = false) {
        console.log("Hiding all views from uimanager!")
        this.components.forEach((component, name) => {
            component.hide(); 
        });
        console.debug('[UIManager] All views hidden (except potentially Loading).');
        this.activeViewName = null; // No view is active after hiding all
    }

    /**
     * Initialize the UI Manager with event listeners and component configurations
     * @returns {Object} Configuration object with events, domEvents, and setup
     */
    initialize() {
        
        return {
            events: [
                // Navigation Handler
                { 
                    eventName: Events.Navigation.ShowView,
                    callback: this._handleShowView 
                },
                {
                    eventName: Events.UI.HideAllViews,
                    callback: this._hideAllViews
                },
                {
                    eventName: Events.Game.StartRequested,
                    callback: this._lazyInitializeGameComponents
                },
                {
                    eventName: Events.Game.Started,
                    callback: (e) => {
                        this._handleShowView({ viewName: Views.GameArea });
                    }
                },
                {
                    eventName: Events.System.ValidJoinCodeDetected,
                    callback: (e) => {
                        // Lazily initialize components needed for joining
                        this._lazyInitializeGameComponents(); // Keep this if needed
                        // Correctly navigate to the Join Lobby view, using the correct constant
                        this._handleShowView({ viewName: Views.JoinLobby, data: e }); 
                    }
                },
                // Ensure SheetSelectionComponent is initialized when MultiplayerChoice.HostClicked is triggered
                {
                    eventName: Events.UI.MultiplayerChoice.HostClicked,
                    callback: () => {
                        this._lazyInitializeGameComponents();
                    }
                },
                // End Dialog Handler
                {
                    eventName: Events.UI.EndDialog.ReturnToMenuClicked,
                    callback: (e) => this._handleShowView({ viewName: Views.MainMenu })
                },
                // Listen for the event to show the waiting dialog
                {
                    eventName: Events.System.ShowWaitingDialog,
                    callback: (payload) => {
                        console.log(`[UIManager] ShowWaitingDialog event received with payload:`, payload);
                        const waitingDialog = this.components.get(WaitingDialog.VIEW_NAME);
                        if (waitingDialog) {
                            if (payload && payload.message) {
                                waitingDialog.show(payload.message);
                            } else {
                                waitingDialog.show(); // Uses default message
                            }
                            console.log(`[UIManager] WaitingDialog shown successfully.`);
                        } else {
                            console.error(`[UIManager] WaitingDialog component not found!`);
                        }
                    }
                },
                // Listen for the event to hide the waiting dialog
                {
                    eventName: Events.System.HideWaitingDialog,
                    callback: () => {
                        console.log(`[UIManager] HideWaitingDialog event received.`);
                        const waitingDialog = this.components.get(WaitingDialog.VIEW_NAME);
                        if (waitingDialog) {
                            waitingDialog.hide();
                            console.log(`[UIManager] WaitingDialog hidden successfully.`);
                        } else {
                            console.error(`[UIManager] WaitingDialog component not found!`);
                        }
                    }
                }
                // Note: MainMenu navigation events handled by MainMenuComponent
                // Note: NamePrompt events handled by component interactions
            ],
            
            domEvents: [], // UIManager doesn't directly handle DOM events
            
            domElements: [], // No direct DOM elements to query
            
        };
    }

    /**
     * Instantiates all the necessary UI components and dialogs.
     */
    initializeComponents() {
        
        // --- Instantiate View Components (extend BaseComponent) --- 
        this._registerComponent(new MainMenuComponent());
        this._registerComponent(new MultiplayerChoiceComponent());
        this._registerComponent(new HostLobbyComponent());
        this._registerComponent(new JoinLobbyComponent());
        this._registerComponent(new GameAreaComponent());
        this._registerComponent(new CustomQuestionsComponent());
        this._registerComponent(new HighscoresComponent());
        this._registerComponent(new AboutComponent());

        // --- Instantiate Utility/Overlay Components (extend BaseComponent) ---
        this._registerComponent(new LoadingComponent());
        this._registerComponent(new CountdownComponent());
        
        // --- Instantiate Game Area Components ---
        this._registerComponent(new QuestionDisplayComponent());
        this._registerComponent(new TimerDisplayComponent());
        this._registerComponent(new ProgressDisplayComponent());
        this._registerComponent(new ScoreDisplayComponent());
        this._registerComponent(new GameFeedbackComponent());
        this._registerComponent(new PlayerListComponent());
        this._registerComponent(new GameNavigationComponent());
        this._registerComponent(new SheetSelectionComponent());
        this._registerComponent(new LoadingComponent());
        this._registerComponent(new ToastComponent());

        // --- Instantiate Dialog Components (extend BaseDialog) ---
        this._registerComponent(new SinglePlayerEndDialog());
        this._registerComponent(new MultiplayerEndDialog());
        this._registerComponent(new PracticeEndDialog());
        this._registerComponent(new NamePromptDialog());
        this._registerComponent(new DisconnectionDialog());
        this._registerComponent(new ErrorDialog());
        this._registerComponent(new ConfirmationDialog());
        this._registerComponent(new WaitingDialog());
        this._registerComponent(new MultiplayerLobbyDialog());
        
    }

    /**
     * Lazily initializes game components that require the game view to be rendered first.
     * This ensures components like AnswerListComponent don't try to find DOM elements
     * that don't exist yet.
     * @private
     */
    _lazyInitializeGameComponents() {
        // Only initialize AnswerListComponent if it doesn't already exist
        if (!this.components.has('AnswerListComponent')) {
            console.log('[UIManager] Lazily initializing AnswerListComponent...');
            this._registerComponent(new AnswerListComponent());
        }

        // Only initialize SheetSelectionComponent if it doesn't already exist
        if (!this.components.has('SheetSelectionComponent')) {
            console.log('[UIManager] Lazily initializing SheetSelectionComponent...');
            this._registerComponent(new SheetSelectionComponent());
        }

        // Only initialize ToastComponent if it doesn't already exist
        if (!this.components.has('ToastComponent')) {
            console.log('[UIManager] Lazily initializing ToastComponent...');
            this._registerComponent(new ToastComponent());
        }

        // Only initialize CustomQuestionsComponent if it doesn't already exist
        if (!this.components.has('CustomQuestionsComponent')) {
            console.log('[UIManager] Lazily initializing CustomQuestionsComponent...');
            this._registerComponent(new CustomQuestionsComponent());
        }
    }

    /**
     * Registers a component instance.
     * Accepts BaseComponent or BaseDialog instances.
     * @param {BaseComponent | BaseDialog} componentInstance
     * @private
     */
    _registerComponent(componentInstance) {
        console.info(`[UIManager] Registering '${componentInstance.name}'.`);

        if (!componentInstance || !componentInstance.name) {
            console.error("[UIManager] Cannot register invalid component instance:", componentInstance);
            return;
        }
        
        // Check if it extends RefactoredBaseComponent or BaseDialog
        if (!(componentInstance instanceof RefactoredBaseComponent || componentInstance instanceof BaseDialog)) { 
            console.warn(`[UIManager] Component '${componentInstance.name}' does not extend RefactoredBaseComponent or BaseDialog.`);
        }
        
        if (this.components.has(componentInstance.name)) {
            console.warn(`[UIManager] Component '${componentInstance.name}' already registered. Overwriting.`);
        }
        
        this.components.set(componentInstance.name, componentInstance);
    }

    /**
     * Checks the initial URL state (query parameters) on page load 
     * @public - Called by UnicornPoepApp
     */
    detectJoinCode() {
        const joinCode = (new URLSearchParams(window.location.search)).get('join');

        if (joinCode && /^[0-9]{6}$/.test(joinCode)) {
            return joinCode;
        }
        return false;
    }
    
    /**
     * Updates the navigation history with the new view.
     * @param {string} viewName The new view being shown
     * @private
     */
    _updateNavigationHistory(viewName) {
        // Add the new view to history
        this.navigationHistory.push(viewName);
        
        // Trim history if it exceeds max length
        if (this.navigationHistory.length > this.maxHistoryLength) {
            this.navigationHistory.shift();
        }
    }

    /**
     * Handles the ShowView navigation event.
     * Hides other components and shows the requested view.
     * ALL TRANSITION/ANIMATION LOGIC REMOVED.
     * 
     * @param {object} payload - Event payload.
     * @param {string} payload.viewName - The name of the VIEW component to show.
     * @param {any} [payload.data] - Optional data to pass to the component.
     * @private
     */
    _handleShowView({ viewName, data }) {
        console.log('[UIManager] _handleShowView (Simplified - No Transitions)', viewName, data);

        const targetComponent = this.components.get(viewName);
        
        if (!targetComponent) {
            console.error(`[UIManager] Component '${viewName}' not found.`);
            return;
        }

        // Hide all other view components
        this.components.forEach((component) => {
            // Check if it's a view component (not a dialog) and not the target
            if (component !== targetComponent && !(component instanceof BaseDialog)) { 
                component.hide(); 
            }
        });

        // Show the target component
        targetComponent.show(data); 
        this.activeViewName = viewName;
        this._updateNavigationHistory(viewName);

        console.log(`[UIManager] Simplified show complete for ${viewName}`);

        // *** ADDED: Special handling for GameAreaComponent children ***
        if (viewName === Views.GameArea) {
            // Determine if it's a multiplayer game from the data passed
            const isMultiplayer = data && (data.gameMode === 'multiplayer-host' || data.gameMode === 'multiplayer-client');
            
            console.log(`[UIManager] GameArea shown. Is multiplayer: ${isMultiplayer}`);

            const playerListComponent = this.components.get('PlayerListComponent');
            if (playerListComponent) {
                if (isMultiplayer) {
                    console.log(`[UIManager] Explicitly showing PlayerListComponent.`);
                    playerListComponent.show(); 
                } else {
                    console.log(`[UIManager] Explicitly hiding PlayerListComponent.`);
                    playerListComponent.hide();
                }
            }

            const gameNavigationComponent = this.components.get('GameNavigation');
            if (gameNavigationComponent) {
                console.log(`[UIManager] Explicitly showing GameNavigation.`);
                gameNavigationComponent.show();
            }
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

    /**
     * Shows a specific dialog component by its registered name.
     * Does not hide other components or dialogs.
     * 
     * @param {string} dialogName The VIEW_NAME of the dialog component to show.
     * @param {*} [data] Optional data to pass to the dialog's show method.
     */
    showDialog(dialogName, data = null) {
        const dialogComponent = this.components.get(dialogName);

        if (dialogComponent && dialogComponent instanceof BaseDialog) {
            console.log(`[${this.name}] Showing dialog: ${dialogName}`);
            // Pass data to the dialog's show method if provided
            if (data !== null) {
                dialogComponent.show(data); 
            } else {
                dialogComponent.show();
            }
        } else if (dialogComponent) {
            console.error(`[${this.name}] Attempted to show non-dialog component '${dialogName}' using showDialog.`);
        } else {
            console.error(`[${this.name}] Dialog component '${dialogName}' not found.`);
        }
    }

    /**
     * Hides a specific dialog component by its registered name.
     * 
     * @param {string} dialogName The VIEW_NAME of the dialog component to hide.
     */
    hideDialog(dialogName) {
        const dialogComponent = this.components.get(dialogName);

        if (dialogComponent && dialogComponent instanceof BaseDialog) {
            console.log(`[${this.name}] Hiding dialog: ${dialogName}`);
            dialogComponent.hide(); // Call the dialog's instance hide method
        } else if (dialogComponent) {
            console.error(`[${this.name}] Attempted to hide non-dialog component '${dialogName}' using hideDialog.`);
        } else {
            // Don't log error if not found, might already be hidden/gone
            // console.warn(`[${this.name}] Dialog component '${dialogName}' not found for hiding.`); 
        }
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager;
