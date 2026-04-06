
class DrawBoard2D {
    constructor(
        boardSize,
        pixelSideLength=500,
        boardColor="#0055ff",
        boardCornerRadius="10px"
    ) {        
        this.canvas = document.getElementById("boardCanvas");
        this.canvas.width = pixelSideLength;
        this.canvas.height = pixelSideLength;
        this.canvas.style.backgroundColor = boardColor;
        this.canvas.style.borderRadius = boardCornerRadius;

        this.ctx = this.canvas.getContext('2d');
        this.CIRCLES_PADDING = 10; // padding between opening circles + wall, in pixels
        this.BOARD_SIZE = boardSize; // board size n (number of circles width/tall)

        this.cellSize = this.canvas.width / this.BOARD_SIZE;
        this.holeRadius = (this.cellSize / 2) - this.CIRCLES_PADDING; // Radius of each circle, in pixels
    }
    
    // Set click event handler, default function just prints column clicked
    setOnClickHandler(onClick = (e) => {
        const col = Math.floor(e.offsetX / (PIXEL_SIDE_LENGTH / _BOARD_SIZE));
        console.log(`Registered click at column ${col}.`);
    }) {
        this.canvas.addEventListener("click", onClick);
    }

    // Returns vector [x, y] representing center of cell given board coords row, col
    boardCoordsToVisualCoords(col, row) {
        return [this.cellSize*(col+0.5), this.cellSize*((this.BOARD_SIZE - row - 1)+0.5)];
    }

    // Add drop to x, y coords
    async addDrop(x, y, fillColor) {
        let ctx1 = this.canvas.getContext("2d");
        this.drawSingleHole(x, y, this.holeRadius, fillColor, "rgba(0, 0, 255, 0.2)", 3);
    }

    // DRAW HOLE given center of circle
    drawSingleHole(x, y, radius, fillColor="white", strokeStyle="rgba(0, 0, 0, 0.2)", lineWidth=3, loop=this.ctx) {
        loop.beginPath();
        loop.arc(x, y, radius, 0, Math.PI*2);
        
        loop.fillStyle = fillColor;
        loop.fill();
        
        // ADD SOME DEPTH TO HOLES WITH OUTLINE
        loop.strokeStyle = strokeStyle;
        loop.lineWidth = lineWidth;
        loop.stroke();

        loop.closePath();
    }

    // DRAWS DOTS OF BOARD OF SIZE n
    drawAllDots() {
        const size = this.canvas.width;

        // console.log("CTX:", this.ctx);
        // console.log("size:", size)
        // console.log("cellSize:", this.cellSize);
        // console.log("radius:", this.holeRadius);

        // Clear canvas if full
        this.ctx.clearRect(0, 0, size, size);

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                // Calculate center coordinates of current circle
                const x = this.cellSize*(col + 0.5);
                const y = this.cellSize*(row + 0.5);
                //console.log(`(${x}, ${y})`)

                this.drawSingleHole(x, y, this.holeRadius);
            }
        }
    }


}


