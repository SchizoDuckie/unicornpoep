/**
 * @file Manages the state, logic, and flow for a MULTIPLAYER game session.
 * Orchestrates WebRTC communication and synchronizes game state across players
 * using a Host-as-Server model.
 * Adapts core game mechanics for the multiplayer context.
 */

// Assume MessageTypes is loaded globally from messagetypes.js
// const MessageTypes = { ... };

class MultiplayerGame {
    /**
     * Initializes a new MultiplayerGame instance.
     * @param {boolean} isHost - Whether this instance is hosting or joining.
     * @param {MainMenu} mainMenu - The central orchestrator instance.
     */
    constructor(isHost = false, mainMenu) {
        console.log(`MP: Initializing MultiplayerGame (isHost: ${isHost}) - Accessing via MainMenu.`);
        if (!mainMenu) {
             throw new Error("MultiplayerGame requires a MainMenu instance!");
        }
        this.mainMenu = mainMenu;
        this.isHost = isHost;
        this.isMultiplayer = true;
        this.wasMultiplayer = true; // Flag for high scores differentiation

        // --- State ---
        /** @type {Map<string, { peerId: string, playerName: string, score: number, isFinished: boolean }>} */
        this.players = new Map(); // Key: peerId, Value: player info object
        this.gamePhase = 'idle'; // 'idle', 'lobby', 'connecting', 'joining', 'countdown', 'playing', 'waiting', 'results'
        this.localPlayerFinished = false;
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || 'MP Player';
        this.selectedSheets = [];
        this.difficulty = null;
        this.currentQuestionIndex = 0;
        this.currentQuestions = [];
        this.timer = null; // Will be ScoreTimer instance
        this._countdownInterval = null;

        // --- Access Managers & Controllers via Hub ---
        // this.questionsManager = this.mainMenuController.questionsManager; (Example)

        // --- Internal Manager ---
        this.webRTCManager = new WebRTCManager(this); // Manages WebRTC, passes THIS instance

        // Validate essential dependencies are available via the hub
        if (!this.mainMenu?.questionsManager || !this.mainMenu?.gameAreaController || !this.mainMenu?.multiplayerController || !this.mainMenu?.dialogController || !this.mainMenu?.loadingController) {
            console.error("MP Game: Essential managers/controllers not found via MainMenu!");
        }
    }

    /**
     * Loads the player name from localStorage. Called externally before starting MP interactions.
     */
    loadPlayerName() {
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || `Player${Math.floor(Math.random() * 1000)}`;
        console.log("MP: Loaded player name:", this.playerName);
    }

    /**
     * Loads questions for the multiplayer game using QuestionsManager.
     * Does NOT shuffle here; shuffling happens after loading in startMultiplayerHost.
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If questions cannot be loaded for the selected sheets.
     */
    async loadQuestionsForMultiplayer() {
        console.log("MP Game: Calling loadQuestionsForMultiplayer...");
        if (!this.mainMenu?.questionsManager) {
            throw new Error("MP Game: QuestionsManager not available via mainMenu.");
        }
        if (!this.selectedSheets || this.selectedSheets.length === 0) {
            throw new Error("MP Game: No sheets selected to load questions from.");
        }

        try {
            // *** Use the new consolidated method in QuestionsManager ***
            this.currentQuestions = await this.mainMenu.questionsManager.getQuestionsForSheets(this.selectedSheets);

            console.log(`MP Game: Successfully loaded ${this.currentQuestions.length} total questions via QuestionsManager.`);
            // NOTE: Shuffling is done separately in startMultiplayerHost after this method succeeds.

        } catch (error) {
            console.error("MP Game: Error loading questions via QuestionsManager:", error);
            this.mainMenu.dialogController?.showError(`Fout bij laden vragen: ${error.message}`);
            this.currentQuestions = []; // Ensure state is clean on error
            throw error; // Re-throw to be caught by startMultiplayerHost
        }
    }

    /** Shuffles the `currentQuestions` array in place. */
    shuffleQuestions() {
        // Ensure we are shuffling the correct array
        if (this.currentQuestions && this.currentQuestions.length > 0) {
            this.shuffleArray(this.currentQuestions);
            console.log("MP Game: Shuffled questions.");
        } else {
             console.warn("MP Game: Attempted to shuffle an empty questions array.");
        }
    }

    // --- Hosting / Joining ---

    /**
     * Starts the process of hosting a multiplayer game.
     * Loads questions, initializes WebRTC host, and updates UI.
     * @param {string[]} sheetKeys - The selected sheet keys.
     * @param {string} difficulty - The selected difficulty.
     * @async
     */
    async startMultiplayerHost(sheetKeys, difficulty) {
        console.log(`MP: Starting host. Sheets: ${sheetKeys}, Difficulty: ${difficulty}`);
        this.resetMultiplayerState();
        this.isHost = true;
        this.gamePhase = 'lobby';
        this.selectedSheets = sheetKeys;
        this.difficulty = difficulty;

        this.mainMenu.loadingController?.show("Hosting starten...");

        try {
            await this.loadQuestionsForMultiplayer();
            this.shuffleQuestions(); // Shuffle once for the whole game

            const hostPeerId = await this.webRTCManager.initializeHost();
            console.log("MP: WebRTC Host Initialized, Peer ID:", hostPeerId);

            // Add host to the player list using their own peerId
            this.players.set(hostPeerId, {
                peerId: hostPeerId,
                playerName: this.playerName,
                score: 0,
                isFinished: false
            });

            this.mainMenu.loadingController?.hide();
            this.mainMenu.multiplayerController?.showHostScreen(hostPeerId); // Show code, waiting message
            // Do not show game area yet

        } catch (error) {
            this.mainMenu.loadingController?.hide();
            console.error("MP: Failed to initialize host:", error);
            this.handleFatalError(`Host init error: ${error.message || 'Unknown'}`);
            // Consider navigating back to main menu or showing error dialog
            this.mainMenu?.showView('mainMenu'); // Example fallback
        }
    }

    /**
     * Initiates a request to join a multiplayer game via Host ID.
     * @param {string} hostId - The 6-digit PeerJS ID of the host.
     * @async
     */
    async requestToJoin(hostId) {
        console.log(`MP: Attempting to join host: ${hostId}`);
        this.resetMultiplayerState();
        this.isHost = false;
        this.gamePhase = 'connecting';
        this.mainMenu.multiplayerController?.showFetchingGameInfo(); // Update UI

        try {
            await this.webRTCManager.initializeClient(hostId);
            // Connection is established, waiting for host confirmation/game info
            console.log("MP: Client initialized, connection established. Waiting for Game Info.");
            // onHostConnected and message handling will take over
        } catch (error) {
            console.error("MP: Failed to initialize client or connect:", error);
            this.mainMenu.multiplayerController?.showJoinError(error.message || "Kon niet verbinden.", true);
            this.gamePhase = 'idle'; // Reset phase on connection failure
        }
    }

    /**
     * Called by WebRTCManager when the connection to the host is successfully opened.
     * Sends the initial join request to the host.
     */
    onHostConnected() {
        console.log("MP Client: Connection to host established. Sending join request.");
        // Phase remains 'connecting' until game info is received
        this.webRTCManager?.send({
            type: MessageTypes.C_REQUEST_JOIN,
            playerName: this.playerName
        });
    }

