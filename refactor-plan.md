# Refactoring Plan: Towards an Event-Based System

1.  **Problem:** The current JavaScript codebase exhibits tight coupling between components. Major parts like `MultiplayerGame`, `Game`, `MainMenu`, `WebRTCManager`, and various UI controllers (`multiplayer-controller`, `gamearea-controller`, `dialog-controller`, etc.) have direct dependencies on each other, often through a central `MainMenu` object acting as a service locator or by direct instantiation and method calls. This makes the code:
    *   **Hard to Understand:** Following the flow of execution requires jumping between many tightly linked files.
    *   **Brittle:** Changes in one component (e.g., a UI controller) can easily break another component that depends on it directly (e.g., `MultiplayerGame`).
    *   **Difficult to Test:** Isolating components for unit testing is challenging due to these direct dependencies.
    *   **Difficult to Extend:** Adding new features often requires modifying multiple existing components.

2.  **Goal:** Refactor the codebase to use an event-based architecture. Components will communicate indirectly by emitting events and listening for events they care about, rather than calling methods on each other directly. This will:
    *   **Decouple Components:** Reduce direct dependencies, making components more independent and reusable.
    *   **Improve Maintainability:** Changes within one component are less likely to affect others.
    *   **Enhance Testability:** Components can be tested in isolation by mocking the event bus or dispatching test events.
    *   **Increase Clarity:** Interactions become clearer – component A *emits* an event, component B *listens* for it.

3.  **Development Strategy: `v2` Subdirectory**

    *   **Isolation:** To avoid disrupting the current working application, the entire refactor will take place within a new subdirectory named `v2`.
    *   **Self-Contained Environment:** The `v2` directory will be self-contained.
        *   **HTML:** Duplicate the main `index.html` into `v2/index.html`.
        *   **Assets:** Copy necessary asset directories (e.g., `css/`, `js/lib/`, `images/`, `fonts/`) from the root directory into the `v2` directory.
        *   **Path Adjustments:** Modify all paths within `v2/index.html` (for CSS, JS, images) and within copied assets (like CSS `url()` paths) to use relative paths that correctly point to resources *within* the `v2` directory structure. This ensures `v2` runs independently.
    *   **Benefit:** This approach allows side-by-side comparison of the original and refactored code and enables independent testing of the `v2` version by serving `v2/index.html`.
    *   **Mandatory V2 Code Verification:** Before implementing or modifying *any* component, service, or utility within the `v2` directory based on this plan, the developer **MUST** first check if a corresponding file already exists in the `v2/js/...` structure. If a V2 file exists, its current implementation **MUST** be read, understood, and used as the basis for any changes. **DO NOT** overwrite existing V2 code without review. If V1 code exists but no V2 code does, use V1 as a reference for refactoring into the V2 structure. If unsure, ask.

