import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * Manages the visibility of the top game navigation bar (#gameNavigation)
 * and handles the Stop button click.
 * @extends RefactoredBaseComponent
 */
export default class GameNavigation extends RefactoredBaseComponent {
    static SELECTOR = '#gameNavigation';
    static VIEW_NAME = Views.GameNavigation; // Assuming a constant exists

    static SELECTORS = {
        STOP_BUTTON: '#stopGame' // Matches GameAreaComponent
    };

    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this.handleGameStarted
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this.handleGameFinished
                },
                {
                    eventName: Events.Game.Aborted, // Listen for abort as well
                    callback: this.handleGameFinished
                }
            ],
            domEvents: [
                {
                    selector: GameNavigation.SELECTORS.STOP_BUTTON,
                    event: 'click',
                    emits: Events.UI.GameArea.LeaveGameClicked // Emit the same event as GameAreaComponent
                }
            ],
            domElements: [] // No elements needed to manage directly
        };
    }

    handleGameStarted(data) {
        console.log(`[GameNavigation] handleGameStarted received. Data:`, data);
        // REMOVED: Do not call this.show() here. UIManager will handle it.
    }

    handleGameFinished() {
        console.log(`[GameNavigation] handleGameFinished received.`);
        this.hide();
    }
} 