// ADD NEW PLAYERS
let nextPlayerNumber = 3;

function addPlayer() {
    const container = document.getElementById("players-container");
    if (!container) return;

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

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", function () {
        removePlayer(removeBtn);
    });

    tile.appendChild(label);
    tile.appendChild(select);
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
        const playerNumber = idx + 1;

        t.id = "player_" + playerNumber;

        const label = t.querySelector("p");
        if (label) label.textContent = "Player " + playerNumber + ":";

        const select = t.querySelector("select");
        if (select) select.name = "playertype_" + playerNumber;
    });

    nextPlayerNumber = remainingTiles.length + 1;
}
