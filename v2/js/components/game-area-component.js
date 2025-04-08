import BaseComponent from './base-component.js';
import Views from '../core/view-constants.js'; // Import Views constant
// Removed imports for sub-components as they are managed by UIManager
// Removed eventBus/Events import as they are not directly used here anymore

/**
 * Component managing the main Game Area view (#gameArea).
 * Acts primarily as a container whose visibility is controlled by UIManager.
 * Sub-components within this container manage their own state based on events.
 */
export default class GameAreaComponent extends BaseComponent {
    /**
     * Initializes the GameAreaComponent.
     */
    constructor() {
        super('#gameArea', Views.GameArea);

        // No sub-component instantiation here anymore.

        // Remove internal event listeners that configured sub-components
        // this.listenForEvents(); // Removed
        console.log("[GameAreaComponent] Initialized as a container.");
    }

    // Removed addEventListeners() - Likely not needed for the container itself.

    // Removed listenForEvents() and handlers like handleGameStarted, handleGameFinished, configureForMode.
    // The UIManager will control the visibility of this component based on game state.
    // Sub-components inside #gameArea will listen to game events directly.

    // Removed showErrorState() - Error handling should be managed globally or by specific components.

    /**
     * Override show - Log when shown.
     */
    show() {
        super.show();
        console.log("[GameAreaComponent] Shown");
        // Resetting or configuring sub-components is no longer done here.
    }

    /**
     * Override hide - Log when hidden.
     */
    hide() {
        super.hide();
        console.log("[GameAreaComponent] Hidden");
    }

    /**
     * Override destroy - Log destruction.
     * No sub-components to destroy here anymore.
     */
    destroy() {
        console.log("[GameAreaComponent] Destroying...");
        // No sub-components to nullify here.
        super.destroy(); // Call base cleanup
        console.log("[GameAreaComponent] Destroyed.");
    }
} 