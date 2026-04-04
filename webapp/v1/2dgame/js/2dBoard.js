
class DrawBoard2D {
    constructor(boardSize) {        
        this.canvas = document.getElementById("boardCanvas");
        this.ctx = this.canvas.getContext('2d');
        this.CIRCLES_PADDING = 10; // padding between opening circles + wall, in pixels
        this.BOARD_SIZE = boardSize; // board size n (number of circles width/tall)

        // DETECT CLICKS:
        this.canvas.addEventListener("click", (e) => {
            const col = Math.floor(e.offsetX / (this.canvas.width / this.BOARD_SIZE));
            console.log(`Registered click at column index ${col}.`);
        })
    }

    // DRAW HOLE given center of circle
    drawSingleHole(x, y, radius) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI*2);
        
        this.ctx.fillStyle = "white"; // Empty slot color
        this.ctx.fill();
        
        this.ctx.closePath();

        // ADD SOME DEPTH TO HOLES WITH OUTLINE
        this.ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }

    // DRAWS DOTS OF BOARD OF SIZE n
    drawAllDots() {
        const size = this.canvas.width;
        const cellSize = size / this.BOARD_SIZE;
        const radius = (cellSize / 2) - this.CIRCLES_PADDING; // Radius of each circle, in pixels

        console.log("CTX:", this.ctx);
        console.log("size:", size)
        console.log("cellSize:", cellSize);
        console.log("radius:", radius);

        // Clear canvas if full
        this.ctx.clearRect(0, 0, size, size);

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                // Calculate center coordinates of current circle
                const x = cellSize*(col + 0.5);
                const y = cellSize*(row + 0.5);
                //console.log(`(${x}, ${y})`)

                this.drawSingleHole(x, y, radius);
            }
        }
    }


}


