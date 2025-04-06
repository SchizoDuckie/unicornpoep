/**
 * Manages the initial Loading indicator UI.
 */
class LoadingController {
    /**
     * Initializes the controller by getting the container element.
     * Assumes the container has the 'hidden' class initially if it should start hidden.
     */
    constructor() {
        this.container = document.getElementById('loading');
    }

    /**
     * Shows the loading indicator by removing the 'hidden' class.
     * Assumes the base CSS for #loading sets display: flex.
     */
    show() {
        this.container.classList.remove('hidden');
    }

    /**
     * Hides the loading indicator by adding the 'hidden' class.
     */
    hide() {
        this.container.classList.add('hidden');
    }
}