import './style.css';
import * as THREE from 'three';
import { ConnectNGame } from './engine/game';
import { TelemetryBuffer } from './engine/telemetry';
import { makeSliceCells, moveFromSlice, getDropAxes } from './engine/projection';

type Mode = '2d' | '3d' | 'nd';
type AgentName = 'random' | 'strategic';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('app root not found');

const telemetry = new TelemetryBuffer();

let mode: Mode = '2d';
let game = new ConnectNGame(7, 2);
let aiEnabled = false;
let aiAgent: AgentName = 'random';
let aiTimeMs = 350;
let aiWorker: Worker | null = null;
let pendingAiId: number | null = null;
let requestCounter = 0;

let ndAxisA = 0;
let ndAxisB = 2;
const ndFixed: Record<number, number> = {};

const ensureWorker = (): Worker => {
  if (!aiWorker) aiWorker = new Worker(new URL('./workers/ai.worker.ts', import.meta.url), { type: 'module' });
  return aiWorker;
};

const boardStatus = (): string => {
  if (game.winner) return `Player ${game.winner} wins`; 
  if (game.board.isDraw()) return 'Draw';
  return `Player ${game.currentPlayer} to move`;
};

const newGame = (size: number, dimensions: number): void => {
  game = new ConnectNGame(size, dimensions);
  const dropAxes = getDropAxes(dimensions);
  ndAxisA = dropAxes[0] ?? 0;
  ndAxisB = dropAxes[Math.min(1, dropAxes.length - 1)] ?? dropAxes[0] ?? 0;
  Object.keys(ndFixed).forEach((k) => delete ndFixed[Number(k)]);
};

const requestAIMove = (): void => {
  if (!aiEnabled || game.winner || game.board.isDraw() || game.currentPlayer !== 2) return;
  const worker = ensureWorker();

  if (pendingAiId != null) {
    worker.postMessage({ kind: 'cancel', id: pendingAiId });
    pendingAiId = null;
  }

  const id = ++requestCounter;
  pendingAiId = id;
  const startedAt = performance.now();

  const listener = (event: MessageEvent<{ id: number; move: number[] | null; elapsed: number; timeout: boolean }>) => {
    if (event.data.id !== id) return;
    worker.removeEventListener('message', listener);
    pendingAiId = null;

    if (event.data.timeout) {
      telemetry.push({ type: 'ai_timeout', ms: event.data.elapsed, meta: { agent: aiAgent } });
      render();
      return;
    }

    telemetry.push({ type: 'ai_latency', ms: event.data.elapsed, meta: { agent: aiAgent } });
    if (event.data.move && game.play(event.data.move)) {
      telemetry.push({ type: 'move_latency', ms: performance.now() - startedAt, meta: { mode, by: 'ai' } });
      render();
    }
  };

  worker.addEventListener('message', listener);
  worker.postMessage({
    kind: 'choose',
    id,
    agent: aiAgent,
    snapshot: game.snapshot(),
    maxTimeMs: aiTimeMs
  });
};

const topPiece2D = (x: number): string => {
  let cls = 'cell';
  for (let y = game.size - 1; y >= 0; y -= 1) {
    const v = game.board.cells[game.board.coordsToIndex([x, y])];
    if (v !== 0) {
      cls += ` p${v}`;
      break;
    }
  }
  return cls;
};

const render2DBoard = (): string => {
  const n = game.size;
  let out = '<div class="columns">';
  for (let x = 0; x < n; x += 1) {
    out += `<button data-drop2d="${x}" ${game.winner ? 'disabled' : ''}>▼</button>`;
  }
  out += '</div>';

  out += '<div class="preview-row">';
  for (let x = 0; x < n; x += 1) out += `<div class="${topPiece2D(x)}"></div>`;
  out += '</div>';

  out += `<div class="grid2d" style="grid-template-columns: repeat(${n}, 40px)">`;
  for (let y = n - 1; y >= 0; y -= 1) {
    for (let x = 0; x < n; x += 1) {
      const idx = game.board.coordsToIndex([x, y]);
      const cell = game.board.cells[idx];
      out += `<div class="cell ${cell ? `p${cell} filled` : ''}"></div>`;
    }
  }
  out += '</div>';
  return out;
};

