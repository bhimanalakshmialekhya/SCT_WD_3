document.addEventListener('DOMContentLoaded', () => {
    // Structural DOM Reference Hooks
    const gameModeSelect = document.getElementById('gameMode');
    const p2Panel = document.getElementById('p2-panel');
    const p2Label = document.getElementById('p2Label');
    const p2NameInput = document.getElementById('p2Name');
    const p1NameInput = document.getElementById('p1Name');
    const p1EmojiSelect = document.getElementById('p1Emoji');
    const p2EmojiSelect = document.getElementById('p2Emoji');
    const applyConfigBtn = document.getElementById('applyConfigBtn');
    
    const cardP1 = document.getElementById('card-p1');
    const cardP2 = document.getElementById('card-p2');
    const scoreName1 = document.getElementById('scoreName1');
    const scoreName2 = document.getElementById('scoreName2');
    const scoreEmoji1 = document.getElementById('scoreEmoji1');
    const scoreEmoji2 = document.getElementById('scoreEmoji2');
    const scoreVal1 = document.getElementById('scoreVal1');
    const scoreVal2 = document.getElementById('scoreVal2');
    
    const statusBox = document.getElementById('statusBox');
    const cells = document.querySelectorAll('.cell');

    // Isolated Score Databases (Ensures configuration modes do not mix metrics)
    const scores = {
        pvp: { p1: 0, p2: 0 },
        pvc: { p1: 0, p2: 0 }
    };

    // Global Game State Tracker
    let state = {
        board: Array(9).fill(""),
        activePlayer: 1, // 1 = Player 1, 2 = Player 2 / Computer
        active: false,
        mode: "pvp", // pvp or pvc
        p1: { name: "Player 1", emoji: "❌" },
        p2: { name: "Player 2", emoji: "⭕" }
    };

    const winMatrix = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontal
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Vertical
        [0, 4, 8], [2, 4, 6]             // Diagonal
    ];

    /* --- Handles Game Mode Changes --- */
    gameModeSelect.addEventListener('change', () => {
        if (gameModeSelect.value === 'pvc') {
            p2Label.textContent = "Player 2 (AI Override)";
            p2NameInput.value = "Computer";
            p2NameInput.disabled = true;
        } else {
            p2Label.textContent = "Player 2 (O)";
            p2NameInput.value = "Player 2";
            p2NameInput.disabled = false;
        }
    });

    /* --- Re-evaluates configuration inputs and loads engine state --- */
    function initSession() {
        let p1Emoji = p1EmojiSelect.value;
        let p2Emoji = p2EmojiSelect.value;

        // Validation rule: Enforce unique markers to prevent UI logic overlap
        if (p1Emoji === p2Emoji) {
            alert("Players must select different emojis to prevent game collision.");
            return;
        }

        state.mode = gameModeSelect.value;
        state.p1.name = p1NameInput.value.trim() || "Player 1";
        state.p1.emoji = p1Emoji;

        if (state.mode === 'pvc') {
            state.p2.name = "Computer";
        } else {
            state.p2.name = p2NameInput.value.trim() || "Player 2";
        }
        state.p2.emoji = p2Emoji;

        // Map data arrays to UI layers
        scoreName1.textContent = state.p1.name;
        scoreEmoji1.textContent = state.p1.emoji;
        scoreName2.textContent = state.p2.name;
        scoreEmoji2.textContent = state.p2.emoji;

        updateScoreUI();
        clearBoard();
        state.active = true;
        setTurn(1);
    }

    /* --- Sync UI Scores based on Active Database Path --- */
    function updateScoreUI() {
        const currentScoreSet = scores[state.mode];
        scoreVal1.textContent = currentScoreSet.p1;
        scoreVal2.textContent = currentScoreSet.p2;
    }

    /* --- Reset Matrix Elements --- */
    function clearBoard() {
        state.board.fill("");
        cells.forEach(cell => {
            cell.textContent = "";
            cell.className = "cell"; // Clears tracking highlights & modifiers
        });
    }

    /* --- Context Switching Component --- */
    function setTurn(playerIndex) {
        state.activePlayer = playerIndex;
        if (playerIndex === 1) {
            cardP1.classList.add('active-turn');
            cardP2.classList.remove('active-turn');
            statusBox.textContent = `${state.p1.name}'s Turn (${state.p1.emoji})`;
        } else {
            cardP2.classList.add('active-turn');
            cardP1.classList.remove('active-turn');
            statusBox.textContent = `${state.p2.name}'s Turn (${state.p2.emoji})`;

            // If the Computer mode is active, block manual inputs and run calculations
            if (state.mode === 'pvc' && state.active) {
                setTimeout(executeComputerMove, 600); // Small delay to mimic processing
            }
        }
    }

    /* --- Grid Cell Intercept Click Handler --- */
    cells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));

            // Condition locks down writing to filled spaces, inactive sessions, or during AI processing
            if (!state.active || state.board[index] !== "") return;
            if (state.mode === 'pvc' && state.activePlayer === 2) return;

            commitMove(index);
        });
    });

    /* --- Commit State Transformation on Board Array --- */
    function commitMove(index) {
        const currentMarker = state.activePlayer === 1 ? state.p1.emoji : state.p2.emoji;
        state.board[index] = currentMarker;
        
        cells[index].textContent = currentMarker;
        cells[index].classList.add('occupied');

        if (evaluateGameEnd()) return;

        // Switch turn
        setTurn(state.activePlayer === 1 ? 2 : 1);
    }

    /* --- Computer AI Move Processing Pipeline --- */
    function executeComputerMove() {
        if (!state.active) return;

        // Find available open grid indexes
        let availableIndexes = [];
        state.board.forEach((val, idx) => {
            if (val === "") availableIndexes.push(idx);
        });

        if (availableIndexes.length === 0) return;

        let selectedMove;

        // 1. Offense Check: Can the computer win in this execution loop?
        selectedMove = findStrategicGridIntersection(state.p2.emoji);

        // 2. Defense Check: Can the computer block a winning path for Player 1?
        if (selectedMove === null) {
            selectedMove = findStrategicGridIntersection(state.p1.emoji);
        }

        // 3. Fallback: Center Position Strategy
        if (selectedMove === null && availableIndexes.includes(4)) {
            selectedMove = 4;
        }

        // 4. Default: Select a random available index
        if (selectedMove === null) {
            const randomArrIndex = Math.floor(Math.random() * availableIndexes.length);
            selectedMove = availableIndexes[randomArrIndex];
        }

        commitMove(selectedMove);
    }

    /* --- AI Helper: Evaluates optimal position nodes --- */
    function findStrategicGridIntersection(markerToAnalyze) {
        for (let i = 0; i < winMatrix.length; i++) {
            const [a, b, c] = winMatrix[i];
            const matchCount = 
                (state.board[a] === markerToAnalyze ? 1 : 0) +
                (state.board[b] === markerToAnalyze ? 1 : 0) +
                (state.board[c] === markerToAnalyze ? 1 : 0);
            
            // If two positions are filled by the same marker and the third is open, return it
            if (matchCount === 2) {
                if (state.board[a] === "") return a;
                if (state.board[b] === "") return b;
                if (state.board[c] === "") return c;
            }
        }
        return null;
    }

    /* --- Evaluation Rules System Engine --- */
    function evaluateGameEnd() {
        // Scan array matrix for combination matches
        for (let i = 0; i < winMatrix.length; i++) {
            const [a, b, c] = winMatrix[i];
            if (state.board[a] !== "" && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
                declareWinner(winMatrix[i]);
                return true;
            }
        }

        // Check for Draw (No empty tiles remaining)
        if (!state.board.includes("")) {
            declareDraw();
            return true;
        }

        return false;
    }

    /* --- Game Winner Execution Loop --- */
    function declareWinner(winningLine) {
        state.active = false;
        
        // Apply visual neon pulse highlights to winning combination
        winningLine.forEach(idx => cells[idx].classList.add('win-highlight'));

        const winnerName = state.activePlayer === 1 ? state.p1.name : state.p2.name;
        statusBox.textContent = `🎉 ${winnerName} Wins This Round!`;

        // Log score inside proper tracking map path
        if (state.activePlayer === 1) {
            scores[state.mode].p1++;
        } else {
            scores[state.mode].p2++;
        }
        updateScoreUI();
    }

    /* --- Game Draw Handling Routine --- */
    function declareDraw() {
        state.active = false;
        statusBox.textContent = "🤝 It's a Perfect Draw!";
    }

    // Attach Event Triggers
    applyConfigBtn.addEventListener('click', initSession);

    // Initial Launch Routine
    initSession();
});