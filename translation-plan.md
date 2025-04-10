# Translation Refactoring Plan: Moving Strings to HTML

**Goal:** Make the Unicorn Poep application easily translatable by moving all user-facing text strings from the JavaScript codebase into the primary HTML file (`v2/index.html`). This allows for translation by simply creating and translating copies of the HTML file (e.g., `index_en.html`, `index_de.html`). JavaScript's role will shift from generating text to manipulating the visibility and content of pre-existing HTML elements containing the text.

**Rationale:**

*   **Simplified Translation Workflow:** Translators only need to work with HTML files, requiring no JavaScript knowledge.
*   **Separation of Concerns:** Keeps presentation (HTML/CSS/Text) separate from logic (JavaScript).
*   **Maintainability:** Changes to wording or adding languages primarily involve editing HTML.

**Strategy:**

1.  **Identify String Sources:** Systematically review all JavaScript files within the `v2/js/` directory, particularly components (`v2/js/components/`, `v2/js/dialogs/`), services that might generate user feedback (`v2/js/services/`), and the main application coordinator (`v2/js/UnicornPoep.js`). Look for any hardcoded string literals used for:
    *   Button text (`textContent`, `innerText`)
    *   Labels (`textContent`, `innerText`)
    *   Titles and Headings (`textContent`, `innerText`)
    *   Placeholders (`placeholder` attribute)
    *   Status messages, error messages, help text (`textContent`, `innerText`)
    *   Dialog content (`textContent`, `innerText`)
    *   Toast messages (Text should ideally originate from triggering code/event, not component itself)
    *   Confirmation prompts (`confirm()`, `alert()`) - ***MUST be replaced with custom dialogs***.
    *   Dynamic text templates (e.g., "Score: {score}", "Vraag {current} / {total}")

2.  **Migrate Strings to HTML:**
    *   For each identified string, locate or create the corresponding HTML element(s) in `v2/index.html`.
    *   Place the base string directly within the element (e.g., `<button id="startGame">Start!</button>`).
    *   For elements showing different text based on state (e.g., a status display):
        *   **Prefer using multiple, specific elements with descriptive IDs/classes.** One is visible by default, others have `class="hidden"`. JS simply toggles the `hidden` class on the appropriate elements. Example: `<p><span id="status-loading">Laden...</span><span id="status-connected" class="hidden">Verbonden!</span></p>`.
        *   Use `data-*` attributes only if multiple text variations are needed for the *exact same* element instance and toggling elements is impractical.
    *   For dynamic text (scores, names, progress), use nested `<span>` elements with specific classes/IDs for the dynamic parts within the static text structure. Example:
        ```html
        <!-- HTML -->
        <div id="scoreDisplay"><span class="score-label">Score: </span><span class="score-value">0</span></div>
        <span id="progressText"><span class="progress-label">Vraag</span> <span class="current-q">0</span> / <span class="total-q">0</span></span>
        ```
        ```javascript
        // JS
        scoreElement.querySelector('.score-value').textContent = newScore;
        progressElement.querySelector('.current-q').textContent = current;
        progressElement.querySelector('.total-q').textContent = total;
        // Note: The static parts ("Score:", "Vraag", "/") remain untouched in the HTML.
        ```

3.  **Refactor JavaScript:**
    *   Modify the JavaScript code to *select* the relevant HTML elements (including the static text parts if needed for context, but primarily the dynamic value spans or state-specific elements).
    *   Update JS logic to set `textContent`/`innerText` only on the *dynamic parts* (e.g., `.score-value`), or toggle the `hidden` class on the *state-specific elements*.
    *   Remove the hardcoded strings from the JavaScript files.
    *   **Replace any native `alert()` or `confirm()` calls with custom dialog components that read their text from the HTML.** This is mandatory.

4.  **Verification:**
    *   Thoroughly test the application after refactoring each component/section to ensure all text displays correctly in all states and languages (once translated).
    *   Check that dynamic content is correctly injected without affecting static text.

**REVISED TODO List (Based on File Verification):**

Review and refactor the following files, moving UI strings to `v2/index.html` and replacing `alert/confirm`:

