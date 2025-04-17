import RefactoredBaseComponent from './RefactoredBaseComponent.js';
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
export default class HighscoresComponent extends RefactoredBaseComponent {
    static SELECTOR = '#highscores';
    static VIEW_NAME = 'HighscoresComponent';
    
    static SELECTORS = {
        LIST_CONTAINER: '#scoreList',
        BACK_BUTTON: '.backToMain',
        ROW_TEMPLATE: '#highscore-row-template'
    };

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Menu.Highscores.Loaded,
                    callback: this._handleScoresLoaded
                },
                {
                    eventName: Events.Menu.Highscores.LoadFailed,
                    callback: this._handleScoresError
                },
                {
                    eventName: Events.Navigation.ShowView,
                    callback: this._handleNavigation
                }
            ],
            
            domEvents: [
                {
                    selector: HighscoresComponent.SELECTORS.BACK_BUTTON,
                    event: 'click',
                    emits: Events.UI.MainMenu.Show
                }
            ],
            
            domElements: [
                {
                    name: 'listContainer',
                    selector: HighscoresComponent.SELECTORS.LIST_CONTAINER
                },
                {
                    name: 'backButton',
                    selector: HighscoresComponent.SELECTORS.BACK_BUTTON
                },
                {
                    name: 'rowTemplate',
                    selector: HighscoresComponent.SELECTORS.ROW_TEMPLATE
                }
            ]
        };
    }
    
    /**
     * Handles navigation events to clear display when navigating away
     * @param {object} payload
     * @param {string} payload.viewName
     * @private
     */
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
    _handleScoresLoaded({ scores }) {
        this.renderScores(scores);
    }

    /**
     * Handles the Highscores.Error event.
     * @param {object} payload
     * @param {string} payload.message
     * @private
     */
    _handleScoresError({ message }) {
        this.renderError(message || getTextTemplate('hsLoadErrorDefault'));
    }

    /**
     * Renders the high scores list to the table body using the template.
     * @param {Array<object>} scores
     * @private
     */
    renderScores = (scores) => {
        if (!this.elements.listContainer || !this.elements.rowTemplate) return;

        this.elements.listContainer.innerHTML = '';

        if (!scores || scores.length === 0) {
            const row = this.elements.listContainer.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = getTextTemplate('hsListEmpty');
            cell.style.textAlign = "center";
            return;
        }

        scores.forEach((score, index) => {
            const templateClone = this.elements.rowTemplate.content.cloneNode(true);
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
            
            const formattedGameName = displayGameName.split(',')
                .map(part => {
                    let baseNamePart = part.trim();
                    if (baseNamePart.includes(':')) {
                        const subParts = baseNamePart.split(':');
                        if (subParts.length > 1) {
                            baseNamePart = subParts.slice(1).join(':').trim(); 
                        }
                    } else if (baseNamePart.includes('_')) {
                        const subParts = baseNamePart.split('_');
                        if (subParts.length > 1) {
                            baseNamePart = subParts.slice(1).join('_').trim(); 
                        }
                    }
                    const finalNamePart = baseNamePart.replace(/_/g, ' ');
                    return finalNamePart;
                })
                .join(', ');
                
            if(gameNameCell) gameNameCell.textContent = formattedGameName;
            
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
                    dateCell.textContent = '-';
                }
            } else {
                dateCell.textContent = '-';
            }
            
            this.elements.listContainer.appendChild(rowElement);
        });
    }

    /**
     * Renders an error message in the table body.
     * @param {string} message
     * @private
     */
    renderError = (message) => {
        if (!this.elements.listContainer) return;
        this.elements.listContainer.innerHTML = '';
        const row = this.elements.listContainer.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = `${getTextTemplate('hsRenderErrorPrefix')}${message}`;
        cell.style.textAlign = "center";
        cell.style.color = "red";
    }

    /**
     * Clears the score list display.
     */
    clearDisplay = () => {
        if (this.elements.listContainer) {
            this.elements.listContainer.innerHTML = '';
        }
    }

    /**
     * Override show to trigger loading scores when the view becomes visible.
     * HighscoreManager listens for ShowRequested.
     * @override
     */
    show() {
        super.show();
        eventBus.emit(Events.Menu.Highscores.ShowRequested);
        easterEggActivator.addKonamiListener();
    }

    /**
     * Override hide to remove Konami listener.
     * @override
     */
    hide() {
        super.hide();
        easterEggActivator.deactivate();
    }
} 