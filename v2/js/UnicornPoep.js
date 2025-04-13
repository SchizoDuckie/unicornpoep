// Core Imports
import eventBus from './core/event-bus.js';
import Events from './core/event-constants.js';
import Views from './core/view-constants.js';
import { getTextTemplate } from './utils/miscUtils.js';

// Service Imports (Singleton instances OR Classes to be instantiated)
import uiManager from './ui/UIManager.js'; // Singleton
import questionsManager from './services/QuestionsManager.js'; // Singleton
import highscoreManager from './services/HighscoreManager.js'; // Singleton
import webRTCManager from './services/WebRTCManager.js'; // Singleton
import multiplayerClientManager from './services/MultiplayerClientManager.js'; // Singleton
import GameCoordinator from './services/GameCoordinator.js'; // <-- Import CLASS
// Import other services as they are created

/**
 * Main application class (or entry point script).
 * Responsibilities:
 * - Ensure all core services are imported/instantiated.
 * - Instantiate coordinator classes and inject dependencies.
 * - Trigger the initial application state (e.g., show the main menu).
 * - Perform any other one-time setup.
 */
class UnicornPoepApp {
    constructor() {
        console.info("[UnicornPoepApp] Initializing application...");

        // --- Instantiate Coordinator with Dependencies ---
        // Ensure singleton services needed by coordinator are loaded first
        if (!questionsManager || !multiplayerClientManager) {
            console.error("[UnicornPoepApp] Cannot instantiate GameCoordinator: Required singleton services (QuestionsManager, MultiplayerClientManager) failed to load!");
            this.showInitializationError("Missing core game services.");
            return;
        }
        const gameCoordinatorInstance = new GameCoordinator(questionsManager, multiplayerClientManager);
        console.log("[UnicornPoepApp] GameCoordinator instantiated.");
        // --- End Coordinator Instantiation ---

        // Check if other essential singletons loaded
        if (!eventBus || !uiManager || !highscoreManager || !webRTCManager) {
             console.error("[UnicornPoepApp] Critical singleton service failed to load (EventBus, UIManager, HighscoreManager, or WebRTCManager)!");
             this.showInitializationError("Missing core UI or connection services.");
             return;
        }

        // Add services to window for debugging convenience (optional)
        window.appServices = {
            eventBus,
            uiManager,
            gameCoordinator: gameCoordinatorInstance, // Add the instance back directly
            questionsManager,
            highscoreManager,
            webRTCManager,
            multiplayerClientManager
        };
        console.debug("[UnicornPoepApp] Services attached to window.appServices for debugging.");

        // Set up global error handling (optional but recommended)
        this.setupGlobalErrorHandling();

        // UIManager initializes its components on DOMContentLoaded.
        document.addEventListener('DOMContentLoaded', () => {
            console.log("[UnicornPoepApp] DOM Content Loaded. Resetting WebRTC and setting up...");

            // Force reset WebRTC state on initial load
            webRTCManager.closeConnection();

            // Setup coordinators/listeners for UI actions (Uncomment if needed)
            this.setupCoordinators();

            // Check if UIManager handled initial navigation
            const initialNavigationHandled = uiManager.checkInitialHash(); 

            // Trigger the initial view if needed
            if (!initialNavigationHandled) {
                // REMOVE check for Views here, assume it's loaded
                console.log("[UnicornPoepApp] Initial navigation not handled by UIManager, requesting MainMenu view.");
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
                console.info("[UnicornPoepApp] Application initialization flow complete. Initial view requested: MainMenu.");
            } else {
                console.info("[UnicornPoepApp] Application initialization flow complete. Initial navigation handled by UIManager.");
            }
        });
    }

