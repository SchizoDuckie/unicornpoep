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
// Removed: import GameCoordinator from './services/GameCoordinator.js'; // <-- Import CLASS

// NEW: Import specific coordinators
import SinglePlayerGameCoordinator from './coordinators/SinglePlayerGameCoordinator.js';
import MultiplayerHostCoordinator from './coordinators/MultiplayerHostCoordinator.js';
import MultiplayerClientCoordinator from './coordinators/MultiplayerClientCoordinator.js';

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
    
        // UIManager initializes its components on DOMContentLoaded.
        window.addEventListener('load', this.domContentLoadedHandler);
    }

    domContentLoadedHandler = () => {
    
            console.log("[UnicornPoepApp] DOM Content Loaded. Setting up...");
            uiManager.initialize();

            this.setupCoordinators();
            
            uiManager.initializeComponents();
            
            window.eventBus = eventBus;
            const joinCode = uiManager.detectJoinCode();
            if (joinCode) {
                eventBus.emit(Events.System.ValidJoinCodeDetected, { joinCode: joinCode });
            } else {
                // Emit the standard navigation event to show the main menu
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
            }
    }

    /**
     * Sets up listeners that coordinate actions based on UI events.
     * This acts as a simple coordinator layer for now.
     * Ideally, complex logic could be moved to dedicated Coordinator classes.
     * @private
     */
    setupCoordinators() {
        console.debug("[UnicornPoepApp] Setting up coordination listeners...");

        this.singlePlayerCoordinator = new SinglePlayerGameCoordinator();
        this.multiplayerHostCoordinator = new MultiplayerHostCoordinator();
        this.multiplayerClientCoordinator = new MultiplayerClientCoordinator();
        
         console.debug("[UnicornPoepApp] Coordination listeners set up.");
    }


}

// Instantiate the main application class to start the process
new UnicornPoepApp();