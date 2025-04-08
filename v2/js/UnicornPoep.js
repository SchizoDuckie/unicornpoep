// Core Imports
import eventBus from './core/event-bus.js';
import Events from './core/event-constants.js';
import Views from './core/view-constants.js';

// Service Imports (Singleton instances)
import uiManager from './ui/UIManager.js';
import gameCoordinator from './services/GameCoordinator.js';
import questionsManager from './services/QuestionsManager.js';
import highscoreManager from './services/HighscoreManager.js';
import webRTCManager from './services/WebRTCManager.js';
import multiplayerClientManager from './services/MultiplayerClientManager.js';
// Import other services as they are created

/**
 * Main application class (or entry point script).
 * Responsibilities:
 * - Ensure all core services are imported/instantiated (handled by singleton pattern in modules).
 * - Trigger the initial application state (e.g., show the main menu).
 * - Perform any other one-time setup.
 */
class UnicornPoepApp {
    constructor() {
        console.info("[UnicornPoepApp] Initializing application...");

        // Services are already instantiated due to module imports & singleton pattern.
        // We just need to ensure they are loaded here.
        if (!eventBus || !uiManager || !gameCoordinator || !questionsManager || !highscoreManager || !webRTCManager || !multiplayerClientManager) {
             console.error("[UnicornPoepApp] Critical service failed to load!");
             // Handle this critical failure (e.g., display static error message)
             this.showInitializationError();
             return;
        }

        // Add services to window for debugging convenience (optional)
        window.appServices = {
            eventBus,
            uiManager,
            gameCoordinator,
            questionsManager,
            highscoreManager,
            webRTCManager,
            multiplayerClientManager
        };
        console.debug("[UnicornPoepApp] Services attached to window.appServices for debugging.");

        // Set up global error handling (optional but recommended)
        this.setupGlobalErrorHandling();

        // UIManager initializes its components on DOMContentLoaded.
        // Wait for UIManager to signal readiness or just proceed after DOMContentLoaded.
        document.addEventListener('DOMContentLoaded', () => {
            console.log("[UnicornPoepApp] DOM Content Loaded. Setting up coordinators and triggering initial view...");

            // Setup coordinators/listeners for UI actions
            this.setupCoordinators();

            // Trigger the initial view - Main Menu
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            console.info("[UnicornPoepApp] Application initialization flow complete. Initial view requested.");
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
        eventBus.on(Events.UI.MainMenu.JoinMultiplayerClicked, () => {
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MultiplayerChoice });
        });
        // REMOVED redundant listeners for Practice/SinglePlayer - GameCoordinator handles these.
        // eventBus.on(Events.UI.MainMenu.StartPracticeClicked, () => { ... });
        // eventBus.on(Events.UI.MainMenu.StartSinglePlayerClicked, () => { ... });

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
                    eventBus.emit(Events.System.ShowFeedback, { message: `Vragenlijst '${name}' opgeslagen.`, level: 'success' });
                } else {
                    throw new Error("QuestionsManager reported failure to save (parsing or other issue).");
                }
            } catch (error) {
                console.error(`[Coordinator] Failed to handle save request for custom sheet '${name}':`, error);
                eventBus.emit(Events.Menu.CustomQuestions.SaveFailed, {
                    sheetId: idToSave,
                    name: name,
                    message: error.message || "Onbekende fout bij opslaan vragenlijst."
                });
                eventBus.emit(Events.System.ShowFeedback, { message: `Fout bij opslaan '${name}'.`, level: 'error' });
            }
        });

        // --- Highscore Management Coordination ---
        eventBus.on(Events.Menu.Highscores.ShowRequested, async () => {
             console.log("[Coordinator] Handling Menu Highscores ShowRequested");
            // HighscoreManager already listens for this internally in the original plan?
            // Let's assume HighscoreManager handles loading on its own for now
            // or adjust if HighscoreManager needs explicit triggering here.
            // If HighscoreManager needs triggering:
            // try {
            //     await highscoreManager.loadScores(); // Assuming loadScores is async and emits Loaded/LoadFailed
            // } catch (error) {
            //     console.error("[Coordinator] Error triggering highscore load:", error);
            //     // Emit a generic failure? HighscoreManager should emit its own LoadFailed.
            // }
             console.warn("[Coordinator] Assuming HighscoreManager handles loading internally based on ShowRequested event.");
        });

        // Add other coordination listeners here (e.g., deleting custom sheets)
        eventBus.on(Events.UI.CustomQuestions.DeleteClicked, async ({ sheetId }) => {
            console.log(`[Coordinator] Handling UI DeleteClicked for sheet ID: ${sheetId}`);
            if (!sheetId) {
                console.error("[Coordinator] DeleteClicked event missing sheetId.");
                eventBus.emit(Events.System.ShowFeedback, { message: "Kon ID niet vinden om te verwijderen.", level: "error" });
                return;
            }

            try {
                // Call the service method
                const success = questionsManager.deleteCustomSheet(sheetId);

                if (success) {
                    console.log(`[Coordinator] Custom sheet deleted successfully via QuestionsManager: ${sheetId}`);
                    eventBus.emit(Events.Menu.CustomQuestions.DeleteSuccess, { sheetId: sheetId });
                    eventBus.emit(Events.System.ShowFeedback, { message: `Vragenlijst verwijderd.`, level: "success" });
                } else {
                    // deleteCustomSheet should log specific reason in QuestionsManager
                    throw new Error("QuestionsManager reported failure to delete (sheet not found?).");
                }
            } catch (error) {
                console.error(`[Coordinator] Failed to handle delete request for custom sheet '${sheetId}':`, error);
                eventBus.emit(Events.Menu.CustomQuestions.DeleteFailed, {
                    sheetId: sheetId,
                    message: error.message || "Onbekende fout bij verwijderen vragenlijst."
                });
                eventBus.emit(Events.System.ShowFeedback, { message: `Fout bij verwijderen vragenlijst.`, level: 'error' });
            }
        });

        // Listen for Edit request from UI
        eventBus.on(Events.UI.CustomQuestions.EditClicked, async ({ sheetId }) => {
            console.log(`[Coordinator] Handling UI EditClicked for sheet ID: ${sheetId}`);
            if (!sheetId) {
                console.error("[Coordinator] EditClicked event missing sheetId.");
                eventBus.emit(Events.System.ShowFeedback, { message: "Kon ID niet vinden om te bewerken.", level: "error" });
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
                // Emit specific failure event?
                // eventBus.emit(Events.Menu.CustomQuestions.LoadForEditFailed, { sheetId: sheetId, message: error.message });
                eventBus.emit(Events.System.ShowFeedback, { message: `Fout bij laden van vragenlijst voor bewerken.`, level: 'error' });
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
            console.error("[UnicornPoepApp] Unhandled global error:", event.error, event.message);
            eventBus.emit(Events.System.ErrorOccurred, {
                message: event.message || 'An unexpected error occurred.',
                error: event.error,
                context: 'Global Error Handler'
            });
            // Optionally show feedback to the user
            eventBus.emit(Events.System.ShowFeedback, { message: 'An unexpected error occurred. Please check console.', level: 'error' });
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
    showInitializationError() {
        document.addEventListener('DOMContentLoaded', () => {
            const body = document.body;
            if (body) {
                body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;">' +
                                 '<h1>Application Initialization Failed</h1>' +
                                 '<p>A critical error occurred while loading essential services. Please check the console for details.</p>' +
                                 '</div>';
            }
        });
    }
}

// Instantiate the main application class to start the process
new UnicornPoepApp();