import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * Component managing the About view (#about).
 * Simple static content view with a back button.
 */
export default class AboutComponent extends RefactoredBaseComponent {
    static SELECTOR = '#about';
    static VIEW_NAME = 'AboutComponent';
    
    static SELECTORS = {
        BACK_BUTTON: '.backToMain'
    };

    /** 
     * Initializes component using the declarative pattern.
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            // No global event bus listeners needed
            events: [],
            
            // DOM event to event bus mapping - directly emit the Navigation event
            domEvents: [
                {
                    selector: AboutComponent.SELECTORS.BACK_BUTTON,
                    event: 'click',
                    emits: Events.UI.MainMenu.Show
                }
            ]
        };
    }
} 