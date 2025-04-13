import BaseComponent from '../components/base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * Base class for dialog components that use the HTML <dialog> element.
 * Extends BaseComponent and overrides show/hide to use showModal/close.
 * Assumes the root element is a <dialog>.
 */
export default class BaseDialog extends BaseComponent {

    /**
     * Base constructor for dialogs. Subclasses should NOT override this.
     * They MUST define static SELECTOR and static VIEW_NAME (or NAME) properties.
     */
    constructor() {
        super(); // Call BaseComponent constructor (which now reads static props & calls initialize/registerListeners)

        // Post-initialization check specific to dialogs
        if (this.rootElement && !(this.rootElement instanceof HTMLDialogElement)) {
            console.warn(`[${this.name}] Root element ${this.selector} is not a <dialog> element. showModal/close might fail.`);
        }
        
        // Initial state is handled by BaseComponent checking the 'hidden' class.
        // Dialogs often start visible in HTML until explicitly hidden by JS.
        // Ensure they are hidden (closed) after initialization if not already.
        if (this.rootElement instanceof HTMLDialogElement && this.rootElement.open) {
             this.hide();
        }
    }

    /** 
     * Shows the dialog using showModal() and emits Shown event. 
     * Overrides BaseComponent.show().
     */
    show() {
        if (this.rootElement instanceof HTMLDialogElement) {
            this.rootElement.classList.remove('hidden'); 
            if (!this.rootElement.open) {
                 try {
                    this.rootElement.showModal();
                    this.isVisible = true; // Update internal state
                    eventBus.emit(Events.Component.Shown, { component: this, componentName: this.name });
                    console.debug(`[BaseDialog] Shown (modal): ${this.name}`);
                 } catch (error) {
                     console.error(`[${this.name}] Error showing dialog modal:`, error);
                     this.rootElement.classList.add('hidden'); // Add back hidden if showModal failed
                 }
            } else {
                 console.debug(`[${this.name}] show() called but dialog already open. Ensuring .hidden is removed.`);
            }
        } else {
             console.warn(`[${this.name}] Cannot show dialog: Element not found or not a dialog.`);
        }
    }

    /** 
     * Hides the dialog using close() and emits Hidden event. 
     * Overrides BaseComponent.hide().
     */
    hide() {
        if (this.rootElement instanceof HTMLDialogElement) {
            if (this.rootElement.open) {
                 try {
                    this.rootElement.close();
                    this.isVisible = false; // Update internal state
                    eventBus.emit(Events.Component.Hidden, { component: this, componentName: this.name });
                    console.debug(`[BaseDialog] Hidden (closed): ${this.name}`);
                 } catch (error) {
                     console.error(`[${this.name}] Error closing dialog modal:`, error);
                     // Don't re-add hidden class here if close failed, state is uncertain
                 }
            } 
            this.rootElement.classList.add('hidden'); 
            this.isVisible = false; // Ensure state is false even if wasn't open
        } 
        // No warning if already closed, as hide() might be called defensively.
    }
    
     /**
     * Adds a listener for a standard close button within the dialog.
     * Assumes a button with the class '.dialog-close-button'.
     * Call this in the constructor of inheriting dialogs if needed.
     * @protected
     */
     addCloseButtonListener(buttonSelector = '.dialog-close-button') {
        const closeButton = this.rootElement.querySelector(buttonSelector);
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                 e.preventDefault();
                 console.log(`[${this.name}] Close button clicked.`);
                 this.hide();
                 // Optionally emit a specific cancel/close event
                 // eventBus.emit(`ui:${this.name}:closed`); 
            });
        } else {
            console.debug(`[${this.name}] No close button found with selector: ${buttonSelector}`);
        }
    }

    /**
     * Placeholder for initializing dialog-specific elements or listeners.
     * Called by BaseComponent constructor after super() and element finding.
     * Subclasses should implement this instead of a constructor.
     */
    // initialize() {
        // Example:
        // this.titleElement = this.rootElement.querySelector('.title');
        // this._bindMethods();
        // this.addCloseButtonListener(); 
    // }

    /**
     * Placeholder for registering dialog-specific DOM listeners needed immediately.
     * Called by BaseComponent constructor after initialize().
     * Subclasses should implement this if needed.
     */
    // registerListeners() {
        // Example: Add listeners for form elements within the dialog
    // }
} 