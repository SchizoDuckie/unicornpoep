import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';


/**
 * Component managing the About view (#about).
 * Simple static content view with a back button.
 */
export default class AboutComponent extends BaseComponent {
    /**
     * Initializes the AboutComponent.
     */
    constructor() {
        super('#about', Views.About);

        this.backButton = this.rootElement.querySelector('.backToMain');

        if (!this.backButton) {
            console.error("[AboutComponent] Missing required elements (#about, .backToMain). Component cannot function.");
            return;
        }

        this.addEventListeners();
        console.log("[AboutComponent] Initialized.");
    }

    /**
     * Adds DOM event listeners.
     * @private
     */
    addEventListeners() {
        this.backButton.addEventListener('click', () => {
            console.log(`[${this.name}] Back button clicked.`);
            eventBus.emit(Events.UI.About.BackClicked);
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
        });
    }

    // No specific event listeners needed from the event bus
    // No need to override show/hide/destroy for this simple component
} 