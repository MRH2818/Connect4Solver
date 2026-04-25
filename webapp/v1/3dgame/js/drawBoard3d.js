const THREE_VERSION_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/+esm";
const ORBIT_CONTROLS_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
let THREE = globalThis.THREE;
let OrbitControlsCtor = globalThis.OrbitControls;

async function ensureThreeLoaded() {
    if (!THREE) {
        THREE = await import(THREE_VERSION_URL);
        globalThis.THREE = THREE;
    }

    if (!OrbitControlsCtor) {
        const controlsModule = await import(ORBIT_CONTROLS_URL);
        OrbitControlsCtor = controlsModule.OrbitControls;
        globalThis.OrbitControls = OrbitControlsCtor;
    }

    return THREE;
}

class DrawBoard3D {
    constructor(
        boardSize,
        pixelSideLength = 650,
        boardColor = 0x1f4fbf,
        boardCornerRadius = "10px",
        enableHover
    ) {
        this.BOARD_SIZE = boardSize;
        this.canvas = document.getElementById("boardCanvas");
        this.canvas.style.borderRadius = boardCornerRadius;
        this.canvas.style.backgroundColor = "#0b0f1a";

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
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

        this.enableHover = enableHover ?? true;

        this._pieceByKey = new Map();
        this._boardColor = boardColor;
        this._hoverTarget = null;
        this._hoverHandler = () => {};
        this._hoverEventsBound = false;
        this._landingYResolver = null;
        this._clickPointerDown = null;

        this._buildLights();
        this._buildBoardFrame();
        this._buildHoverPreview();
        this._setupControls();
        this.drawAllDots();
        this._resizeToCanvas();
        window.addEventListener("resize", () => this._resizeToCanvas());
        this.render();
    }

    _resizeToCanvas() {
        const w = Math.max(1, Math.floor(this.canvas.clientWidth || window.innerWidth || 1));
        const h = Math.max(1, Math.floor(this.canvas.clientHeight || window.innerHeight || 1));

        if (this.canvas.width !== w) {
            this.canvas.width = w;
        }
        if (this.canvas.height !== h) {
            this.canvas.height = h;
        }

        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.render();
    }

    setOnClickHandler(onClick = (evt) => {
        console.log("Clicked:", evt.dropCoords);
    }) {
        const maxMovePx = 8;

        this.canvas.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) {
                return;
            }
            this._clickPointerDown = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener("pointercancel", () => {
            this._clickPointerDown = null;
        });

