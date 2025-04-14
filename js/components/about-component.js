import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * Component managing the About view (#about).
 * Simple static content view with a back button.
 */
export default class AboutComponent extends BaseComponent {
    static SELECTOR = '#about'; // Corrected ID from HTML
    static VIEW_NAME = 'AboutComponent';  // Use the component registration name (class name) as the VIEW_NAME

    /**
     * Initializes the AboutComponent.
     */
    constructor() {
        super(); // Call BaseComponent constructor
        console.log("[AboutComponent] Constructed (via BaseComponent).");
    }

    /** 
     * Initializes component elements.
     * Called by BaseComponent constructor.
     */
    initialize() {
        this.backButton = this.rootElement.querySelector('.backToMain');
        if (!this.backButton) {
             console.warn(`[${this.name}] Back button (.backToMain) not found.`);
        }
        console.log(`[${this.name}] Initialized.`);
    }

    /** 
     * Registers DOM event listeners. 
     * Called by BaseComponent constructor.
     */
    registerListeners() {
        // Bind method here before adding listener
        this._handleBackClick = this._handleBackClick.bind(this); 
        
        if (this.backButton) {
            this.backButton.addEventListener('click', this._handleBackClick);
            console.log(`[${this.name}] Back button listener registered.`);
        } else {
            console.warn(`[${this.name}] Back button not found, cannot add listener.`);
        }
    }

    _handleBackClick() {
        console.log("[AboutComponent] Back button clicked.");
        // Navigate using the constant
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    // No specific event listeners needed from the event bus
    // No need to override show/hide/destroy for this simple component
    // BaseComponent handles visibility and basic destruction (removing listeners)
} 