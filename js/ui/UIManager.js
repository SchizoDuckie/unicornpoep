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
     * @param {string|null} [viewBeingShown=null] - The VIEW_NAME of the component being shown, to avoid hiding its children.
     * @private
     */
    _hideAllViews(viewBeingShown = null) {
        

        this.components.forEach((component, name) => {
            component.hide(); 
        });
        // console.debug('[UIManager] Hide loop finished.'); // Reduced verbosity
        this.activeViewName = null; // Reset active view before showing the new one
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
                {
                    eventName: Events.UI.MultiplayerChoice.HostClicked,
                    callback: () => {
                        this._lazyInitializeGameComponents();
                    }
                },
                {
                    eventName: Events.UI.EndDialog.ReturnToMenuClicked,
                    callback: (e) => this._handleShowView({ viewName: Views.MainMenu })
                },
                {
                    eventName: Events.System.ShowWaitingDialog,
                    callback: (payload) => {
                        
                        const waitingDialog = this.components.get(WaitingDialog.VIEW_NAME);
                        
                        if (payload && payload.message) {
                            waitingDialog.show(payload.message);
                        } else {
                            waitingDialog.show(); // Uses default message
                        }                    
                    }
                },
                {
                    eventName: Events.System.HideWaitingDialog,
                    callback: () => {
                        const waitingDialog = this.components.get(WaitingDialog.VIEW_NAME);
                        waitingDialog.hide();
                    }
                }

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
        this._registerComponent(new ToastComponent());
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
        if (!this.components.has('AnswerListComponent')) {
            this._registerComponent(new AnswerListComponent());
        }

        if (!this.components.has('SheetSelectionComponent')) {
            this._registerComponent(new SheetSelectionComponent());
        }

        if (!this.components.has('ToastComponent')) {
            this._registerComponent(new ToastComponent());
        }

        if (!this.components.has('CustomQuestionsComponent')) {
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
        if (!componentInstance || !componentInstance.name) {
            console.error("[UIManager] Cannot register invalid component instance:", componentInstance);
            return;
        }
        
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
     * Handles the Navigation.ShowView event to transition between UI components.
     * @param {object} payload - The event payload.
     * @param {string} payload.viewName - The VIEW_NAME of the component to show.
     * @param {object} [payload.data] - Optional data to pass to the component's show method.
     * @private
     */
    _handleShowView({ viewName, data }) {
        console.debug(`[UIManager] _handleShowView (Simplified - No Transitions) ${viewName}`, data);
        const componentToShow = this.components.get(viewName);

        if (!componentToShow) {
            console.error(`[UIManager] Component with name "${viewName}" not found.`);
            eventBus.emit(Events.System.ShowFeedback, { message: `Error: UI View "${viewName}" not found.`, type: 'error' });
            return;
        }

        // Hide other views (passing the target view to potentially skip children)
        this._hideAllViews(viewName); 

        // *** Explicitly hide LoadingComponent AFTER hiding others ***
        const loadingComponent = this.components.get(LoadingComponent.VIEW_NAME);
        if (loadingComponent) {
            loadingComponent.hide(); 
        }

        // Show the target component
        if (typeof componentToShow.show === 'function') {
            componentToShow.show(data); // Pass data to the show method
            this.activeViewName = viewName; // Set the new active view
            this._updateNavigationHistory(viewName); // Update history
            console.debug(`[UIManager] Simplified show complete for ${viewName}`);

            // --- Specific Logic for GameArea ---
            // This ensures related components are shown/hidden correctly ONLY when GameArea is the target view
            if (viewName === Views.GameArea) {
                 const isMultiplayer = data?.gameMode?.includes('multiplayer'); // Check if multiplayer based on passed data
                 console.log(`[UIManager] GameArea shown. Is multiplayer: ${isMultiplayer}`);

                 // Always show these core game components when GameArea is active
                 this.components.get(QuestionDisplayComponent.VIEW_NAME).show();
                 this.components.get(AnswerListComponent.VIEW_NAME).show(); // Assuming AnswerList is always needed
                 this.components.get(TimerDisplayComponent.VIEW_NAME).show();
                 this.components.get(ProgressDisplayComponent.VIEW_NAME).show();
                 this.components.get(ScoreDisplayComponent.VIEW_NAME).show();
                 this.components.get(GameFeedbackComponent.VIEW_NAME).show(); // Show feedback area
                 this.components.get(GameNavigationComponent.VIEW_NAME).show(); // Show navigation (like Stop button)

                 // Conditionally show/hide PlayerList
                 const playerListComponent = this.components.get(PlayerListComponent.VIEW_NAME);
                 if (isMultiplayer) {
                      console.log(`[UIManager] Explicitly showing PlayerListComponent.`);
                      playerListComponent?.show();
                 } else {
                      console.log(`[UIManager] Explicitly hiding PlayerListComponent.`);
                      playerListComponent?.hide();
                 }
            }
            // --- End Specific Logic for GameArea ---

        } else {
            console.error(`[UIManager] Component "${viewName}" does not have a show method.`);
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
