
class DrawBoard2D {
    // Initializes drawing context and board geometry values.
    constructor(
        boardSize,
        pixelSideLength=500,
        boardColor="#1f4fbf",
        boardCornerRadius="10px"
    ) {        
        this.canvas = document.getElementById("boardCanvas");
        this.canvas.width = pixelSideLength;
        this.canvas.height = pixelSideLength;
        this.canvas.style.backgroundColor = "transparent";
        this.canvas.style.borderRadius = boardCornerRadius;

        this.ctx = this.canvas.getContext('2d');
        this.BOARD_SIZE = boardSize; // board size n (number of circles width/tall)
        this.boardColor = boardColor;
        
        this.cellSize = this.canvas.width / this.BOARD_SIZE;
        this.CIRCLES_PADDING = 0.13 * this.cellSize; // padding between opening circles + wall, in pixels
        this.holeRadius = (this.cellSize / 2) - this.CIRCLES_PADDING; // Radius of each circle, in pixels
        this.placedDrops = [];
        this.hoverDrop = null;
    }
    
    // Sets click handler that maps canvas clicks to board columns.
    setOnClickHandler(onClick = (e) => {
        const col = Math.floor(e.offsetX / (PIXEL_SIDE_LENGTH / _BOARD_SIZE));
        console.log(`Registered click at column ${col}.`);
    }) {
        this.canvas.addEventListener("click", onClick);
    }

    // Returns vector [x, y] representing center of cell given board coords row, col.
    boardCoordsToVisualCoords(col, row) {
        return [this.cellSize*(col+0.5), this.cellSize*((this.BOARD_SIZE - row - 1)+0.5)];
    }

    // Adds a game piece at the specified visual position.
    async addDrop(x, y, fillColor) {
        this.placedDrops.push({ x, y, fillColor });
        this.renderBoard();
    }

    // Draws a piece or open slot with layered shading.
    drawSingleHole(x, y, radius, fillColor="white", strokeStyle="rgba(0, 0, 0, 0.2)", lineWidth=3, loop=this.ctx) {
        const gradient = loop.createRadialGradient( x - (radius * 0.4), y - (radius * 0.45), radius * 0.22, x, y, radius );

        if (fillColor === "white") {
            gradient.addColorStop(0, "rgba(239, 246, 255, 0.95)");
            // gradient.addColorStop(0.56, "rgba(199, 216, 247, 0.9)");
            // gradient.addColorStop(1, "rgba(133, 158, 205, 0.92)");
        } else {
            gradient.addColorStop(0, this.lightenColor(fillColor, 0.34));
            gradient.addColorStop(0.6, fillColor);
            gradient.addColorStop(1, this.darkenColor(fillColor, 0.28));
        }

        loop.beginPath();
        loop.arc(x, y, radius, 0, Math.PI*2);
        
        loop.fillStyle = gradient;
        loop.fill();
        
        // Adds definition around slot edge.
        loop.strokeStyle = fillColor === "white" ? "rgba(8, 18, 38, 0.55)" : strokeStyle;
        loop.lineWidth = lineWidth;
        loop.stroke();

        // Adds a top-left highlight for a glossy look.
        // loop.beginPath();
        // loop.arc(x - radius * 0.24, y - radius * 0.24, radius * 0.36, 0, Math.PI * 2);
        // loop.fillStyle = "rgba(255, 255, 255, 0.22)";
        // loop.fill();

        loop.closePath();
    }

    // Draws the board body with rounded corners and directional shading.
    drawBoardPlate() {
        const size = this.canvas.width;
        const cornerRadius = Math.max(12, this.cellSize * 0.22);
        const boardGradient = this.ctx.createLinearGradient(0, 0, size, size);
        boardGradient.addColorStop(0, this.lightenColor(this.boardColor, 0.18));
        boardGradient.addColorStop(0.48, this.boardColor);
        boardGradient.addColorStop(1, this.darkenColor(this.boardColor, 0.24));

        this.ctx.save();
        this.ctx.beginPath();
        this.roundRectPath(0, 0, size, size, cornerRadius, this.ctx);
        this.ctx.fillStyle = boardGradient;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
        this.ctx.shadowBlur = 18;
        this.ctx.shadowOffsetY = 10;
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.beginPath();
        this.roundRectPath(2, 2, size - 4, size - 4, cornerRadius - 2, this.ctx);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "rgba(224, 236, 255, 0.3)";
        this.ctx.stroke();

        this.ctx.beginPath();
        this.roundRectPath(8, 8, size - 16, size - 16, cornerRadius - 6, this.ctx);
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "rgba(12, 23, 51, 0.36)";
        this.ctx.stroke();
    }

