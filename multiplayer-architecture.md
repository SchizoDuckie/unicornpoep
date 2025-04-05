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

*   **`Game.js` (Host Role):**
    *   Acts as the central game orchestrator and state authority.
    *   Initializes the PeerJS peer as a host.
    *   Manages a list of connected players (`players = Map<peerId, {playerName, score, isFinished, ...}>`).
    *   Handles client connection requests (`requestJoin`), confirmations (`confirmJoin`), and disconnections.
    *   Receives and processes action messages from clients (`submitAnswer`, `chatMessage`, `playerFinished`).
    *   Manages the master game loop/state (current question, timer sync - if applicable).
    *   Determines game start (after countdown trigger) and game end (when all players are finished).
    *   Calculates final results.
    *   Broadcasts game state updates, events (`playerJoined`, `startCountdown`, `startGame`, `gameStateUpdate`, `playerFinishedUpdate`, `finalResults`, `chatMessage`, `playerDisconnected`), and specific messages to clients via `WebRTCManager`.

*   **`Game.js` (Client Role):**
    *   Initiates connection to the Host via PeerJS ID.
    *   Sends join requests and confirmations (`requestJoin`, `confirmJoin`).
    *   Sends player actions (`submitAnswer`, `chatMessage`, `playerFinished`) to the Host.
    *   Receives and reacts to messages/commands from the Host (`gameInfo`, `gameInProgress`, `playerJoined`, `startCountdown`, `startGame`, `gameStateUpdate`, `playerFinishedUpdate`, `finalResults`, `chatMessage`, `playerDisconnected`).
    *   Updates local state and UI based *only* on data received from the Host. Contains minimal game logic, primarily rendering and input handling directed towards the host.

*   **`WebRTCManager.js`:**
    *   Abstracts PeerJS interactions.
    *   **Host:** Initializes PeerJS peer, listens for incoming connections (`peer.on('connection')`), handles connection lifecycle events (`open`, `data`, `close`, `error`) for each client, stores active connections (`Map<peerId, DataConnection>`), provides methods to `broadcast(message)` to all connections and `sendTo(peerId, message)`.
    *   **Client:** Initializes PeerJS peer, initiates connection to host (`peer.connect(hostId)`), handles connection lifecycle events (`open`, `data`, `close`, `error`) for the single host connection, provides method `send(message)` to the host.
    *   Handles message serialization/deserialization (e.g., JSON).

*   **`MultiplayerController.js`:**
    *   Manages pre-game UI: Host/Join choice, player name input.
    *   Displays Host code and sharing options (Copy, WhatsApp).
    *   Handles Join code input and submission.
    *   Displays connection status during setup ("Fetching game info...", "Connecting...", "Waiting for confirmation...").
    *   Displays the **Join Confirmation Screen** (showing `gameInfo` received from the host) with "Join" / "Cancel" options.
    *   Interacts with `Game.js` to initiate `startMultiplayerHost`, `requestToJoin`, `confirmJoin`, `cancelJoin`. Handles UI updates based on feedback from `Game.js` during this phase (e.g., show errors like "Game in Progress").

*   **`GameAreaController.js`:**
    *   Manages the main gameplay UI elements.
    *   Displays current question, answer options (potentially disabled/enabled by host state).
    *   Displays local player score and list/scores of all connected opponents.
    *   Displays game timer (potentially synchronized/controlled by host).
    *   Manages and displays the **Countdown Overlay**.
    *   Manages and displays the **Waiting State UI** (hiding game elements, showing "Waiting for others...", activating chat input/display).
    *   Displays received chat messages.
    *   Handles user input for answers and chat messages, passing them to `Game.js`.
    *   Updates all UI elements based on `gameStateUpdate` messages received via `Game.js`.

*   **`DialogController.js`:**
    *   Manages modal dialogs.
    *   Displays the **Multiplayer Final Results Dialog**, showing a list of all players, their scores, and highlighting the winner. Triggered by `Game.js` upon receiving/calculating `finalResults`.
    *   Displays error/disconnect dialogs (e.g., "Host disconnected").