        this.canvas.addEventListener("click", (e) => {
            if (e.button !== 0) {
                return;
            }
            const start = this._clickPointerDown;
            this._clickPointerDown = null;
            if (!start) {
                return;
            }
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (dx * dx + dy * dy > maxMovePx * maxMovePx) {
                return;
            }

            const hoverResult = this._hoverTarget ?? this.getDropCoordinatesFromEvent(e);
            const dropCoords = this._extractDropCoords(hoverResult);
            onClick({ ...e, dropCoords });
        });
    }

    setLandingHeightResolver(resolver) {
        this._landingYResolver = typeof resolver === "function" ? resolver : null;
    }

    setOnHoverHandler(onHover = (evt) => {
        console.log("Hover:", evt.hoverCoords);
    }) {
        this._hoverHandler = onHover;
        if (this._hoverEventsBound) {
            return;
        }

        this.canvas.addEventListener("pointermove", (e) => {
            const hoverCoords = this.getDropCoordinatesFromEvent(e);
            this._setHoverTarget(hoverCoords);
            this._hoverHandler({ ...e, hoverCoords });
        });

        this.canvas.addEventListener("pointerleave", (e) => {
            this._clearHoverTarget();
            this._hoverHandler({
                ...e,
                hoverCoords: { x: null, z: null, inBounds: false },
            });
        });

        this._hoverEventsBound = true;
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
            color: "white",//this._boardColor,
            roughness: 0.55,
            metalness: 0.15,
            transparent: true,
            opacity: 0,
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

    _buildHoverPreview(pieceFillColor) {
        const topY = this.boardOffset.y + (this.BOARD_SIZE - 1) * this.cellSpacing + this.cellRadius;
        this.hoverPreview = new THREE.Group();
        this.hoverPreview.visible = false;
        this.hoverPreview.renderOrder = 1;

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(this.cellRadius * 0.95, 0.05, 12, 32),
            new THREE.MeshBasicMaterial({
                color: 0x9cd3ff,
                transparent: true,
                opacity: 1,
                depthTest: false,
                depthWrite: false,
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = topY;
        ring.renderOrder = 1;
        this.hoverPreview.add(ring);

        this.hoverGhost = this._getPieceMesh(0, 0, 0, 0x9cd3ff, true);
        this.hoverGhost.visible = false;
        this.hoverGhost.renderOrder = 1;
        this.hoverPreview.add(this.hoverGhost);

        this.boardRoot.add(this.hoverPreview);
    }

    _setupControls() {
        if (!OrbitControlsCtor) {
            return;
        }

        this.canvas.addEventListener("contextmenu", (evt) => evt.preventDefault());
        this.controls = new OrbitControlsCtor(this.camera, this.canvas);
        this.controls.enableDamping = false;

        
        this.controls.zoomSpeed = 3;
        this.controls.target.set(0, this.BOARD_SIZE * 0.45, 0);
        this.controls.screenSpacePanning = true;
        this.controls.minZoom = this.BOARD_SIZE * 1;
        this.controls.maxZoom = this.BOARD_SIZE * 3;

        this.controls.minDistance = this.BOARD_SIZE;
        this.controls.maxDistance = this.BOARD_SIZE * 5;

        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
        };
        this.controls.addEventListener("change", () => this.render());
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
            //depthTest: false
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

    _getPieceMesh(x, y, z, fillColor, ghost = false) {
        const piece = new THREE.Mesh(
            new THREE.SphereGeometry(this.cellRadius, 20, 20),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(fillColor || "white"),
                roughness: 0.28,
                metalness: 0.25,
                ...(ghost ? { transparent: true, opacity: 0.7, depthTest: false } : {}),
            })
        );
        piece.position.copy(this.boardCoordsToWorldCoords(x, y, z));
        return piece;
    }

    addDrop(x, y, z, fillColor, ghost=false) {
        if (Array.isArray(x)) {
            [x, y, z, fillColor] = [x[0], x[1], x[2], y];
        }

        const key = `${x},${y},${z}`;
        if (this._pieceByKey.has(key)) {
            const prev = this._pieceByKey.get(key);
            this.boardRoot.remove(prev);
            this._pieceByKey.delete(key);
        }

        const piece = this._getPieceMesh(x, y, z, fillColor, ghost);
        this.boardRoot.add(piece);
        this._pieceByKey.set(key, piece);
        this.render();
    }

    refresh() {
        this.render();
    }

    _extractDropCoords(hoverResult) {
        if (!hoverResult?.inBounds) {
            return null;
        }
        return [hoverResult.x, hoverResult.z];
    }

    _setHoverTarget(nextHoverTarget) {
        const normalized = nextHoverTarget?.inBounds
            ? { x: nextHoverTarget.x, z: nextHoverTarget.z, inBounds: true }
            : { x: null, z: null, inBounds: false };

        const prev = this._hoverTarget;
        const unchanged =
            prev?.inBounds === normalized.inBounds &&
            prev?.x === normalized.x &&
            prev?.z === normalized.z;

        if (unchanged) {
            return;
        }

        this._hoverTarget = normalized;
        if (!normalized.inBounds) {
            this.hoverPreview.visible = false;
            if (this.hoverGhost) {
                this.hoverGhost.visible = false;
            }
            this.render();
            return;
        }

        if (!this.enableHover) {
            this.hoverPreview.visible = false;
            if (this.hoverGhost) {
                this.hoverGhost.visible = false;
            }
            this.render();
            return;
        }

        const world = this.boardCoordsToWorldCoords(normalized.x, 0, normalized.z);
        this.hoverPreview.position.set(world.x, 0, world.z);
        this.hoverPreview.visible = true;

        if (this.hoverGhost && this._landingYResolver) {
            const y = this._landingYResolver(normalized.x, normalized.z);
            if (y == null) {
                this.hoverGhost.visible = false;
            } else {
                this.hoverGhost.visible = true;
                this.hoverGhost.position.set(0, this.boardOffset.y + y * this.cellSpacing, 0);
            }
        } else if (this.hoverGhost) {
            this.hoverGhost.visible = false;
        }

        this.render();
    }

    _clearHoverTarget() {
        this._setHoverTarget({ x: null, z: null, inBounds: false });
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
            return { x: null, z: null, inBounds: false };
        }

        const x = Math.round((worldHit.x - this.boardOffset.x) / this.cellSpacing);
        const z = Math.round((worldHit.z - this.boardOffset.z) / this.cellSpacing);

        if (x < 0 || x >= this.BOARD_SIZE || z < 0 || z >= this.BOARD_SIZE) {
            return { x, z, inBounds: false };
        }

        return { x, z, inBounds: true };
    }
}

window.DrawBoard3D = DrawBoard3D;
window.ensureThreeLoaded = ensureThreeLoaded;

// Example usage/test for DrawBoard3D:
// (Uncomment to use in a page with a canvas#boardCanvas and loaded THREE.js)
//
// document.addEventListener("DOMContentLoaded", async () => {
//     await ensureThreeLoaded();

//     const board = new DrawBoard3D(7);

//     board.setOnClickHandler(({ dropCoords }) => {
//         if (dropCoords) {
//             // Random color for demo
//             const color = ["red", "yellow", "green", "blue"][Math.floor(Math.random() * 4)];
//             board.addDrop(dropCoords[0], 0, dropCoords[1], color);
//         }
//     });
// });
//
// To use: ensure THREE.js is loaded and there is a <canvas id="boardCanvas"></canvas> on your HTML page.
