import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * @class GameNavigationComponent
 * @extends RefactoredBaseComponent
 * Manages navigation controls within the game area, primarily the 'Leave Game' button.
 */
export default class GameNavigationComponent extends RefactoredBaseComponent {
    static SELECTOR = '#gameNavigation';
    static VIEW_NAME = 'GameNavigation';
    
    static SELECTORS = {
        STOP_BUTTON: '#stopGame'
    };

    /** 
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this.show
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this.hide
                },
                {
                    eventName: Events.Game.Aborted,
                    callback: this.hide
                }
            ],
            
            domEvents: [
                {
                    selector: GameNavigationComponent.SELECTORS.STOP_BUTTON,
                    event: 'click',
                    emits: Events.UI.GameArea.LeaveGameClicked
                }
            ],
            
            domElements: []
        };
    }
} 