4.  **Proposed Solution: Event Bus & Component-Based UI**

    *   **Event Bus:** Implement a simple event bus/emitter class with `on(eventName, listener)`, `off(eventName, listener)`, and `emit(eventName, ...args)` methods.
        *   **Dependency Management:** Use ES Modules (`import/export`). Create a single instance of `EventBus` in `event-bus.js` and export it. Other modules can then explicitly `import eventBus from './event-bus.js';`. This makes dependencies clearer and avoids polluting the global scope.

        ```javascript
        // Example: event-bus.js - ES Module Singleton
        class EventBus {
            constructor() { this.listeners = {}; }
            on(eventName, callback) { /* ... add listener ... */ console.debug(`EventBus: Listener added for '${eventName}'`); }
            off(eventName, callback) { /* ... remove listener ... */ console.debug(`EventBus: Listener removed for '${eventName}'`); }
            emit(eventName, ...args) {
                console.debug(`[EventBus] Emitting: '${eventName}'`, args);
                (this.listeners[eventName] || []).forEach(callback => {
                    try {
                        callback(...args);
                    } catch (error) {
                        console.error(`[EventBus] Error in listener for '${eventName}':`, error);
                        // Optionally emit a system error event here
                        // this.emit(Events.System.ErrorOccurred, { message: `Listener error for ${eventName}`, error });
                    }
                });
            }
        }
        const eventBus = new EventBus(); // Singleton instance
        export default eventBus;
        ```

    *   **Hierarchical Event Constants:** Define all possible event names as constants within a structured object.
        *   **Dependency Management:** Similar to the `EventBus`, export the `Events` object from `event-constants.js` and import it where needed.
        *   **Payload Definition (CRITICAL):** *Rigorously define and document the exact payload structure for every event.* Use JSDoc comments above each event constant definition in `event-constants.js` to specify the type and properties of the payload. This is essential for maintainability and acts as a contract between emitters and listeners.

        ```javascript
        // Example: event-constants.js
        /**
         * Core application events namespace.
         * @namespace Events
         */
        export const Events = {
            /**
             * System and general application events.
             * @namespace Events.System
             */
            System: {
                /**
                 * Fired when a significant error occurs that needs reporting or handling.
                 * @event Events.System.ErrorOccurred
                 * @type {object}
                 * @property {string} message - User-friendly error message.
                 * @property {Error} [error] - The original Error object, if available.
                 * @property {string} [context] - Optional context where the error occurred (e.g., 'WebRTC Connection').
                 */
                ErrorOccurred: 'system:errorOccurred',
                /**
                 * Fired when a major application state transition occurs (e.g., view change).
                 * @event Events.System.StateChange
                 * @type {object}
                 * @property {string} newState - Identifier of the new state/view.
                 * @property {string} oldState - Identifier of the previous state/view.
                 */
                StateChange: 'system:stateChange',
                /**
                 * Request to show transient feedback to the user (e.g., a toast notification).
                 * @event Events.System.ShowFeedback
                 * @type {object}
                 * @property {string} message - The feedback message.
                 * @property {'info'|'success'|'warn'|'error'} level - Severity level.
                 * @property {number} [duration] - Optional display duration in milliseconds.
                 */
                ShowFeedback: 'system:showFeedback',
            },
            /**
             * Events related to application navigation and view management.
             * @namespace Events.Navigation
             */
            Navigation: {
                /**
                 * Request to show a specific application view/component.
                 * @event Events.Navigation.ShowView
                 * @type {object}
                 * @property {string} viewName - The identifier of the view to show (e.g., 'MainMenu', 'GameArea', 'HostLobby').
                 * @property {any} [data] - Optional data to pass to the view upon showing.
                 */
                ShowView: 'navigation:showView',
            },
            /**
             * Lifecycle events emitted by BaseComponent instances.
             * @namespace Events.Component
             */
            Component: {
                /**
                 * Fired *by BaseComponent* after a component instance is constructed and basic setup is complete.
                 * @event Events.Component.Initialized
                 * @type {object}
                 * @property {BaseComponent} component - The component instance that was initialized.
                 * @property {string} componentName - The name/identifier of the component.
                 */
                Initialized: 'component:initialized',
                /**
                 * Fired *by BaseComponent* when a component's root element is shown (e.g., 'hidden' class removed).
                 * @event Events.Component.Shown
                 * @type {object}
                 * @property {BaseComponent} component - The component instance that was shown.
                 * @property {string} componentName - The name/identifier of the component.
                 */
                Shown: 'component:shown',
                /**
                 * Fired *by BaseComponent* when a component's root element is hidden (e.g., 'hidden' class added).
                 * @event Events.Component.Hidden
                 * @type {object}
                 * @property {BaseComponent} component - The component instance that was hidden.
                 * @property {string} componentName - The name/identifier of the component.
                 */
                Hidden: 'component:hidden',
                /**
                 * Fired *by BaseComponent* just before a component is destroyed and listeners are cleaned up.
                 * @event Events.Component.Destroyed
                 * @type {object}
                 * @property {BaseComponent} component - The component instance being destroyed.
                 * @property {string} componentName - The name/identifier of the component.
                 */
                Destroyed: 'component:destroyed',
            },
            /**
             * General game-related events, applicable across different modes.
             * @namespace Events.Game
             */
            Game: {
                 /**
                  * Request to start a new game. Should trigger instantiation of the correct game mode class.
                  * @event Events.Game.StartRequested
                  * @type {object}
                  * @property {'single' | 'multiplayer-host' | 'multiplayer-join' | 'practice'} mode - The requested game mode.
                  * @property {object} [settings] - Game settings (e.g., sheet ID, difficulty). Specific structure depends on mode.
                  * @property {string} [hostId] - Required for 'multiplayer-join' mode.
                  * @property {string} [playerName] - Player's chosen name.
                  */
                 StartRequested: 'game:startRequested',
                /**
                 * Fired when a game has successfully started and is ready.
                 * @event Events.Game.Started
                 * @type {object}
                 * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that started.
                 * @property {object} settings - The final settings used for the game.
                 */
                Started: 'game:started',
                /**
                 * Fired when a game finishes.
                 * @event Events.Game.Finished
                 * @type {object}
                 * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that finished.
                 * @property {object} results - Game results (e.g., score, rankings). Structure varies by mode.
                 */
                Finished: 'game:finished',
                /**
                 * Fired when a new question is presented to the player(s).
                 * @event Events.Game.QuestionNew
                 * @type {object}
                 * @property {number} questionIndex - 0-based index of the current question.
                 * @property {number} totalQuestions - Total number of questions in the quiz.
                 * @property {object} questionData - The question details.
                 * @property {string} questionData.question - The question text.
                 * @property {string[]} questionData.answers - Shuffled array of possible answers.
                 */
                QuestionNew: 'game:questionNew',
                /**
                 * Fired *by the QuizEngine* after checking a submitted answer.
                 * @event Events.Game.AnswerChecked
                 * @type {object}
                 * @property {boolean} isCorrect - Whether the submitted answer was correct.
                 * @property {number} scoreDelta - Change in score resulting from this answer.
                 * @property {string} correctAnswer - The correct answer text.
                 * @property {any} submittedAnswer - The answer submitted by the player.
                 */
                AnswerChecked: 'game:answerChecked',
                /**
                 * Fired when the player's score is updated. Emitted by the active Game Mode class.
                 * @event Events.Game.ScoreUpdated
                 * @type {object}
                 * @property {number} totalScore - The new total score for the player.
                 * @property {string} [playerId] - Identifier for the player whose score updated (relevant in MP). If omitted, assumes local player.
                 */
                ScoreUpdated: 'game:scoreUpdated',
                /**
                 * Fired periodically by a timer during the game.
                 * @event Events.Game.TimeTick
                 * @type {object}
                 * @property {number} remainingTime - Remaining time in seconds (or other unit).
                 * @property {string} [timerId] - Optional identifier if multiple timers exist.
                 */
                TimeTick: 'game:timeTick',
                 /**
                 * Fired when a game timer runs out.
                 * @event Events.Game.TimeUp
                 * @type {object}
                 * @property {string} [timerId] - Optional identifier if multiple timers exist.
                 */
                TimeUp: 'game:timeUp',
                 /**
                 * Fired *by the QuizEngine* when all questions have been answered.
                 * @event Events.Game.AllQuestionsAnswered
                 * @type {object}
                 * @property {number} finalScore - The final score achieved in the quiz round.
                 */
                AllQuestionsAnswered: 'game:allQuestionsAnswered',
            },
            /**
             * Events specific to multiplayer mode.
             * @namespace Events.Multiplayer
             */
            Multiplayer: {
                /** @namespace Events.Multiplayer.Host */
                Host: {
                    /**
                     * Fired when the host initializes the PeerJS connection.
                     * @event Events.Multiplayer.Host.Initialized
                     * @type {object}
                     * @property {string} hostId - The unique ID assigned to the host's peer connection.
                     */
                    Initialized: 'multiplayer:host:initialized',
                    /**
                     * Fired on the host when a client successfully connects.
                     * @event Events.Multiplayer.Host.ClientConnected
                     * @type {object}
                     * @property {string} peerId - The PeerJS ID of the connected client.
                     * @property {string} playerName - The name provided by the client.
                     */
                    ClientConnected: 'multiplayer:host:clientConnected',
                    /**
                     * Fired on the host when a client disconnects.
                     * @event Events.Multiplayer.Host.ClientDisconnected
                     * @type {object}
                     * @property {string} peerId - The PeerJS ID of the disconnected client.
                     */
                    ClientDisconnected: 'multiplayer:host:clientDisconnected',
                },
                /** @namespace Events.Multiplayer.Client */
                Client: {
                    /**
                     * Fired on the client when successfully connected to the host.
                     * @event Events.Multiplayer.Client.ConnectedToHost
                     * @type {object}
                     * @property {string} hostId - The PeerJS ID of the host.
                     */
                    ConnectedToHost: 'multiplayer:client:connectedToHost',
                     /**
                     * Fired on the client when disconnected from the host.
                     * @event Events.Multiplayer.Client.DisconnectedFromHost
                     * @type {object} - Payload might be empty or contain a reason.
                     */
                    DisconnectedFromHost: 'multiplayer:client:disconnectedFromHost',
                     /**
                     * Fired on the client when receiving initial game info from the host (before game start).
                     * @event Events.Multiplayer.Client.GameInfoReceived
                     * @type {object}
                     * @property {object} settings - Game settings chosen by the host.
                     * @property {Map<string, object>} players - Map of currently connected players (peerId -> playerData).
                     */
                    GameInfoReceived: 'multiplayer:client:gameInfoReceived',
                },
                /** @namespace Events.Multiplayer.Common */
                Common: {
                    /**
                     * Fired for all peers (host and clients) when a new player joins the session.
                     * @event Events.Multiplayer.Common.PlayerJoined
                     * @type {object}
                     * @property {string} peerId - The PeerJS ID of the player who joined.
                     * @property {object} playerData - Initial data for the joined player (e.g., name).
                     */
                    PlayerJoined: 'multiplayer:common:playerJoined',
                    /**
                     * Fired for all peers when a player leaves the session.
                     * @event Events.Multiplayer.Common.PlayerLeft
                     * @type {object}
                     * @property {string} peerId - The PeerJS ID of the player who left.
                     */
                    PlayerLeft: 'multiplayer:common:playerLeft',
                    /**
                     * Fired for all peers when a player's data (e.g., score, status) is updated.
                     * @event Events.Multiplayer.Common.PlayerUpdated
                     * @type {object}
                     * @property {string} peerId - The PeerJS ID of the player whose data changed.
                     * @property {object} updatedData - The specific fields that were updated.
                     */
                    PlayerUpdated: 'multiplayer:common:playerUpdated',
                     /**
                     * Fired when the overall list of players needs updating (e.g., after join/leave, or periodically).
                     * Often triggered by PlayerJoined/PlayerLeft handlers.
                     * @event Events.Multiplayer.Common.PlayerListUpdated
                     * @type {object}
                     * @property {Map<string, object>} players - The complete, current map of players (peerId -> playerData).
                     */
                    PlayerListUpdated: 'multiplayer:common:playerListUpdated',
                    /**
                     * Used for sending potentially large or complete game state snapshots for synchronization.
                     * @event Events.Multiplayer.Common.GameStateSync
                     * @type {object}
                     * @property {object} state - The full or partial game state object to sync.
                     */
                    GameStateSync: 'multiplayer:common:gameStateSync',
                },
            },
            /**
             * Events generated BY UI components interacting with the user.
             * @namespace Events.UI
             */
            UI: {
                /** @namespace Events.UI.MainMenu */
                MainMenu: {
                    /** Fired when the single player button is clicked. */
                    StartSinglePlayerClicked: 'ui:mainMenu:startSinglePlayerClicked',
                    /** Fired when the host multiplayer button is clicked. */
                    StartMultiplayerHostClicked: 'ui:mainMenu:startMultiplayerHostClicked',
                    /** Fired when the join multiplayer button is clicked. */
                    JoinMultiplayerClicked: 'ui:mainMenu:joinMultiplayerClicked',
                    /** Fired when the highscores button is clicked. */
                    HighscoresClicked: 'ui:mainMenu:highscoresClicked',
                    // ... other main menu actions
                },
                 /** @namespace Events.UI.GameArea */
                GameArea: {
                    /**
                     * Fired when the user submits an answer.
                     * @event Events.UI.GameArea.AnswerSubmitted
                     * @type {object}
                     * @property {any} answer - The answer selected/submitted by the user.
                     */
                    AnswerSubmitted: 'ui:gameArea:answerSubmitted',
                    /** Fired when the user clicks the button to leave the current game. */
                    LeaveGameClicked: 'ui:gameArea:leaveGameClicked',
                },
                 /** @namespace Events.UI.Dialog */
                Dialog: {
                    /**
                     * Fired when the user confirms their name in the name prompt dialog.
                     * @event Events.UI.Dialog.NameConfirmed
                     * @type {object}
                     * @property {string} name - The entered name.
                     */
                    NameConfirmed: 'ui:dialog:nameConfirmed',
                    /** Fired when the user confirms joining in the join confirmation dialog. */
                    JoinConfirmed: 'ui:dialog:joinConfirmed',
                     /**
                     * Fired when a generic confirmation dialog is accepted.
                     * @event Events.UI.Dialog.GenericConfirm
                     * @type {object}
                     * @property {string} dialogId - Identifier for the dialog being confirmed.
                     * @property {any} [value] - Optional value associated with the confirmation.
                     */
                    GenericConfirm: 'ui:dialog:genericConfirm',
                    /**
                     * Fired when a generic confirmation dialog is cancelled.
                     * @event Events.UI.Dialog.GenericCancel
                     * @type {object}
                     * @property {string} dialogId - Identifier for the dialog being cancelled.
                     */
                    GenericCancel: 'ui:dialog:genericCancel',
                },
                /** @namespace Events.UI.MultiplayerChoice */
                MultiplayerChoice: {
                    /**
                     * Fired when user chooses to host, after entering name/settings.
                     * @event Events.UI.MultiplayerChoice.HostClicked
                     * @type {object}
                     * @property {string} playerName - The host's chosen name.
                     * @property {object} settings - Selected game settings.
                     */
                    HostClicked: 'ui:mpChoice:hostClicked',
                    /**
                     * Fired when user chooses to join, after entering name.
                     * @event Events.UI.MultiplayerChoice.JoinClicked
                     * @type {object}
                     * @property {string} playerName - The joining player's chosen name.
                     */
                    JoinClicked: 'ui:mpChoice:joinClicked',
                },
                /** @namespace Events.UI.HostLobby */
                HostLobby: {
                    /** Fired when the host clicks the button to start the game. */
                    StartGameClicked: 'ui:hostLobby:startGameClicked',
                    /** Fired when the host cancels the lobby. */
                    CancelClicked: 'ui:hostLobby:cancelClicked',
                },
                /** @namespace Events.UI.JoinLobby */
                JoinLobby: {
                    /**
                     * Fired when the user submits the host connection code.
                     * @event Events.UI.JoinLobby.SubmitCodeClicked
                     * @type {object}
                     * @property {string} code - The submitted connection code.
                     */
                    SubmitCodeClicked: 'ui:joinLobby:submitCodeClicked',
                    /** Fired when the user confirms joining after seeing game info. */
                    ConfirmClicked: 'ui:joinLobby:confirmClicked',
                     /** Fired when the user cancels the joining process. */
                    CancelClicked: 'ui:joinLobby:cancelClicked',
                },
                 /** @namespace Events.UI.EndDialog */
                EndDialog: {
                    /** Fired when user clicks Return to Menu in an end-game dialog. */
                     ReturnToMenuClicked: 'ui:endDialog:returnToMenuClicked',
                     /** Fired when user clicks Play Again (if applicable) in an end-game dialog. */
                     PlayAgainClicked: 'ui:endDialog:playAgainClicked',
                },
                // ... other UI interaction events
            },
            /**
             * Events specific to the WebRTC communication layer.
             * @namespace Events.WebRTC
             */
            WebRTC: {
                 /**
                 * Fired when a data message is received from a peer.
                 * @event Events.WebRTC.MessageReceived
                 * @type {object}
                 * @property {object} msg - The parsed message data.
                 * @property {string} sender - The PeerJS ID of the sender.
                 */
                MessageReceived: 'webrtc:messageReceived',
                /**
                 * Fired when a PeerJS connection fails.
                 * @event Events.WebRTC.ConnectionFailed
                 * @type {object}
                 * @property {Error} error - The connection error object.
                 * @property {string} [peerId] - The ID of the peer connection that failed, if applicable.
                 */
                ConnectionFailed: 'webrtc:connectionFailed',
                /**
                 * Fired when a peer explicitly disconnects or the connection is lost.
                 * @event Events.WebRTC.PeerDisconnected
                 * @type {object}
                 * @property {string} peerId - The ID of the disconnected peer.
                 */
                PeerDisconnected: 'webrtc:peerDisconnected',
            },
             /**
             * Events related to specific menu sections like Highscores, Custom Questions.
             * @namespace Events.Menu
             */
            Menu: {
                 /** @namespace Events.Menu.Highscores */
                Highscores: {
                     /** Request to show the highscores view. */
                    Show: 'menu:highscores:show',
                     /**
                     * Fired when highscore data has been loaded.
                     * @event Events.Menu.Highscores.Loaded
                     * @type {object}
                     * @property {Array<object>} scores - The loaded highscore entries.
                     */
                    Loaded: 'menu:highscores:loaded',
                }
                // ... other menu sections
            },
            // Add more domains/actions as needed
        };
        // Original global approach: window.Events = Events;
        ```

    *   **UI Manager & Components:** Introduce a `UIManager` class responsible for initializing UI components and managing top-level view transitions.
        *   **`BaseComponent`:** A base class providing common functionality (e.g., reference to its root element, basic show/hide, event listener management).
        *   **`BaseDialog`:** A base class extending `BaseComponent` specifically for managing HTML `<dialog>` elements using `showModal()` and `close()`.

            ```javascript
            // Example: base-component.js
            import eventBus from './event-bus.js';
            import { Events } from './event-constants.js';

            const HIDDEN_CLASS = 'hidden'; // Define standard hidden class

            class BaseComponent {
                /**
                 * @param {string} elementSelector CSS selector for the component's root element.
                 * @param {string} [componentName] Optional identifier for the component, defaults to selector.
                 */
                constructor(elementSelector, componentName) {
                    this.selector = elementSelector;
                    this.name = componentName || elementSelector; // Identifier for events
                    this.rootElement = document.querySelector(this.selector);
                    this._listeners = []; // Stores { eventName, callback, handler } tuples
                    this.isVisible = false;


                    // Emit an initialized event after basic setup
                    eventBus.emit(Events.Component.Initialized, { component: this, componentName: this.name });
                    console.debug(`[BaseComponent] Initialized: ${this.name}`);
                }

                /** Shows the component's root element and emits Shown event. */
                show() {
                    if (this.rootElement && !this.isVisible) {
                        this.rootElement.classList.remove(HIDDEN_CLASS);
                        this.isVisible = true;
                        eventBus.emit(Events.Component.Shown, { component: this, componentName: this.name });
                        console.debug(`[BaseComponent] Shown: ${this.name}`);
                    }
                }

                /** Hides the component's root element and emits Hidden event. */
                hide() {
                    if (this.rootElement && this.isVisible) {
                        this.rootElement.classList.add(HIDDEN_CLASS);
                        this.isVisible = false;
                        eventBus.emit(Events.Component.Hidden, { component: this, componentName: this.name });
                        console.debug(`[BaseComponent] Hidden: ${this.name}`);
                    }
                }

                /**
                 * Registers a listener on the global event bus that will be automatically removed on destroy.
                 * @param {string} eventName The event name constant (e.g., Events.Game.Started).
                 * @param {Function} callback The function to call when the event is emitted.
                 */
                listen(eventName, callback) {
                    // Bind callback to maintain 'this' context if called from eventBus
                    const boundCallback = callback.bind(this);
                    this._listeners.push({ eventName, callback: boundCallback });
                    eventBus.on(eventName, boundCallback);
                }

                /** Removes all listeners registered via this.listen(). */
                cleanupListeners() {
                    console.debug(`[BaseComponent] Cleaning up ${this._listeners.length} listeners for: ${this.name}`);
                    this._listeners.forEach(({ eventName, callback }) => {
                        eventBus.off(eventName, callback);
                    });
                    this._listeners = []; // Clear the stored listeners
                }

                /** Emits Destroyed event, cleans up listeners, prepares for garbage collection. */
                destroy() {
                    console.debug(`[BaseComponent] Destroying: ${this.name}`);
                    // Emit destroyed event *before* removing listeners, in case others need to react
                    eventBus.emit(Events.Component.Destroyed, { component: this, componentName: this.name });
                    this.cleanupListeners();
                    // Optional: Remove element from DOM or perform other cleanup
                    // if (this.rootElement && this.rootElement.parentNode) {
                    //     this.rootElement.parentNode.removeChild(this.rootElement);
                    // }
                    this.rootElement = null; // Help garbage collection
                }
            }
            ```
        *   **Specialized Components (Examples):** Classes like `MainMenuComponent`, `PlayerListComponent`, `QuestionDisplayComponent` will extend `BaseComponent` to manage standard UI sections. Dialog classes like `NamePromptDialog`, `SinglePlayerEndDialog`, `MultiplayerEndDialog` will extend `BaseDialog` to manage modal dialogs. They will define their own HTML element selector, listen for specific application events, and update their respective DOM sections.
        *   **`UIManager`:** Instantiates the required components (both `BaseComponent` views and `BaseDialog` dialogs). It listens for high-level navigation events like `Events.Navigation.ShowView` to manage which VIEW components are active, hiding others. Dialogs are typically shown/hidden based on game state events (e.g., `Game.Finished`) or specific programmatic calls (e.g., `NamePromptDialog.prompt()`).
    *   **New UI Components (Replacing Old Controllers/Dialogs):** The following components will be created to handle specific UI sections and interactions:
        *   `MainMenuComponent` (extends `BaseComponent`): Manages `#mainMenu`.
        *   `SheetSelectionComponent` (extends `BaseComponent`): Manages `#sheetSelection`.
        *   `QuestionDisplayComponent` (extends `BaseComponent`): Manages `#question`.
        *   `AnswerListComponent` (extends `BaseComponent`): Manages `#answers`.
            *   **(Note:** Implementation added basic keyboard navigation (arrow keys/enter/space) for accessibility.)*
        *   `TimerDisplayComponent` (extends `BaseComponent`): Manages `#timer`.
        *   `ScoreDisplayComponent` (extends `BaseComponent`): Manages `#score` (SP) / `#playerScores` (MP placeholder).
        *   `ProgressDisplayComponent` (extends `BaseComponent`): Manages `#progressIndicator`.
            *   **(Note:** Implementation added updating a visual `<progress>` bar alongside text.)*
        *   `GameNavigationComponent` (extends `BaseComponent`): Manages `#gameNavigation`/`#stopGame`.
        *   `GameFeedbackComponent` (extends `BaseComponent`): Handles answer highlighting/confetti (on correct answer).
        *   `CountdownComponent` (extends `BaseComponent`): Manages `#countdownDisplay`.
        *   `MultiplayerChoiceComponent` (extends `BaseComponent`): Manages `#multiplayerChoice`.
        *   `HostLobbyComponent` (extends `BaseComponent`): Manages host waiting screen (`#connectionCode`), displays code/link, player count/names, copy/share buttons, handles start button click.
        *   `JoinLobbyComponent` (extends `BaseComponent`): Manages join screens (`#joinView`, `#fetchingInfoView`, `#joinConfirmView`, `#waitingForStartView`), handles code input/submit, displays game info, handles confirm/cancel clicks.
        *   `PlayerListComponent` (extends `BaseComponent`): Manages a dedicated player list display (e.g., `#playerListContainer`) shown in MP lobby and game area. Listens for `PlayerListUpdated`, `PlayerUpdated`. Shows player names, scores, finished status.
        *   `HighscoresComponent` (extends `BaseComponent`): Manages `#highscores`, listens for `Highscores.Loaded`, renders list, handles back button.
        *   `CustomQuestionsComponent` (extends `BaseComponent`): Manages `#customQuestionsManager`, emits save/delete events, handles back button.
        *   `AboutComponent` (extends `BaseComponent`): Manages `#about`, handles back button.
        *   `LoadingComponent` (extends `BaseComponent`): Manages `#loading`, listens for loading start/finish events.
        *   Dialog Components (extending `BaseDialog`):
            *   `NamePromptDialog`: Manages `#namePromptDialog`.
            *   `SinglePlayerEndDialog`: Manages `#endOfGameDialog`.
                *   **(Note:** Implementation added `Events.System.ShowFeedback` emission on empty name save attempt.)*
            *   `MultiplayerEndDialog`: Manages `#multiplayerEndDialog`.
            *   `PracticeEndDialog`: Manages `#practiceEndDialog`.
            *   `DisconnectionDialog`: Manages `#disconnectionDialog`.
            *   `ErrorDialog`: Manages `#errorDialog`.
        *   `ToastComponent` (extends `BaseComponent`): Manages `#toastNotification`.
        *   **Application Initialization (`UnicornPoep`):** A dedicated class or entry-point script (`UnicornPoep.js` or similar) responsible *only* for the initial setup:
            *   Instantiate core singleton services: `EventBus`, `UIManager`, `QuestionsManager`, `HighscoreManager`, `WebRTCManager` (and potentially others like a `ConfigurationLoader`).
            *   Initialize the `UIManager` (which internally creates its managed UI components and dialogs).
            *   Trigger the display of the initial view (e.g., `eventBus.emit(Events.Navigation.ShowView, { viewName: 'MainMenu' });`).
            *   **Crucially, it does *not* directly handle UI interaction events for starting games.** That logic belongs elsewhere (see Step 5).
            *   **Ensure the local `v2/js/lib/peerjs.min.js` is used.** Do not rely on external CDNs for PeerJS. Verify that `v2/index.html` correctly references this local file.
            *   **(Added Requirement):** The `v2/js/services/WebRTCManager.js` **MUST** implement robust heartbeat mechanisms (e.g., sending periodic pings) and timeout detection logic for client connections (on the host) and the host connection (on the client) to handle silent disconnections gracefully, similar to the functionality present in the V1 codebase.

    *   **Architectural Principle: Avoid Defensive Programming (Mandatory):**
        *   **Trust the Setup:** Components (especially those extending `BaseComponent` or `BaseDialog`) should trust that their `rootElement` exists after the superclass constructor runs. The `BaseComponent` constructor *must* throw an error if the root element cannot be found.
        *   **Child Element Validation:** When querying essential child elements within a component's constructor (e.g., buttons, input fields, display areas critical for functionality), the constructor *must* check if these elements were found. If any essential child element is missing, the constructor *must* `throw new Error(...)` immediately, clearly indicating the missing element(s) and the component that requires them. Do *not* use flags (like `isFunctional`) or return early to silently handle missing elements.
        *   **No Redundant Checks:** Subsequent methods within the component (e.g., event handlers, `show`, `hide`, `destroy`, `_removeEventListeners`) should *not* re-check for the existence of the root element or essential child elements whose presence was already verified (or guaranteed by throwing an error) in the constructor. Avoid unnecessary `if (this.element)` checks or optional chaining (`?.`) on elements confirmed during construction.
        *   **Exception: Event Payloads/External Data:** Defensive checks (like `payload?.property` or `typeof data === 'expectedType'`) *are* appropriate and necessary when handling data from external sources like event payloads or API responses, where the structure is not guaranteed at compile time.

    *   **Architectural Principle: UI Event Decoupling (Mandatory):**
        *   **UI Components** are responsible ONLY for capturing user interactions and emitting corresponding `Events.UI.*` events with the necessary payload.
        *   **Service Classes** (e.g., `QuestionsManager`, `HighscoreManager`, `WebRTCManager`, `QuizEngine`) should NEVER directly listen for `Events.UI.*` events.
        *   **Coordinator Services** (e.g., `GameCoordinator`, a potential `MenuCoordinator` or similar) are responsible for listening to relevant `Events.UI.*` events.
        *   Upon receiving a UI event, the **Coordinator** validates the request (if necessary), calls the appropriate method(s) on the relevant **Service Class(es)**, and then emits feedback events (`Events.System.ShowFeedback`, `Events.System.ErrorOccurred`) or domain-specific events (e.g., `Events.Menu.CustomQuestions.SaveSuccess`, `Events.Game.Started`) based on the outcome of the service call.
        *   This maintains a clear separation of concerns: UI signals intent, Coordinator orchestrates the action, Service performs the core logic/data manipulation.
        *   **Asset Management:** Ensure all necessary assets (CSS, JS libraries like `peerjs.min.js`, images, fonts) are correctly copied into the `v2` structure and placed in appropriate subdirectories (e.g., `v2/fonts/`, `v2/js/lib/`). Avoid copying unused V1 assets. **Verify that all required CSS from V1, including potentially separate files like `mobile.css`, is either integrated into `v2/css/styles.css` or copied to `v2/css/` and correctly referenced in `v2/index.html`.**

    *   **UI Pattern: Use `<template>` for Repeating Elements (Recommended):** When dynamically generating lists or other repeating structures within UI components (e.g., player lists, high score lists, custom sheet lists), prefer using the HTML `<template>` element. Define the structure of a single item within the `<template>` tag in your HTML file. In the component's JavaScript, query for the template, clone its `content` (`template.content.cloneNode(true)`), populate the clone with data, and then append the clone to the container. This is generally more performant and maintainable than numerous `document.createElement` calls.

    *   **Verification Against V1:** When implementing features or refactoring logic (especially UI structure, data handling, core game rules), **always attempt to verify assumptions and implementation details against the original V1 codebase (`/js`, `/css`, `index.html`) where applicable.** While the goal is improvement and decoupling, preserving existing *intended* functionality and structure (unless explicitly decided otherwise) is crucial. Use V1 as a reference to avoid accidentally dropping features or misinterpreting requirements during the refactor.

    *   **Progress Tracking:** Maintain a separate `refactor-progress.md` file in the workspace root. After completing significant steps or sections of the refactoring, update this file to reflect the current status, including which components/services have been refactored, adherence to the plan, and any deviations or pending items. This provides a clear overview of the refactoring progress.

