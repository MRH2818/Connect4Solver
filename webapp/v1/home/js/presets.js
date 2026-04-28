/**
 * Applies a preset game configuration to the form fields.
 * This function relies on global functions `addPlayer()` and `removePlayer()`
 * from `addplayersdropdown.js` and specific `id` attributes on the form elements.
 * @param {object} config - The configuration object for the preset.
 */
function applyPreset(config) {
    // Get all radio inputs with class 'num-dimensions-radio'
    const numDimensionsInputs = document.querySelectorAll('.num-dimensions-radio');
    if (config.numDimensions) {
        numDimensionsInputs.forEach(input => {
            input.checked = (input.value == config.numDimensions);
        });
    }

    const boardSizeInput = document.getElementById("board-size");
    if (boardSizeInput) {
        boardSizeInput.value = config.boardSize;
        var steppers = document.querySelectorAll(".stepper[data-stepper-for]");
        steppers.forEach(function (stepper) {
            var id = stepper.getAttribute("data-stepper-for");
            if (!id) return;

            var input = document.getElementById(id);
            if (!input || !(input instanceof HTMLInputElement)) return;

            capBoardSizeMax(input);
        });
    }

    // Set agent settings (if applicable)
    const agentMaxDepthInput = document.getElementById("agentMaxDepth");
    if (config.agentMaxDepth) agentMaxDepthInput.value = config.agentMaxDepth;
    const agentMaxTimeInput = document.getElementById("agentMaxTime");
    if (config.agentMaxTime) agentMaxTimeInput.value = config.agentMaxTime;

    const agentMinDepthInput = document.getElementById("agentMinDepth");
    if (config.agentMinDepth) agentMinDepthInput.value = config.agentMinDepth;

    // Adjust player count and types
    const playersContainer = document.getElementById("players-container");
    if (playersContainer) {
        let currentPlayers = playersContainer.querySelectorAll(".playertile").length;
        const targetPlayers = config.players.length;

        // Add or remove players to match targetPlayers
        while (currentPlayers < targetPlayers) {
            if (typeof addPlayer === 'function') addPlayer(); // Ensure addPlayer is available
            currentPlayers++;
        }
        while (currentPlayers > targetPlayers) {
            // Remove the last player tile
            const lastPlayerTile = playersContainer.lastElementChild;
            if (lastPlayerTile) {
                const removeButton = lastPlayerTile.querySelector("button");
                if (removeButton && typeof removePlayer === 'function') {
                    removePlayer(removeButton); // Ensure removePlayer is available
                }
            }
            currentPlayers--;
        }

        // Set player types
        config.players.forEach((playerConfig, index) => {
            const playerNumber = index + 1;
            const selectElement = document.querySelector(`select[name="playertype_${playerNumber}"]`);
            if (selectElement) selectElement.value = playerConfig.type;
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const presetButtons = document.querySelectorAll(".preset-button");
    presetButtons.forEach(button => {
        button.addEventListener("click", () => {
            try {
                presetButtons.forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");

                const configString = button.dataset.config;
                const config = JSON.parse(configString);
                applyPreset(config);
            } catch (e) {
                console.error("Failed to apply preset:", e);
            }
        });
    });
});

// FOR CUSTOM SETTINGS:
document.addEventListener("DOMContentLoaded", function() {
    const toggleBtn = document.getElementById("toggle-custom-btn");
    const customSettings = document.getElementById("custom-settings");
    toggleBtn.addEventListener("click", function() {
        const isHidden = customSettings.style.display === "none";
        customSettings.style.display = isHidden ? "grid" : "none";
        toggleBtn.textContent = isHidden ? "Hide Custom Settings" : "Show Custom Settings";
    });
});
