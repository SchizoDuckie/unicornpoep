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
            // ... Full event definitions are in the actual event-constants.js file ...
            // This is just a placeholder example in the plan.
        };
        ```
        // NOTE: The extensive example event definition previously shown here has been removed 
        //       as it duplicates the actual implementation in v2/js/core/event-constants.js. 
        //       Refer to that file for the definitive list and payload definitions.

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
        *   **`UIManager`:** Instantiates the required components (both `BaseComponent` views and `BaseDialog` dialogs). It listens for high-level navigation events like `Events.Navigation.ShowView` to manage which VIEW components are active, hiding others. Dialogs are typically shown/hidden based on game state events (e.g., `Game.Finished`) or specific programmatic calls (e.g., `NamePromptDialog.prompt()`). It also handles initial URL parsing (hash and join parameters) to determine the starting view or action.
            *   **Hash Handling (Mandatory):** The `UIManager` is **solely responsible** for:
                *   Reading the initial `window.location.hash` during application startup (`checkInitialHash` method).
                *   Mapping the hash (or lack thereof) to the correct initial view.
                *   If an invalid code is found, it cleans the parameter from the URL and proceeds to check the hash.
                *   The main application initializer (`UnicornPoep.js`) **MUST NOT** read or interpret the initial hash or join parameter; it should only initialize the `UIManager` and let it handle the initial view determination.
                *   **Initialization Flow Update:** The initializer should instantiate core services like `UIManager`. Then, the `UIManager`'s `checkInitialHash` method (called from its constructor or the DOMContentLoaded listener) handles determining the initial action:
                    *   If `?join={valid_code}` is present, emit `Events.System.ValidJoinCodeDetected` and stop.
                    *   Otherwise, determine the view based on the URL hash (or default to MainMenu) and emit `Events.Navigation.ShowView`.
                *   The initializer should **not** attempt to read the hash/param or emit the first `ShowView`/`ValidJoinCodeDetected` event itself.
            *   **Ensure the local `v2/js/lib/peerjs.min.js` is used.** Do not rely on external CDNs for PeerJS. Verify that `v2/index.html` correctly references this local file.
            *   **(Added Requirement):** The `v2/js/services/WebRTCManager.js` **MUST** implement robust heartbeat mechanisms (e.g., sending periodic pings) and timeout detection logic for client connections (on the host) and the host connection (on the client) to handle silent disconnections gracefully, similar to the functionality present in the V1 codebase. It emits `Events.Multiplayer.Host.ClientDisconnected` or `Events.Multiplayer.Client.DisconnectedFromHost` upon detected timeouts or explicit disconnects.
            *   **(Updated Requirement):** The `v2/js/services/WebRTCManager.js` **MUST** initialize the host PeerJS connection using a randomly generated 6-digit numeric code as the Peer ID, instead of relying on the PeerServer to assign a GUID. Clients will connect using this 6-digit code. The `Events.Multiplayer.Host.Initialized` event payload must reflect this, containing `{ hostId: '123456', hostPeerId: '123456' }`.
            *   **(Added Requirement):** Multiplayer game setup communication (`game_info`) **MUST** include the full question data (`questionsData`) instead of just `sheetIds`. The `questionsData` structure should be `{ sheets: Array<{ id: string, name: string, isCustom: boolean, questions: Array<{question: string, answer: string}> }> }`. Difficulty should also be passed separately.
            *   **(Added Requirement):** The client **MUST** attempt to save any received custom sheets (identified by `isCustom: true` within the `questionsData`) to its local storage using `QuestionsManager`. Collision detection is mandatory: if a custom sheet with the same ID already exists locally, it **MUST NOT** be overwritten. The original host's player name **MUST** be stored alongside the saved custom sheet data (e.g., as `originHostName`).
            *   **(Clarification):** `WebRTCManager` updates its internal player list upon client connection/disconnection and receipt of `c_requestJoin` messages containing player names. It then emits `Events.Multiplayer.Common.PlayerListUpdated` with the complete player map. UI components like `HostLobbyComponent` or `PlayerListComponent` listen for this event to update their displays, rather than querying `WebRTCManager` directly.

    *   **Multiplayer Game Flow (Asynchronous Model) (IMPORTANT CLARIFICATION):**
        *   **Initiation:** The host initiates the game start, distributing the necessary game data (including all questions) to clients.
        *   **Independent Progression:** Once started, each client proceeds through the questions independently and at their own pace. There is no round-by-round synchronization enforced by the host after the initial start.
        *   **Individual Scoring:** Client scores are determined based on their individual performance, including the speed at which they answer questions.
        *   **Early Finishers:** A client that completes all questions before others will signal their completion to the host. The client's UI **MUST** then transition to display the specific waiting dialog: `#waitingDialog`, showing the message "Je bent klaar! We wachten op de andere spelers".
        *   **Final Synchronization:** The host tracks the completion status of all clients. Only when *all* clients have signaled completion does the host aggregate the final results and trigger the display of the final scores/results dialog: `#multiplayerEndDialog` for all participants. The `#waitingDialog` (if shown) should be hidden when the `#multiplayerEndDialog` is displayed.
        *   **QuizEngine Singleton Usage:** This asynchronous model relies on the singleton `QuizEngine` instance. The host MUST load the questions into the singleton *before* signaling game start. Clients use the singleton instance primarily to retrieve shuffled answers (`getShuffledAnswers`) and check correctness (`checkAnswer`), always providing their *local* `currentQuestionIndex` to these methods. Clients manage their own `currentQuestionIndex` state to track their independent progress through the quiz data held by the singleton.

    *   **Architectural Principle: Avoid Defensive Programming (Mandatory):**
        *   **Trust the Setup:** Components (especially those extending `BaseComponent` or `BaseDialog`) should trust that their `rootElement` exists after the superclass constructor runs. The `BaseComponent` constructor *must* throw an error if the root element cannot be found.
        *   **Child Element Validation:** When querying essential child elements within a component's constructor (e.g., buttons, input fields, display areas critical for functionality), the constructor *must* check if these elements were found. If any essential child element is missing, the constructor *must* `throw new Error(...)` immediately, clearly indicating the missing element(s) and the component that requires them. Do *not* use flags (like `isFunctional`) or return early to silently handle missing elements.
        *   **No Redundant Checks:** Subsequent methods within the component (e.g., event handlers, `show`, `hide`, `destroy`, `_removeEventListeners`) should *not* re-check for the existence of the root element or essential child elements whose presence was already verified (or guaranteed by throwing an error) in the constructor. Avoid unnecessary `if (this.element)` checks or optional chaining (`.`) on elements confirmed during construction.
        *   **Exception: Event Payloads/External Data:** Defensive checks (like `payload.property` or `typeof data === 'expectedType'`) *are* appropriate and necessary when handling data from external sources like event payloads or API responses, where the structure is not guaranteed at compile time.

    *   **Architectural Principle: UI Event Decoupling (Mandatory):**
        *   **UI Components** are responsible ONLY for capturing user interactions and emitting corresponding `Events.UI.*` events with the necessary payload.
        *   **Service Classes** (e.g., `QuestionsManager`, `HighscoreManager`, `WebRTCManager`, `QuizEngine`) should NEVER directly listen for `Events.UI.*` events.
        *   **Coordinator Services** (e.g., `GameCoordinator`, a potential `MenuCoordinator` or similar) are responsible for listening to relevant `Events.UI.*` events.
        *   Upon receiving a UI event, the **Coordinator** validates the request (if necessary), calls the appropriate method(s) on the relevant **Service Class(es)**, and then emits feedback events (`Events.System.ShowFeedback`, `Events.System.ErrorOccurred`) or domain-specific events (e.g., `Events.Menu.CustomQuestions.SaveSuccess`, `Events.Game.Started`) based on the outcome of the service call.
        *   This maintains a clear separation of concerns: UI signals intent, Coordinator orchestrates the action, Service performs the core logic/data manipulation.
        *   **Asset Management:** Ensure all necessary assets (CSS, JS libraries like `peerjs.min.js`, images, fonts) are correctly copied into the `v2` structure and placed in appropriate subdirectories (e.g., `v2/fonts/`, `v2/js/lib/`). Avoid copying unused V1 assets. **Verify that all required CSS from V1, including potentially separate files like `mobile.css`, is either integrated into `v2/css/styles.css` or copied to `v2/css/` and correctly referenced in `v2/index.html`.**

    *   **UI Pattern: Use `<template>` for Repeating Elements (Recommended):** When dynamically generating lists or other repeating structures within UI components (e.g., player lists, high score lists, custom sheet lists), prefer using the HTML `<template>` element. Define the structure of a single item within the `<template>` tag in your HTML file. In the component's JavaScript, query for the template, clone its `content` (`template.content.cloneNode(true)`), populate the clone with data, and then append the clone to the container. This is generally more performant and maintainable than numerous `document.createElement` calls.

    *   **Verification Against V1:** When implementing features or refactoring logic (especially UI structure, data handling, core game rules), **always attempt to verify assumptions and implementation details against the original V1 codebase (`/js`, `/css`, `index.html`) where applicable.** While the goal is improvement and decoupling, preserving existing *intended* functionality and structure (unless explicitly decided otherwise) is crucial. Use V1 as a reference to avoid accidentally dropping features or misinterpreting requirements during the refactor.

    *   **Progress Tracking:** Maintain a separate `refactor-progress.md` to track this refactor. Update it after any changes.

5.  **Future Enhancements / Considerations**

    *   **Early Game End Optimization:** Consider allowing the host to end the game early if, after the host finishes, the maximum potential score achievable by any remaining *unfinished* client is insufficient to surpass the current highest score.
    *   **Host-Side Answer Validation:** To prevent cheating, the host could validate every answer submitted by clients (via a potential new message type like `CLIENT_SUBMIT_ANSWER`) against the official question list and answers before applying score changes or acknowledging completion.