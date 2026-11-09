// Slicer-style 2D views of the bone mask: three orthogonal planes on the sweep's own 0.3 mm grid.
// Red: one depth (looking down onto the sweep). Yellow: one position along the sweep (cut across it).
// Green: one position across the sweep (cut along it). Clicking a view moves the other two planes.
const INDEX_URL = './assets/20261108/slices.json?v=20261108';
const MASK_RGB = [255, 122, 26];
const $ = id => document.getElementById(id);
const cache = new Map();
const state = {index: null, sweep: null, matrix: 'matrix_1', background: 'ultrasound', showMask: true, opacity: 0.6,
  volume: null, data: {}, pos: {depth: 0, across: 0, along: 0}, token: 0, started: false};
const VIEWS = {
  red: {fixed: 'depth', rows: 'across', cols: 'along'},
  yellow: {fixed: 'along', rows: 'depth', cols: 'across'},
  green: {fixed: 'across', rows: 'depth', cols: 'along'},
};

function dims() {
  const [depth, across, along] = state.volume.shape_depth_across_along;
  return {depth, across, along};
}

async function fetchVolume(info, label, expected) {
  if (cache.has(info.file)) return cache.get(info.file);
  setStatus(`Loading ${label} · ${(info.bytes / 1048576).toFixed(1)} MB`);
  const response = await fetch(`./${info.file}`);
  if (!response.ok) throw Error(`${label} could not be loaded.`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const array = new Uint8Array(await new Response(stream).arrayBuffer());
  if (array.length !== expected) throw Error(`${label} has an unexpected size.`);
  cache.set(info.file, array);
  return array;
}

function setStatus(text) {
  $('slice-status').textContent = text;
}

function maskCentre(mask) {
  const n = dims();
  let count = 0, d = 0, a = 0, l = 0;
  for (let z = 0; z < n.depth; z++) for (let y = 0; y < n.across; y++) {
    const row = (z * n.across + y) * n.along;
    for (let x = 0; x < n.along; x++) if (mask[row + x]) { count++; d += z; a += y; l += x; }
  }
  return count ? {depth: Math.round(d / count), across: Math.round(a / count), along: Math.round(l / count)}
    : {depth: n.depth >> 1, across: n.across >> 1, along: n.along >> 1};
}

// Scale the voxel-sized canvas to fill its frame without changing the aspect ratio (voxels are isotropic).
function fit(name) {
  const canvas = $(`slice-${name}`), wrap = canvas.parentElement;
  if (!canvas.width || !wrap.clientWidth) return;
  const scale = Math.min(wrap.clientWidth / canvas.width, wrap.clientHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}

function draw(name) {
  const view = VIEWS[name], n = dims(), canvas = $(`slice-${name}`);
  const width = n[view.cols], height = n[view.rows];
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; fit(name); }
  const context = canvas.getContext('2d'), image = context.createImageData(width, height), pixels = image.data;
  const background = state.data[state.background], mask = state.data.mask, alpha = state.showMask ? state.opacity : 0;
  const stride = {depth: n.across * n.along, across: n.along, along: 1};
  const base = state.pos[view.fixed] * stride[view.fixed], rowStride = stride[view.rows], colStride = stride[view.cols];
  let maskPixels = 0;
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
    const i = base + r * rowStride + c * colStride, value = background[i], marked = mask[i];
    const p = (r * width + c) * 4;
    if (marked) maskPixels++;
    const mix = marked ? alpha : 0;
    pixels[p] = value * (1 - mix) + MASK_RGB[0] * mix;
    pixels[p + 1] = value * (1 - mix) + MASK_RGB[1] * mix;
    pixels[p + 2] = value * (1 - mix) + MASK_RGB[2] * mix;
    pixels[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  // Crosshair: the positions of the two other planes.
  context.save();
  context.globalAlpha = 0.75;
  context.lineWidth = Math.max(1, width / 400);
  const lines = {red: {across: '#e8c547', along: '#4cc46a'}, yellow: {depth: '#e05b4b', across: '#4cc46a'},
    green: {depth: '#e05b4b', along: '#e8c547'}}[name];
  for (const [axis, colour] of Object.entries(lines)) {
    context.strokeStyle = colour;
    context.beginPath();
    if (axis === view.rows) { context.moveTo(0, state.pos[axis] + .5); context.lineTo(width, state.pos[axis] + .5); }
    else { context.moveTo(state.pos[axis] + .5, 0); context.lineTo(state.pos[axis] + .5, height); }
    context.stroke();
  }
  context.restore();
  canvas.dataset.maskPixels = String(maskPixels);
  const mm = (state.pos[view.fixed] * state.volume.voxel_mm).toFixed(1);
  $(`slice-${name}-position`).textContent = `${mm} mm`;
  canvas.setAttribute('aria-label', `${canvas.dataset.title} at ${mm} mm, ${maskPixels} bone-mask pixels shown`);
  const slider = $(`slice-${name}-slider`);
  slider.max = String(n[view.fixed] - 1);
  slider.value = String(state.pos[view.fixed]);
  // The site's range style draws its track from --fill.
  slider.style.setProperty('--fill', `${(100 * state.pos[view.fixed] / Math.max(1, n[view.fixed] - 1)).toFixed(2)}%`);
}

function drawAll() {
  if (!state.volume || !state.data.mask || !state.data[state.background]) return;
  for (const name of Object.keys(VIEWS)) draw(name);
}

async function load() {
  if (!state.index || !state.sweep) return;
  const volume = state.index.volumes.find(v => v.sweep === state.sweep && v.matrix === state.matrix);
  if (!volume) { setStatus('No slice volumes for this sweep.'); return; }
  const token = ++state.token, panel = $('slice-panel');
  panel.dataset.sliceReady = '';
  panel.setAttribute('aria-busy', 'true');
  const [d, a, l] = volume.shape_depth_across_along, voxels = d * a * l;
  try {
    const mask = await fetchVolume(volume.files.mask, 'bone mask', voxels);
    const background = await fetchVolume(volume.files[state.background],
      state.background === 'ct' ? `CT ${volume.ct_series}` : 'ultrasound volume', voxels);
    if (token !== state.token) return;
    const keepPosition = state.volume && state.volume.sweep === volume.sweep && state.volume.matrix === volume.matrix;
    state.volume = volume;
    state.data = {mask, [state.background]: background};
    if (!keepPosition) state.pos = maskCentre(mask);
    drawAll();
    const phantom = volume.phantom === 'big' ? 'big phantom' : 'small phantom';
    setStatus(`Sweep ${volume.sweep} · ${volume.matrix === 'matrix_1' ? 'Matrix 1' : 'Matrix 2'} · ${phantom} · ` +
      `${state.background === 'ct' ? `CT ${volume.ct_series} after the rigid fit` : 'compounded ultrasound'} · ` +
      `${volume.mask_voxels.toLocaleString('en-US')} mask voxels`);
    panel.dataset.sliceReady = `${volume.sweep}/${volume.matrix}/${state.background}`;
  } catch (error) {
    if (token === state.token) setStatus(error.message);
  } finally {
    if (token === state.token) panel.setAttribute('aria-busy', 'false');
  }
}

function select(group, value) {
  for (const button of $(group).querySelectorAll('button')) {
    const on = button.dataset.value === value;
    button.classList.toggle('selected', on);
    button.setAttribute('aria-pressed', String(on));
  }
}

function pointer(name, event) {
  if (!state.volume) return;
  const view = VIEWS[name], canvas = $(`slice-${name}`), box = canvas.getBoundingClientRect(), n = dims();
  const col = Math.floor((event.clientX - box.left) / box.width * canvas.width);
  const row = Math.floor((event.clientY - box.top) / box.height * canvas.height);
  state.pos[view.cols] = Math.min(Math.max(col, 0), n[view.cols] - 1);
  state.pos[view.rows] = Math.min(Math.max(row, 0), n[view.rows] - 1);
  drawAll();
}

function wire() {
  for (const name of Object.keys(VIEWS)) {
    const view = VIEWS[name];
    $(`slice-${name}-slider`).addEventListener('input', event => {
      state.pos[view.fixed] = Number(event.target.value);
      if (state.volume) draw(name), Object.keys(VIEWS).filter(v => v !== name).forEach(draw);
    });
    $(`slice-${name}`).addEventListener('click', event => pointer(name, event));
  }
  $('slice-matrix').addEventListener('click', event => {
    const value = event.target.closest('button')?.dataset.value;
    if (!value || value === state.matrix) return;
    state.matrix = value; select('slice-matrix', value); load();
  });
  $('slice-background').addEventListener('click', event => {
    const value = event.target.closest('button')?.dataset.value;
    if (!value || value === state.background) return;
    state.background = value; select('slice-background', value); load();
  });
  $('slice-mask').addEventListener('change', event => { state.showMask = event.target.checked; drawAll(); });
  $('slice-opacity').addEventListener('input', event => { state.opacity = Number(event.target.value); drawAll(); });
  // Follow the sweep and the single-matrix choice of the main workspace.
  document.addEventListener('click', event => {
    const sweep = event.target.closest('[data-case]')?.dataset.case;
    if (sweep && sweep !== state.sweep) { state.sweep = sweep; if (state.started) load(); }
    const matrix = event.target.closest('#matrix-options [data-matrix]')?.dataset.matrix;
    if ((matrix === 'matrix_1' || matrix === 'matrix_2') && matrix !== state.matrix) {
      state.matrix = matrix; select('slice-matrix', matrix); if (state.started) load();
    }
  });
}

async function start() {
  if (state.started) return;
  state.started = true;
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) throw Error('The slice index could not be loaded.');
    state.index = await response.json();
    await load();
  } catch (error) {
    setStatus(error.message);
  }
}

function init() {
  if (!$('slice-panel')) return;
  state.sweep = document.querySelector('[data-case].selected')?.dataset.case || '192514';
  wire();
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(() => Object.keys(VIEWS).forEach(fit));
    document.querySelectorAll('.slice-canvas-wrap').forEach(wrap => resize.observe(wrap));
  }
  // Download the volumes only when the panel comes near the screen.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); start(); }
    }, {rootMargin: '400px'});
    observer.observe($('slice-panel'));
  } else start();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
