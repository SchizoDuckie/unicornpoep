// Core Imports
import eventBus from './core/event-bus.js';
import Events from './core/event-constants.js';
import Views from './core/view-constants.js';
import { getTextTemplate } from './utils/miscUtils.js';

// Set up console logging with timestamps
(function() {
    // Store original console methods
    const originalConsole = {
        log: console.log,
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    // Function to get current time with millisecond precision
    const getTimestamp = () => {
        const now = new Date();
        return `[${now.toISOString().replace('T', ' ').replace('Z', '')}]`;
    };

    // Function to get the call site (file:line)
    const getCallSite = () => {
        try {
            const err = new Error();
            if (!err.stack) return '[unknown]';
            const stackLines = err.stack.split('\n');
            
            // Find the first line outside the logging functions in this file.
            let callerLine = '';
            for (let i = 3; i < stackLines.length; i++) { // Start search after Error, getCallSite, wrapper
                if (stackLines[i] && !stackLines[i].includes('UnicornPoep.js')) { 
                     callerLine = stackLines[i];
                     break;
                }
            }
    
            if (!callerLine) return '[unknown]';
    
            // Patterns to extract file:line from common stack formats
            let match = callerLine.match(/at .*?\((?:.*?)?([^/\\(]+):(\d+):\d+\)?$/) || // V8 with function name
                        callerLine.match(/at (?:.*?)?([^/\\(]+):(\d+):\d+$/) ||         // V8 without function name
                        callerLine.match(/@(?:.*?)?([^/\\@]+):(\d+):\d+$/);             // Firefox like
    
            if (match && match[1] && match[2]) {
                // Extract filename without the full path for brevity
                const fileName = match[1].substring(match[1].lastIndexOf('/') + 1);
                 return `[${fileName}:${match[2]}]`;
            }
    
            return '[unknown]'; // Parsing failed
        } catch (e) {
            originalConsole.error("Error getting call site:", e); 
            return '[error]';
        }
    };

})();

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