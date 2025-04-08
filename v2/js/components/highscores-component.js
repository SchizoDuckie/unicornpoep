import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

import HighscoreManager from '../services/HighscoreManager.js';
import easterEggActivator from '../utils/easter-egg-activator.js';

/**
 * Component managing the Highscores view (#highscores).
 * Displays the list of high scores.
 */
export default class HighscoresComponent extends BaseComponent {
    /**
     * Initializes the HighscoresComponent.
     */
    constructor() {
        super('#highscores', Views.Highscores); // Use registration name
        // BaseComponent constructor throws if rootElement is null.

        this.scoreListBody = this.rootElement.querySelector('#scoreList');
        this.backButton = this.rootElement.querySelector('.backToMain');
        this.rowTemplate = this.rootElement.querySelector('#highscore-row-template');

        // Throw if essential child elements are missing
        if (!this.scoreListBody || !this.backButton || !this.rowTemplate) {
            throw new Error(`[${this.name}] Missing required child elements (#scoreList, .backToMain, #highscore-row-template). Component cannot function.`);
        }

        this._bindMethods();
        this.addEventListeners();
        this.listenForEvents();
        console.log("[HighscoresComponent] Initialized.");
    }

    _bindMethods() {
        this.handleScoresLoaded = this.handleScoresLoaded.bind(this);
        this.handleLoadFailed = this.handleLoadFailed.bind(this);
        this.clearDisplay = this.clearDisplay.bind(this);
    }

    /**
     * Adds DOM event listeners.
     * @private
     */
    addEventListeners() {
        this.backButton?.addEventListener('click', () => {
            console.log("[HighscoresComponent] Back button clicked.");
            eventBus.emit(Events.UI.Highscores.BackClicked);
            eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Use imported constant
        });
    }

    /**
     * Listens for highscore data events.
     * @private
     */
    listenForEvents() {
        // Listen for the data loaded event from HighscoreManager
        this.listen(Events.Menu.Highscores.Loaded, this.handleScoresLoaded);
        this.listen(Events.Menu.Highscores.LoadFailed, this.handleLoadFailed);

        // Clear list if navigating away
        this.listen(Events.Navigation.ShowView, ({ viewName }) => {
            if (viewName !== this.name) { // Use this.name for comparison
                this.clearDisplay();
                easterEggActivator.deactivate();
            }
        });
    }

    /**
     * Handles the Highscores.Loaded event by rendering the scores.
     * @param {object} payload
     * @param {Array<object>} payload.scores - Array of score objects ({ name, score, date, level? }).
     * @private
     */
    handleScoresLoaded({ scores }) {
        console.log("[HighscoresComponent] Scores loaded event received:", scores);
        this.renderScores(scores);
    }

    /**
     * Handles the Highscores.LoadFailed event.
     * @param {object} payload
     * @param {string} payload.message
     * @private
     */
    handleLoadFailed({ message }) {
        console.error(`[HighscoresComponent] Load failed event received: ${message}`);
        this.renderError(message || "Kon scores niet laden.");
    }

    /**
     * Renders the high scores list to the table body using the template.
     * @param {Array<object>} scores
     * @private
     */
    renderScores(scores) {
        // Check if necessary elements are available (already checked in constructor, but good practice)
        if (!this.scoreListBody || !this.rowTemplate) return;

        this.scoreListBody.innerHTML = ''; // Clear previous entries

        if (!scores || scores.length === 0) {
            const row = this.scoreListBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5; // Ensure it spans all columns defined in the template/thead
            cell.textContent = "Nog geen hoge scores behaald!";
            cell.style.textAlign = "center";
            return;
        }

        // Use the template to create and append rows
        scores.forEach((score, index) => {
            // Clone the template content for each row
            const templateClone = this.rowTemplate.content.cloneNode(true);
            // Get the actual <tr> element from the cloned fragment
            const rowElement = templateClone.querySelector('tr');

            // Populate the cells within the cloned row using their class names
            rowElement.querySelector('.rank').textContent = index + 1;
            rowElement.querySelector('.level').textContent = score.level || '-'; // Handle optional level
            rowElement.querySelector('.name').textContent = score.name;
            rowElement.querySelector('.score').textContent = score.score;
            rowElement.querySelector('.date').textContent = score.date ? new Date(score.date).toLocaleDateString('nl-NL') : '-'; // Format date

            // Append the populated row to the table body
            this.scoreListBody.appendChild(rowElement);
        });
    }

    /**
     * Renders an error message in the table body.
     * @param {string} message
     * @private
     */
    renderError(message) {
        if (!this.scoreListBody) return;
        this.scoreListBody.innerHTML = ''; // Clear previous entries
        const row = this.scoreListBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5; // Match column count
        cell.textContent = `Fout: ${message}`;
        cell.style.textAlign = "center";
        cell.style.color = "red";
    }

     /**
     * Clears the score display.
     * @private
     */
    clearDisplay() {
        if (this.scoreListBody) {
            this.scoreListBody.innerHTML = '';
            console.debug("[HighscoresComponent] Display cleared.");
        }
    }

    /**
     * Override show to trigger loading scores when the view becomes visible.
     * HighscoreManager listens for ShowRequested.
     */
    show() {
        super.show();
        console.log("[HighscoresComponent] Shown. Requesting scores...");
        eventBus.emit(Events.Menu.Highscores.ShowRequested);
        // Add Konami listener when shown
        easterEggActivator.addKonamiListener();
    }

    /**
     * Override hide to remove Konami listener.
     */
    hide() {
        super.hide();
        easterEggActivator.deactivate();
    }

    /**
     * Override destroy to remove listeners.
     */
    destroy() {
        easterEggActivator.deactivate();
        super.destroy();
    }
} 