const renderSliceBoard = (): string => {
  const dropAxes = getDropAxes(game.dimensions);
  if (dropAxes.length < 2) return '<p class="small">Need at least 4D for slice exploration.</p>';

  if (!dropAxes.includes(ndAxisA)) ndAxisA = dropAxes[0];
  if (!dropAxes.includes(ndAxisB) || ndAxisB === ndAxisA) ndAxisB = dropAxes[1] ?? dropAxes[0];

  let controls = '<div class="slice-controls">';
  controls += '<label>X axis <select id="sliceAxisA">';
  dropAxes.forEach((axis) => {
    controls += `<option value="${axis}" ${axis === ndAxisA ? 'selected' : ''}>${axis}</option>`;
  });
  controls += '</select></label>';

  controls += '<label>Y axis <select id="sliceAxisB">';
  dropAxes.forEach((axis) => {
    controls += `<option value="${axis}" ${axis === ndAxisB ? 'selected' : ''}>${axis}</option>`;
  });
  controls += '</select></label>';

  dropAxes
    .filter((axis) => axis !== ndAxisA && axis !== ndAxisB)
    .forEach((axis) => {
      const val = ndFixed[axis] ?? 0;
      controls += `<label>axis ${axis}: <input data-fixed-axis="${axis}" type="range" min="0" max="${game.size - 1}" value="${val}" /> <span>${val}</span></label>`;
    });

  controls += '</div>';

  const cells = makeSliceCells(game, { axisA: ndAxisA, axisB: ndAxisB, fixed: ndFixed });
  let grid = `<div class="grid2d slice" style="grid-template-columns: repeat(${game.size}, 40px)">`;
  for (let y = game.size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < game.size; x += 1) {
      const c = cells.find((cell) => cell.x === x && cell.y === y);
      const owner = c?.topOwner ?? 0;
      const label = c?.height ? `${c.height}` : '';
      grid += `<button class="cell slice-cell ${owner ? `p${owner} filled` : ''}" data-slice-x="${x}" data-slice-y="${y}" ${game.winner ? 'disabled' : ''}>${label}</button>`;
    }
  }
  grid += '</div>';

  return `${controls}<p class="small">Height numbers show filled depth in gravity axis. Use axes and fixed sliders to navigate 4D+ spaces.</p>${grid}`;
};

const init3D = (): void => {
  const host = document.getElementById('three');
  if (!host || game.dimensions < 3) return;
  host.innerHTML = '';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.1, 1000);
  let radius = game.size * 2.2;
  let theta = 0.75;
  let phi = 1.1;
  let panX = 0;
  let panZ = 0;

  const updateCamera = (): void => {
    const x = radius * Math.sin(phi) * Math.cos(theta) + panX;
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta) + panZ;
    camera.position.set(x, y, z);
    camera.lookAt(panX, game.size / 2, panZ);
  };
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(8, 12, 6);
  scene.add(key);

  const boardGroup = new THREE.Group();
  const grid = new THREE.GridHelper(game.size + 1, game.size + 1, 0x1f3a5f, 0x91abc9);
  grid.position.set(0, 0, 0);
  boardGroup.add(grid);
  scene.add(boardGroup);

  const pieceGeo = new THREE.SphereGeometry(0.3, 18, 18);
  const pieceMats = [
    new THREE.MeshStandardMaterial({ color: 0xcbd6ea }),
    new THREE.MeshStandardMaterial({ color: 0xd7263d }),
    new THREE.MeshStandardMaterial({ color: 0xf4d35e })
  ];

  const drawPieces = (): void => {
    scene.children.filter((node) => node.userData.piece === true).forEach((node) => scene.remove(node));
    for (let i = 0; i < game.board.cells.length; i += 1) {
      const v = game.board.cells[i];
      if (!v) continue;
      const [x, y, z] = game.board.indexToCoords(i);
      const m = new THREE.Mesh(pieceGeo, pieceMats[v]);
      m.position.set(x - game.size / 2 + 0.5, y + 0.5, z - game.size / 2 + 0.5);
      m.userData.piece = true;
      scene.add(m);
    }
  };
  drawPieces();

  let dragMode: 'orbit' | 'pan' | null = null;
  let lastX = 0;
  let lastY = 0;

  renderer.domElement.oncontextmenu = (e) => e.preventDefault();
  renderer.domElement.onpointerdown = (e) => {
    dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
    lastX = e.clientX;
    lastY = e.clientY;
  };
  renderer.domElement.onpointerup = () => {
    dragMode = null;
  };
  renderer.domElement.onpointermove = (e) => {
    if (!dragMode) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (dragMode === 'orbit') {
      theta -= dx * 0.008;
      phi = Math.min(Math.PI - 0.2, Math.max(0.2, phi + dy * 0.008));
    } else {
      panX -= dx * 0.01;
      panZ += dy * 0.01;
    }
    updateCamera();
  };
  renderer.domElement.onwheel = (e) => {
    e.preventDefault();
    radius = Math.min(60, Math.max(4, radius + e.deltaY * 0.01));
    updateCamera();
  };

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
  renderer.domElement.onclick = (event) => {
    if (game.winner) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const p = new THREE.Vector3();
    ray.ray.intersectPlane(plane, p);
    const x = Math.floor(p.x + game.size / 2);
    const z = Math.floor(p.z + game.size / 2);
    if (x < 0 || z < 0 || x >= game.size || z >= game.size) return;

    const startedAt = performance.now();
    if (game.play([x, z])) {
      telemetry.push({ type: 'move_latency', ms: performance.now() - startedAt, meta: { mode: '3d', by: 'human' } });
      render();
    }
  };

  const animate = (): void => {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
};

