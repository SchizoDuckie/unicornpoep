import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


const HIDDEN_CLASS = 'hidden'; // Define standard hidden class

/**
 * Base class for UI components, providing common lifecycle management,
 * visibility control, and automatic event listener cleanup.
 * 
 * Supports declarative configuration for:
 * - Global EventBus listeners via `events` array
 * - DOM event to EventBus mappings via `domEvents` array
 * - DOM element queries and caching via `domElements` array
 * - Additional setup via `setup` function
 * 
 * DOM Event Configuration Options:
 * - `selector`: CSS selector for the element(s) to target (required)
 * - `event`: DOM event name to listen for (required)
 * - `handler`: Component method to handle the event (optional if emits is provided)
 * - `emits`: EventBus event to emit when the DOM event occurs (optional if handler is provided)
 * - `payload`: Static data object to include with the emitted event (optional)
 * - `includeEvent`: Set to true to include the original DOM event in the payload (optional)
 * - `includeTarget`: Set to true to include the target element in the payload (optional)
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
        this._listeners = []; // Stores EventBus listeners: { eventName, callback, boundCallback }
        this._domListeners = []; // Stores DOM listeners: { element, eventName, handler }
        this.isVisible = false;

        if (!this.rootElement) {
            // Throw an error instead of just warning
            debugger;
        }

        // Assume components start hidden unless explicitly shown
        this.isVisible = !this.rootElement.classList.contains(HIDDEN_CLASS);

        // Process initialization configuration
        this._processInitialization();
    }

    /**
     * Shows the component's root element by removing the 'hidden' class.
     * Does nothing if the element is already visible.
     */
    show(data = {}) {
        if (!this.isVisible) {
            this.rootElement.classList.remove(HIDDEN_CLASS);
            this.isVisible = true;
            
            // Lazy initialize elements when shown if configured with lazyInit
            this._lazyInitializeElements();
            
            console.info(`Show: ${this.name}`);
        }
    }

    /**
     * Lazily initializes DOM elements that might not be available during component construction.
     * This is automatically called when the component is shown.
     * It queries for any elements marked with lazyInit=true in the domElements configuration.
     * @private
     */
    _lazyInitializeElements() {
        // Skip if we don't have a configuration
        if (!this._domElementsConfig || !Array.isArray(this._domElementsConfig)) {
            return;
        }
        
        // Query and cache any elements marked for lazy initialization
        const lazyElements = this._domElementsConfig.filter(config => config.lazyInit === true);
        
        if (lazyElements.length) {
            console.debug(`[BaseComponent] Lazily initializing ${lazyElements.length} elements for ${this.name}`);
            
            lazyElements.forEach(elementConfig => {
                const { name, selector, required = false } = elementConfig;
                
                // Skip if already initialized
                if (this.elements[name]) {
                    return;
                }
                
                const element = this.rootElement.querySelector(selector);
                
                if (element) {
                    this.elements[name] = element;
                    console.debug(`[BaseComponent] Lazily initialized element '${name}' for ${this.name}`);
                } else if (required) {
                    console.error(`[BaseComponent] Required element not found during lazy init: ${selector} in component '${this.name}'.`);
                } else {
                    console.warn(`[BaseComponent] Optional element not found during lazy init: ${selector} in component '${this.name}'.`);
                }
            });
        }
    }

    /**
     * Hides the component's root element by adding the 'hidden' class.
     * Does nothing if the element is already hidden.
     */
    hide() {
        if (this.isVisible) {
            this.rootElement.classList.add(HIDDEN_CLASS);
            this.isVisible = false;
            
            // Call unregisterListeners when hidden, if it exists
            if (typeof this.unregisterListeners === 'function') {
                this.unregisterListeners();
            }
            
            console.debug(`Hide: ${this.name}`);
        }
    }

    /**
     * Registers a listener on the global event bus that will be automatically
     * removed when the component's `destroy` method is called.
     * This method is used internally by the initialization configuration.
     * @private
     * @param {string} eventName The event name constant (e.g., Events.Game.Started).
     * @param {Function} callback The function to call when the event is emitted. The function will be bound to `this` component instance.
     */
    _addEventListener(eventName, callback) {
        if (typeof callback !== 'function') {
            console.error(`[BaseComponent] Invalid callback provided for event '${eventName}' in component '${this.name}'.`);
            return;
        }
        // Bind callback to maintain 'this' context when invoked by the eventBus
        const boundCallback = callback.bind(this);
        this._listeners.push({ eventName, callback, boundCallback });
        eventBus.on(eventName, boundCallback);
        console.debug(`[BaseComponent] Listener implicitly added for '${eventName}' in '${this.name}'`);
    }

    /**
     * Removes a specific listener for an event from the global event bus.
     * This method is used internally for cleanup.
     * @private
     * @param {string} eventName The event name constant (e.g., Events.Game.Started).
     * @param {Function} callback The original callback function to remove.
     */
    _removeEventListener(eventName, callback) {
        const index = this._listeners.findIndex(listener => listener.eventName === eventName && listener.callback === callback);
        if (index > -1) {
            const { boundCallback } = this._listeners[index];
            eventBus.off(eventName, boundCallback);
            this._listeners.splice(index, 1);
            console.debug(`[BaseComponent] Listener implicitly removed for '${eventName}' in '${this.name}'`);
        }
    }

    /**
     * Adds a DOM event listener to the specified element and tracks it for automatic cleanup.
     * @private
     * @param {Element} element The DOM element to attach the event to
     * @param {string} eventName The DOM event name (e.g., 'click')
     * @param {Function} handler The event handler function
     */
    _addDOMEventListener(element, eventName, handler) {
        if (typeof handler !== 'function') {
            debugger;
            console.error(`[BaseComponent] Invalid handler for DOM event '${eventName}' in component '${this.name}'.`);
            return;
        }
        
        // Bind handler to maintain 'this' context
        const boundHandler = handler.bind(this);
        element.addEventListener(eventName, boundHandler);
        this._domListeners.push({ element, eventName, handler: boundHandler });
        console.debug(`[BaseComponent] DOM listener added for '${eventName}' in '${this.name}'`);
    }

    /**
     * Adds a delegated DOM event listener to the root element for all matching child elements.
     * This uses event bubbling to handle events from all matching elements, even if added later.
     * @private
     * @param {string} selector The CSS selector to match against event targets
     * @param {string} eventName The DOM event name (e.g., 'click')
     * @param {Function} handler The event handler function
     */
    _addDelegatedEventListener(selector, eventName, handler) {
        if (typeof handler !== 'function') {
            console.error(`[BaseComponent] Invalid handler for delegated DOM event '${eventName}' in component '${this.name}'.`);
            return;
        }
        
        // Create delegated handler that checks if the event target matches the selector
        const delegatedHandler = (e) => {
            // Find the closest element that matches the selector
            const target = e.target.closest(selector);
            if (target && this.rootElement.contains(target)) {
                // Call the handler with the matching element as context
                handler.call(this, e, target);
            }
        };
        
        // Attach the delegated handler to the root element
        this.rootElement.addEventListener(eventName, delegatedHandler);
        this._domListeners.push({ element: this.rootElement, eventName, handler: delegatedHandler });
        console.debug(`[BaseComponent] Delegated DOM listener added for '${eventName}' with selector '${selector}' in '${this.name}'`);
    }

    /**
     * Creates a simple handler that emits an EventBus event when a DOM event occurs.
     * @private
     * @param {string} eventBusEventName The EventBus event name to emit
     * @param {Object} [extraData] Optional extra data to include in the event
     * @returns {Function} A function that emits the specified EventBus event
     */
    _createEventEmitter(eventBusEventName, extraData = {}) {
        return function domEventHandler(e) {
            console.debug(`[${this.name}] DOM event triggered, emitting: ${eventBusEventName}`);
            eventBus.emit(eventBusEventName, extraData);
        }.bind(this);
    }

    /**
     * Removes all DOM event listeners that were added via _addDOMEventListener.
     * @private
     */
    _cleanupDOMListeners() {
        if (this._domListeners.length > 0) {
            console.debug(`[BaseComponent] Cleaning up ${this._domListeners.length} DOM listeners for: '${this.name}'`);
            this._domListeners.forEach(({ element, eventName, handler }) => {
                element.removeEventListener(eventName, handler);
            });
            this._domListeners = []; // Clear the stored listeners after removal
        } else {
            console.debug(`[BaseComponent] No DOM listeners to clean up for: '${this.name}'`);
        }
    }

    /**
     * Removes all listeners that were registered on the event bus via the initialization configuration.
     * This is called automatically during `destroy()`.
     * @private
     */
    _cleanupListeners() {
        if (this._listeners.length > 0) {
            console.debug(`[BaseComponent] Cleaning up ${this._listeners.length} EventBus listeners for: '${this.name}'`);
            this._listeners.forEach(({ eventName, boundCallback }) => {
                eventBus.off(eventName, boundCallback);
            });
            this._listeners = []; // Clear the stored listeners after removal
        } else {
            console.debug(`[BaseComponent] No EventBus listeners to clean up for: '${this.name}'`);
        }
    }

    /**
     * Safely gets a DOM element by its registered name. If the element is not yet available 
     * but is configured, it will attempt to query it on-demand.
     * 
     * This provides a reliable way to access DOM elements even when the component
     * might have been initialized before its HTML was fully available or visible.
     * 
     * @param {string} elementName - The registered name of the element from domElements config
     * @param {boolean} [warnIfMissing=true] - Whether to log a warning if the element can't be found
     * @returns {HTMLElement|null} The requested element or null if not found
     */
    getElement(elementName, warnIfMissing = true) {
        // First check if the element is already cached
        if (this.elements[elementName]) {
            return this.elements[elementName];
        }
        
        // If not cached, check if we have configuration for this element
        if (!this._domElementsConfig || !Array.isArray(this._domElementsConfig)) {
            if (warnIfMissing) {
                console.warn(`[${this.name}] No DOM elements configuration available when trying to get '${elementName}'`);
            }
            return null;
        }
        
        // Find the element config
        const elementConfig = this._domElementsConfig.find(config => config.name === elementName);
        if (!elementConfig) {
            if (warnIfMissing) {
                console.warn(`[${this.name}] No configuration found for element '${elementName}' in component '${this.name}'`);
            }
            return null;
        }
        
        // Try to query the element again (it might be available now if DOM has loaded)
        const { selector, required = false } = elementConfig;
        const element = this.rootElement.querySelector(selector);
        
        if (element) {
            // Cache the element for future use
            this.elements[elementName] = element;
            console.debug(`[${this.name}] Lazily loaded element '${elementName}' on demand`);
            return element;
        } else if (required && warnIfMissing) {
            console.error(`[${this.name}] Required element '${elementName}' (${selector}) not found in component '${this.name}' during on-demand loading`);
        } else if (warnIfMissing) {
            console.warn(`[${this.name}] Optional element '${elementName}' (${selector}) not found in component '${this.name}' during on-demand loading`);
        }
        
        return null;
    }

    /**
     * Initializes the component with a declarative configuration for events, DOM elements, and setup.
     * Subclasses must override this to define their initialization logic.
     * 
     * The configuration object allows for a clear definition of:
     * - DOM event listeners via domEvents array
     * - EventBus listeners via events array
     * - DOM element queries and caching via domElements array
     * - Additional setup logic via setup function
     * 
     * @example
     * initialize() {
     *   return {
     *     // DOM events that trigger EventBus events or component methods
     *     domEvents: [
     *       // Simple mapping: DOM click -> EventBus event
     *       { selector: '#myButton', event: 'click', emits: Events.UI.Button.Clicked },
     *       
     *       // With handler method: DOM click -> component method (for custom logic)
     *       { selector: '#submitButton', event: 'click', handler: this._handleSubmit },
     *       
     *       // With payload: DOM click -> EventBus event with data
     *       { selector: '.item', event: 'click', emits: Events.UI.Item.Selected, 
     *         payload: { source: 'item-list' } },
     *
     *       // With event/target included: DOM click -> EventBus event with DOM event and target element
     *       { selector: '.draggable', event: 'dragstart', emits: Events.UI.Drag.Started,
     *         includeEvent: true, includeTarget: true },
     *       
     *       // Example: Using includeEvent to access properties of the original DOM event
     *       // In this case, to get the coordinates of a mouse click
     *       { selector: '.canvas', event: 'click', emits: Events.UI.Canvas.Clicked,
     *         includeEvent: true },
     *       // Then in the event handler receiving this event:
     *       // canvasClickHandler({ event }) {
     *       //   const x = event.clientX;
     *       //   const y = event.clientY;
     *       //   // Use coordinates
     *       // }
     *       
     *       // Example: Using includeTarget to access the specific DOM element
     *       // In this case, to get custom data attributes from the clicked element
     *       { selector: '.product-card', event: 'click', emits: Events.UI.Product.Selected,
     *         includeTarget: true },
     *       // Then in the event handler receiving this event:
     *       // productSelectedHandler({ target }) {
     *       //   const productId = target.dataset.productId;
     *       //   const price = target.dataset.price;
     *       //   // Use the product data
     *       // }
     *       
     *       // Can include both handler and emits for flexibility
     *       { selector: '#resetButton', event: 'click', 
     *         emits: Events.UI.Form.Reset, 
     *         handler: this._handleReset 
     *       }
     *     ],
     *     
     *     // Global EventBus listeners
     *     events: [
     *       { eventName: Events.Game.Started, callback: this.onGameStarted },
     *       { eventName: Events.UI.MainMenu.StartSinglePlayerClicked, callback: this.onStartSinglePlayer },
     *     ],
     *     
     *     // DOM elements to query and cache
     *     domElements: [
     *       { name: 'submitButton', selector: '#submitBtn'},
     *       { name: 'errorMessage', selector: '.error-msg' }
     *     ],
     *     
     *     // Additional setup logic
     *     setup: () => {
     *       // Initialize properties, fetch data, etc.
     *       this.setupExtraStuff();
     *     }
     *   };
     * }
     * 
     * @returns {Object} Configuration object with domEvents, events, domElements, and setup.
     * @property {Array<Object>} [domEvents] - Array of DOM event mappings.
     * @property {Array<Object>} [events] - Array of EventBus listener objects.
     * @property {Array<Object>} [domElements] - Array of DOM element query definitions.
     * @property {Function} [setup] - Optional additional setup function.
     */
    initialize() {
        // Default implementation returns empty configuration
        // Subclasses MUST override this method
        return { events: [], domEvents: [], domElements: [], setup: null };
    }

    /**
     * Processes the initialization configuration returned by initialize().
     * This is called internally by the constructor to set up events and run setup logic.
     * @private
     */
    _processInitialization() {
        
        const config = this.initialize();
        
        // Initialize elements container
        this.elements = {};
        
        // Store the DOM elements config for potential lazy initialization
        this._domElementsConfig = config.domElements;

        // Process DOM element queries (for non-lazy elements)
        if (config.domElements && Array.isArray(config.domElements)) {
            config.domElements.forEach(elementConfig => {
                const { name, selector, required = false, lazyInit = false } = elementConfig;
                
                if (!name || !selector) {
                    console.error(`[BaseComponent] Invalid DOM element config in '${this.name}': name and selector are required.`);
                    debugger;
                    return;
                }
                
                // Skip immediate initialization for lazy elements
                if (lazyInit) {
                    return;
                }
                
                const element = this.rootElement.querySelector(selector);
                
                if (element) {
                    this.elements[name] = element;
                } else if (required) {
                    console.error(`[BaseComponent] Required element not found: ${selector} in component '${this.name}'.`);
                } else {
                    
                    console.error(`[BaseComponent] Optional element not found: ${selector} in component '${this.name}'.`);
                }
            });
        }
        
        // Process EventBus listeners
        if (config.events && Array.isArray(config.events)) {
            config.events.forEach(({ eventName, callback }) => {
                if (typeof callback === 'function' && typeof eventName === 'string') {
                    this._addEventListener(eventName, callback);
                } else {
                    
                    console.error(`[${this.name}] tries to register invalid event!`, new Error().stack);
                    debugger;
                }
            });
        }
        
        // Process DOM event mappings using delegation
        if (config.domEvents && Array.isArray(config.domEvents)) {
            config.domEvents.forEach(domEventConfig => {
                const { selector, event, emits, handler } = domEventConfig;
                
                if (!selector || !event) {
                    debugger;
                    console.warn(`[BaseComponent] Invalid DOM event config in '${this.name}': selector and event are required.`);
                    return;
                }
                
                if (emits && handler) {
                    // Both emits and handler provided - use custom handler that also emits the event
                    const combinedHandler = function domEventHandler(e, target) {
                        // First call the custom handler
                        handler.call(this, e, target);
                        // Then emit the event
                        console.debug(`[${this.name}] DOM event '${event}' triggered on '${selector}', emitting: ${emits}`);
                        
                        // Start with the static payload or empty object
                        const payload = domEventConfig.payload || {};
                        
                        // When includeEvent is true, adds the original DOM event object (e) to the payload
                        // This gives event handlers access to all DOM event properties (clientX/Y, key, etc.)
                        if (domEventConfig.includeEvent && !payload.event) {
                            payload.event = e;
                        }
                        
                        // When includeTarget is true, adds the target DOM element to the payload
                        // This gives event handlers access to the element and its properties (dataset, etc.)
                        if (domEventConfig.includeTarget && !payload.target) {
                            payload.target = target;
                        }
                        
                        eventBus.emit(emits, payload);
                    }.bind(this);
                    this._addDelegatedEventListener(selector, event, combinedHandler);
                } else if (emits) {
                    // Log the value of 'emits' when the handler is CREATED
                    console.log(`[${this.name}] DEBUG: Creating emitHandler for selector '${selector}'. 'emits' value at creation:`, emits);
                    
                    // Only emits provided - create a handler that simply emits the event
                    const emitHandler = (e, target) => {
                        // --- Validate the event name *before* emitting ---
                        console.log(`[${this.name}] DEBUG: Validating emits value:`, emits); // Explicit log
                        if (typeof emits !== 'string' || !emits) {
                            const error = new Error(`[${this.name}] Attempted to emit an invalid event via domEvents configuration. Event name must be a non-empty string, but received: ${emits}`);
                            if (error.stack) {
                                console.error(`Invalid emit definition in ${this.name} (selector: ${selector}, event: ${event}):`, error.stack);
                            }
                            throw error;
                        }
                        // --- End validation ---
                        
                        console.debug(`[${this.name}] DOM event '${event}' triggered on '${selector}', emitting: ${emits}`);
                        
                        // Start with the static payload or empty object
                        const payload = domEventConfig.payload || {};
                        
                        // When includeEvent is true, adds the original DOM event object (e)
                        if (domEventConfig.includeEvent && !payload.event) {
                            payload.event = e;
                        }
                        
                        // When includeTarget is true, adds the target DOM element
                        if (domEventConfig.includeTarget && !payload.target) {
                            payload.target = target;
                        }
                        
                        eventBus.emit(emits, payload);
                    };
                    this._addDelegatedEventListener(selector, event, emitHandler);
                } else if (handler) {
                    // Only handler provided - just use the handler directly without emitting any event
                    this._addDelegatedEventListener(selector, event, handler);
                }
            });
        }
        
        // Process setup logic
        if (config.setup && typeof config.setup === 'function') {
            config.setup.call(this);
        }
 
    }
}