5.  **Refactoring Steps:**

    *   **Step 0: Setup `v2` Directory:**
        *   Create the `v2/` subdirectory.
        *   Duplicate `index.html` to `v2/index.html`.
        *   Copy required asset folders (e.g., `css`, `js/lib`, `images`) into `v2/`. **Ensure all necessary V1 CSS files (including `mobile.css` if used) are copied or integrated.**
        *   Adjust all paths within `v2/index.html` and copied assets (CSS `url()`) to be relative to the `v2` directory. **Verify `v2/index.html` uses the local `js/lib/peerjs.min.js`.**
    *   **Step 1: Implement Core Infrastructure (within `v2/js/`):**
        *   Create `v2/js/core/event-bus.js` (singleton export), `v2/js/core/event-constants.js` (export `Events` with JSDoc payloads), `v2/js/components/base-component.js`.
        *   Create structure for services like `v2/js/services/QuizEngine.js`, `v2/js/services/QuestionsManager.js`, `v2/js/services/HighscoreManager.js`, `v2/js/services/WebRTCManager.js`, `v2/js/ui/UIManager.js`. Define interfaces/expected methods.
    *   **Step 2: Implement Application Initialization & Game Coordination (within `v2/js/`):**
        *   Create `v2/js/UnicornPoep.js` (or `v2/js/main.js` / `v2/js/app.js`) for core service instantiation and initial view trigger as described above.
        *   **Game Mode Instantiation & Coordination:** Introduce a dedicated `GameCoordinator.js` service responsible for coordinating the start of different game modes.
            *   The `GameCoordinator` listens for relevant UI events (e.g., `Events.UI.MainMenu.StartSinglePlayerClicked`, `Events.UI.MultiplayerChoice.HostClicked`, `Events.UI.JoinLobby.SubmitCodeClicked`). **It MUST NOT be handled by UI components or core game/data services directly.**
            *   Upon receiving such an event, it performs necessary validation and orchestrates interactions with other services (e.g., `WebRTCManager`, `QuestionsManager`).
            *   If valid, it instantiates the appropriate game mode class (`SinglePlayerGame`, `MultiplayerGame`, `PracticeGame`) or emits further events as needed.
            *   Handles the overall game start/setup flow triggered by user actions.
        *   **Menu Action Coordination (Mandatory):** Similarly, UI events related to non-game actions (like saving custom questions: `Events.UI.CustomQuestions.SaveClicked`, deleting sheets, loading high scores: `Events.Menu.Highscores.ShowRequested`) **MUST** be handled by a dedicated Coordinator (e.g., a new `MenuCoordinator` or potentially integrated into `UIManager` or the main `UnicornPoep` initializer if simple) rather than directly by the target service (`QuestionsManager`, `HighscoreManager`). This Coordinator will call the service methods and emit feedback/result events.
    *   **Step 3: Create Core UI Components:**
        *   Refactor `MainMenu` into `MainMenuComponent.js` extending `BaseComponent`. Implement its UI event emissions (`Events.UI.MainMenu.*`).
        *   Create other essential UI components (`PlayerListComponent`, `QuestionDisplayComponent`, `ScoreboardComponent`, Dialog components like `NamePromptComponent`, `EndGameComponent`, etc.) extending `BaseComponent`, managed by `UIManager`.
        *   Implement basic view switching in `UIManager` listening to `Events.Navigation.ShowView`.
    *   **Step 4: Implement `QuizEngine` & Game Mode Classes:**
        *   Flesh out `QuizEngine.js` with core quiz logic (question loading/serving, answer checking).
        *   Create and implement the structure for `SinglePlayerGame.js`, `PracticeGame.js`, `MultiplayerGame.js`. They should instantiate `QuizEngine`, listen for relevant UI events (like `AnswerSubmitted`), interact with `QuizEngine`, manage mode-specific elements (timers, WebRTC via its manager), and emit `Events.Game.Finished`.
        *   **Refinement Note:** If significant duplication arises between `SinglePlayerGame.js` and `PracticeGame.js` (or other future modes), consider introducing a `BaseGameMode.js` class to contain common game flow logic (start, nextQuestion, finish, basic event handling), keeping `QuizEngine` focused solely on quiz mechanics (question data, answer checking, progress). The specific game mode classes would then extend `BaseGameMode` and implement mode-specific features (timers, scoring, networking).
    *   **Step 5: Refactor Event Producers:**
        *   Modify remaining classes (`WebRTCManager`, `Timer`, dialog components, input handlers) and the Game Mode classes to `emit`
    *   **Step 6: Refactor Remaining UI Controllers/Logic:**
    *   **Step 7: Integration & Testing:**
    *   **Step 8: Cleanup & Documentation:**