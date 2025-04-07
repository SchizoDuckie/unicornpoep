/**
 * @file Manages the state, logic, and flow for a MULTIPLAYER game session.
 * Orchestrates WebRTC communication and synchronizes game state across players
 * using a Host-as-Server model.
 * Adapts core game mechanics for the multiplayer context.
 */

// Assume MessageTypes is loaded globally from messagetypes.js
// const MessageTypes = { ... };

// Define possible game phases (adjust as needed)
const GamePhases = {
    LOBBY: 'lobby',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    FINISHED: 'finished' // Added for end-game state
};

class MultiplayerGame {
    /**
     * Initializes a new MultiplayerGame instance.
     * @param {MainMenu} mainMenu - The central orchestrator instance.
     * @param {boolean} isHost - Whether this instance is hosting or joining. MUST be provided.
     * @param {string[]} [initialSheetKeys=[]] - Initial sheet keys (primarily for host setup later).
     * @param {string} [initialDifficulty='medium'] - Initial difficulty (primarily for host setup later).
     */
    constructor(mainMenu, isHost, initialSheetKeys = [], initialDifficulty = 'medium') {
        console.log(`MP: Initializing MultiplayerGame (isHost: ${isHost}) - Accessing via MainMenu.`);
        if (!mainMenu) {
             throw new Error("MultiplayerGame requires a MainMenu instance!");
        }
        if (typeof isHost !== 'boolean') {
            throw new Error("MultiplayerGame constructor requires isHost (boolean) argument.");
        }
        this.mainMenu = mainMenu;
        this.isHost = isHost;
        this.isMultiplayer = true;

        // <<< DEBUGGING: Check mainMenu reference during construction >>>
        console.log("MP Constructor DEBUG: Received mainMenu object:", this.mainMenu);
        console.log("MP Constructor DEBUG: typeof mainMenu.saveHighScore:", typeof this.mainMenu?.saveHighScore);
        // <<< END DEBUGGING >>>

        this.wasMultiplayer = true; // Flag for high scores differentiation
        this.gamePhase = GamePhases.LOBBY; // Initialize phase

        // --- State ---
        /** @type {Map<string, { peerId: string, playerName: string, score: number, isFinished: boolean }>} */
        this.players = new Map(); // Key: peerId, Value: player info object
        this.localPlayerFinished = false;
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || 'MP Player';
        this.selectedSheets = initialSheetKeys;
        this.difficulty = initialDifficulty;
        this.currentQuestionIndex = 0;
        this.currentQuestions = [];
        this.timer = null; // Will be ScoreTimer instance
        this._countdownInterval = null;

        // --- Access Managers & Controllers via Hub ---
        // this.questionsManager = this.mainMenuController.questionsManager; (Example)

        // --- Internal Manager ---
        this.webRTCManager = new WebRTCManager(this); // Manages WebRTC, passes THIS instance

        // Validate essential dependencies are available via the hub
        if (!this.mainMenu.questionsManager || !this.mainMenu.gameAreaController || !this.mainMenu.multiplayerController || !this.mainMenu.dialogController || !this.mainMenu.loadingController) {
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
        if (!this.mainMenu.questionsManager) {
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
            this.mainMenu.dialogController.showError(`Fout bij laden vragen: ${error.message}`);
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

        this.mainMenu.loadingController.show("Hosting starten...");

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

            this.mainMenu.loadingController.hide();
            this.mainMenu.multiplayerController.showHostScreen(hostPeerId); // Show code, waiting message
            // Do not show game area yet

        } catch (error) {
            this.mainMenu.loadingController.hide();
            console.error("MP: Failed to initialize host:", error);
            this.handleFatalError(`Host init error: ${error.message || 'Unknown'}`);
            // Consider navigating back to main menu or showing error dialog
            this.mainMenu.showView('mainMenu'); // Example fallback
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
        this.mainMenu.multiplayerController.showFetchingGameInfo(); // Update UI

        try {
            await this.webRTCManager.initializeClient(hostId);
            // Connection is established, waiting for host confirmation/game info
            console.log("MP: Client initialized, connection established. Waiting for Game Info.");
            // onHostConnected and message handling will take over
        } catch (error) {
            console.error("MP: Failed to initialize client or connect:", error);
            // Corrected reference: this.mainMenuController (passed during construction)
            // Corrected method name: showConnectionError
            this.mainMenuController.multiplayerController.showConnectionError(error.message || "Kon niet verbinden.", true);
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
        this.webRTCManager.send({
            type: MessageTypes.C_REQUEST_JOIN,
            playerName: this.playerName
        });
    }

    /**
     * Called when the client clicks "Join" on the confirmation screen.
     * Sends confirmation to the host.
     */
    confirmJoin() {
        if (!this.isHost && this.webRTCManager.isActive() && this.gamePhase === 'joining') {
            console.log("MP Client: Sending join confirmation.");
            this.webRTCManager.send({
                type: MessageTypes.C_CONFIRM_JOIN,
                playerName: this.playerName
            });
            this.gamePhase = 'lobby'; // Move to lobby state, waiting for host to start
            this.mainMenu.multiplayerController.showWaitingForGameStart();
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
            this.webRTCManager.cleanup();
            this.gamePhase = 'idle';
            // Navigate back via the central controller
            this.mainMenu.showView('mainMenu');
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
                    // *** FIX: Pass correct parameters to handleClientAnswer ***
                    this.handleClientAnswer(senderId,
                         message.clientQuestionIndex, // Use client's index
                         message.questionText,        // Use question text
                         message.answer,              // Submitted answer
                         message.scoreToAdd);         // Claimed score
                    break;
                case MessageTypes.C_PLAYER_FINISHED:
                    this.handleClientFinished(senderId, message.finalScore);
                    break;
                case MessageTypes.C_CHAT_MESSAGE:
                    // Placeholder: Handle chat message forwarding
                    console.log(`Chat from ${senderId}: ${message.text}`);
                    this.broadcastChatMessage(senderId, this.players.get(senderId).playerName || 'Unknown', message.text);
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
                    if(message.playerInfo.peerId !== this.webRTCManager.peerId) {
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
                    console.log("MP Client: Received final results from host.");
                     this.gamePhase = 'ended'; // Ensure phase is set
                     this._handleFinalResults(message.playersArray, this.webRTCManager.peerId, message.winnerInfo);
                     // Perform client-side cleanup if needed AFTER showing results
                     // this.cleanupMultiplayer(); // Be cautious if this navigates away
                     break;
                case MessageTypes.H_CHAT_MESSAGE:
                    // Placeholder: Display chat message in UI
                    console.log(`Chat from ${message.senderName}: ${message.text}`);
                    this.mainMenu.gameAreaController.displayChatMessage(message.senderName, message.text);
                    break;
                case MessageTypes.H_RECORD_HIGHSCORE:
                     this.handleRecordHighscore(message);
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
            this.mainMenu.multiplayerController.showJoinConfirmationScreen(gameInfo);

            } catch (error) {
                 console.error("MP Client: Failed to load questions based on game info:", error);
                 this.handleFatalError(`Kon spelvragen niet laden: ${error.message}`);
                 // Ensure connection cleanup on error
                 this.webRTCManager.cleanup();
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
        // RE-APPLYING FIX: Call showConnectionError instead of showJoinError
        this.mainMenu.multiplayerController.showConnectionError(reason, true);
        this.webRTCManager.cleanup();
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
            isFinished: false,
            currentQuestionIndex: -1 // *** Initialize progress tracker ***
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
        this.mainMenu.multiplayerController.updateLobbyPlayerCount(this.players.size);
        this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId); // Update host's game area if visible
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
            this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId); // Update game area if visible
        } else {
             console.warn("MP Client: Received welcome message in unexpected phase:", this.gamePhase);
        }
    }

    /**
     * HOST: Handles an answer submitted by a client.
     * Verifies the answer and score based on host data (found via questionText) and client submission.
     * @param {string} senderId - The PeerJS ID of the submitting client.
     * @param {number} clientQuestionIndex - The index of the question *in the client's list*.
     * @param {string} questionText - The actual text of the question answered.
     * @param {string} submittedAnswer - The answer submitted by the client.
     * @param {number} [claimedScoreToAdd=0] - The score calculated and sent by the client.
     */
    handleClientAnswer(senderId, clientQuestionIndex, questionText, submittedAnswer, claimedScoreToAdd = 0) {
        if (!this.isHost) return;
        console.log(`MP Host: Received answer submission from ${senderId} for QText='${questionText}' (ClientIndex=${clientQuestionIndex}): Answer='${submittedAnswer}', ClaimedScore=${claimedScoreToAdd}`);

        // --- Verification ---
        // 1. Find Host's Correct Answer (using questionText)
        const hostQuestionData = this.currentQuestions.find(q => q.question === questionText);
        if (!hostQuestionData) {
            console.error(`MP Host handleClientAnswer: Cannot find question data for text: "${questionText}". Ignoring.`);
            // Consider sending an error back to the client?
            return;
        }
        const correctAnswer = hostQuestionData.answer;
        console.log(`MP Host handleClientAnswer: Found matching question on host. Correct answer is: "${correctAnswer}"`);

        // 2. Verify Client's Answer Correctness (using host data)
        const isCorrect = (submittedAnswer === correctAnswer);
        console.log(`MP Host handleClientAnswer: Client answer correct (verified by host) = ${isCorrect}`);

        // 3. Validate Client's Score
        let validatedScoreToAdd = 0;
        const MAX_POSSIBLE_SCORE = 60; // Based on ScoreTimer (10 base + 50 max bonus)
        if (isCorrect) {
            if (typeof claimedScoreToAdd === 'number' && claimedScoreToAdd >= 0 && claimedScoreToAdd <= MAX_POSSIBLE_SCORE) {
                validatedScoreToAdd = claimedScoreToAdd;
                console.log(`MP Host handleClientAnswer: Client score ${claimedScoreToAdd} accepted.`);
            } else {
                console.warn(`MP Host handleClientAnswer: Client ${senderId} sent invalid score ${claimedScoreToAdd} for a correct answer. Awarding 0.`);
                validatedScoreToAdd = 0; // Award 0 if score seems invalid/cheated
            }
        } else {
            // If answer was incorrect, score MUST be 0, regardless of what client sent
            validatedScoreToAdd = 0;
             if (claimedScoreToAdd !== 0) {
                 console.warn(`MP Host handleClientAnswer: Client ${senderId} sent score ${claimedScoreToAdd} for an INCORRECT answer. Setting score to 0.`);
             }
        }

        // --- Processing ---
        // 4. Call the main processing function with VERIFIED data and CLIENT'S index
        // processAnswer(peerId, questionIndex, selectedAnswer, isCorrect, scoreToAdd, targetButton)
        this.processAnswer(senderId, clientQuestionIndex, submittedAnswer, isCorrect, validatedScoreToAdd, null);

        // Host broadcasts state AFTER processing the client's answer
        this.broadcastGameState();
    }

    /**
     * CLIENT: Handles the notification that another player has joined. Adds them to the local list.
     * @param {object} playerInfo - The info object for the player who joined.
     */
    updatePlayerListAdd(playerInfo) {
         if (!this.players.has(playerInfo.peerId)) {
             console.log(`MP Client: Player ${playerInfo.playerName} (${playerInfo.peerId}) joined.`);
             this.players.set(playerInfo.peerId, playerInfo);
             this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);
              // Update lobby count if client UI shows it
             this.mainMenu.multiplayerController.updateLobbyPlayerCount(this.players.size);
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
                this.mainMenu.multiplayerController.updateLobbyPlayerCount(this.players.size);
                this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);

                // *** FIX: Re-check game end if player disconnected during playing OR waiting_for_finish phase ***
                 if (this.gamePhase === 'playing' || this.gamePhase === 'waiting_for_finish') {
                    console.log(`MP Host: Player disconnected during ${this.gamePhase} phase. Re-checking game end.`);
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
            if (peerId === this.webRTCManager.hostId) {
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
             this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);
             // Optional: Show toast message "Player X left" using injected instance
             this.mainMenu.toastNotification.show(`${disconnectedPlayerName} heeft het spel verlaten.`);
              // Update lobby count if client UI shows it
             this.mainMenu.multiplayerController.updateLobbyPlayerCount(this.players.size);
         }
     }


    /**
     * CLIENT: Handles the host disconnecting. Shows a dialog and cleans up.
     */
    handleHostDisconnect(reason) {
        console.error("MP Client: Host disconnected.");
        if (this.gamePhase !== 'idle' && this.gamePhase !== 'results') {
             this.mainMenu.dialogController.showDisconnectionDialog(reason);
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

        // Explicitly check if mainMenu and its dialogController AND the showError method exist before calling.
        // NO optional chaining.
        if (this.mainMenu && this.mainMenu.dialogController && typeof this.mainMenu.dialogController.showError === 'function') {
            this.mainMenu.dialogController.showError(errorMessage); // Show error
        } else {
            console.error("MP: Cannot show fatal error dialog - MainMenu, DialogController, or showError method not available.");
            // Fallback? Maybe alert, but rules say no alerts.
            // Relying on console error for now.
        }

        // Navigation is handled within cleanup()
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
        this.mainMenu.multiplayerController.hideConnectionDialog();
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
            this.mainMenu.multiplayerController.hideConnectionDialog();
        }

        // Prepare Game Area UI (hide elements, show countdown overlay)
        this.mainMenu.gameAreaController.hideAnswers();
        this.mainMenu.gameAreaController.hideQuestion();
        this.mainMenu.gameAreaController.hideTimer();
        this.mainMenu.gameAreaController.hideNextButton();
        this.mainMenu.gameAreaController.hideWaitingUi();
        this.mainMenu.gameAreaController.showCountdownOverlay();
        this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);

        let remaining = duration;
        this.mainMenu.gameAreaController.updateCountdown(remaining);
        clearInterval(this._countdownInterval);
        this._countdownInterval = setInterval(() => {
            remaining--;
            this.mainMenu.gameAreaController.updateCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(this._countdownInterval);
                this.mainMenu.gameAreaController.hideCountdownOverlay();
                // *** FIX: BOTH Host and Client call startGameLocally after countdown ***
                this.startGameLocally();
                // Removed incorrect conditional logic:
                // if (this.isHost) {
                //     this.startGameLocally();
                // }
                 // // Client waits for the first game state update message // Incorrect
            }
        }, 1000);
    }

    /**
     * HOST/CLIENT: Starts the actual game logic locally after countdown finishes.
     * Initializes timer, resets scores, displays first question, and shows the main game UI.
     */
    startGameLocally() {
        console.log(`MP: Starting game locally (Current Phase: ${this.gamePhase}). Current Index: ${this.currentQuestionIndex}. Questions loaded: ${this.currentQuestions.length}`);

        // Check if questions are loaded
        if (!this.currentQuestions || this.currentQuestions.length === 0) {
             console.error("MP: Cannot start game locally, questions not loaded!");
             this.handleFatalError("Spel kon niet starten: Vragen niet geladen.");
             return;
         }

        // *** MODIFIED CHECK: Only perform initial setup if index is not yet 0 ***
        // This prevents race conditions if H_GAME_STATE_UPDATE arrives before countdown finishes.
        if (this.currentQuestionIndex < 0) {
            console.log("MP startGameLocally: Performing initial setup (Index < 0).");
            this.gamePhase = 'playing'; // Ensure phase is set correctly
            this.currentQuestionIndex = 0;
            this.localPlayerFinished = false;
            // Reset scores for all players at the start
            this.players.forEach(player => { player.score = 0; player.isFinished = false; });

            this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);
            this.mainMenu.gameAreaController.showGameCoreElements(); // Ensure core elements are visible

            if (!this.difficulty) console.warn(`MP ${this.isHost ? 'Host' : 'Client'}: Difficulty not set before initializing timer!`);
            this.timer = new ScoreTimer(this.difficulty);

            this.displayCurrentQuestion(); // Display Q0

            // Host broadcasts initial state AFTER setting its own index to 0 and displaying Q0
            if (this.isHost) {
                console.log("MP Host: Broadcasting initial game state from startGameLocally.");
                this.broadcastGameState();
                console.log("MP Host: Initial game state broadcast attempted.");
            }
        } else {
            // If index is already 0 or more, game has likely started, maybe log a warning.
            console.warn(`MP startGameLocally: Called when game seems already started (Index: ${this.currentQuestionIndex}). No setup action taken.`);
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
            this.mainMenu.gameAreaController.showWaitingUi("Wachten op andere spelers...");
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
        ctrl.hideWaitingUi();
        ctrl.showGameCoreElements(); // Shows container, handles basic score/timer visibility

        // 2. Update Question
        ctrl.displayQuestion(currentQuestion.question); // This MUST update the text content
        ctrl.showQuestion();

        // 3. Update Answers
        ctrl.displayAnswers(answers); // This MUST update the innerHTML
        ctrl.showAnswers();

        // 4. Enable interaction
        ctrl.enableAnswers();

        // 5. Update Progress Indicator
        ctrl.updateProgress(indexToShow + 1, this.currentQuestions.length);

        // 6. Hide "Next" button (it was just clicked)
        ctrl.hideNextButton();

        // 7. Show Timer Element
        ctrl.showTimer();

        // *** FIX: Reset interaction block AFTER UI is ready ***
        console.log("MP displayCurrentQuestion: Resetting blockInteraction flag.");
        this.blockInteraction = false;
        // *** END FIX ***

        // Start/Reset Timer
        if (this.timer) {
            this.timer.stop();
            const initialSeconds = Math.ceil(this.timer.durationMs / 1000);
            ctrl.updateTimerDisplay(initialSeconds); // Update timer text
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
            this.timer.stop(); // Attempt to stop timer to prevent loops
             return;
        }
        // Optional: Log confirms 'this' is correct
        // console.log(`MP onTimerTick: Context 'this' OK. Remaining MS: ${remainingTimeMs}`);

        if (this.gamePhase !== 'playing' || this.localPlayerFinished) {
            this.timer.stop(); return;
        }

        const remainingSeconds = Math.max(0, Math.ceil(remainingTimeMs / 1000));
        this.mainMenu.gameAreaController.updateTimerDisplay(remainingSeconds);

        if (remainingTimeMs <= 0 && !this.blockInteraction) { // Only process timeout if interaction isn't already blocked (i.e., answer wasn't just selected)
             console.log("MP: Time ran out for local player!");
             this.blockInteraction = true; // Block further interaction
             this.timer.stop();
             this.mainMenu.gameAreaController.disableAnswers();
             const currentQuestion = this.currentQuestions[this.currentQuestionIndex];

             // *** FIX: Call 'processAnswer' instead of 'processAnswerLocally' ***
             const localPeerId = this.webRTCManager.peerId;
             if (localPeerId) {
                 console.log(`MP onTimerTick: Processing timeout locally for player ${localPeerId}.`);
                 // Arguments for timeout: peerId, index, selectedAnswer=null, isCorrect=false, scoreToAdd=0, button=null
                 this.processAnswer(localPeerId, this.currentQuestionIndex, null, false, 0, null);
             } else {
                  console.error("MP onTimerTick: Cannot process timeout - local PeerID is missing.");
                 // Handle error state? Maybe just show feedback locally?
                  this.mainMenu.gameAreaController.showFeedback(false, currentQuestion.answer); // Show feedback anyway
             }
             // *** END FIX ***

             // Show feedback *after* processing (processAnswer handles local feedback now)
             // this.mainMenu.gameAreaController.showFeedback(false, currentQuestion.answer); // Moved into processAnswer

             // If HOST, broadcast the updated state (player's score didn't change, but index might have in processAnswer)
             if (this.isHost) {
                 console.log("MP Host: Broadcasting game state after timeout processing.");
                 this.broadcastGameState();
                 // Show next button after processing timeout on host? Maybe not needed if it moves to next Q.
                 // Let's assume the regular flow (Next button shows after processAnswer) handles this via broadcast.
                 // Or, maybe timeout should automatically trigger next question for host?
                 // For now, let's keep it simple: process timeout, broadcast, host must click Next.
                 // Host needs to see the Next button though.
                 this.mainMenu.gameAreaController.showNextButton();
             } else {
                 // Client: Timeout occurred locally. State will be updated by host broadcast eventually.
                 // Show the next button so client can proceed if host already did.
                 this.mainMenu.gameAreaController.showNextButton();
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
        this.timer.stop(); // Stop timer if running

        const localId = this.webRTCManager.peerId;
        if (localId && this.players.has(localId)) {
             this.players.get(localId).isFinished = true; // <<< Mark as finished in the map
        } else {
             console.warn("MP: Could not find local player in map to mark as finished.");
        }

        this.mainMenu.gameAreaController.showWaitingUi("Goed gedaan! Wachten op de anderen...");
        this.mainMenu.gameAreaController.disableAnswers();

        if (this.isHost) {
            // Host broadcasts state change and checks if game ended
            console.log("MP Host: Local player (host) finished. Broadcasting state and checking end.");
            this.broadcastGameState(); // Ensure others see finished status
            this.checkMultiplayerEnd(); // Check if game ends now
        } else {
            // Client notifies host they are finished
            console.log("MP Client: Notifying host of finish.");
            this.webRTCManager.send({
                type: MessageTypes.C_PLAYER_FINISHED,
                 finalScore: this.players.get(localId).score || 0 // Send final score
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
            // *** FIX: Uncomment this line to store the client's reported final score ***
            player.score = finalScore; 

            // Broadcast the updated state (player finished, score updated)
             this.broadcastGameState();
            // Check if this completion ends the game
            this.checkMultiplayerEnd();
        } else {
            console.warn(`MP Host: Received finished signal from unknown or already finished client: ${clientId}`);
        }
    }

    /**
     * Checks if all players have finished. If so, ends the game.
     * If the local player (host) finishes but others haven't, shows a waiting state.
     * Should typically only trigger end game logic on the HOST.
     */
    checkMultiplayerEnd() {
        if (this.gamePhase === 'ended') return; // Already ended

        const allPlayersFinished = Array.from(this.players.values()).every(p => p.isFinished);
        const localPlayerId = this.webRTCManager.peerId;
        const localPlayer = this.players.get(localPlayerId);

        console.log(`MP checkMultiplayerEnd: All finished: ${allPlayersFinished}. Local player (${localPlayer.playerName}) finished: ${localPlayer.isFinished}`);

        if (this.isHost) {
            if (localPlayer.isFinished && !allPlayersFinished) {
                // Host is finished, but others are still playing
                if (this.gamePhase !== 'waiting_for_finish') {
                     console.log("MP Host: Finished, but waiting for other players. Showing waiting UI.");
                     this.gamePhase = 'waiting_for_finish';
                     this.timer.stop(); // Stop host timer if somehow running
                     this.mainMenu.gameAreaController.showWaitingUi("Je bent klaar! Wachten op andere spelers...");
                     
                     // Optionally hide Next button if it was somehow visible
                     this.mainMenu.gameAreaController.hideNextButton();
                     // Broadcast the waiting state so clients know the host is waiting
                     this.broadcastGameState();
                }
                // Don't end the game yet, host needs to wait.
                return; // Exit the check early
            } else if (allPlayersFinished) {
                // All players are finished, host ends the game for everyone
                console.log("MP Host: All players finished. Ending the game.");
                this.endMultiplayerGame();
            } else {
                // Host is not finished, game continues
                console.log("MP Host: Still playing, game continues.");
            }
        } else {
            // Client logic: Game end is triggered by host message/state update.
            // Clients might check allPlayersFinished locally to update their own UI status if needed.
            if (allPlayersFinished) {
                 console.log("MP Client: Detected all players finished based on local state.");
                 // Can optionally show a preliminary "waiting for results" state here
                 if (this.gamePhase !== 'ended' && this.gamePhase !== 'waiting_for_finish') {
                      // Avoid overwriting host's waiting message if client finishes last
                       // this.mainMenu.gameAreaController.showWaitingUi("Game finished! Waiting for results...");
                 }
            }
        }
    }

    /**
     * Ends the multiplayer game session for all players. Cleans up timers, determines winner, shows results.
     * Usually called by the host when all players are finished.
     */
    async endMultiplayerGame() { // <<< Added async
        console.log("MP endMultiplayerGame: Ending game.");
        this.gamePhase = 'ended'; // Explicitly set phase
        console.log("MP endMultiplayerGame: Game phase set to ended.");

        // Stop timers and cleanup UI
        this.mainMenu.gameAreaController.hide();

        const playersArray = Array.from(this.players.values());

        // Determine winner(s)
        let winnerInfo = null;
        if (playersArray.length > 0) {
            const sortedPlayers = [...playersArray].sort((a, b) => b.score - a.score);
            const topScore = sortedPlayers[0].score;
            const winners = sortedPlayers.filter(p => p.score === topScore);
            // If there's a clear single winner or multiple winners (tie), use the first one for winnerInfo
            // The DialogController will handle displaying "Gelijkspel" if winners.length > 1
            if (winners.length > 0) {
                winnerInfo = winners[0];
            }
        }

        // Host: Send results to clients
        if (this.isHost) {
            console.log("MP Host: Broadcasting final results:", playersArray, winnerInfo);
            this.webRTCManager.broadcast({
                type: MessageTypes.H_FINAL_RESULTS,
                playersArray: playersArray,
                winnerInfo: winnerInfo // Send winner info
            });

            // <<< NEW: Broadcast Highscore if applicable >>>
            if (winnerInfo && this.players.size > 1) {
                const gameName = this._getMultiplayerNameForHighscore();
                console.log(`MP Host: Broadcasting highscore record for ${winnerInfo.playerName} (Score: ${winnerInfo.score})`);
                this.webRTCManager.broadcast({
                    type: MessageTypes.H_RECORD_HIGHSCORE,
                    gameName: gameName,
                    playerName: winnerInfo.playerName,
                    score: winnerInfo.score,
                    isMultiplayer: true,
                    difficulty: this.difficulty
                });
            }
            // <<< END NEW >>>

            // HOST: Check if host won and save highscore
            if (winnerInfo && winnerInfo.peerId === this.webRTCManager.peerId && this.players.size > 1) { // Only save if winner AND > 1 player
                const gameName = this._getMultiplayerNameForHighscore();
                console.log(`MP HOST WIN: Saving highscore for ${this.playerName} (Score: ${winnerInfo.score}, Game: ${gameName})`);
                
                // --- Defensive Logging Removed --- 

                try {
                    // <<< CORRECTED CALL: Use HighscoresManager >>>
                    await this.mainMenu.highscoresManager.addScore(
                        gameName, 
                        this.playerName, 
                        winnerInfo.score, 
                        this.isMultiplayer, // Pass true for multiplayer
                        this.difficulty // Pass the game difficulty
                    );
                    console.log("MP HOST WIN: Successfully CALLED addScore."); 
                } catch (saveError) {
                    console.error(`MP HOST WIN: Error calling addScore:`, saveError);
                }
            } else {
                 console.log("MP HOST: Host did not win or tied, or only one player. Not saving highscore.");
            }
        }

        // Both Host and Client show the results
        this._handleFinalResults(playersArray, this.webRTCManager.peerId, winnerInfo);

        // Perform cleanup AFTER showing results
        //this.cleanup();
    }

    /**
     * Handles displaying the final results using the DialogController.
     * Called locally by host/client after receiving necessary data.
     * Passes the full player list to the dialog controller for dynamic display.
     * @param {Array<Object>} playersArray - Array of ALL player objects {peerId, playerName, score, isFinished}.
     * @param {string} localPlayerId - The peer ID of the local player (potentially useful for highlighting).
     * @param {Object|null} winnerInfo - Information about the winner {peerId, playerName, score, ...}.
     * @private
     */
    async _handleFinalResults(playersArray, localPlayerId, winnerInfo) { // <<< Added async
        console.log("MP _handleFinalResults: Received final results.", { playersArray, localPlayerId, winnerInfo });
        this.gamePhase = 'ended'; // Ensure phase is correct
        this.mainMenu.gameAreaController.hide(); // Hide game area

        // <<< NEW: Navigate to Highscores View FIRST >>>
        console.log("MP _handleFinalResults: Navigating to highscores view before showing dialog.");
        try {
            await this.mainMenu.showView('highscores'); // Ensure this navigation happens
            console.log("MP _handleFinalResults: Navigation to highscores view initiated/completed.");
        } catch (error) {
             console.error("MP _handleFinalResults: Error navigating to highscores view:", error);
             // Continue anyway? Or show an error? Let's try to continue.
        }
        // <<< END NEW >>>

        // <<< Store results for validation >>>
        this._lastReceivedWinnerInfo = winnerInfo;

        // CLIENT: Check if local client won and save highscore
        if (!this.isHost && winnerInfo && winnerInfo.peerId === localPlayerId && playersArray.length > 1) { // Only save if winner AND > 1 player
            const gameName = this._getMultiplayerNameForHighscore();
            console.log(`MP CLIENT WIN: Saving highscore for ${this.playerName} (Score: ${winnerInfo.score}, Game: ${gameName})`);

            // --- Defensive Logging Removed ---

            try {
                // <<< CORRECTED CALL: Use HighscoresManager >>>
                 await this.mainMenu.highscoresManager.addScore(
                    gameName,
                    this.playerName,
                    winnerInfo.score,
                    this.isMultiplayer, // Pass true for multiplayer
                    this.difficulty // Pass the game difficulty
                );
                 console.log("MP CLIENT WIN: Successfully CALLED addScore.");
            } catch (saveError) {
                 console.error(`MP CLIENT WIN: Error calling addScore:`, saveError);
            }
        } else if (!this.isHost) {
             console.log("MP CLIENT: Client did not win or tied, not saving highscore.");
        }

        // Use DialogController to show the results (OVER the highscores view)
        console.log("MP _handleFinalResults: Displaying multiplayer results dialog.");
        this.mainMenu.dialogController.displayMultiplayerResults(playersArray, winnerInfo, localPlayerId);

        // Cleanup is handled in endMultiplayerGame after this call returns
    }

    // --- State Management & Cleanup ---

    /**
     * Resets the multiplayer state, cleaning up connections, timers, and UI elements.
     * Stops the game timer, cleans up the WebRTC manager, clears player data, and resets related UI controllers.
     * Should be called when stopping a game, encountering critical errors, or before starting a new session.
     */
    resetMultiplayerState() {
        console.log("MP: Resetting multiplayer state");
        this.mainMenu.gameAreaController.resetUI();

        // *** REVERT/CONFIRM: Stop 'this.timer' and nullify ***
         if (this.timer) {
            console.log("MP: Stopping existing timer instance during reset.");
            this.timer.stop();
        }
        this.timer = null; // Explicitly nullify

        this.webRTCManager.cleanup();
        this.players = new Map();
        this.gamePhase = 'lobby';
        this.currentQuestionIndex = -1;
        this.currentQuestions = [];
        this.mainMenu.multiplayerController.resetUI();
    }

     /**
      * Cleans up the WebRTC connection and resets the game state.
      * Includes navigating back to the main menu.
      */
     cleanup() {
         console.log("MP: Cleaning up multiplayer game session.");
         this.resetMultiplayerState(); // Stops timer, cleans WebRTC, resets state

         // Explicitly check if mainMenu and showView method are available before navigating
         if (this.mainMenu && typeof this.mainMenu.showView === 'function') {
            this.mainMenu.showView('mainMenu'); // Navigation happens here
         } else {
              console.warn("MP: Cannot navigate back to main menu - MainMenu or showView not available during cleanup.");
         }
     }

    // --- Player Name ---

    /**
     * Updates the local player's name, saves it, and notifies the host if this instance is a client.
     * @param {string} newName - The new player name.
     */
    updatePlayerName(newName) {
         const trimmedName = newName.trim();
         if (!trimmedName) {
             console.warn("MP: Attempted to update player name to empty string. Ignoring.");
             return; // Don't allow empty names
         }

         if (trimmedName !== this.playerName) {
             console.log(`MP: Updating player name locally from "${this.playerName}" to: "${trimmedName}"`);
             this.playerName = trimmedName;
             localStorage.setItem('unicornPoepPlayerName', trimmedName); // Persist name

             // Update own entry in players map if it exists
             const localId = this.webRTCManager.peerId;
             if (localId && this.players.has(localId)) {
                  this.players.get(localId).playerName = this.playerName;
                  // Update local UI immediately (e.g., opponent list if shown)
                  this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, localId);
             }

                 // If HOST, broadcast the change so others update their lists
                 if (this.isHost) {
                console.log("MP Host: Broadcasting name change via game state.");
                 // Broadcasting full state is simpler and covers this change.
                     this.broadcastGameState();
                 }
             // *** If CLIENT, notify the host ***
             else if (this.webRTCManager.isActive()) {
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
         this.webRTCManager.send({
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
         this.mainMenu.gameAreaController.displayChatMessage(senderName, text);
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
         const trimmedName = newName.trim();
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
        if (!this.webRTCManager.isActive()) {
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
        // --- REMOVED direct phase copy from host --- 
        // this.gamePhase = state.gamePhase || this.gamePhase;

        // --- Check for definitive END state from host --- 
        if (state.gamePhase === GamePhases.FINISHED) {
            console.log("MP Client: Received FINISHED phase from host. Setting local phase.");
            this.gamePhase = GamePhases.FINISHED;
            this.mainMenu.gameAreaController.hideWaitingUi(); // Hide waiting if shown
             // Let H_FINAL_RESULTS message handle showing the end dialog.
            if (this.timer) this.timer.stop(); // Stop timer if it was somehow running
            return; // Don't process further player updates if game is finished
        }

        // --- Timer Initialization (only if game is starting/playing locally) ---
        // Re-evaluate condition: Initialize only if the client is moving into 'playing'
        // and doesn't already have a timer.
        // Note: 'playing' phase is set locally in startGameLocally
        console.log(`MP Client: Timer check. Local Phase=${this.gamePhase}, PrevPhase=${previousPhase}, Difficulty=${this.difficulty}, TimerExists=${!!this.timer}`);
        if (this.gamePhase === 'playing' && !this.timer) {
             if (!this.difficulty) {
                console.error("MP Client: Cannot initialize timer, difficulty not set!");
                this.handleFatalError("Kon timer niet starten: Spel moeilijkheid onbekend.");
                return;
            }
            console.log(`MP Client: --> INITIALIZING ScoreTimer for difficulty '${this.difficulty}'.`);
            this.timer = new ScoreTimer(this.difficulty);
            console.log(`MP Client: --> Timer object AFTER init:`, this.timer);
        } else if (this.gamePhase !== 'playing' && this.timer) {
             console.log("MP Client: Game not in playing phase, ensuring timer is stopped.");
             this.timer.stop();
        }

        // Update player data from host state
        if (state.players && Array.isArray(state.players)) {
             const localPlayerId = this.webRTCManager.peerId;
             state.players.forEach(pInfo => {
                const existingPlayer = this.players.get(pInfo.peerId);
                 if (existingPlayer) {
                    // *** FIX: Only update score/status for OTHER players from host state ***
                    if (pInfo.peerId !== localPlayerId) {
                        console.log(`MP Client handleGameStateUpdate: Updating opponent (${pInfo.playerName}) score to ${pInfo.score}, finished to ${pInfo.isFinished}`);
                        existingPlayer.score = pInfo.score;
                        existingPlayer.isFinished = pInfo.isFinished;
                        existingPlayer.currentQuestionIndex = pInfo.currentQuestionIndex; 
                    } else {
                        // For the local player, only update isFinished status and maybe index if needed?
                        // Score is managed locally by client's processAnswer.
                        console.log(`MP Client handleGameStateUpdate: Updating local player finished status to ${pInfo.isFinished} (Score is managed locally)`);
                        existingPlayer.isFinished = pInfo.isFinished;
                        // Should we sync local player index from host? Maybe not, client progresses independently.
                        // existingPlayer.currentQuestionIndex = pInfo.currentQuestionIndex; 
                    }
                 } else {
                     console.warn("MP Client: Received state for unknown player:", pInfo.peerId);
                     this.players.set(pInfo.peerId, pInfo); // Add if missing (will get full info)
                 }

                 // Logging received scores (no change here)
                 if (pInfo.peerId === localPlayerId) {
                      console.log(`MP Client handleGameStateUpdate: Local score (${pInfo.playerName}) is ${pInfo.score}. updateOpponentDisplay will handle UI.`);
                      // *** REMOVED: Redundant updateScore call ***
                      // this.mainMenu.gameAreaController.updateScore(pInfo.score);
                 } else {
                      console.log(`MP Client handleGameStateUpdate: Opponent score (${pInfo.playerName}) is ${pInfo.score}. updateOpponentDisplay will handle UI.`);
                      // *** REMOVED: Redundant call ***
                      // this.mainMenu.gameAreaController.updateOpponentScore(pInfo.score);
                      // Check if opponent got score update to show confetti (compare previous vs current)
                      // This might be complex, maybe confetti only on local correct answer is enough.
                 }
             });
             // Update the opponent list display which shows names/status/scores together
             console.log("MP Client handleGameStateUpdate: Calling updateOpponentDisplay to refresh all scores.");
             this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, localPlayerId);
        }

        // Update local finished flag based on received state
        const localPlayerData = this.players.get(this.webRTCManager.peerId);
        if (localPlayerData) { // Check if local player data exists
            this.localPlayerFinished = localPlayerData.isFinished || false;
        } else {
            console.warn("MP Client handleGameStateUpdate: Could not find local player data to update finished flag.");
            this.localPlayerFinished = false; // Default if not found
        }

        // Update UI based on local finished status or game phase
        // REMOVED: Redundant check for state.gamePhase === GamePhases.FINISHED (handled above)
        /* if (state.gamePhase === GamePhases.FINISHED) { ... } */
        
        // Control Waiting UI based *only* on local finished status
        if (this.localPlayerFinished) {
            console.log("MP Client: Local player IS finished. Showing waiting UI.");
            this.mainMenu.gameAreaController.showWaitingUi("Wachten tot anderen klaar zijn...");
            if (this.timer) this.timer.stop(); // Stop timer if local player finished
        } else if (this.gamePhase === 'playing'){
             // If game is playing AND local player is NOT finished, ensure waiting UI is hidden
             console.log("MP Client: Game ongoing, local player NOT finished. Ensuring waiting UI is hidden.");
             this.mainMenu.gameAreaController.hideWaitingUi();
        }

    }

    /**
     * Handles answer selection logic for both host and client.
     * Calculates score based on correctness and timer *before* stopping the timer.
     * @param {string} selectedAnswer - The answer text selected by the player.
     * @param {Event} event - The click event.
     */
    handleAnswerSelection(selectedAnswer, event) {
        if (!selectedAnswer || this.blockInteraction || this.gamePhase !== 'playing') {
             console.log(`MP handleAnswerSelection: Blocked interaction (Answer: ${selectedAnswer}, Blocked: ${this.blockInteraction}, Phase: ${this.gamePhase})`);
             return;
         }

        console.log(`MP handleAnswerSelection: Processing local answer "${selectedAnswer}" (Type: ${typeof selectedAnswer}). IsHost: ${this.isHost}`);
        this.blockInteraction = true; // Block interaction FIRST

        const currentQData = this.currentQuestions[this.currentQuestionIndex];
        if (!currentQData) {
             console.error(`MP handleAnswerSelection: CRITICAL - No question data found for index ${this.currentQuestionIndex}. Aborting processing.`);
             this.blockInteraction = false; // Allow potential recovery?
             // No need to enable answers here, proceeding will likely cause issues.
             return;
        }
        console.log(`MP handleAnswerSelection: Fetched currentQData:`, JSON.parse(JSON.stringify(currentQData || {})));

        const actualCorrectAnswer = currentQData.answer;
        console.log(`MP handleAnswerSelection: Comparing selectedAnswer "${selectedAnswer}" with currentQData.answer "${actualCorrectAnswer}"`);
        const isCorrect = typeof actualCorrectAnswer !== 'undefined' && selectedAnswer == actualCorrectAnswer;
        console.log(`MP handleAnswerSelection: Answer isCorrect = ${isCorrect}`);

        let scoreToAdd = 0;
        if (isCorrect) {
            if (this.timer && typeof this.timer.calculateScore === 'function') {
                // *** ADD DETAILED TIMER LOGGING ***
                console.log(`MP handleAnswerSelection: Timer object state JUST BEFORE calculateScore():`, this.timer);
                 // Attempt to log potentially relevant internal state if Timer/ScoreTimer structure is known/guessable
                 try {
                      // Use JSON.stringify to capture state, handle circular refs if necessary
                     const timerStateString = JSON.stringify(this.timer, (key, value) => {
                          // Simple circular reference handler example (adjust if needed)
                          // if (key === '_someCircularRef') return '[Circular]';
                          return value;
                     });
                     console.log(`MP handleAnswerSelection: Timer state (JSON): ${timerStateString}`);
                 } catch (e) {
                     console.warn("MP handleAnswerSelection: Could not stringify timer state:", e);
                 }
                 // *** END DETAILED LOGGING ***

                // *** Add check for timer type BEFORE stop ***
                if (this.timer) {
                     console.log(`MP handleAnswerSelection: Checking timer instance BEFORE stop. Constructor: ${this.timer.constructor.name}`);
                 } else {
                     console.log(`MP handleAnswerSelection: Timer is null/undefined BEFORE stop.`);
                 }

                // Stop the timer BEFORE calculating score
                this.timer.stop(); // Direct call - will throw error if timer is null/undefined

                scoreToAdd = this.timer.calculateScore(); // Calculate score
                console.log(`MP handleAnswerSelection: Score calculated AFTER stop: ${scoreToAdd}`); // Log the result immediately
            } else {
                console.warn("MP handleAnswerSelection: Timer or calculateScore method missing! Awarding default score (10).");
                scoreToAdd = 10; // Fallback
            }
        }

        // Timer is already stopped above
        // this.timer.stop(); // REMOVED FROM HERE
        this.mainMenu.gameAreaController.disableAnswers();

        const localPeerId = this.webRTCManager.peerId;
        if (localPeerId) {
            console.log(`MP handleAnswerSelection: Processing answer locally for player ${localPeerId}.`);
            // *** FIX: Pass calculated scoreToAdd to processAnswer ***
            this.processAnswer(localPeerId, this.currentQuestionIndex, selectedAnswer, isCorrect, scoreToAdd, event.target);
        } else {
            console.error("MP handleAnswerSelection: Cannot process local answer - local PeerID is missing.");
            this.blockInteraction = false;
            this.mainMenu.gameAreaController.enableAnswers();
            return;
        }

        // Host specific logic: Broadcast state
        if (this.isHost) {
            console.log("MP Host: Broadcasting game state after processing own answer.");
            this.broadcastGameState();

            // Also check if game should end after processing client answer
            if (this.checkIfAllFinished()) {
                 console.log("MP Host: All players finished after processing client answer!");
                 this.gamePhase = GamePhases.FINISHED;
                 this.broadcastGameState(); // Broadcast final state
                 this.endGame(true); // Host can end immediately
            }
        }
        // Client specific logic: Send answer AND SCORE to host
        else {
             // Ensure scoreToAdd is defined and is a number before sending
            const finalScoreToAdd = (typeof scoreToAdd === 'number') ? scoreToAdd : 0;
            const clientQuestionIndex = this.currentQuestionIndex; // Get client's current index
            const questionText = currentQData.question; // Get the actual question text

             console.log(`MP Client (${localPeerId}): Sending answer='${selectedAnswer}', text='${questionText}', score=${finalScoreToAdd} for clientIndex=${clientQuestionIndex} to host.`);
             if (this.webRTCManager && this.webRTCManager.isActive()) { // Check if manager is active
                // *** FIX: Send questionText and clientQuestionIndex ***
                 this.webRTCManager.send({
                     type: MessageTypes.C_SUBMIT_ANSWER,
                     // questionIndex: this.currentQuestionIndex, // OLD
                     clientQuestionIndex: clientQuestionIndex, // NEW
                     questionText: questionText, // NEW
                     answer: selectedAnswer,
                     scoreToAdd: finalScoreToAdd
                 });
             } else {
                 console.error(`MP Client: Cannot send answer - WebRTCManager not active or hostConnection missing.`);
             }
        }

        // Check if the local player just finished
        const localPlayer = this.players.get(localPeerId);
        if (localPlayer && localPlayer.isFinished) {
            // Player just finished with this answer
            console.log(`MP handleAnswerSelection: Local player ${localPeerId} finished. Calling handleLocalPlayerFinished.`);
            this.handleLocalPlayerFinished();
            // DO NOT show the Next button in this case
        } else if (localPlayer) { // Only show Next if player exists and is NOT finished
            // Player answered but is not finished yet
            console.log(`MP handleAnswerSelection: Showing Next button for local player ${localPeerId} because they are not finished.`);
            this.mainMenu.gameAreaController.showNextButton();
        } else {
            // Handle case where local player data wasn't found (shouldn't happen ideally)
            console.error(`MP handleAnswerSelection: Cannot find local player data (${localPeerId}) after processing answer.`);
        }

        // REMOVED unconditional showNextButton from here
        // console.log(`MP handleAnswerSelection: Showing Next button for local player ${localPeerId}.`); 

        console.log(`MP handleAnswerSelection: Finished processing event for answer "${selectedAnswer}".`);
    }

    /**
     * Processes an answer for a given player (updates player state, shows feedback).
     * Uses the pre-calculated score passed from handleAnswerSelection.
     * @param {string} peerId - The peer ID of the player who answered.
     * @param {number} questionIndex - The index of the question answered.
     * @param {string} selectedAnswer - The answer chosen.
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} scoreToAdd - The score calculated before the timer was stopped.
     * @param {HTMLElement | null} [targetButton] - The button element clicked (optional).
     * @private
     */
    processAnswer(peerId, questionIndex, selectedAnswer, isCorrect, scoreToAdd, targetButton = null) {
        const player = this.players.get(peerId);
        if (!player) {
            console.error(`MP processAnswer: Cannot find player with ID: ${peerId}`);
            return;
        }
        console.log(`MP processAnswer START: Player ${player.playerName} (${peerId}) initial score: ${player.score}`);

        // *** CORRECTED CHECK: Only ignore if THIS PLAYER already processed this question index ***
        // The old check was: if (questionIndex !== this.currentQuestionIndex || player.currentQuestionIndex > questionIndex) {
        if (player.currentQuestionIndex >= questionIndex) { // Use >= to prevent processing same or older index
             console.warn(`MP processAnswer: Ignoring answer for Q${questionIndex} from ${player.playerName}. Player already processed up to Q${player.currentQuestionIndex}`);
             return;
        }

        console.log(`MP processAnswer: Processing answer from ${player.playerName} (${peerId}) for Q${questionIndex}. Correct: ${isCorrect}. ScoreToAdd: ${scoreToAdd}`);

        // --- Update Player State (Score & Progress) ---
        if (isCorrect) {
            player.score += scoreToAdd;
            console.log(`MP processAnswer: Updated player ${player.playerName} score to ${player.score}`);
        }

        // IMPORTANT: Update the player's PROGRESS marker to reflect the question index *just answered*
        player.currentQuestionIndex = questionIndex;
        console.log(`MP processAnswer: Updated player ${player.playerName} currentQuestionIndex to ${questionIndex}`);

        // --- UI Updates (if it's the LOCAL player) ---
        if (peerId === this.webRTCManager.peerId) {
            console.log(`MP processAnswer: Updating local UI for answer to Q${questionIndex}`);
            this.mainMenu.gameAreaController.disableAnswers();
            // REMOVED: this.mainMenu.gameAreaController.updateScore(player.score); - Handled by updateOpponentDisplay
            this.mainMenu.gameAreaController.showFeedback(isCorrect, this.currentQuestions[questionIndex].answer, targetButton);
            this.mainMenu.gameAreaController.showNextButton(); // Show next button *after* local processing
        }

        // --- Update Opponent Display for ALL players (including local score update) ---
        console.log(`MP processAnswer: Calling updateOpponentDisplay after processing for ${player.playerName}`);
        this.mainMenu.gameAreaController.updateOpponentDisplay(this.players, this.webRTCManager.peerId);

        // --- Check if THIS player finished the game ---
        // Check if the question index just processed is the last one (index is 0-based)
        if (player.currentQuestionIndex >= this.currentQuestions.length - 1) {
             player.isFinished = true;
             console.log(`MP processAnswer: Player ${player.playerName} (${peerId}) marked as finished after answering Q${player.currentQuestionIndex}.`);
        }

        // --- Check Game End (checks if ALL active players are finished) ---
        // REMOVED: this.checkIfPlayerFinished(peerId);
        this.checkMultiplayerEnd();

        console.log(`MP processAnswer END: Player ${player.playerName} (${peerId}) final state for this step: score=${player.score}, index=${player.currentQuestionIndex}, finished=${player.isFinished}`);
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

    /**
     * Checks if all players in the game have finished.
     * @returns {boolean} True if all players are finished, false otherwise.
     * @private
     */
    checkIfAllFinished() {
        if (!this.players || this.players.size === 0) return false; // Can't be finished if no players map or it's empty
        // Check if we have at least the expected number of players (e.g., 2 for 1v1)
        // This prevents ending prematurely if a player disconnects before finishing.
        // Adjust the expected number if group sizes change.
        const expectedPlayers = 2; // TODO: Make this dynamic if lobby size changes?
        if (this.players.size < expectedPlayers) {
            // console.log("MP checkIfAllFinished: Not enough players connected to finish.");
            return false;
        }

        for (const player of this.players.values()) {
            if (!player.isFinished) {
                return false; // Found a player who is not finished
            }
        }
        console.log("MP checkIfAllFinished: All connected players are finished.");
        return true; // All players are finished
    }

    /**
     * Handles a non-fatal connection failure during the initial client connection attempt.
     * Updates the UI to show the error without tearing down the whole game state yet.
     * @param {string} errorMessage - The specific connection error message.
     */
    handleConnectionFailed(errorMessage) {
        console.warn("MP Game: Handling non-fatal connection failure.", errorMessage);
        // Update UI via MultiplayerController to show the error
        if (this.mainMenu && this.mainMenu.multiplayerController && typeof this.mainMenu.multiplayerController.showConnectionError === 'function') {
             this.mainMenu.multiplayerController.showConnectionError(errorMessage, true); // Keep join view visible
        } else {
             console.error("MP Game: Cannot display connection error - MultiplayerController or showConnectionError missing.");
             // Fallback? Maybe alert?
             // alert(`Connection Failed: ${errorMessage}`); 
        }
        // Cleanup WebRTC even on non-fatal connection error to ensure clean state
        if (this.webRTCManager) {
             console.log("MP Game: Cleaning up WebRTCManager after connection failure.");
             this.webRTCManager.cleanup();
        }
        // Don't cleanup the MultiplayerGame instance itself here, let the user decide to go back via UI
        this.gamePhase = 'idle'; // Set phase to idle so they can retry or go back
    }

    // --- Utility & State ---

    /**
     * Creates a standardized game name string for high score saving.
     * Uses selected sheet names and difficulty.
     * @returns {string} The formatted game name (e.g., "Tafel van 1, Tafel van 2 (Multiplayer Medium)")
     * @private
     */
    _getMultiplayerNameForHighscore() {
        const sheetString = this.selectedSheets && this.selectedSheets.length > 0
            ? this.selectedSheets.join(', ')
            : "Onbekend";
        const difficultyString = this.difficulty ? ` (Multiplayer ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)})` : " (Multiplayer)";
        return `${sheetString}${difficultyString}`;
    }

    /**
     * HOST/CLIENT: Handles the H_RECORD_HIGHSCORE message broadcast by the host.
     * Saves the score to the local HighscoresManager.
     * @param {object} message - The message containing highscore details.
     */
    async handleRecordHighscore(message) {
        console.log("MP handleRecordHighscore: Received request to record highscore:", message);
        
        // <<< VALIDATION >>>
        if (!this._lastReceivedWinnerInfo) {
            console.warn("MP handleRecordHighscore: Ignoring save request - No final winner info available for validation.");
            return;
        }
        if (this._lastReceivedWinnerInfo.playerName !== message.playerName || 
            this._lastReceivedWinnerInfo.score !== message.score ||
            !message.isMultiplayer) { // Basic check
            console.warn("MP handleRecordHighscore: Ignoring save request - Broadcasted score details do not match validated final results.", {
                broadcasted: message,
                validated: this._lastReceivedWinnerInfo
            });
            // Optionally show a silent warning toast?
             this.mainMenu?.toastNotification?.show("Highscore info niet gevalideerd.", 3000);
            return;
        }
        console.log("MP handleRecordHighscore: Validation passed. Proceeding with save.");
        // Clear the stored info after validation (optional, prevents re-saving from same game)
        // this._lastReceivedWinnerInfo = null; 
        // <<< END VALIDATION >>>

        try {
            if (!this.mainMenu || !this.mainMenu.highscoresManager) {
                 throw new Error("HighscoresManager not available via mainMenu.");
            }
            await this.mainMenu.highscoresManager.addScore(
                message.gameName, 
                message.playerName, 
                message.score, 
                message.isMultiplayer, 
                message.difficulty
            );
            console.log(`MP handleRecordHighscore: Successfully saved score locally for ${message.playerName}.`);
        } catch (error) {
            console.error(`MP handleRecordHighscore: Failed to save score locally:`, error);
            // Maybe show a non-critical toast notification? 
            this.mainMenu?.toastNotification?.show("Fout bij opslaan highscore.", 3000);
        }
    }

}

// Ensure the class is available globally if needed by index.html initialization logic
// window.MultiplayerGame = MultiplayerGame; // Uncomment if necessary, but index.html seems to instantiate directly. 