## 4. Message Types (Conceptual)

*(Messages prefixed with `c_` are Client->Host, `h_` are Host->Client)*

*   **Connection/Setup:**
    *   `c_requestJoin { playerName }`: Client asks host if they can join.
    *   `h_gameInfo { hostName, sheetNames, difficulty, playerCount }`: Host sends game details to requesting client.
    *   `h_gameInProgress`: Host tells client game has already started.
    *   `h_joinRejected { reason }`: Host denies join (e.g., "lobby full" if limit implemented).
    *   `c_confirmJoin`: Client confirms they want to join after seeing `h_gameInfo`.
    *   `h_welcome { assignedPeerId, playerList }`: Host confirms join, sends initial player list.
    *   `h_playerJoined { peerId, playerName }`: Host informs *all* clients someone new joined.
    *   `c_disconnecting`: Client informs host they are leaving (graceful disconnect).
    *   `h_playerDisconnected { peerId }`: Host informs *all* clients someone left.

*   **Game Flow:**
    *   `h_startCountdown { duration }`: Host tells all clients to start the visual countdown.
    *   `h_startGame { initialGameState }`: Host signals game start, sends initial question/state.
    *   `c_submitAnswer { questionId, answer }`: Client sends their answer.
    *   `h_gameStateUpdate { timestamp, currentPlayerScores, currentQuestion?, gamePhase, ... }`: Host broadcasts current state to all clients. (Sent periodically or after key events).
    *   `c_playerFinished { finalScore }`: Client informs host they have completed all questions or timed out.
    *   `h_playerFinishedUpdate { peerId, finalScore }`: Host informs all clients that a specific player has finished.
    *   `h_finalResults { resultsList: [{peerId, playerName, score, rank}, ...], winnerName }`: Host sends final ranked results to all clients.

*   **Chat:**
    *   `c_chatMessage { text }`: Client sends a chat message.
    *   `h_chatMessage { senderPeerId, senderName, text }`: Host relays chat message to all clients.

## 5. Detailed Flows

*(Simplified sequences focusing on interactions)*

1.  **Hosting:**
    *   User clicks Host -> `MultiplayerController` gets name, calls `Game.startMultiplayerHost` -> `Game` init -> `WebRTCManager.initializeHost` -> `WebRTCManager` gets PeerID -> `Game` stores ID -> `MultiplayerController.showHostScreen(peerId)`.

2.  **Joining & Confirmation:**
    *   User enters code, clicks Join -> `MultiplayerController.submitCode` -> `Game.requestToJoin(hostId)` -> `WebRTCManager.connectToHost(hostId)` -> On 'open': `WebRTCManager.send(c_requestJoin)`.
    *   Host: `WebRTCManager` receives `c_requestJoin` -> `Game.handleJoinRequest` -> If game not started: `WebRTCManager.sendTo(clientId, h_gameInfo)`. If started: `sendTo(clientId, h_gameInProgress)`, close connection.
    *   Client: `WebRTCManager` receives `h_gameInfo` -> `Game.handleGameInfo` -> `MultiplayerController.showJoinConfirmation(gameInfo)`. If `h_gameInProgress`: `Game.handleJoinRejected` -> `MultiplayerController.showError("Game in progress")`.
    *   User clicks "Confirm Join" -> `MultiplayerController` calls `Game.confirmJoin` -> `WebRTCManager.send(c_confirmJoin)`.
    *   Host: `WebRTCManager` receives `c_confirmJoin` -> `Game.finalizePlayerJoin(clientId, clientName)` -> Add player to list -> `WebRTCManager.broadcast(h_playerJoined)` -> `WebRTCManager.sendTo(newClientId, h_welcome)`.
    *   Client: `WebRTCManager` receives `h_welcome` or `h_playerJoined` -> `Game.updatePlayerList` -> `GameAreaController.updateOpponentDisplay`.