    /**
     * Called when the client clicks "Join" on the confirmation screen.
     * Sends confirmation to the host.
     */
    confirmJoin() {
        if (!this.isHost && this.webRTCManager?.isActive() && this.gamePhase === 'joining') {
            console.log("MP Client: Sending join confirmation.");
            this.webRTCManager?.send({
                type: MessageTypes.C_CONFIRM_JOIN,
                playerName: this.playerName
            });
            this.gamePhase = 'lobby'; // Move to lobby state, waiting for host to start
            this.mainMenu.multiplayerController?.showWaitingForGameStart();
        } else {
            console.warn("MP: ConfirmJoin called in invalid state:", this.gamePhase);
        }
    }

    /**
     * Called when the client cancels the join attempt (e.g., from confirmation screen).
     */
    cancelJoin() {
        if (!this.isHost) {
            console.log("MP Client: Cancelling join / Disconnecting.");
            this.webRTCManager?.cleanup();
            this.gamePhase = 'idle';
            // Navigate back via the central controller
            this.mainMenu?.showView('mainMenu');
        }
    }

    // --- Message Handling ---

    /**
     * Central message handler called by WebRTCManager when data is received.
     * Routes messages to specific handler methods based on type.
     * @param {object} message - The received data object.
     * @param {string} senderId - The PeerJS ID of the sender.
     */
    handleMultiplayerMessage(message, senderId) {
        if (!message || !message.type) {
            console.warn("MP: Received invalid message structure:", message);
            return;
        }
        console.log(`MP Route: Received '${message.type}' from ${senderId}. IsHost: ${this.isHost}`);

        // --- Host-specific handlers ---
        if (this.isHost) {
        switch (message.type) {
            case MessageTypes.C_REQUEST_JOIN:
                    this.handleJoinRequest(senderId, message.playerName);
                break;
                case MessageTypes.C_CONFIRM_JOIN:
                    this.finalizePlayerJoin(senderId, message.playerName);
                    break;
                case MessageTypes.C_SUBMIT_ANSWER:
                    this.handleClientAnswer(senderId, message.questionIndex, message.answer);
                    break;
                case MessageTypes.C_PLAYER_FINISHED:
                    this.handleClientFinished(senderId, message.finalScore);
                    break;
                case MessageTypes.C_CHAT_MESSAGE:
                    // Placeholder: Handle chat message forwarding
                    console.log(`Chat from ${senderId}: ${message.text}`);
                    this.broadcastChatMessage(senderId, this.players.get(senderId)?.playerName || 'Unknown', message.text);
                    break;
                case MessageTypes.C_UPDATE_NAME:
                    this.handleClientNameUpdate(senderId, message.newName);
                    break;
                default:
                    console.warn(`MP Host: Received unexpected message type from client ${senderId}: ${message.type}`);
            }
        }
        // --- Client-specific handlers ---
        else {
            switch (message.type) {
            case MessageTypes.H_GAME_INFO:
                    this.handleGameInfo(message);
                break;
            case MessageTypes.H_GAME_IN_PROGRESS:
                    this.handleJoinRejected("Spel is al bezig.");
                break;
            case MessageTypes.H_JOIN_REJECTED:
                    this.handleJoinRejected(message.reason);
                break;
            case MessageTypes.H_WELCOME:
                    this.handleWelcome(message);
                break;
            case MessageTypes.H_PLAYER_JOINED:
                    // Add player unless it's the local player joining confirmation
                    if(message.playerInfo.peerId !== this.webRTCManager?.peerId) {
                       this.updatePlayerListAdd(message.playerInfo);
                    }
                break;
            case MessageTypes.H_PLAYER_DISCONNECTED:
                    this.handlePlayerDisconnect(message.peerId); // Handles UI update
                break;
            case MessageTypes.H_START_COUNTDOWN:
                    this.handleStartCountdown(message.duration);
                 break;
                case MessageTypes.H_START_GAME:
                    // Optional: Could be used, but currently starting after countdown locally
                    // this.startGameLocally();
                break;
            case MessageTypes.H_GAME_STATE_UPDATE:
                    console.log(`MP Route Client: Routing H_GAME_STATE_UPDATE to handleGameStateUpdate.`);
                    this.handleGameStateUpdate(message.state);
                 break;
            case MessageTypes.H_FINAL_RESULTS:
                 this.handleFinalResults(message);
                 break;
                case MessageTypes.H_CHAT_MESSAGE:
                    // Placeholder: Display chat message in UI
                    console.log(`Chat from ${message.senderName}: ${message.text}`);
                    this.mainMenu.gameAreaController?.displayChatMessage(message.senderName, message.text);
                    break;
            default:
                    console.warn(`MP Client: Received unexpected message type from host: ${message.type}`);
            }
        }
    }

    // --- Join Flow Handlers ---

    /**
     * HOST: Handles a join request from a client. Sends back game info or rejection.
     * @param {string} clientId - The PeerJS ID of the requesting client.
     * @param {string} clientName - The name provided by the client.
     */
    handleJoinRequest(clientId, clientName) {
        console.log(`MP Host: Handling join request from ${clientName} (${clientId})`);
        if (this.gamePhase !== 'lobby') {
            console.warn(`MP Host: Rejecting ${clientId}, game not in lobby phase (current: ${this.gamePhase}).`);
            this.webRTCManager.sendTo(clientId, { type: MessageTypes.H_GAME_IN_PROGRESS });
            return;
        }
        // Add potential checks: max players, etc.

        const gameInfo = {
            type: MessageTypes.H_GAME_INFO,
            hostName: this.playerName,
            // Access questionsManager via hub
            sheetKeys: this.selectedSheets, // Send the array of keys/names
            difficulty: this.difficulty,
            playerCount: this.players.size // Current player count (including host)
        };
        console.log("MP Host: Sending game info to", clientId, gameInfo);
        this.webRTCManager.sendTo(clientId, gameInfo);
    }

    /**
     * CLIENT: Handles receiving game information from the host.
     * Stores info, loads questions, and updates UI to show confirmation screen.
     * @param {object} gameInfo - The game info object received from the host.
     */
    async handleGameInfo(gameInfo) {
        console.log("MP Client: Received game info:", gameInfo);
        if (this.gamePhase === 'connecting') {
            // Store game details needed later
            // Note: sheetNames from host might be formatted, need keys if using readSheet
            // Assuming H_GAME_INFO sends the original keys or names QuestionsManager understands
            this.selectedSheets = gameInfo.sheetKeys || []; // Expecting sheetKeys now
            this.difficulty = gameInfo.difficulty;

            // *** FIX: Load questions based on received info BEFORE showing confirmation ***
            try {
                console.log("MP Client: Loading questions for received sheets:", this.selectedSheets);
                // Use the same loading logic as host, but access via mainMenu
                 const allQuestionsPromises = this.selectedSheets.map(sheetName =>
                    this.mainMenu.questionsManager.readSheet(sheetName)
                 );
                 const questionsPerSheet = await Promise.all(allQuestionsPromises);
                 this.currentQuestions = questionsPerSheet.flat(); // Store questions locally
                 this.shuffleQuestions(); // Shuffle locally for client variety if desired? Or rely on host index? Let's shuffle.
                 console.log(`MP Client: Loaded and shuffled ${this.currentQuestions.length} questions.`);

                 if (!this.currentQuestions || this.currentQuestions.length === 0) {
                     throw new Error("Geen vragen gevonden voor dit spel.");
                 }

                // Now show confirmation screen
                this.gamePhase = 'joining';
            this.mainMenu.multiplayerController?.showJoinConfirmationScreen(gameInfo);

            } catch (error) {
                 console.error("MP Client: Failed to load questions based on game info:", error);
                 this.handleFatalError(`Kon spelvragen niet laden: ${error.message}`);
                 // Ensure connection cleanup on error
                 this.webRTCManager?.cleanup();
                 this.gamePhase = 'idle';
            }

        } else {
             console.warn("MP Client: Received game info in unexpected phase:", this.gamePhase);
        }
    }

