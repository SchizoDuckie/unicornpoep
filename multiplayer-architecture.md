# Multiplayer Architecture Plan (Host-as-Server Model)

## 1. Introduction

This document outlines the plan for refactoring the Unicorn Poep multiplayer functionality to use a **Host-as-Server** architecture via WebRTC (PeerJS). The primary goal is to create a robust foundation for multiplayer gameplay, supporting features like synchronized start/end, pre-game information, waiting states, and chat, while centralizing game logic on the host.

**Core Principles:**

*   **Host Authority:** The player initiating the game (Host) acts as the central authority, managing the definitive game state and connections.
*   **Client Simplicity:** Client instances connect only to the host, send their actions, and react to state updates broadcast by the host.
*   **Synchronized Experience:** Game events like starting, ending, and player progress are synchronized across all participants via the host.
*   **Enhanced User Experience:** Provide clearer pre-game information, a waiting lobby/state, and in-game chat.

*(Assumption: This plan ignores potential performance bottlenecks related to browser limitations or host bandwidth when scaling to a very large number of players, focusing purely on the logical architecture.)*

## 2. Core Architecture: Host-as-Server Topology

*   **Initialization:** The Host player starts a game, generating a unique PeerJS ID.
*   **Connection:** All Client players use the Host's PeerJS ID to establish a direct WebRTC data connection *only* to the Host. Clients do **not** connect to each other.
*   **Data Flow:**
    *   Clients send messages (actions, chat, state changes) exclusively to the Host.
    *   The Host receives messages from all Clients, processes them, updates the authoritative game state, and broadcasts necessary updates or events back to all connected Clients (or specific clients as needed).

```javascript
/* Conceptual Diagram

  Client A ---> Host <--- Client B
      ^           |           ^
      |           V           |
      +-----------+-----------+
                  |
                  V
  Client C ---> Host <--- Client D
      ^           |           ^
      |           V           |
      +-----------+-----------+

  (All arrows represent PeerJS Data Connections)
*/
```

## 3. Component Responsibilities

*   **`Game.js` (Base Class):**
    *   Manages the core **single-player** game logic: loading questions, tracking progress (`currentQuestionIndex`), score calculation (local), timer management (local), checking answers, displaying questions/answers via `GameAreaController`.
    *   Handles navigation between main menu, game area, high scores, about, custom questions (via respective controllers) for single-player mode.
    *   Knows nothing about multiplayer state, WebRTC, or message handling.

*   **`MultiplayerGame.js` (Wrapper/Orchestrator):**
    *   *Contains* an instance of the base `Game` class (`this.coreGame`) to handle non-networked game mechanics.
    *   Manages multiplayer-specific state: `isHost`, `players` Map, `gamePhase`.
    *   Manages the `WebRTCManager` instance.
    *   Implements methods for hosting (`startMultiplayerHost`) and joining (`requestToJoin`, `confirmJoin`, `cancelJoin`).
    *   Implements the central `handleMultiplayerMessage` method, processing messages using `MessageTypes` constants.
    *   Handles multiplayer game flow: lobby, countdown, synchronized start/end, waiting states.
    *   Processes player actions (answers, finishes) received via network messages.
    *   Orchestrates UI updates via controllers based on multiplayer state (e.g., calls `gameAreaController.updateOpponentDisplay` with `this.players`).
    *   Delegates display of questions/answers to `this.coreGame.displayCurrentQuestion()` but controls *when* it happens based on network state.

*   **`WebRTCManager.js`:**
    *   Abstracts PeerJS interactions (Host/Client roles).
    *   Uses `MessageTypes` constants when sending/logging messages.
    *   Communicates received messages back to the `MultiplayerGame` instance's `handleMultiplayerMessage`.

*   **`MultiplayerController.js`:**
    *   Manages pre-game UI: Host/Join choice, player name input.
    *   Displays Host code and sharing options (Copy, WhatsApp).
    *   Handles Join code input and submission.
    *   Displays connection status during setup ("Fetching game info...", "Connecting...", "Waiting for confirmation...").
    *   Displays the **Join Confirmation Screen** (showing `gameInfo` received from the host) with "Join" / "Cancel" options.
    *   Interacts with the active `MultiplayerGame` instance (instead of `Game`) to trigger hosting/joining actions.

