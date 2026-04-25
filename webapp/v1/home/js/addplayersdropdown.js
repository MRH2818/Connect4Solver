// ADD NEW PLAYERS
let nextPlayerNumber = 3;

const NEXT_COLORS = ["orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "magenta", "rgb(106, 84, 12)"]

function addPlayer() {
    const container = document.getElementById("players-container");
    if (!container || nextPlayerNumber > 12) {
        return;
    }

    const n = nextPlayerNumber;
    const tile = document.createElement("div");
    tile.className = "playertile";
    tile.id = "player_" + n;

    const label = document.createElement("p");
    label.textContent = "Player " + n + ":";

    const select = document.createElement("select");
    select.name = "playertype_" + n;
    ["Human", "KorfBot"].forEach(function (name) {
        const opt = document.createElement("option");
        opt.textContent = name;
        select.appendChild(opt);
    });

    // CREATE COLOR TEXT
    const colorSettingSwatch = document.createElement("span");
    colorSettingSwatch.className = "player-color-swatch";
    colorSettingSwatch.style.backgroundColor = NEXT_COLORS[nextPlayerNumber-3];
    const colorSettingText = document.createElement("span");
    colorSettingText.className = "player-color-text";
    colorSettingText.innerHTML = `Color: ${NEXT_COLORS[nextPlayerNumber-3]}`;

    const colorSetting = document.createElement("div");
    colorSetting.className = "player-color-setting";
    colorSetting.appendChild(colorSettingSwatch);
    colorSetting.appendChild(colorSettingText);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", function () {
        removePlayer(removeBtn);
    });

    tile.appendChild(label);
    tile.appendChild(select);
    tile.appendChild(colorSetting);
    tile.appendChild(removeBtn);
    container.appendChild(tile);
    console.log("Added tile:", tile);
    nextPlayerNumber += 1;
}

function removePlayer(button) {
    const tile = button.closest(".playertile");
    if (!tile) return;

    const container = document.getElementById("players-container");
    if (!container) return;

    const tiles = container.querySelectorAll(".playertile");
    if (tiles.length <= 2) return;

    tile.remove();

    // SET RENUMBER TILES BELOW (if they exist), i.e. if player 3 is removed, make sure that player 4 is renamed to player 3
    const remainingTiles = container.querySelectorAll(".playertile");
    remainingTiles.forEach(function (t, idx) {
        if (idx < 2) return;

        const playerNumber = idx + 1;

        t.id = "player_" + playerNumber;

        const label = t.querySelector("p");
        if (label) label.textContent = "Player " + playerNumber + ":";

        const select = t.querySelector("select");
        if (select) select.name = "playertype_" + playerNumber;

        const colorSetting = t.querySelector("div");
        colorSetting.children[0].style.backgroundColor = NEXT_COLORS[playerNumber-3];
        colorSetting.children[1].innerHTML = `Color: ${NEXT_COLORS[playerNumber-3]}`;
    });
    nextPlayerNumber = remainingTiles.length + 1;
}