*   **Components (`v2/js/components/`)**
    *   `countdown-component.js`: `'Go!'` end message.
    *   `custom-questions-component.js`: Validation messages (`Geef...`, `Voer...`), list state messages (`Nog geen...`, `Fout bij laden...`), toast message (`Kon...`), **`confirm()` call**. (**High Priority due to `confirm`**)
    *   `highscores-component.js`: Error messages (`Kon scores niet laden.`, `Fout: `), empty state message (`Nog geen...`).
    *   `host-lobby-component.js`: Loading states (`Laden...`), WhatsApp text (`Doe mee...`), player count text (`speler`/`spelers`), waiting text structure (`Wachten op...`), init message (`Host initialiseren...`), feedback messages (`Code gekopieerd!`, `Kopiëren mislukt`, `Link gekopieerd!`).
    *   `join-lobby-component.js`: Welcome message structure (`Hoi ...! Voer...`), fallback names (`Player`, `Unknown`), info labels (`Host:`, `Sheets:`, `Difficulty:`, `Players:`), fallbacks (`Default`, `Medium`), error prefix (`Kon niet verbinden: `), validation messages (`Voer een geldige...`, `Vul alsjeblieft...`, `Naam mag...`).
    *   `loading-component.js`: Default message handling (`Laden...`).
    *   `multiplayer-choice-component.js`: Validation messages (`Vul alsjeblieft...`, `Naam mag...`).
    *   `player-list-component.js`: Default name (`Unnamed Player`), tag text (`(Host)`, `(You)`).
    *   `progress-display-component.js`: Base text (`Vraag`).
    *   `score-display-component.js`: Base text (`Score: `).
    *   `sheet-selection-component.js`: List state messages (`Geen vragenlijsten...`, `Fout bij laden...`).
*   **Dialogs (`v2/js/dialogs/`)**
    *   `disconnection-dialog.js`: Default message (`De andere...`).
    *   `error-dialog.js`: Default message (`Er is een...`).
    *   `multiplayer-end-dialog.js`: Fallback name (`Unknown`), error message (`Kon resultaten...`), empty state (`Geen spelers...`).
    *   `single-player-end-dialog.js`: Feedback message (`Vul een naam...`), error text (`Fout!`).
*   **Services (`v2/js/services/`)**
    *   `HighscoreManager.js`: Feedback messages (`Could not save...`, `Error loading...`), default name (`Player`), error message (`Could not load...`).
    *   `MultiplayerClientManager.js`: Feedback message (`Disconnected...`).
    *   `QuestionsManager.js`: Default name (`Naamloos`), error message (`Kon...`), **`confirm()` call**. (**High Priority due to `confirm`**)
    *   `QuizEngine.js`: Loading message (`Vragen laden...`), error message (`Failed to load...`).
    *   `WebRTCManager.js`: Default name (`Anon`), fallback name generation (`Client_...`), error message (`PeerJS library...`).
*   **UI (`v2/js/ui/`)**
    *   `UIManager.js`: Error message (`UI Error: View...`).
*   **Main App (`v2/js/UnicornPoep.js`)**
    *   Feedback messages (`Vragenlijst '${name}' opgeslagen.`, `Fout bij opslaan...`, etc.).
    *   Error messages (`Onbekende fout...`, `An unexpected error...`, etc.).
    *   Critical init error HTML (`Application Initialization Failed`, etc.).
*   **Utils (`v2/js/utils/`)**
    *   `easter-egg-activator.js`: Feedback message (`🦄💩 Easter Egg Activated!...`).
*   **Game (`v2/js/game/`)**
    *   `BaseGameMode.js`: Default name (`Player`), error messages (`No questions loaded...`, `Error starting...`).
    *   `MultiplayerGame.js`: Error messages (`No questions loaded...`, `Host error starting game...`, `Host error: Could not retrieve...`).

**Files Confirmed OK (No translatable strings or alert/confirm):**

*   `v2/js/components/about-component.js`
*   `v2/js/components/answer-list-component.js`
*   `v2/js/components/base-component.js`
*   `v2/js/components/game-area-component.js`
*   `v2/js/components/game-feedback-component.js`
*   `v2/js/components/game-navigation-component.js`
*   `v2/js/components/main-menu-component.js`
*   `v2/js/components/question-display-component.js`
*   `v2/js/components/timer-display-component.js`
*   `v2/js/components/toast-component.js`
*   `v2/js/core/event-bus.js`
*   `v2/js/core/event-constants.js`
*   `v2/js/core/timer.js`
*   `v2/js/dialogs/base-dialog.js`
*   `v2/js/dialogs/name-prompt-dialog.js`
*   `v2/js/dialogs/practice-end-dialog.js`
*   `v2/js/game/PracticeGame.js`
*   `v2/js/game/SinglePlayerGame.js`
*   `v2/js/services/GameCoordinator.js` (Needs verification - assumed OK for now)
*   `v2/js/ui/AnswerListComponent.js`
*   `v2/js/utils/arrayUtils.js`
*   `v2/js/utils/miscUtils.js`

**Next Steps:**

1.  Verify `GameCoordinator.js`.
2.  Prioritize fixing the files with `confirm()` calls (`QuestionsManager.js`, `custom-questions-component.js`).
3.  Systematically refactor the files in the TODO list.

**Update Related Plans:**

*   Add a note in `refactor-plan.md` mentioning the translation goal and linking to this plan. (Done)
*   Add a section or task in `refactor-progress.md` to track the progress of this translation refactoring effort across the listed files. (Done, needs update with refined list) 