const toolbarHtml = (): string => `
<div class="toolbar">
  <label>Mode
    <select id="mode">
      <option value="2d" ${mode === '2d' ? 'selected' : ''}>2D</option>
      <option value="3d" ${mode === '3d' ? 'selected' : ''}>3D</option>
      <option value="nd" ${mode === 'nd' ? 'selected' : ''}>4D+</option>
    </select>
  </label>
  <label>Size <input id="size" type="number" min="4" max="9" value="${game.size}" /></label>
  <label>Dimensions <input id="dims" type="number" min="2" max="6" value="${game.dimensions}" /></label>
  <button id="newGame">New game</button>
  <button id="reset">Reset</button>
  <button id="undo">Undo</button>
  <label><input id="aiEnabled" type="checkbox" ${aiEnabled ? 'checked' : ''} /> Human vs AI</label>
  <label>AI
    <select id="aiAgent">
      <option value="random" ${aiAgent === 'random' ? 'selected' : ''}>Random</option>
      <option value="strategic" ${aiAgent === 'strategic' ? 'selected' : ''}>Strategic-lite</option>
    </select>
  </label>
  <label>AI budget <input id="aiBudget" type="number" min="50" max="5000" value="${aiTimeMs}" /></label>
  <strong>${boardStatus()}</strong>
</div>
`;

const bindControls = (): void => {
  document.getElementById('mode')?.addEventListener('change', (e) => {
    mode = (e.target as HTMLSelectElement).value as Mode;
    render();
  });

  document.getElementById('newGame')?.addEventListener('click', () => {
    const size = Number((document.getElementById('size') as HTMLInputElement).value);
    const dimensions = Number((document.getElementById('dims') as HTMLInputElement).value);
    newGame(size, dimensions);
    render();
  });

  document.getElementById('reset')?.addEventListener('click', () => {
    game.reset();
    render();
  });

  document.getElementById('undo')?.addEventListener('click', () => {
    game.undo();
    render();
  });

  document.getElementById('aiEnabled')?.addEventListener('change', (e) => {
    aiEnabled = (e.target as HTMLInputElement).checked;
    render();
  });

  document.getElementById('aiAgent')?.addEventListener('change', (e) => {
    aiAgent = (e.target as HTMLSelectElement).value as AgentName;
  });

  document.getElementById('aiBudget')?.addEventListener('change', (e) => {
    aiTimeMs = Number((e.target as HTMLInputElement).value);
  });

  document.querySelectorAll('[data-drop2d]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const x = Number((btn as HTMLButtonElement).dataset.drop2d);
      const startedAt = performance.now();
      if (game.dimensions === 2 && game.play([x])) {
        telemetry.push({ type: 'move_latency', ms: performance.now() - startedAt, meta: { mode: '2d', by: 'human' } });
        render();
      }
    });
  });

  document.querySelectorAll('[data-slice-x]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const x = Number((btn as HTMLButtonElement).dataset.sliceX);
      const y = Number((btn as HTMLButtonElement).dataset.sliceY);
      const move = moveFromSlice(game.dimensions, ndAxisA, ndAxisB, ndFixed, x, y);
      const startedAt = performance.now();
      if (game.play(move)) {
        telemetry.push({ type: 'move_latency', ms: performance.now() - startedAt, meta: { mode: 'nd', by: 'human' } });
        render();
      }
    });
  });

  document.getElementById('sliceAxisA')?.addEventListener('change', (e) => {
    ndAxisA = Number((e.target as HTMLSelectElement).value);
    if (ndAxisA === ndAxisB) {
      const fallback = getDropAxes(game.dimensions).find((axis) => axis !== ndAxisA);
      if (fallback != null) ndAxisB = fallback;
    }
    render();
  });

  document.getElementById('sliceAxisB')?.addEventListener('change', (e) => {
    ndAxisB = Number((e.target as HTMLSelectElement).value);
    if (ndAxisA === ndAxisB) {
      const fallback = getDropAxes(game.dimensions).find((axis) => axis !== ndAxisB);
      if (fallback != null) ndAxisA = fallback;
    }
    render();
  });

  document.querySelectorAll('[data-fixed-axis]').forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const axis = Number((e.target as HTMLInputElement).dataset.fixedAxis);
      ndFixed[axis] = Number((e.target as HTMLInputElement).value);
      render();
    });
  });
};

const render = (): void => {
  const visual = mode === '2d' ? render2DBoard() : mode === '3d' ? '<div id="three"></div><p class="small">Drag to orbit, Shift+drag/right-drag to pan, wheel to zoom.</p>' : renderSliceBoard();
  app.innerHTML = `${toolbarHtml()}${visual}<div class="small telemetry">Telemetry: ${telemetry.summary() || 'no events yet'}</div>`;
  bindControls();
  if (mode === '3d') init3D();
  requestAIMove();
};

newGame(7, 2);
render();