    /**
     * Sets up listeners that coordinate actions based on UI events.
     * This acts as a simple coordinator layer for now.
     * Ideally, complex logic could be moved to dedicated Coordinator classes.
     * @private
     */
    setupCoordinators() {
        console.debug("[UnicornPoepApp] Setting up coordination listeners...");

        // --- Main Menu Navigation --- 
        eventBus.on(Events.UI.MainMenu.HighscoresClicked, () => {
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.Highscores });
        });
        eventBus.on(Events.UI.MainMenu.CustomQuestionsClicked, () => {
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.CustomQuestions });
        });
        eventBus.on(Events.UI.MainMenu.AboutClicked, () => {
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.About });
        });
        // GameCoordinator handles multiplayer, single-player, and practice navigation.

        // --- Question Management Coordination ---
        eventBus.on(Events.UI.CustomQuestions.SaveClicked, async ({ name, questionsText, sheetId }) => {
             console.log(`[Coordinator] Handling UI SaveClicked for sheet: ${name}`);
             // Generate a simple unique ID if one is not provided (for creation)
             const idToSave = sheetId || `custom_${Date.now()}`;

            try {
                 // ** Call QuestionsManager to parse and save **
                 // Assuming saveCustomSheet is updated or a new method is created
                 // to handle raw text parsing.
                 const success = await questionsManager.saveCustomSheetFromText(idToSave, name, questionsText);

                if (success) {
                    console.log(`[Coordinator] Custom sheet saved successfully via QuestionsManager: ${name} (${idToSave})`);
                    eventBus.emit(Events.Menu.CustomQuestions.SaveSuccess, { sheetId: idToSave, name: name });
                    eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordSaveSuccess', { '%NAME%': name }), level: 'success' });
                } else {
                    throw new Error("QuestionsManager reported failure to save (parsing or other issue).");
                }
            } catch (error) {
                console.error(`[Coordinator] Failed to handle save request for custom sheet '${name}':`, error);
                const defaultErrorMessage = getTextTemplate('coordSaveErrorDefault');
                eventBus.emit(Events.Menu.CustomQuestions.SaveFailed, {
                    sheetId: idToSave,
                    name: name,
                    message: error.message || defaultErrorMessage
                });
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordSaveErrorFeedback', { '%NAME%': name }), level: 'error' });
            }
        });

     

        // Add other coordination listeners here (e.g., deleting custom sheets)
        eventBus.on(Events.UI.CustomQuestions.DeleteClicked, async ({ sheetId }) => {
            console.log(`[Coordinator] Handling UI DeleteClicked for sheet ID: ${sheetId}`);
            if (!sheetId) {
                console.error("[Coordinator] DeleteClicked event missing sheetId.");
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordDeleteErrorNoId'), level: "error" });
                return;
            }

            try {
                // Call the service method
                const success = questionsManager.deleteCustomSheet(sheetId);

                if (success) {
                    console.log(`[Coordinator] Custom sheet deleted successfully via QuestionsManager: ${sheetId}`);
                    eventBus.emit(Events.Menu.CustomQuestions.DeleteSuccess, { sheetId: sheetId });
                    eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordDeleteSuccess'), level: "success" });
                } else {
                    // deleteCustomSheet should log specific reason in QuestionsManager
                    throw new Error("QuestionsManager reported failure to delete (sheet not found?).");
                }
            } catch (error) {
                console.error(`[Coordinator] Failed to handle delete request for custom sheet '${sheetId}':`, error);
                const defaultDeleteErrorMessage = getTextTemplate('coordDeleteErrorDefault');
                eventBus.emit(Events.Menu.CustomQuestions.DeleteFailed, {
                    sheetId: sheetId,
                    message: error.message || defaultDeleteErrorMessage
                });
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordDeleteErrorFeedback'), level: 'error' });
            }
        });

        // Listen for Edit request from UI
        eventBus.on(Events.UI.CustomQuestions.EditClicked, async ({ sheetId }) => {
            console.log(`[Coordinator] Handling UI EditClicked for sheet ID: ${sheetId}`);
            if (!sheetId) {
                console.error("[Coordinator] EditClicked event missing sheetId.");
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordEditErrorNoId'), level: "error" });
                return;
            }

            try {
                // Get sheet data (assuming getQuestionsForSheet works for custom sheets directly)
                const sheetData = questionsManager.customSheets.get(sheetId);
                if (sheetData && sheetData.questions) {
                    const questionsText = questionsManager.formatQuestionsForTextarea(sheetData.questions);
                    console.log(`[Coordinator] Sending SheetLoadedForEdit for ${sheetId}`);
                    // Emit event for the component to populate its form
                    eventBus.emit(Events.Menu.CustomQuestions.SheetLoadedForEdit, {
                        sheetId: sheetId,
                        name: sheetData.name,
                        questionsText: questionsText
                    });
                } else {
                    throw new Error(`Sheet data not found or invalid for ID: ${sheetId}`);
                }
            } catch (error) {
                console.error(`[Coordinator] Failed to handle edit request for custom sheet '${sheetId}':`, error);
                // Emit generic feedback
                eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('coordEditLoadErrorFeedback'), level: 'error' });
            }
        });

         console.debug("[UnicornPoepApp] Coordination listeners set up.");
    }

    /**
     * Sets up basic global error handlers to catch unhandled exceptions.
     * @private
     */
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            // --- Check for specific PeerJS flush error ---
            const messageString = event.message;
            const error = event.error;
            const source = event.filename;

            const isFlushError = (
                (typeof messageString === 'string' && messageString.includes("Cannot read properties of undefined (reading 'flush')")) ||
                (error instanceof TypeError && error.message.includes("Cannot read properties of undefined (reading 'flush')"))
            );
            const isPeerJsSource = source && source.includes('peerjs.min.js');

            if (isFlushError && isPeerJsSource) {
                console.warn(`[UnicornPoepApp] Suppressing known PeerJS TypeError: "${messageString || error.message}" in ${source}:${event.lineno}`);
                // Prevent default handling for this specific error
                event.preventDefault(); // Stop browser's default handling (like logging as uncaught)
                return; // Still return to prevent our event bus emissions
            }
            // --- End check ---

            // Default handling for all other errors
            console.error("[UnicornPoepApp] Unhandled global error:", error, messageString);
            eventBus.emit(Events.System.ErrorOccurred, {
                message: messageString || 'An unexpected error occurred.',
                error: error,
                context: 'Global Error Handler'
            });
            // Optionally show feedback to the user
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('errorUnexpectedConsole'), level: 'error' });
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error("[UnicornPoepApp] Unhandled promise rejection:", event.reason);
            eventBus.emit(Events.System.ErrorOccurred, {
                message: 'An unexpected promise error occurred.',
                error: event.reason instanceof Error ? event.reason : new Error(JSON.stringify(event.reason)),
                context: 'Global Promise Rejection'
            });
             eventBus.emit(Events.System.ShowFeedback, { message: 'An unexpected background error occurred.', level: 'error' });
        });
        console.debug("[UnicornPoepApp] Global error handlers set up.");
    }

    /**
     * Displays a critical error message if core services fail to load.
     * @private
     */
    showInitializationError(message) {
        document.addEventListener('DOMContentLoaded', () => {
            const body = document.body;
            if (body) {
                body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;">' +
                                 `<h1>Application Initialization Failed</h1>` +
                                 `<p>${message}</p>` +
                                 '</div>';
            }
        });
    }
}

// Instantiate the main application class to start the process
new UnicornPoepApp();