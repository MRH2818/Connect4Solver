(function () {
    function clamp(n, min, max) {
        if (!Number.isFinite(n)) return min;
        return Math.min(max, Math.max(min, n));
    }

    function getNumberAttr(el, name, fallback) {
        var raw = el.getAttribute(name);
        var n = raw === null ? NaN : Number(raw);
        return Number.isFinite(n) ? n : fallback;
    }

    function getSelectedDimensions() {
        var checked = document.querySelector("input[name='num-dimensions']:checked");
        if (!(checked instanceof HTMLInputElement)) return 2;
        return checked.value === "3" ? 3 : 2;
    }

    function updateDialButtons(input, up, down) {
        var min = getNumberAttr(input, "min", Number.NEGATIVE_INFINITY);
        var max = getNumberAttr(input, "max", Number.POSITIVE_INFINITY);
        var value = Number(input.value);
        if (!Number.isFinite(value)) value = min;

        down.disabled = value <= min;
        up.disabled = value >= max;
    }

    function capBoardSizeMax(input) {
        var dims = getSelectedDimensions();
        var cap = dims === 3 ? 7 : 10;
        input.max = String(cap);

        var min = getNumberAttr(input, "min", 4);
        var value = Number(input.value);
        var next = clamp(Number.isFinite(value) ? value : cap, min, cap);
        input.value = String(Math.round(next));
    }

    function stepInput(input, direction) {
        var step = getNumberAttr(input, "step", 1);
        if (!Number.isFinite(step) || step <= 0) step = 1;

        var min = getNumberAttr(input, "min", Number.NEGATIVE_INFINITY);
        var max = getNumberAttr(input, "max", Number.POSITIVE_INFINITY);

        var current = Number(input.value);
        if (!Number.isFinite(current)) current = getNumberAttr(input, "value", min);

        var next = clamp(current + (direction * step), min, max);
        input.value = String(Math.round(next));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
    }

    document.addEventListener("DOMContentLoaded", function () {
        var steppers = document.querySelectorAll(".stepper[data-stepper-for]");
        steppers.forEach(function (stepper) {
            var id = stepper.getAttribute("data-stepper-for");
            if (!id) return;

            var input = document.getElementById(id);
            if (!input || !(input instanceof HTMLInputElement)) return;

            capBoardSizeMax(input);

            var up = stepper.querySelector(".stepper-up");
            var down = stepper.querySelector(".stepper-down");
            if (!(up instanceof HTMLButtonElement) || !(down instanceof HTMLButtonElement)) return;

            updateDialButtons(input, up, down);

            up.addEventListener("click", function () { stepInput(input, +1); updateDialButtons(input, up, down); });
            down.addEventListener("click", function () { stepInput(input, -1); updateDialButtons(input, up, down); });

            document.querySelectorAll("input[name='num-dimensions']").forEach(function (r) {
                r.addEventListener("change", function () { capBoardSizeMax(input); updateDialButtons(input, up, down); });
            });

            input.addEventListener("input", function () { capBoardSizeMax(input); updateDialButtons(input, up, down); });

            input.addEventListener("keydown", function (e) {
                if (e.key === "ArrowUp") { e.preventDefault(); stepInput(input, +1); updateDialButtons(input, up, down); }
                if (e.key === "ArrowDown") { e.preventDefault(); stepInput(input, -1); updateDialButtons(input, up, down); }
            });
        });
    });
})();

