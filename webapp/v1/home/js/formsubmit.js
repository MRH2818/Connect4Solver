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
        keys.forEach(function (key) {
            var n = parseInt(key.replace("playertype_", ""), 10);
            players.push({ index: n, type: formData.get(key) });
        });

        return {
            numDimensions: numDimensions,
            players: players,
        };
    }

    function handleForm(formData) {
        var setup = collectSetup(formData);
        console.log("Here's the form data!");
        console.log(JSON.stringify(setup));
        // END HERE FOR NOW — later: navigate to game or POST to server
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
