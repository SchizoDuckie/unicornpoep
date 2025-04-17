import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import Views from '../core/view-constants.js'; // Import Views constant
import eventBus from '../core/event-bus.js'; // Import eventBus
import Events from '../core/event-constants.js'; // Import Events
// Removed imports for sub-components as they are managed by UIManager

/**
 * Component managing the main Game Area view (#gameArea).
 * Acts primarily as a container whose visibility is controlled by UIManager.
 * Sub-components within this container manage their own state based on events.
 * ALSO handles the Stop button within the game area.
 * @extends RefactoredBaseComponent
 */
export default class GameAreaComponent extends RefactoredBaseComponent {
    static SELECTOR = '#gameArea';
    static VIEW_NAME = Views.GameArea;

    static SELECTORS = {
        STOP_BUTTON: '#stopGame'
    };

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [],
            
            domEvents: [
                {
                    selector: GameAreaComponent.SELECTORS.STOP_BUTTON,
                    event: 'click',
                    emits: Events.UI.GameArea.LeaveGameClicked
                }
            ],
            
            domElements: [
                {
                    name: 'stopButton',
                    selector: GameAreaComponent.SELECTORS.STOP_BUTTON
                }
            ]
        };
    }
} 