3.  **Starting Game:**
    *   Host clicks "Start Game" -> `GameAreaController` calls `Game.requestStartGame` (Host only).
    *   Host `Game`: `WebRTCManager.broadcast(h_startCountdown)`.
    *   All `Game` instances: receive `h_startCountdown` -> `GameAreaController.startCountdownDisplay(duration, onComplete)`.
    *   Countdown `onComplete`: Host `Game` -> sends `h_startGame` / initial `h_gameStateUpdate`. Client `Game` -> waits for `h_startGame` / `h_gameStateUpdate`. -> All `Game` -> `GameAreaController.displayQuestion`.

4.  **Gameplay Loop:**
    *   Client interacts -> `GameAreaController` calls `Game.submitAnswer` -> `WebRTCManager.send(c_submitAnswer)`.
    *   Host `Game` receives `c_submitAnswer` -> Process answer, update score for that client -> `WebRTCManager.broadcast(h_gameStateUpdate)` (contains updated scores for all).
    *   Client `Game` receives `h_gameStateUpdate` -> Update local state -> `GameAreaController.updateUI` (scores, progress etc.).

5.  **Finishing & Game End:**
    *   Player finishes (questions done / timer out) -> `GameAreaController` calls `Game.localPlayerFinished`.
    *   `Game.localPlayerFinished`: Set local `isFinished=true` -> `GameAreaController.showWaitingUI()` -> If Client: `WebRTCManager.send(c_playerFinished)`. If Host: `handlePlayerFinishedLocally()`.
    *   Host `Game`: Receives `c_playerFinished` or `handlePlayerFinishedLocally()` -> Update player status `isFinished=true`, store final score -> `WebRTCManager.broadcast(h_playerFinishedUpdate)`.
    *   Host `Game`: Check if `all players.isFinished === true`. If yes: `calculateFinalResults()` -> `WebRTCManager.broadcast(h_finalResults)` -> `handleFinalResultsLocally()`.
    *   All `Game` instances: Receive `h_playerFinishedUpdate` -> Update UI status for that player (`GameAreaController`). Receive `h_finalResults` -> `GameAreaController.hideWaitingUI()` -> `DialogController.showMultiplayerEndDialog(results)` -> `HighscoresManager.addScore(winner)`.

6.  **Chat:**
    *   User types message, presses Enter -> `GameAreaController` calls `Game.sendChatMessage(text)`.
    *   Client `Game`: `WebRTCManager.send(c_chatMessage)`.
    *   Host `Game`: Receives `c_chatMessage` -> `WebRTCManager.broadcast(h_chatMessage)` (with sender info).
    *   All `Game` instances: Receive `h_chatMessage` -> `GameAreaController.displayChatMessage(senderName, text)`.

7.  **Disconnect:**
    *   `WebRTCManager` detects `close` or `error` event for a connection.
    *   Host `WebRTCManager`: Notify `Game.handleDisconnect(peerId)` -> `Game` removes player -> `WebRTCManager.broadcast(h_playerDisconnected)`.
    *   Client `WebRTCManager`: If host connection lost -> Notify `Game.handleHostDisconnect` -> `DialogController.showError("Host disconnected")`.
    *   Client `Game`: Receives `h_playerDisconnected` -> Remove player from UI (`GameAreaController`).

## 6. Data Structures (Host `Game` State - Conceptual)

```javascript
this.players = new Map(); // Key: peerId, Value: { playerName: string, score: number, isFinished: boolean, connection: DataConnection }
this.gameSettings = { sheetKeys: [], difficulty: '' };
this.questions = [];
this.currentQuestionIndex = 0;
this.gamePhase = 'lobby' | 'countdown' | 'playing' | 'waiting' | 'results'; // Controls overall flow
this.isHost = true;
this.peerId = null; // Host's own PeerJS ID
```

## 7. Conclusion

This Host-as-Server architecture provides a clear structure for managing the multiplayer game flow. It centralizes authority and state management on the host, simplifying client logic. By defining clear message types and component responsibilities, this plan serves as a blueprint for implementing the desired robust and feature-rich multiplayer experience, abstracting away the underlying connection management within `WebRTCManager`. 