import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


const HIDDEN_CLASS = 'hidden'; // Define standard hidden class

/**
 * Base class for UI components, providing common lifecycle management,
 * visibility control, and automatic event listener cleanup.
 */
export default class BaseComponent {
    /**
     * Base constructor. Subclasses should NOT override this.
     * They MUST define static SELECTOR and static VIEW_NAME properties.
     * @throws {Error} If static properties are missing or the element is not found.
     */
    constructor() {
        // Get selector and name from static properties of the subclass
        const elementSelector = this.constructor.SELECTOR;
        const componentName = this.constructor.VIEW_NAME; // Or this.constructor.NAME if preferred

        if (!elementSelector || !componentName) {
            throw new Error(`[BaseComponent] Component class '${this.constructor.name}' must define static SELECTOR and static VIEW_NAME properties.`);
        }

        this.selector = elementSelector;
        this.name = componentName;
        this.rootElement = document.querySelector(this.selector);
        this._listeners = []; // Stores { eventName, callback, handler } tuples
        this.isVisible = false;

        if (!this.rootElement) {
            // Throw an error instead of just warning
            throw new Error(`[BaseComponent] Root element not found for selector: ${this.selector}. Component '${this.name}' cannot be initialized.`);
        }

        // Assume components start hidden unless explicitly shown
        this.isVisible = !this.rootElement.classList.contains(HIDDEN_CLASS);

        // Call subclass initialization if it exists
        if (typeof this.initialize === 'function') {
            this.initialize();
        } else {
            // Optionally warn if initialize is missing, depending on strictness
            // console.warn(`[BaseComponent] Component '${this.name}' does not have an initialize() method.`);
        }

        // Call listener registration if it exists (for listeners needed immediately)
        if (typeof this.registerListeners === 'function') {
            this.registerListeners();
        } 

        // Emit an initialized event after basic setup and subclass init
        eventBus.emit(Events.Component.Initialized, { component: this, componentName: this.name });
        console.debug(`[BaseComponent] Initialized: ${this.name}`);
    }

    /**
     * Shows the component's root element by removing the 'hidden' class.
     * Emits the Component.Shown event.
     * Does nothing if the element is already visible or doesn't exist.
     */
    show(data = {}) {
        if (this.rootElement && !this.isVisible) {
            this.rootElement.classList.remove(HIDDEN_CLASS);
            this.isVisible = true;
            
            // Call registerListeners when shown, if it exists
            // This handles cases where listeners might have been removed on hide
            // if (typeof this.registerListeners === 'function') {
            //     this.registerListeners(); 
            // }
            
            eventBus.emit(Events.Component.Shown, { component: this, componentName: this.name, data: data });
            console.debug(`[BaseComponent] Shown: ${this.name}`);
        }
    }

    /**
     * Hides the component's root element by adding the 'hidden' class.
     * Emits the Component.Hidden event.
     * Does nothing if the element is already hidden or doesn't exist.
     */
    hide() {
        if (this.rootElement && this.isVisible) {
            this.rootElement.classList.add(HIDDEN_CLASS);
            this.isVisible = false;
            
            // Call unregisterListeners when hidden, if it exists
            if (typeof this.unregisterListeners === 'function') {
                this.unregisterListeners();
            }
            
            eventBus.emit(Events.Component.Hidden, { component: this, componentName: this.name });
            console.debug(`[BaseComponent] Hidden: ${this.name}`);
        }
    }

    /**
     * Registers a listener on the global event bus that will be automatically
     * removed when the component's `destroy` method is called.
     * @param {string} eventName The event name constant (e.g., Events.Game.Started).
     * @param {Function} callback The function to call when the event is emitted. The function will be bound to `this` component instance.
     */
    listen(eventName, callback) {
        if (typeof callback !== 'function') {
            console.error(`[BaseComponent] Invalid callback provided for event '${eventName}' in component '${this.name}'.`);
            return;
        }
        // Bind callback to maintain 'this' context when invoked by the eventBus
        const boundCallback = callback.bind(this);
        this._listeners.push({ eventName, callback: boundCallback });
        eventBus.on(eventName, boundCallback);
        // console.debug(`[BaseComponent] Listener registered for '${eventName}' in '${this.name}'`);
    }

    /**
     * Removes all listeners that were registered on the event bus via `this.listen()`.
     * This is called automatically during `destroy()`.
     */
    cleanupListeners() {
        if (this._listeners.length > 0) {
            console.debug(`[BaseComponent] Cleaning up ${this._listeners.length} listeners for: '${this.name}'`);
            this._listeners.forEach(({ eventName, callback }) => {
                eventBus.off(eventName, callback);
            });
            this._listeners = []; // Clear the stored listeners after removal
        } else {
             console.debug(`[BaseComponent] No listeners to clean up for: '${this.name}'`);
        }
    }

    /**
     * Prepares the component for garbage collection.
     * Emits the Component.Destroyed event *before* cleaning up listeners,
     * allowing other components to react to the destruction.
     * Removes all event listeners created via `this.listen()`.
     * Subclasses should call `super.destroy()` if they override this method
     * to ensure proper cleanup.
     */
    destroy() {
        console.debug(`[BaseComponent] Destroying: ${this.name}`);
        // Emit destroyed event *before* removing listeners, in case others need to react
        eventBus.emit(Events.Component.Destroyed, { component: this, componentName: this.name });
        this.cleanupListeners(); // Cleans up GLOBAL event bus listeners added via this.listen()
        
        // Call unregisterListeners for DOM listeners just before nulling element
         if (typeof this.unregisterListeners === 'function') {
             this.unregisterListeners();
         }
         
        // Optional: Remove element from DOM or perform other cleanup
        this.rootElement = null; // Help garbage collection by removing the reference
        console.info(`[BaseComponent] Destroyed: '${this.name}'`);
    }
}

// Default export if needed, though typically used via named import
// export default BaseComponent; 