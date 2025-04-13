/**
 * Handles the 'Game.Finished' event. Cleans up the game instance,
 * determines the winner (if any), handles high score saving,
 * and updates the UI.
 * @param {object} eventData - Data associated with the event.
 * @param {string} eventData.mode - The game mode that finished.
 * @param {object} eventData.gameData - Data about the finished game.
 * @param {Array<object>} eventData.finalResults - Array of player results.
 * @private
 * @async
 */
async handleGameFinished({ mode, gameData, finalResults }) {
    this.logger.log(`[${this.constructor.name} ASYNC] Received Game.Finished event for mode: ${mode}`, gameData);

    // 1. Cleanup the finished game instance
    await this.cleanupActiveGame(mode);
    this.logger.log(`[${this.constructor.name} ASYNC] Cleaning up active multiplayer-${mode} game.`);


    // 2. Process results and high scores based on mode
    if (mode === 'single') {
         // ... existing single player logic ...

    } else if (mode === 'multiplayer-host') {
        this.logger.log(`[${this.constructor.name} ASYNC] Processing Multiplayer Host finish.`);
        // Close the host connection now that the game is fully processed locally
        // and results are ready to be shown.

        // Determine winner(s) - Sort by score descending
        finalResults.sort((a, b) => b.score - a.score);
        const highestScore = finalResults.length > 0 ? finalResults[0].score : 0;
        const winners = finalResults.filter(p => p.score === highestScore && p.score > 0);

        // --- MODIFICATION START ---
        // Handle high score saving for potentially multiple players in a draw
        if (winners.length > 0 && highestScore > 0) {
            this.logger.log(`[${this.constructor.name} ASYNC] Checking ${winners.length} player(s) with score ${highestScore} for high score qualification.`);
            const gameName = this._deriveGameName(gameData);
            const difficulty = gameData.difficulty || this.i18n.t('joinInfoDefaultDifficulty');

            for (const winner of winners) {
                try {
                     // Check if this specific winner's score qualifies
                     const qualifies = await this.highscoreManager.isHighScore(winner.score, gameName, difficulty);
                     if (qualifies) {
                         this.logger.log(`[${this.constructor.name} ASYNC] Player ${winner.name}'s score of ${winner.score} qualifies. Saving...`);
                         await this.highscoreManager.saveScore(
                             winner.name || this.i18n.t('hsDefaultPlayerName'),
                             winner.score,
                             gameName,
                             difficulty
                         );
                     } else {
                         this.logger.log(`[${this.constructor.name} ASYNC] Player ${winner.name}'s score of ${winner.score} does not qualify for high scores.`);
                     }
                } catch (error) {
                    this.logger.error(`[${this.constructor.name} ASYNC] Error checking/saving high score for ${winner.name}:`, error);
                    this.uiManager.showToast(this.i18n.t('hsSaveError'), 'error'); // Use a generic save error message
                }
            }
        } else {
             this.logger.log(`[${this.constructor.name} ASYNC] No winner score > 0 found. No highscore saved.`);
        }
        // --- MODIFICATION END ---

        this.logger.log(`[${this.constructor.name} ASYNC] Requesting UIManager show Multiplayer End Dialog.`);
        this.uiManager.showView('MultiplayerEndDialog', { finalResults });

        // Close WebRTC connection AFTER processing results and telling UI to show them
         this.logger.log(`[${this.constructor.name} ASYNC] Closing WebRTC connection after Host game finished and processed.`);
         await this.webRTCManager.closeConnection();


    } else if (mode === 'multiplayer-client') {
         // ... existing client logic ...
    } else if (mode === 'practice') {
        // ... existing practice logic ...
    }

    // General post-game UI updates (like resetting timer/progress displays)
    // These might be handled by UIManager switching views or specific component resets
    this.eventBus.emit(EVENTS.UI.GAME_ENDED);

}

/**
 * Derives a user-friendly game name from game data.
 * Used for high score display.
 * @param {object} gameData - The game data containing sheet names etc.
 * @returns {string} A displayable game name.
 * @private
 */
_deriveGameName(gameData) {
    if (gameData && gameData.sheetTitles && gameData.sheetTitles.length > 0) {
        // Join selected sheet titles, limit length if necessary
        const maxLen = 30;
        let name = gameData.sheetTitles.join(', ');
        if (name.length > maxLen) {
            name = name.substring(0, maxLen - 3) + '...';
        }
        return name;
    }
    // Fallback for older data or custom games without explicit titles
    return gameData?.gameName || this.i18n.t('qmDefaultCustomName') || 'Game';
} 