    // Draws all slots for the current board size.
    drawAllDots() {
        this.renderBoard();
    }

    // Renders board, existing pieces, and optional hover preview.
    renderBoard() {
        const size = this.canvas.width;

        // Clears and redraws complete board layer.
        this.ctx.clearRect(0, 0, size, size);
        this.drawBoardPlate();

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                // Calculates center coordinates of the current slot.
                const x = this.cellSize*(col + 0.5);
                const y = this.cellSize*(row + 0.5);
                this.drawSingleHole(x, y, this.holeRadius);
            }
        }

        // Draws already placed pieces.
        for (const drop of this.placedDrops) {
            this.drawSingleHole(
                drop.x,
                drop.y,
                this.holeRadius,
                drop.fillColor,
                "rgba(8, 20, 52, 0.1)",
                2.5
            );
        }

        // Draws hover piece preview at top cell of selected column.
        if (this.hoverDrop) {
            this.drawSingleHole(
                this.hoverDrop.x,
                this.hoverDrop.y,
                this.holeRadius,
                this.hoverDrop.fillColor,
                "rgb(44, 44, 44, 0.1)",
                2
            );
        }
    }

    // Maps canvas x-offset to the board column index.
    getColumnFromOffsetX(offsetX) {
        return Math.floor(offsetX / this.cellSize);
    }

    // Updates hover preview for a given column, row, and color.
    setHoverPreview(col, row, fillColor) {
        if ( !Number.isInteger(col) || !Number.isInteger(row) ||
            col < 0 || col >= this.BOARD_SIZE ||
            row < 0 || row >= this.BOARD_SIZE ) {
            this.hoverDrop = null;
            this.renderBoard();
            return;
        }

        const [x, y] = this.boardCoordsToVisualCoords(col, row);
        this.hoverDrop = {
            x,
            y,
            fillColor: this.withAlpha(fillColor, 0.48),
        };
        this.renderBoard();
    }

    // Clears any hover preview.
    clearHoverPreview() {
        if (!this.hoverDrop) {
            return;
        }
        this.hoverDrop = null;
        this.renderBoard();
    }

    // Converts a color string to an rgba value with custom alpha.
    withAlpha(fillColor, alpha = 1) {
        if (typeof fillColor !== "string") {
            return `rgba(255, 255, 255, ${alpha})`;
        }

        const probe = document.createElement("span");
        probe.style.color = fillColor;
        document.body.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();

        const match = resolved.match(/\d+(\.\d+)?/g);
        if (!match || match.length < 3) {
            return fillColor;
        }

        const [r, g, b] = match;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Builds a rounded rectangle path for board borders.
    roundRectPath(x, y, width, height, radius, loop) {
        const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
        loop.moveTo(x + r, y);
        loop.lineTo(x + width - r, y);
        loop.arcTo(x + width, y, x + width, y + r, r);
        loop.lineTo(x + width, y + height - r);
        loop.arcTo(x + width, y + height, x + width - r, y + height, r);
        loop.lineTo(x + r, y + height);
        loop.arcTo(x, y + height, x, y + height - r, r);
        loop.lineTo(x, y + r);
        loop.arcTo(x, y, x + r, y, r);
        loop.closePath();
    }

    // Lightens a hex color by the given factor (0 to 1).
    lightenColor(hexColor, factor) {
        return this.adjustHexColor(hexColor, Math.abs(factor));
    }

    // Darkens a hex color by the given factor (0 to 1).
    darkenColor(hexColor, factor) {
        return this.adjustHexColor(hexColor, -Math.abs(factor));
    }

    // Adjusts a hex color toward white or black.
    adjustHexColor(hexColor, factor) {
        if (typeof hexColor !== "string") {
            return hexColor;
        }

        const normalized = hexColor.trim().replace(/^#/, "");
        const expanded = normalized.length === 3
            ? normalized.split("").map((ch) => ch + ch).join("")
            : normalized;

        // Only process true hex colors; pass through named/rgb colors unchanged.
        if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
            return hexColor;
        }

        const channels = [0, 2, 4].map((idx) => parseInt(expanded.slice(idx, idx + 2), 16));
        const adjusted = channels.map((value) => {
            const next = factor >= 0
                ? value + ((255 - value) * factor)
                : value * (1 + factor);
            return Math.max(0, Math.min(255, Math.round(next)));
        });

        const asHex = adjusted.map((value) => value.toString(16).padStart(2, "0")).join("");
        return `#${asHex}`;
    }

}