*   **`GameAreaController.js`:**
    *   Manages the main gameplay UI elements.
    *   Displays current question, answer options (potentially disabled/enabled by host state).
    *   Displays local player score and list/scores of all connected opponents.
    *   Displays game timer (potentially synchronized/controlled by host).
    *   Manages and displays the **Countdown Overlay**.
    *   Manages and displays the **Waiting State UI** (hiding game elements, showing "Waiting for others...", activating chat input/display).
    *   Displays received chat messages.
    *   Receives updates from either `Game` (single-player) or `MultiplayerGame` (multiplayer) instance (e.g., `updateOpponentDisplay` called by `MultiplayerGame`).
    *   Forwards user actions (answer selection, next button) to the *active* game instance (`Game` or `MultiplayerGame`).

*   **`DialogController.js`:**
    *   Manages modal dialogs.
    *   Displays the **Multiplayer Final Results Dialog**, showing a list of all players, their scores, and highlighting the winner. Triggered by `MultiplayerGame`.
    *   Displays error/disconnect dialogs (e.g., "Host disconnected").

## 4. Message Types (`MessageTypes` Constants)

*   **Connection/Setup:**
    *   `C_REQUEST_JOIN { playerName }`
    *   `H_GAME_INFO { hostName, sheetNames, difficulty, playerCount }`
    *   `H_GAME_IN_PROGRESS`
    *   `H_JOIN_REJECTED { reason }`
    *   `C_CONFIRM_JOIN { playerName }`
    *   `H_WELCOME { assignedPeerId, playerList }`
    *   `H_PLAYER_JOINED { playerInfo: { peerId, playerName, score, isFinished } }`
    *   `C_DISCONNECTING` (Optional)
    *   `H_PLAYER_DISCONNECTED { peerId }`

*   **Game Flow:**
    *   `H_START_COUNTDOWN { duration }`
    *   `H_START_GAME { initialGameState }` (Optional: Or rely on state update after countdown)
    *   `C_SUBMIT_ANSWER { questionIndex, answer }`
    *   `H_GAME_STATE_UPDATE { state: { currentQuestionIndex, players: [{peerId, playerName, score, isFinished}, ...], gamePhase? } }`
    *   `C_PLAYER_FINISHED { finalScore }`
    *   `H_FINAL_RESULTS { resultsList: [{peerId, playerName, score, rank}, ...], winnerName }`

*   **Chat:**
    *   `C_CHAT_MESSAGE { text }`
    *   `H_CHAT_MESSAGE { senderPeerId, senderName, text }`

## 5. Detailed Flows

*(Flows remain conceptually the same, but interactions now involve `MultiplayerGame` coordinating with `WebRTCManager`, Controllers, and its internal `coreGame` instance where appropriate. Message types now use constants.)*

*(Example: Gameplay Loop)*
*   User interacts (MP Client) -> `GameAreaController` calls `currentGame.handleAnswerSelection(answer)` (`currentGame` is `MultiplayerGame` instance) -> `MultiplayerGame` sends `MessageTypes.C_SUBMIT_ANSWER` via `WebRTCManager`.
*   Host `WebRTCManager` receives message -> `MultiplayerGame.handleMultiplayerMessage` processes `MessageTypes.C_SUBMIT_ANSWER` -> `MultiplayerGame.handleClientAnswer` -> `MultiplayerGame.processAnswerLocally` (updates `this.players`) -> `MultiplayerGame.broadcastGameState`.
*   Client `WebRTCManager` receives message -> `MultiplayerGame.handleMultiplayerMessage` processes `MessageTypes.H_GAME_STATE_UPDATE` -> `MultiplayerGame.handleGameStateUpdate` updates `this.players` -> Calls `GameAreaController.updateOpponentDisplay(this.players)`.

## 6. Data Structures (`MultiplayerGame` State - Conceptual)

```javascript
this.isHost = false;
this.players = new Map(); // Key: peerId, Value: { playerName: string, score: number, isFinished: boolean }
this.gamePhase = 'idle'; // etc.
this.localPlayerFinished = false;
this.webRTCManager = new WebRTCManager(this); // Passes self (MultiplayerGame)
this.coreGame = new Game(...); // Internal instance for core logic/state
// Game settings like selectedSheets, difficulty stored here or in coreGame? Likely here.
this.selectedSheets = [];
this.difficulty = '';
this.currentQuestionIndex = 0; // MP needs to track this for sync
```

## 7. Conclusion

This refactored architecture separates single-player (`Game`) and multiplayer (`MultiplayerGame`) logic using composition. `MultiplayerGame` orchestrates the network interactions and multiplayer state, delegating core game mechanics to the base `Game` class when needed. Using `MessageTypes` constants improves code clarity and maintainability. 