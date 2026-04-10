class DrawBoard3D {
    constructor(
        boardSize,
        pixelSideLength = 650,
        boardColor = 0x1f4fbf,
        boardCornerRadius = "10px"
    ) {
        this.BOARD_SIZE = boardSize;
        this.canvas = document.getElementById("boardCanvas");
        this.canvas.width = pixelSideLength;
        this.canvas.height = pixelSideLength;
        this.canvas.style.borderRadius = boardCornerRadius;
        this.canvas.style.backgroundColor = "#0b0f1a";

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(pixelSideLength, pixelSideLength, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x091021);

        this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1000);
        this.camera.position.set(this.BOARD_SIZE * 1.2, this.BOARD_SIZE * 1.15, this.BOARD_SIZE * 1.35);
        this.camera.lookAt(0, this.BOARD_SIZE * 0.45, 0);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.boardRoot = new THREE.Group();
        this.scene.add(this.boardRoot);

        const half = (this.BOARD_SIZE - 1) / 2;
        this.cellSpacing = 1;
        this.cellRadius = 0.36;
        this.boardOffset = {
            x: -half,
            y: 0,
            z: -half,
        };

        this._pieceByKey = new Map();
        this._boardColor = boardColor;

        this._buildLights();
        this._buildBoardFrame();
        this.drawAllDots();
        this.render();
    }

    setOnClickHandler(onClick = (evt) => {
        console.log("Clicked:", evt.dropCoords);
    }) {
        this.canvas.addEventListener("click", (e) => {
            const dropCoords = this.getDropCoordinatesFromEvent(e);
            onClick({ ...e, dropCoords });
        });
    }

    _buildLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffffff, 0.7);
        key.position.set(8, 12, 10);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x99bbff, 0.35);
        fill.position.set(-10, 6, -5);
        this.scene.add(fill);
    }

    _buildBoardFrame() {
        const width = this.BOARD_SIZE + 0.7;
        const height = this.BOARD_SIZE + 0.6;
        const depth = this.BOARD_SIZE + 0.7;

        const frameMat = new THREE.MeshStandardMaterial({
            color: this._boardColor,
            roughness: 0.55,
            metalness: 0.15,
            transparent: true,
            opacity: 0.75,
        });

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            frameMat
        );
        frame.position.set(0, (this.BOARD_SIZE - 1) / 2, 0);
        this.boardRoot.add(frame);

        const wire = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
            new THREE.LineBasicMaterial({ color: 0xb5cbff, transparent: true, opacity: 0.55 })
        );
        wire.position.copy(frame.position);
        this.boardRoot.add(wire);
    }

    boardCoordsToWorldCoords(x, y, z) {
        return new THREE.Vector3(
            this.boardOffset.x + x * this.cellSpacing,
            this.boardOffset.y + y * this.cellSpacing,
            this.boardOffset.z + z * this.cellSpacing
        );
    }

    boardCoordsToVisualCoords(x, y, z) {
        const world = this.boardCoordsToWorldCoords(x, y, z);
        const projected = world.clone().project(this.camera);
        return [
            (projected.x + 1) * 0.5 * this.canvas.width,
            (1 - (projected.y + 1) * 0.5) * this.canvas.height,
        ];
    }

    drawAllDots() {
        if (this.dotGroup) {
            this.boardRoot.remove(this.dotGroup);
        }

        this.dotGroup = new THREE.Group();

        const holeMat = new THREE.MeshStandardMaterial({
            color: 0xdde6ff,
            roughness: 0.4,
            metalness: 0.05,
            transparent: true,
            opacity: 0.18,
        });

        const holeGeo = new THREE.SphereGeometry(this.cellRadius * 0.72, 14, 14);

        for (let x = 0; x < this.BOARD_SIZE; x++) {
            for (let y = 0; y < this.BOARD_SIZE; y++) {
                for (let z = 0; z < this.BOARD_SIZE; z++) {
                    const marker = new THREE.Mesh(holeGeo, holeMat);
                    marker.position.copy(this.boardCoordsToWorldCoords(x, y, z));
                    this.dotGroup.add(marker);
                }
            }
        }

        this.boardRoot.add(this.dotGroup);
        this.render();
    }

    addDrop(x, y, z, fillColor) {
        if (Array.isArray(x)) {
            [x, y, z, fillColor] = [x[0], x[1], x[2], y];
        }

        const key = `${x},${y},${z}`;
        if (this._pieceByKey.has(key)) {
            const prev = this._pieceByKey.get(key);
            this.boardRoot.remove(prev);
            this._pieceByKey.delete(key);
        }

        const piece = new THREE.Mesh(
            new THREE.SphereGeometry(this.cellRadius, 20, 20),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(fillColor || "white"),
                roughness: 0.28,
                metalness: 0.25,
            })
        );

        piece.position.copy(this.boardCoordsToWorldCoords(x, y, z));
        this.boardRoot.add(piece);
        this._pieceByKey.set(key, piece);
        this.render();
    }

    refresh() {
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getDropCoordinatesFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const topPlaneY = this.boardOffset.y + (this.BOARD_SIZE - 1) * this.cellSpacing;
        const hitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -topPlaneY);
        const worldHit = new THREE.Vector3();

        if (!this.raycaster.ray.intersectPlane(hitPlane, worldHit)) {
            return null;
        }

        const x = Math.round((worldHit.x - this.boardOffset.x) / this.cellSpacing);
        const z = Math.round((worldHit.z - this.boardOffset.z) / this.cellSpacing);

        if (x < 0 || x >= this.BOARD_SIZE || z < 0 || z >= this.BOARD_SIZE) {
            return null;
        }

        return [x, z];
    }
}

window.DrawBoard3D = DrawBoard3D;

// Example usage/test for DrawBoard3D:
// (Uncomment to use in a page with a canvas#boardCanvas and loaded THREE.js)
//
document.addEventListener("DOMContentLoaded", () => {
    const board = new DrawBoard3D(7);
    board.setOnClickHandler(({ dropCoords }) => {
        if (dropCoords) {
            // Random color for demo
            const color = ["red", "yellow", "green", "blue"][Math.floor(Math.random() * 4)];
            board.drawPiece(dropCoords[0], 0, dropCoords[1], color);
        }
    });
});
//
// To use: ensure THREE.js is loaded and there is a <canvas id="boardCanvas"></canvas> on your HTML page.
