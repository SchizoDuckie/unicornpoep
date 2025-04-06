/**
 * Manages the specific dialog shown at the end of a multiplayer game.
 * Inherits from BaseDialog.
 */
class MultiplayerEndDialog extends BaseDialog {
    /**
     * @param {string} dialogId - The HTML ID of the dialog element.
     */
    constructor(dialogId) {
        super(dialogId);

        this.titleElement = this.querySelector('#multiplayerEndTitle');
        this.resultsElement = this.querySelector('#multiplayerEndResults');
        this.backButton = this.querySelector('#multiplayerEndBackButton'); // Specific back button ID

        if (!this.titleElement || !this.resultsElement || !this.backButton) {
            console.error("MultiplayerEndDialog: Missing required elements (title, results, or back button).");
        }

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Back button just closes the dialog
        this.backButton.addEventListener('click', () => this.hide());

        // Add listener for the dialog's close event (for ESC key)
        // Ensure onClose is bound correctly if it uses 'this'
        // No longer need onClose logic here, base 'close' event is enough
        // this.dialogElement.addEventListener('close', this.onClose.bind(this)); 
    }

    /** Sets the dialog title. */
    setTitle(text) {
        if (this.titleElement) {
            this.titleElement.textContent = text;
        } else {
            console.error("MultiplayerEndDialog: Title element not found!");
        }
    }

    /** Clears the results list area. */
    clearResults() {
        if (this.resultsElement) {
            this.resultsElement.innerHTML = ''; // Clear previous results
        } else {
            console.error("MultiplayerEndDialog: Results element not found!");
        }
    }

    /**
     * Adds a single player's result line to the dialog.
     * @param {string} name - Player's name.
     * @param {number} score - Player's score.
     * @param {boolean} isLocal - Whether this is the local player.
     * @param {boolean} isWinner - Whether this player is the winner (and it wasn't a tie).
     */
    addPlayerResult(name, score, isLocal, isWinner) {
        if (!this.resultsElement) return; // Guard clause

        const resultP = document.createElement('p');
        resultP.classList.add('player-result'); // Base class for styling

        let nameText = name;
        if (isLocal) {
            nameText += " (Jij)";
            resultP.classList.add('local-player');
        }
        if (isWinner) {
            resultP.classList.add('winner'); // Add winner class for styling
            nameText = `🏆 ${nameText}`; // Add trophy emoji
        }

        resultP.innerHTML = `<strong>${nameText}:</strong> ${score} punten`; // Use innerHTML for emoji

        this.resultsElement.appendChild(resultP);
    }

    /**
     * Shows the dialog. Assumes content (title, results) has been populated beforehand
     * by the DialogController.
     * REMOVED old parameters: hostName, hostScore, clientName, clientScore
     */
    show() { 
        // Content population is now done by DialogController before calling this show method.
        console.log("MultiplayerEndDialog: show() called.");
        // Optional: Trigger confetti here if desired
        if (typeof confetti === 'function') {
            console.log("MultiplayerEndDialog: Triggering confetti.");
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        }
        super.show(); // Call BaseDialog's show method to make it visible
    }

    /** Handles the Back button click. */
    handleBack() {
        // OBSOLETE / REMOVED - Listener directly calls hide()
        console.log("MultiplayerEndDialog: Back button clicked (calling hide).");
        this.hide(); 
    }

    /** Override onClose for ESC key or programmatic close */
    onClose() {
        // OBSOLETE / REMOVED - Base 'close' event is used by DialogController
        // This is called AFTER the dialog is hidden by browser/super.hide()
        super.onClose(); // Call base class onClose if it exists/does anything
        console.log("MultiplayerEndDialog: Closed via ESC or programmatically.");
    }
} 