    /**
     * CLIENT: Handles rejection from the host. Shows error message and cleans up.
     * @param {string} reason - The reason for rejection.
     */
    handleJoinRejected(reason) {
        console.warn(`MP Client: Join rejected. Reason: ${reason}`);
        this.mainMenu.multiplayerController?.showJoinError(reason, true); // Show error and back button
        this.webRTCManager?.cleanup();
        this.gamePhase = 'idle';
    }

    /**
     * HOST: Finalizes adding a client after they confirm joining. Sends welcome message and updates others.
     * @param {string} clientId - The PeerJS ID of the joining client.
     * @param {string} clientName - The name of the joining client.
     */
    finalizePlayerJoin(clientId, clientName) {
        if (this.gamePhase !== 'lobby') {
            console.warn(`MP Host: Cannot finalize join for ${clientId}, game not in lobby phase.`);
            // Maybe send a rejection here?
            return;
        }
        if (this.players.has(clientId)) {
             console.warn(`MP Host: Player ${clientId} already in the list.`);
             return; // Avoid duplicate adds
        }

        console.log(`MP Host: Finalizing join for ${clientName} (${clientId})`);
        const newPlayerInfo = {
            peerId: clientId,
            playerName: clientName || `Player${Math.floor(Math.random() * 1000)}`,
            score: 0,
            isFinished: false
        };
        this.players.set(clientId, newPlayerInfo);

        // 1. Send Welcome message to the new client with the CURRENT player list
        const playerList = Array.from(this.players.values());
        this.webRTCManager.sendTo(clientId, {
            type: MessageTypes.H_WELCOME,
            assignedPeerId: clientId, // Confirm their ID
            playerList: playerList
        });

        // 2. Notify ALL OTHER connected clients about the new player
        this.webRTCManager.broadcast({
            type: MessageTypes.H_PLAYER_JOINED,
            playerInfo: newPlayerInfo
        }, [clientId]); // Exclude the new client itself

        // 3. Update Host UI (e.g., player count)
        this.mainMenu.multiplayerController?.updateLobbyPlayerCount(this.players.size);
        this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId); // Update host's game area if visible
         console.log("MP Host: Player list updated:", Array.from(this.players.values()));
    }

    /**
     * CLIENT: Handles the welcome message from the host. Populates the initial player list.
     * @param {object} welcomeMessage - The welcome message data.
     */
    handleWelcome(welcomeMessage) {
        console.log("MP Client: Received Welcome from host.", welcomeMessage);
        if (this.gamePhase === 'lobby') { // Should be in lobby after confirming join
            this.players.clear(); // Clear any potential stale data
            welcomeMessage.playerList.forEach(pInfo => {
                 this.players.set(pInfo.peerId, pInfo)
             });
            console.log("MP Client: Player list initialized:", Array.from(this.players.values()));
            // UI already shows "Waiting for game start" from confirmJoin()
            this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId); // Update game area if visible
        } else {
             console.warn("MP Client: Received welcome message in unexpected phase:", this.gamePhase);
        }
    }

    /**
     * HOST: Handles an answer submitted by a client.
     * Processes it and broadcasts state. Does NOT check round completion.
     */
    handleClientAnswer(clientId, questionIndex, answer) {
        if (!this.isHost) return;
        console.log(`MP Host: Received answer submission from ${clientId} for Q${questionIndex}.`);
        this.processAnswerLocally(clientId, questionIndex, answer, false, null);
        this.broadcastGameState(); // Broadcast state update (score changes etc.)
    }

    /**
     * CLIENT: Handles the notification that another player has joined. Adds them to the local list.
     * @param {object} playerInfo - The info object for the player who joined.
     */
    updatePlayerListAdd(playerInfo) {
         if (!this.players.has(playerInfo.peerId)) {
             console.log(`MP Client: Player ${playerInfo.playerName} (${playerInfo.peerId}) joined.`);
             this.players.set(playerInfo.peerId, playerInfo);
             this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);
              // Update lobby count if client UI shows it
             this.mainMenu.multiplayerController?.updateLobbyPlayerCount(this.players.size);
         }
    }

    // --- Disconnect Handlers ---

    /**
     * Called by WebRTCManager when a peer disconnects (client for host, host for client).
     * @param {string} peerId - The ID of the disconnected peer.
     * @param {Error} [error] - Optional error object if disconnection was due to an error.
     */
    handleDisconnect(peerId, error) {
        console.log(`MP: Handling disconnect for peer: ${peerId}`, error ? `Error: ${error.message}` : '');

        if (this.isHost) {
            if (this.players.has(peerId)) {
                const disconnectedPlayerName = this.players.get(peerId).playerName;
                console.log(`MP Host: Client ${disconnectedPlayerName} (${peerId}) disconnected.`);
                this.players.delete(peerId);
                this.webRTCManager.broadcast({ type: MessageTypes.H_PLAYER_DISCONNECTED, peerId: peerId });
                this.mainMenu.multiplayerController?.updateLobbyPlayerCount(this.players.size);
                this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);

                // *** Re-check game state after disconnect ***
                 if (this.gamePhase === 'playing') {
                    console.log("MP Host: Player disconnected during 'playing' phase. Re-checking game end.");
                    this.checkMultiplayerEnd(); // Check if remaining players are all finished
                 } else if (this.players.size === 0) {
                     // If host is alone now (e.g., last client left lobby/countdown)
                     console.log("MP Host: Last client disconnected. Game cannot proceed alone.");
                     // Maybe go back to menu or wait? For now, let's stop.
                     this.handleFatalError("Laatste speler heeft de verbinding verbroken.");
                 }

            } else {
                console.warn(`MP Host: Received disconnect for unknown peer ID: ${peerId}`);
            }
        } else {
            // Client only connects to host. If host disconnects, game is over.
            if (peerId === this.webRTCManager?.hostId) {
                this.handleHostDisconnect("Host heeft de verbinding verbroken.");
            } else {
                 console.warn(`MP Client: Received disconnect for unexpected peer ID: ${peerId}`);
            }
        }
    }

     /**
      * CLIENT: Handles the notification that a player (could be self if kicked?) has disconnected.
      */
     handlePlayerDisconnect(peerId) {
         if (this.players.has(peerId)) {
             const disconnectedPlayerName = this.players.get(peerId).playerName;
             console.log(`MP Client: Player ${disconnectedPlayerName} (${peerId}) disconnected.`);
             this.players.delete(peerId);
             this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);
             // Optional: Show toast message "Player X left" using injected instance
             this.mainMenu.toastNotification?.show(`${disconnectedPlayerName} heeft het spel verlaten.`);
              // Update lobby count if client UI shows it
             this.mainMenu.multiplayerController?.updateLobbyPlayerCount(this.players.size);
         }
     }


    /**
     * CLIENT: Handles the host disconnecting. Shows a dialog and cleans up.
     */
    handleHostDisconnect(reason) {
        console.error("MP Client: Host disconnected.");
        if (this.gamePhase !== 'idle' && this.gamePhase !== 'results') {
             this.mainMenu.dialogController?.showDisconnectionDialog(reason);
             this.cleanup(); // Clean up WebRTC connection and state
             this.gamePhase = 'idle';
        } else {
            // If already idle or in results, just ensure cleanup
            this.cleanup();
        }
    }

    /**
     * Handles a fatal error, cleans up, and shows an error message.
     * @param {string} errorMessage - The error message to display.
     */
    handleFatalError(errorMessage) {
        console.error("MP: Fatal Error:", errorMessage);
        this.cleanup(); // Clean up connections and state

        // This was causing the error: No showErrorDialog method exists.
        // this.mainMenu.dialogController?.showErrorDialog(errorMessage);
        // Correct: Call the specific method on DialogController meant for showing errors.
        this.mainMenu.dialogController?.showError(errorMessage); // Show error

        // Navigate back via the central controller - Moved this after showing the error
        // so the user actually sees the message before navigation might hide it.
        // Consider if cleanup() should navigate or if it should happen here.
        // cleanup() currently calls showView, so this might be redundant or cause issues.
        // Let's keep the navigation within cleanup() for consistency for now.
        // this.mainMenu?.showView('mainMenu');
    }

    // --- Countdown/Start ---

    /**
     * HOST: Initiates the game start sequence by starting a countdown.
     * Called when the host clicks the 'Start Spel!' button in the lobby dialog.
     */
    requestStartGame() {
        if (!this.isHost || this.gamePhase !== 'lobby') {
            console.warn("MP: Start game request denied. Not host or not in lobby.");
            return;
        }
        if (this.players.size < 1) {
             console.warn("MP Host: Cannot start game with no players.");
             return;
         }

        console.log("MP Host: Requesting game start. Hiding dialog and navigating.");
        // *** FIX: Hide dialog BEFORE navigating ***
        this.mainMenu.multiplayerController?.hideConnectionDialog();
        // Navigate to the game area view
        this.mainMenu.showView('gameArea');

        // Proceed with countdown logic
        this.gamePhase = 'countdown';
        const countdownDuration = 5;
        this.webRTCManager.broadcast({ type: MessageTypes.H_START_COUNTDOWN, duration: countdownDuration });
        this.handleStartCountdown(countdownDuration); // Start countdown locally for host
    }

    /**
     * HOST/CLIENT: Handles the start countdown message. Shows countdown UI.
     * @param {number} duration - Countdown duration in seconds.
     */
    handleStartCountdown(duration) {
        if (this.gamePhase !== 'lobby' && this.gamePhase !== 'countdown') { // Allow re-entry into countdown state if needed
            console.warn(`MP: Received start countdown in unexpected phase: ${this.gamePhase}`);
            return;
        }
        this.gamePhase = 'countdown';
        console.log(`MP: Starting countdown (${duration}s)`);

        if (!this.isHost) {
            this.mainMenu.showView('gameArea');
            this.mainMenu.multiplayerController?.hideConnectionDialog();
        }

        // Prepare Game Area UI (hide elements, show countdown overlay)
        this.mainMenu.gameAreaController?.hideAnswers();
        this.mainMenu.gameAreaController?.hideQuestion();
        this.mainMenu.gameAreaController?.hideTimer();
        this.mainMenu.gameAreaController?.hideNextButton();
        this.mainMenu.gameAreaController?.hideWaitingUi();
        this.mainMenu.gameAreaController?.showCountdownOverlay();
        this.mainMenu.gameAreaController?.showOpponentList();
        this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);

        let remaining = duration;
        this.mainMenu.gameAreaController?.updateCountdown(remaining);
        clearInterval(this._countdownInterval);
        this._countdownInterval = setInterval(() => {
            remaining--;
            this.mainMenu.gameAreaController?.updateCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(this._countdownInterval);
                this.mainMenu.gameAreaController?.hideCountdownOverlay();
                // *** FIX: Only HOST calls startGameLocally here ***
                if (this.isHost) {
                    this.startGameLocally();
                }
                 // Client waits for the first game state update message
            }
        }, 1000);
    }

    /**
     * HOST/CLIENT: Starts the actual game logic locally after countdown finishes.
     * Initializes timer, resets scores, displays first question, and shows the main game UI.
     */
    startGameLocally() {
        console.log(`MP: Starting game locally (Phase: ${this.gamePhase}). Questions loaded: ${this.currentQuestions?.length}`);
        // Ensure this only runs if countdown completed properly
        if (this.gamePhase !== 'countdown') {
             console.warn(`MP: startGameLocally called in unexpected phase: ${this.gamePhase}. Aborting.`);
            // If called incorrectly, might need to reset state or log more info
             return;
        }
         // Check if questions are actually loaded (especially for client)
         if (!this.currentQuestions || this.currentQuestions.length === 0) {
             console.error("MP: Cannot start game locally, questions not loaded!");
             this.handleFatalError("Spel kon niet starten: Vragen niet geladen.");
             return;
         }

        this.gamePhase = 'playing';
        this.currentQuestionIndex = 0;
        this.localPlayerFinished = false;
        this.players.forEach(player => { player.score = 0; player.isFinished = false; });
        this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);
        this.mainMenu.gameAreaController?.showGameCoreElements(); // Show elements container

        if (!this.difficulty) console.warn(`MP ${this.isHost ? 'Host' : 'Client'}: Difficulty not set before initializing timer!`);
        this.timer = new ScoreTimer(this.difficulty);

        this.displayCurrentQuestion(); // Displays question locally

        // *** HOST FIX: Broadcast the very first game state ***
        if (this.isHost) {
            console.log("MP Host: Broadcasting initial game state.");
            this.broadcastGameState();
            console.log("MP Host: Initial game state broadcast attempted.");
        }
    }

    /**
     * Displays the question at the CURRENT local index.
     * Handles running out of questions by calling handleLocalPlayerFinished.
     */
    displayCurrentQuestion() {
        const indexToShow = this.currentQuestionIndex; // Use variable for clarity in logs
        console.log(`MP displayCurrentQuestion: ENTER - Attempting display for index ${indexToShow}. Total Qs: ${this.currentQuestions.length}. Finished: ${this.localPlayerFinished}`);

        // Check if player is already marked finished
        if (this.localPlayerFinished) {
            console.log("MP displayCurrentQuestion: EXIT - Player already marked finished. Showing waiting UI.");
            this.mainMenu.gameAreaController?.showWaitingUi("Wachten op andere spelers...");
            return;
        }

        // Check if the CURRENT index is out of bounds
        if (indexToShow >= this.currentQuestions.length) {
            console.log(`MP displayCurrentQuestion: EXIT - Index ${indexToShow} is out of bounds. Handling local finish.`);
            this.handleLocalPlayerFinished();
            return;
        }

        // Fetch the question data for the current index
        const currentQuestion = this.currentQuestions[indexToShow];
        if (!currentQuestion || typeof currentQuestion.question === 'undefined' || typeof currentQuestion.answer === 'undefined') {
            console.error(`MP displayCurrentQuestion: EXIT - Invalid or missing question data at index ${indexToShow}. Handling local finish.`);
            this.handleLocalPlayerFinished(); // Treat as finished if question data invalid
            return;
        }
         console.log(`MP displayCurrentQuestion: Data OK - Question: "${currentQuestion.question}", Answer: "${currentQuestion.answer}"`);

        const answers = this.getShuffledAnswers(currentQuestion);
         console.log(`MP displayCurrentQuestion: Data OK - Shuffled Answers:`, answers);

        // --- UI Updates ---
        console.log("MP displayCurrentQuestion: Updating UI elements via GameAreaController...");
        const ctrl = this.mainMenu.gameAreaController; // Alias for brevity

        // 1. Ensure core elements are visible and waiting UI is hidden
        ctrl?.hideWaitingUi();
        ctrl?.showGameCoreElements(); // Shows container, handles basic score/timer visibility

        // 2. Update Question
        ctrl?.displayQuestion(currentQuestion.question); // This MUST update the text content
        ctrl?.showQuestion();

        // 3. Update Answers
        ctrl?.displayAnswers(answers); // This MUST update the innerHTML
        ctrl?.showAnswers();

        // 4. Enable interaction
        ctrl?.enableAnswers();

        // 5. Update Progress Indicator
        ctrl?.updateProgress(indexToShow + 1, this.currentQuestions.length);

        // 6. Hide "Next" button (it was just clicked)
        ctrl?.hideNextButton();

        // 7. Show Timer Element
        ctrl?.showTimer();

        // *** FIX: Reset interaction block AFTER UI is ready ***
        console.log("MP displayCurrentQuestion: Resetting blockInteraction flag.");
        this.blockInteraction = false;
        // *** END FIX ***

        // Start/Reset Timer
        if (this.timer) {
            this.timer.stop();
            const initialSeconds = Math.ceil(this.timer.durationMs / 1000);
            ctrl?.updateTimerDisplay(initialSeconds); // Update timer text
            console.log(`MP displayCurrentQuestion: Starting timer for Q${indexToShow} duration ${this.timer.durationMs}ms`);
            this.timer.start(this.onTimerTick.bind(this));
        } else {
            console.error("MP displayCurrentQuestion: Timer object not initialized!");
        }
        console.log(`MP displayCurrentQuestion: EXIT - Successfully updated UI for index ${indexToShow}.`);
    }

    /**
     * Generates shuffled answer options for a given question.
     * @param {object} currentQuestion - The question object { question: string, answer: string }.
     * @returns {string[]} An array of 4 shuffled answer options.
     */
    getShuffledAnswers(currentQuestion) {
        // This logic seems fine, adapted from base Game class likely
        const correctAnswer = currentQuestion.answer;
        const allAnswers = this.currentQuestions.map(q => q.answer).filter(ans => ans !== undefined && ans !== null);
        const uniqueAnswers = [...new Set(allAnswers)];

        // Get incorrect options, excluding the correct answer
        const incorrectOptions = uniqueAnswers.filter(ans => ans !== correctAnswer);
        this.shuffleArray(incorrectOptions); // Shuffle the unique incorrect answers

        // Select up to 3 incorrect options
        let selectedIncorrect = incorrectOptions.slice(0, 3);

        // Ensure we always have 4 options total (correct + 3 incorrect)
        // Add placeholders if not enough unique incorrect answers found
        let placeholderIndex = 1;
        while (selectedIncorrect.length < 3) {
            const placeholder = `Optie ${placeholderIndex++}`;
            // Avoid adding the correct answer or duplicates as placeholder
            if (placeholder !== correctAnswer && !selectedIncorrect.includes(placeholder)) {
                selectedIncorrect.push(placeholder);
        }
        }

        const finalAnswers = [correctAnswer, ...selectedIncorrect];
        // Ensure exactly 4 answers (handle cases with fewer than 3 unique incorrect options correctly)
        // This slice ensures we don't exceed 4 if something went wrong
        const answersToShuffle = finalAnswers.slice(0, 4);
        // Add generic placeholders if somehow we still have fewer than 4
         while (answersToShuffle.length < 4) {
             answersToShuffle.push(`--- ${answersToShuffle.length + 1} ---`);
         }


        return this.shuffleArray(answersToShuffle); // Shuffle the final set of 4 answers
    }

    /**
     * Utility function to shuffle an array in place using Fisher-Yates algorithm.
     * @param {Array<any>} array - The array to shuffle.
     * @returns {Array<any>} The shuffled array (same instance).
     */
    shuffleArray(array) {
       for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Called by the local ScoreTimer instance on each tick. Updates UI.
     * Handles timeout condition.
     * @param {number} remainingTimeMs - The time left in milliseconds (from Timer class).
     */
    onTimerTick(remainingTimeMs) {
        // *** Check 'this' context immediately ***
        if (!(this instanceof MultiplayerGame)) {
            console.error("MP onTimerTick: CRITICAL - 'this' is NOT a MultiplayerGame instance!", this);
            this.timer?.stop(); // Attempt to stop timer to prevent loops
             return;
        }
        // Optional: Log confirms 'this' is correct
        // console.log(`MP onTimerTick: Context 'this' OK. Remaining MS: ${remainingTimeMs}`);

        if (this.gamePhase !== 'playing' || this.localPlayerFinished) {
            this.timer?.stop(); return;
        }

        const remainingSeconds = Math.max(0, Math.ceil(remainingTimeMs / 1000));
        this.mainMenu.gameAreaController?.updateTimerDisplay(remainingSeconds);

        if (remainingTimeMs <= 0) {
            console.log("MP: Time ran out for local player!");
            this.timer?.stop();
            this.mainMenu.gameAreaController?.disableAnswers();
            const currentQuestion = this.currentQuestions?.[this.currentQuestionIndex];

            if (this.isHost) {
                // *** Explicitly verify method existence on 'this' ***
                if (typeof this.processAnswerLocally === 'function') {
                    this.processAnswerLocally(this.webRTCManager?.peerId, this.currentQuestionIndex, null, true, null);
                    this.mainMenu.gameAreaController?.showFeedback(false, currentQuestion?.answer);
         this.broadcastGameState();
            } else {
                    console.error("MP onTimerTick: 'this.processAnswerLocally' is NOT a function!", this);
                }
             } else {
                this.mainMenu.gameAreaController?.showFeedback(false, currentQuestion?.answer);
                this.handleLocalPlayerFinished();
            }
         }
    }

    /**
     * Handles the local player (Host or Client) finishing all questions.
     * Updates local state, UI, and notifies the host if applicable.
     */
    handleLocalPlayerFinished() {
        if (this.localPlayerFinished) return; // Already processed

        console.log("MP: Local player finished all questions.");
        this.localPlayerFinished = true;
        this.timer?.stop(); // Stop timer if running

        const localId = this.webRTCManager?.peerId;
        if (localId && this.players.has(localId)) {
             this.players.get(localId).isFinished = true; // <<< Mark as finished in the map
        } else {
             console.warn("MP: Could not find local player in map to mark as finished.");
        }

        this.mainMenu.gameAreaController?.showWaitingUi("Goed gedaan! Wachten op de anderen...");
        this.mainMenu.gameAreaController?.disableAnswers();

        if (this.isHost) {
            // Host broadcasts state change and checks if game ended
            console.log("MP Host: Local player (host) finished. Broadcasting state and checking end.");
            this.broadcastGameState(); // Ensure others see finished status
            this.checkMultiplayerEnd(); // Check if game ends now
        } else {
            // Client notifies host they are finished
            console.log("MP Client: Notifying host of finish.");
            this.webRTCManager?.send({
                type: MessageTypes.C_PLAYER_FINISHED,
                 finalScore: this.players.get(localId)?.score || 0 // Send final score
            });
        }
    }

    /**
     * HOST: Handles notification that a client has finished the game.
     * @param {string} clientId - The PeerJS ID of the finished client.
     * @param {number} finalScore - The final score reported by the client.
     */
    handleClientFinished(clientId, finalScore) {
        if (!this.isHost) return;

        const player = this.players.get(clientId);
        if (player && !player.isFinished) {
            console.log(`MP Host: Client ${player.playerName} (${clientId}) reported finished with score ${finalScore}.`);
            player.isFinished = true;
            // Optionally verify/use client's reported score or rely on host's tracking
            // player.score = finalScore; // Example: Trust client score report

            // Broadcast the updated state (player finished)
             this.broadcastGameState();
            // Check if this completion ends the game
            this.checkMultiplayerEnd();
        } else {
            console.warn(`MP Host: Received finished signal from unknown or already finished client: ${clientId}`);
        }
    }

    /**
     * HOST: Checks if all currently connected players are marked as finished with the *whole game*.
     * Primarily used when a player disconnects or reports finishing the game.
     */
    checkMultiplayerEnd() {
        if (!this.isHost) return; // Should not be called by client

        // Only perform check if game is potentially ending or player left
        if (this.gamePhase !== 'playing' && this.gamePhase !== 'lobby') {
             console.log("MP Host checkMultiplayerEnd: Check skipped, game phase is", this.gamePhase);
            return;
        }

        // *** FIX: Get connected peer IDs from the connections map keys ***
        let connectedPeerIds = [];
        if (this.webRTCManager && this.webRTCManager.connections instanceof Map) {
            connectedPeerIds = Array.from(this.webRTCManager.connections.keys());
        } else {
            console.warn("MP Host checkMultiplayerEnd: WebRTCManager or connections map not found/invalid.");
        }

        // Include host's own ID
        const hostId = this.webRTCManager?.peerId;
        if (hostId && !connectedPeerIds.includes(hostId)) {
            connectedPeerIds.push(hostId);
        }
        const uniqueConnectedIds = [...new Set(connectedPeerIds)];

        // Filter players map to only include connected ones
        const connectedPlayers = uniqueConnectedIds
                                    .map(id => this.players.get(id))
                                    .filter(p => p); // Filter out undefined if IDs don't match map

        // If no players are connected (e.g., last client left), end might be handled by disconnect logic.
        if (connectedPlayers.length === 0) {
             console.log("MP Host checkMultiplayerEnd: No connected players found in list.");
             // Consider ending if host is alone? Depends on desired logic.
             return;
         }

        // Check if ALL connected players have the main 'isFinished' flag set
        const allGameFinished = connectedPlayers.every(p => p.isFinished);

        if (allGameFinished) {
            console.log("MP Host: checkMultiplayerEnd - All connected players are finished! Ending game.");
            this.endMultiplayerGame(); // Trigger final results
         } else {
            console.log("MP Host: checkMultiplayerEnd - Not all connected players finished yet.");
         }
    }

     /**
     * HOST: Ends the multiplayer game, calculates final results, and broadcasts them.
     */
    endMultiplayerGame() {
        if (!this.isHost) return;
        console.log("MP Host: Calculating and broadcasting final results.");
        this.gamePhase = 'results';
        this.timer?.stop(); // Stop host timer if running

        const finalResults = {
            type: MessageTypes.H_FINAL_RESULTS,
            scores: Array.from(this.players.values()).map(p => ({
                playerName: p.playerName,
                score: p.score
            })).sort((a, b) => b.score - a.score) // Sort descending by score
        };

        this.webRTCManager.broadcast(finalResults);
        // Handle results locally for the host too
        this.handleFinalResults(finalResults);
    }

    /**
     * HOST/CLIENT: Handles the final results message. Shows the results dialog.
     * @param {object} resultsMessage - The H_FINAL_RESULTS message data.
     */
    handleFinalResults(resultsMessage) {
        console.log("MP: Handling final results.", resultsMessage);
        this.gamePhase = 'results'; // Ensure phase is correct
        this.timer?.stop(); // Stop local timer
        this.mainMenu.gameAreaController?.hide(); // Hide game area UI elements
        // Use DialogController to show the results
        this.mainMenu.dialogController?.showMultiplayerEndResults(resultsMessage.scores);
    }

    // --- State Management & Cleanup ---

    /**
     * Resets the multiplayer state, cleaning up connections, timers, and UI elements.
     * Stops the game timer, cleans up the WebRTC manager, clears player data, and resets related UI controllers.
     * Should be called when stopping a game, encountering critical errors, or before starting a new session.
     */
    resetMultiplayerState() {
        console.log("MP: Resetting multiplayer state");
        this.mainMenu.gameAreaController?.resetUI();

        // *** REVERT/CONFIRM: Stop 'this.timer' and nullify ***
         if (this.timer) {
            console.log("MP: Stopping existing timer instance during reset.");
            this.timer.stop();
        }
        this.timer = null; // Explicitly nullify

        this.webRTCManager?.cleanup();
        this.players = new Map();
        this.gamePhase = 'lobby';
        this.currentQuestionIndex = -1;
        this.currentQuestions = [];
        this.mainMenu.multiplayerController?.resetUI();
    }

     /**
      * Cleans up the WebRTC connection and resets the game state.
      * Includes navigating back to the main menu.
      */
     cleanup() {
         console.log("MP: Cleaning up multiplayer game session.");
         this.resetMultiplayerState(); // Stops timer, cleans WebRTC, resets state
         // Navigate back to the main menu
         this.mainMenu?.showView('mainMenu'); // Navigation happens here
     }

    // --- Player Name ---

    /**
     * Updates the local player's name, saves it, and notifies the host if this instance is a client.
     * @param {string} newName - The new player name.
     */
    updatePlayerName(newName) {
         const trimmedName = newName?.trim();
         if (!trimmedName) {
             console.warn("MP: Attempted to update player name to empty string. Ignoring.");
             return; // Don't allow empty names
         }

         if (trimmedName !== this.playerName) {
             console.log(`MP: Updating player name locally from "${this.playerName}" to: "${trimmedName}"`);
             this.playerName = trimmedName;
             localStorage.setItem('unicornPoepPlayerName', trimmedName); // Persist name

             // Update own entry in players map if it exists
             const localId = this.webRTCManager?.peerId;
             if (localId && this.players.has(localId)) {
                  this.players.get(localId).playerName = this.playerName;
                  // Update local UI immediately (e.g., opponent list if shown)
                  this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, localId);
             }

                 // If HOST, broadcast the change so others update their lists
                 if (this.isHost) {
                console.log("MP Host: Broadcasting name change via game state.");
                 // Broadcasting full state is simpler and covers this change.
                     this.broadcastGameState();
                 }
             // *** If CLIENT, notify the host ***
             else if (this.webRTCManager?.isActive()) {
                 console.log("MP Client: Sending name update to host.");
                 this.webRTCManager.send({
                     type: MessageTypes.C_UPDATE_NAME, // Ensure this type exists in MessageTypes
                     newName: this.playerName
                 });
             }
         }
    }

     // --- Chat --- (Placeholders - Requires UI implementation in GameAreaController)

     /**
      * Sends a chat message to the host (if client).
      * @param {string} text - The chat message text.
      */
     sendChatMessage(text) {
         if (this.isHost || !text.trim()) return;
         console.log("MP Client: Sending chat message:", text);
         this.webRTCManager?.send({
             type: MessageTypes.C_CHAT_MESSAGE,
             text: text.trim()
         });
     }

     /**
      * HOST: Broadcasts a received chat message to all clients.
      * @param {string} senderId - PeerId of the original sender.
      * @param {string} senderName - Name of the original sender.
      * @param {string} text - The chat message text.
      */
     broadcastChatMessage(senderId, senderName, text) {
         if (!this.isHost) return;
         console.log(`MP Host: Broadcasting chat from ${senderName}: ${text}`);
         this.webRTCManager.broadcast({
             type: MessageTypes.H_CHAT_MESSAGE,
             senderPeerId: senderId,
             senderName: senderName,
             text: text
         });
         // Display chat message for host locally too
         this.mainMenu.gameAreaController?.displayChatMessage(senderName, text);
     }

    /**
     * Stops the current multiplayer game session prematurely.
     * Performs cleanup (disconnects peers), resets state, and navigates back.
     */
    stopGame() {
        console.log("MP: Stopping game via stop button.");
        // cleanup() handles internal reset and navigation
        this.cleanup(); // Calls resetMultiplayerState and showView('mainMenu')
        // *** Call MainMenu cleanup AFTER internal cleanup/navigation attempt ***
        this.mainMenu._handleEndOfGameCleanup();
    }

    /**
     * HOST: Handles a name update request from a client.
     * @param {string} clientId - The PeerJS ID of the client updating their name.
     * @param {string} newName - The new name provided by the client.
     */
    handleClientNameUpdate(clientId, newName) {
         const trimmedName = newName?.trim();
         if (!trimmedName) {
             console.warn(`MP Host: Received empty name update from ${clientId}. Ignoring.`);
             return;
         }

         const player = this.players.get(clientId);
         if (player) {
             console.log(`MP Host: Updating name for ${clientId} from "${player.playerName}" to "${trimmedName}"`);
             player.playerName = trimmedName;
             // Broadcast the updated state so all clients (including the sender) get the change confirmed
             this.broadcastGameState();
         } else {
             console.warn(`MP Host: Received name update from unknown client ID: ${clientId}`);
         }
    }

    /**
     * HOST: Broadcasts the current game state to all connected clients.
     * Sends the current question index, player list (scores, finished status), and game phase.
     */
    broadcastGameState() {
        if (!this.isHost) {
            console.warn("MP: Client attempted to call broadcastGameState.");
            return;
        }
        if (!this.webRTCManager?.isActive()) {
            console.warn("MP Host: Cannot broadcast state, WebRTC not active.");
            return;
        }

        const state = {
            currentQuestionIndex: this.currentQuestionIndex,
            players: Array.from(this.players.values()),
            gamePhase: this.gamePhase
        };

        // *** Add log here to show the data being sent ***
        console.log(`MP Host: Broadcasting game state update (Data):`, state);
        this.webRTCManager.broadcast({
            type: MessageTypes.H_GAME_STATE_UPDATE,
            state: state
        });
    }

    /**
     * CLIENT: Handles game state updates from the host.
     * @param {object} state - The game state object ({ currentQuestionIndex, players, gamePhase }).
     */
    handleGameStateUpdate(state) {
        if (!state || this.isHost) return;
        console.log("MP Client: handleGameStateUpdate invoked with state:", state);

        const previousPhase = this.gamePhase;
        this.gamePhase = state.gamePhase || this.gamePhase;

        // *** DETAILED TIMER INIT LOGGING ***
        console.log(`MP Client: Checking timer init. GamePhase=${this.gamePhase}, PrevPhase=${previousPhase}, Difficulty=${this.difficulty}, TimerExists=${!!this.timer}`);
        if (this.gamePhase === 'playing' && previousPhase !== 'playing') {
            if (!this.difficulty) {
                console.error("MP Client: Cannot initialize timer, difficulty not set!");
                this.handleFatalError("Kon timer niet starten: Spel moeilijkheid onbekend.");
                return;
            }
            if (!this.timer) {
                 console.log(`MP Client: --> INITIALIZING ScoreTimer for difficulty '${this.difficulty}'.`);
                 this.timer = new ScoreTimer(this.difficulty);
                 console.log(`MP Client: --> Timer object AFTER init:`, this.timer); // Log the object itself
            } else {
                 console.log("MP Client: Timer already exists, not re-initializing.");
            }
        }
        // *** END DETAILED LOGGING ***

        // Update player data first
        if (state.players && Array.isArray(state.players)) {
             state.players.forEach(pInfo => {
                if (this.players.has(pInfo.peerId)) {
                    Object.assign(this.players.get(pInfo.peerId), pInfo); // Update existing player data
                } else {
                    // Should not happen often if welcome/join logic is correct
                    console.warn("MP Client: Received state for unknown player:", pInfo.peerId);
                    this.players.set(pInfo.peerId, pInfo);
                }
             });
             this.mainMenu.gameAreaController?.updateOpponentDisplay(this.players, this.webRTCManager?.peerId);
        }

        const localPlayerData = this.players.get(this.webRTCManager?.peerId);
        this.localPlayerFinished = localPlayerData?.isFinished || false;

        console.log("MP Client: Calling showGameCoreElements() from handleGameStateUpdate.");
        this.mainMenu.gameAreaController?.showGameCoreElements();

        // Now handle question display or waiting UI based on state
        if (this.localPlayerFinished) {
            console.log("MP Client: Player is finished, showing waiting UI.");
             this.mainMenu.gameAreaController?.showWaitingUi();
             this.timer?.stop();
        } else if (state.currentQuestionIndex !== this.currentQuestionIndex || previousPhase !== 'playing') {
             console.log(`MP Client: Question index changed/initial (or phase changed to playing). Index: ${state.currentQuestionIndex}. Preparing to display question.`);
             this.currentQuestionIndex = state.currentQuestionIndex;
             // *** Log timer existence right before display call ***
             console.log(`MP Client: Timer object BEFORE calling displayCurrentQuestion:`, this.timer);
             this.displayCurrentQuestion(); // <<< This is where the error occurs
        } else {
             console.log("MP Client: Game state update received, but index unchanged and player not finished.");
        }

        if (this.gamePhase === 'results') { /* ... */ }
    }

    /**
     * Processes an answer for a given player (updates player state, shows feedback).
     * Called by both host (for self and client) and client (for self feedback).
     * @param {string} peerId - The peer ID of the player who answered.
     * @param {number} questionIndex - The index of the question answered.
     * @param {string} selectedAnswer - The answer chosen.
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {HTMLElement | null} [targetButton] - The button element clicked (optional).
     * @private // Marked as private as it's primarily internal logic
     */
    processAnswer(peerId, questionIndex, selectedAnswer, isCorrect, targetButton = null) {
        // Ensure the player exists
        const player = this.players.get(peerId);
        if (!player) {
            console.error(`MP processAnswer: Player with peerId ${peerId} not found.`);
            return;
        }

        // Only process if it's the current question and player hasn't finished it yet for this round
        // Note: Using > accounts for potential race conditions or re-processing attempts
        if (questionIndex !== this.currentQuestionIndex || player.currentQuestionIndex > questionIndex) {
             console.warn(`MP processAnswer: Ignoring answer for Q${questionIndex} from ${player.playerName}. Current is Q${this.currentQuestionIndex}. Player already processed up to Q${player.currentQuestionIndex}`);
             // If it's the local player clicking again, ensure next button is shown.
             if (peerId === this.webRTCManager?.peerId) {
                  console.log(`MP processAnswer: Local player (${peerId}) clicked again on processed question ${questionIndex}. Ensuring Next button is visible.`);
                  this.mainMenu.gameAreaController.showNextButton();
             }
            return; // Stop processing if already handled or not the current question
        }

        console.log(`MP processAnswer: Processing answer from ${player.playerName} (${peerId}) for Q${questionIndex}. Correct: ${isCorrect}`);

        player.lastAnswerCorrect = isCorrect;
        player.lastAnswerTimestamp = Date.now();
        // Mark this question index as processed by this player for this round
        player.currentQuestionIndex = questionIndex + 1;

        if (isCorrect) {
            // Use ScoreTimer to calculate score based on time remaining for *this* question
            const scoreToAdd = this.timer ? this.timer.calculateScore() : 10; // Fallback score
            player.score += scoreToAdd;
             console.log(`MP processAnswer: Awarded ${scoreToAdd} points to ${player.playerName}. New score: ${player.score}`);
        } else {
            console.log(`MP processAnswer: Answer from ${player.playerName} was incorrect. No points added.`);
        }

         // Update the player map with the modified player object
         this.players.set(peerId, player);

        // --- Visual Feedback (Only for Local Player) ---
        const localPeerId = this.webRTCManager?.peerId;
         if (peerId === localPeerId) {
             const currentQDataForFeedback = this.currentQuestions?.[questionIndex];
             // *** FIX: Use '.answer' instead of '.correctAnswer' ***
             const correctAnswerForFeedback = currentQDataForFeedback?.answer; // Use the correct property name
             console.log(`MP processAnswer: Showing local feedback for ${player.playerName}. Correct: ${isCorrect}. Correct Answer for Feedback: ${correctAnswerForFeedback}`);
             if (typeof correctAnswerForFeedback !== 'undefined') {
                 this.mainMenu.gameAreaController.showFeedback(isCorrect, correctAnswerForFeedback, targetButton);
             } else {
                  console.error(`MP processAnswer: Cannot show feedback for Q${questionIndex}, correct answer value is undefined in question data.`);
                  // Optionally show generic feedback without highlighting correct answer
                  // this.mainMenu.gameAreaController.showFeedback(isCorrect, null, targetButton);
             }
         }
         // --- Opponent Score/UI Update (Handled by broadcastGameState/handleGameStateUpdate) ---
         // Avoid direct UI updates for opponent here; rely on state synchronization.
         // This prevents duplicate updates (once here, once on state reception).

        // --- Check Game End Condition ---
        // Let's move this check to after state broadcast/reception to ensure consistency
        // this.checkAndHandleGameEnd(); // Moved
         console.log(`MP processAnswer: Finished for ${player.playerName} on Q${questionIndex}. Player state:`, JSON.parse(JSON.stringify(player))); // Log state after processing
    }

    /**
     * Handles answer selection logic for both host and client.
     * @param {string} selectedAnswer - The answer text selected by the player.
     * @param {Event} event - The click event.
     */
    handleAnswerSelection(selectedAnswer, event) {
        // Check if interaction should be blocked or if answer is invalid
        if (!selectedAnswer || this.blockInteraction || this.gamePhase !== 'playing') {
            console.log(`MP handleAnswerSelection: Blocked interaction (Answer: ${selectedAnswer}, Blocked: ${this.blockInteraction}, Phase: ${this.gamePhase})`);
            return; // Exit early if interaction is blocked
        }

        console.log(`MP handleAnswerSelection: Processing local answer "${selectedAnswer}" (Type: ${typeof selectedAnswer}). IsHost: ${this.isHost}`);
        this.blockInteraction = true;
        this.timer?.stop();
        this.mainMenu.gameAreaController.disableAnswers();

        const currentQData = this.currentQuestions?.[this.currentQuestionIndex];
        // *** DIAGNOSTIC LOGGING START ***
        console.log(`MP handleAnswerSelection: Current Question Index: ${this.currentQuestionIndex}`);
        // Log the object structure (using JSON stringify for cleaner output)
        console.log(`MP handleAnswerSelection: Fetched currentQData:`, JSON.parse(JSON.stringify(currentQData || {})));

        if (!currentQData) {
             console.error(`MP handleAnswerSelection: CRITICAL - No question data found for index ${this.currentQuestionIndex}. Aborting processing.`);
             this.blockInteraction = false;
             this.mainMenu.gameAreaController.enableAnswers();
            return;
        }

        // *** FIX: Use '.answer' instead of '.correctAnswer' ***
        const actualCorrectAnswer = currentQData.answer; // Use the correct property name
        console.log(`MP handleAnswerSelection: Comparing selectedAnswer "${selectedAnswer}" (Type: ${typeof selectedAnswer}) with currentQData.answer "${actualCorrectAnswer}" (Type: ${typeof actualCorrectAnswer})`);
        // *** END FIX ***

        // Perform comparison (using == for type flexibility, ensure data types are consistent ideally)
        const isCorrect = typeof actualCorrectAnswer !== 'undefined' && selectedAnswer == actualCorrectAnswer;
        console.log(`MP handleAnswerSelection: Answer isCorrect = ${isCorrect} (Used ==)`);
        // *** DIAGNOSTIC LOGGING END ***

        const localPeerId = this.webRTCManager?.peerId;
        if (localPeerId) {
            console.log(`MP handleAnswerSelection: Processing answer locally for player ${localPeerId}.`);
            // Pass the comparison result and target button
            this.processAnswer(localPeerId, this.currentQuestionIndex, selectedAnswer, isCorrect, event?.target);
        } else {
            console.error("MP handleAnswerSelection: Cannot process local answer - local PeerID is missing.");
            this.blockInteraction = false;
            this.mainMenu.gameAreaController.enableAnswers();
            return;
        }

        // Host specific logic: Broadcast state
        if (this.isHost) {
            console.log("MP Host: Broadcasting game state after processing own answer.");
            this.broadcastGameState(); // Broadcast the state including the result of the host's answer
        }
        // Client specific logic: Send answer to host
        else {
             console.log(`MP Client (${localPeerId}): Sending answer '${selectedAnswer}' for Q${this.currentQuestionIndex} to host.`);
             if (this.webRTCManager && this.webRTCManager.hostConnection) {
                 this.webRTCManager.sendTo(this.webRTCManager.hostConnection.peer, {
                     type: MessageTypes.C_SUBMIT_ANSWER, // Use enum/const if available
                     questionIndex: this.currentQuestionIndex,
                     answer: selectedAnswer
                 });
             } else {
                 console.error(`MP Client: Cannot send answer - WebRTCManager (${!!this.webRTCManager}) or hostConnection (${!!this.webRTCManager?.hostConnection}) missing/invalid.`);
             }
        }

        // Show the Next button for the local player (both host and client)
         console.log(`MP handleAnswerSelection: Showing Next button for local player ${localPeerId}.`);
         this.mainMenu.gameAreaController.showNextButton();

         console.log(`MP handleAnswerSelection: Finished processing event for answer "${selectedAnswer}".`);
    }

    /**
     * Called when the local user clicks the "Next" button.
     * Increments the local question index and displays the next question.
     */
    proceedToNextQuestion() {
        console.log(`MP proceedToNextQuestion: Current index BEFORE increment: ${this.currentQuestionIndex}`);
        // Increment index FIRST
        this.currentQuestionIndex++;
        console.log(`MP proceedToNextQuestion: Current index AFTER increment: ${this.currentQuestionIndex}`);
        // Then display the question at the new index
        this.displayCurrentQuestion();
    }

}

// Ensure the class is available globally if needed by index.html initialization logic
// window.MultiplayerGame = MultiplayerGame; // Uncomment if necessary, but index.html seems to instantiate directly. 