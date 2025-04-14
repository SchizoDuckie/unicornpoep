import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

import highscoreManager from '../services/HighscoreManager.js';
import easterEggActivator from '../utils/easter-egg-activator.js';

/**
 * Component managing the Highscores view (#highscores).
 * Displays the list of high scores.
 */
export default class HighscoresComponent extends BaseComponent {
    static SELECTOR = '#highscores';
    static VIEW_NAME = 'HighscoresComponent';

    /**
     * Initializes the HighscoresComponent.
     */
    constructor() {
        super();
        // NO element selection here
        console.log("[HighscoresComponent] Constructor completed.");
    }

    /**
     * Initializes the component by selecting DOM elements.
     * Called by BaseComponent.
     */
    initialize() {
        console.log(`[${this.name}] initialize() called.`);
        // Select elements here, AFTER this.rootElement is available
        this.listContainer = this.rootElement.querySelector('#scoreList');
        this.backButton = this.rootElement.querySelector('.backToMain');
        this.rowTemplate = this.rootElement.querySelector('#highscore-row-template');

        // Error check remains important
        if (!this.listContainer || !this.backButton || !this.rowTemplate) {
            throw new Error(`[${this.name}] Missing required child elements (#scoreList, .backToMain, #highscore-row-template) after initialize(). Component cannot function.`);
        }
        console.log(`[${this.name}] Elements selected in initialize.`);
    }

    _bindMethods() {
        this._handleBackClick = this._handleBackClick.bind(this);
        this.handleScoresLoaded = this.handleScoresLoaded.bind(this);
        this.handleScoresError = this.handleScoresError.bind(this);
        this.clearDisplay = this.clearDisplay.bind(this);
    }

    /**
     * Adds DOM and eventBus event listeners.
     * Called by BaseComponent constructor.
     */
    registerListeners() {
        this._bindMethods();
        
        if(this.backButton) this.backButton.addEventListener('click', this._handleBackClick);

        this.listen(Events.Menu.Highscores.Loaded, this.handleScoresLoaded);
        this.listen(Events.Menu.Highscores.LoadFailed, this.handleScoresError);
        this.listen(Events.Navigation.ShowView, this._handleNavigation);
        
        console.log(`[${this.name}] Listeners registered.`);
    }
    
    _handleNavigation({ viewName }) {
        if (viewName !== this.name) {
            this.clearDisplay();
            easterEggActivator.deactivate();
        }
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
     * Handles the Highscores.Error event.
     * @param {object} payload
     * @param {string} payload.message
     * NOTE: Now listens for Events.Menu.Highscores.LoadFailed
     * @private
     */
    handleScoresError({ message }) {
        console.error(`[HighscoresComponent] Error event received: ${message}`);
        this.renderError(message || getTextTemplate('hsLoadErrorDefault'));
    }

    /**
     * Renders the high scores list to the table body using the template.
     * @param {Array<object>} scores
     * @private
     */
    renderScores(scores) {
        if (!this.listContainer || !this.rowTemplate) return;

        this.listContainer.innerHTML = '';

        if (!scores || scores.length === 0) {
            const row = this.listContainer.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = getTextTemplate('hsListEmpty');
            cell.style.textAlign = "center";
            return;
        }

        scores.forEach((score, index) => {
            const templateClone = this.rowTemplate.content.cloneNode(true);
            const rowElement = templateClone.querySelector('tr');

            const rank = index + 1;
            if (rank <= 3) {
                rowElement.classList.add(`rank-${rank}`);
            }
           
            const rankCell = rowElement.querySelector('.rank');
            if (rank === 1) rankCell.innerHTML = '🥇';
            else if (rank === 2) rankCell.innerHTML = '🥈';
            else if (rank === 3) rankCell.innerHTML = '🥉';
            else rankCell.textContent = rank;
            
            let displayGameName = score.gameName || '?';
            const gameNameCell = rowElement.querySelector('.game-name');
            const difficultyCell = rowElement.querySelector('.difficulty');
            // --- Restore FULL Original Formatting Logic --- 
            const formattedGameName = displayGameName.split(',') // Handle multiple sheets
                .map(part => {
                    // --- Corrected Formatting --- 
                    let baseNamePart = part.trim();
                    // Check for ':' first (likely multiplayer)
                    if (baseNamePart.includes(':')) {
                        const subParts = baseNamePart.split(':');
                        if (subParts.length > 1) {
                            // Join all parts after the first one
                            baseNamePart = subParts.slice(1).join(':').trim(); 
                        }
                    // If no ':', check for '_' (likely V1 single player)
                    } else if (baseNamePart.includes('_')) {
                        const subParts = baseNamePart.split('_');
                        if (subParts.length > 1) {
                            // Join all parts after the first one
                            baseNamePart = subParts.slice(1).join('_').trim(); 
                        }
                    }
                    // Replace any remaining underscores in the name itself
                    const finalNamePart = baseNamePart.replace(/_/g, ' ');
                    return finalNamePart;
                })
                .join(', '); // Join back if multiple sheets
            if(gameNameCell) gameNameCell.textContent = formattedGameName;
             // REMOVED difficulty cell population - column will be removed
            // if(difficultyCell) difficultyCell.textContent = score.difficulty || '-';
            // --- End Restore Formatting ---
            
            rowElement.querySelector('.name').textContent = score.player;
            rowElement.querySelector('.score').textContent = score.score;
            const dateCell = rowElement.querySelector('.date');
            if (score.date && typeof score.date === 'string') {
                try {
                    const dateObj = new Date(score.date);
                    const formattedDate = `${dateObj.getDate()}-${dateObj.getMonth() + 1}-${dateObj.getFullYear()}`;
                    const formattedTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
                    dateCell.innerHTML = `${formattedDate} ${formattedTime}`;
                } catch (e) {
                    console.warn(`Error formatting date: ${score.date}`, e);
                    dateCell.textContent = '-';
                }
            } else {
                dateCell.textContent = '-';
            }
            
            this.listContainer.appendChild(rowElement);
        });
    }

    /**
     * Renders an error message in the table body.
     * @param {string} message
     * @private
     */
    renderError(message) {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = ''; // Clear previous entries
        const row = this.listContainer.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5; // Reverted column count
        cell.textContent = `${getTextTemplate('hsRenderErrorPrefix')}${message}`;
        cell.style.textAlign = "center";
        cell.style.color = "red";
    }

     /**
     * Clears the score display.
     * @private
     */
    clearDisplay() {
        if (this.listContainer) {
            this.listContainer.innerHTML = '';
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

    /**
     * Handles the back button click.
     * @private
     */
    _handleBackClick() {
        console.log("[HighscoresComponent] Back button clicked.");
        eventBus.emit(Events.UI.Highscores.BackClicked);
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Use imported constant
    }
} 