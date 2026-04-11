(function () {
    function collectSetup(formData) {
        var raw = Number(formData.get("num-dimensions"));
        var numDimensions = 2;
        if (Number.isFinite(raw)) {
            numDimensions = Math.min(6, Math.max(2, Math.round(raw)));
        }

        var players = [];
        var keys = [];
        for (var key of formData.keys()) {
            if (key.indexOf("playertype_") === 0) keys.push(key);
        }
        keys.sort(function (a, b) {
            var na = parseInt(a.replace("playertype_", ""), 10);
            var nb = parseInt(b.replace("playertype_", ""), 10);
            return na - nb;
        });
        keys.forEach(function (key, idx) {
            var n = parseInt(key.replace("playertype_", ""), 10);
            players.push({ num: idx+1, type: formData.get(key) });
        });

        var boardSize = Number(formData.get("boardsize"));
        if (Number.isFinite(boardSize)) {
            boardSize = Math.min((numDimensions === 2) ? 10 : 7, Math.max(4, Math.round(boardSize)));
        }

        return {
            numDimensions: numDimensions,
            boardSize: boardSize,
            players: players,
        };
    }

    function handleForm(formData) {
        var setup = collectSetup(formData);
        console.log("Here's the form data!");
        console.log(JSON.stringify(setup));

        // PREPARE STRING
        const binstr = encodeOBJtoBASE64_URL(setup);
        console.log("ENCODED TO:");
        console.log(binstr);

        // CHECK DIMENSIONS
        if (setup.numDimensions === 2) {
            // BUILD REDIRECT
            const newurl = `../2dgame/twogame.html?config=${binstr}`;
            window.location.href = newurl;
            return setup;
        } else if (setup.numDimensions === 3) {
            // BUILD REDIRECT
            const newurl = `../3dgame/threegame.html?config=${binstr}`;
            window.location.href = newurl;
            return setup;
        }


        return setup;
    }
    window.handleForm = handleForm;

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("game-setup-form");
        if (!form) return;

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var formData = new FormData(form);
            handleForm(formData);
        });
    });
})();
