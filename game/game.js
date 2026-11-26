/* Merapi Dawn Run — a small original flight game.
   Plain Canvas 2D, no libraries, no network requests, no external files.
   You are a bush pilot flying the dawn mail run across a volcanic
   Indonesian archipelago: take off, thread eight glowing rings over
   rice terraces and the smoking volcano, then put the plane down
   gently on the short island strip at Pulau Dermaga. */

'use strict';

/* ---------------- utils ---------------- */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth(fx), v = smooth(fz);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z) {
  return vnoise(x, z) * 0.6 + vnoise(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.3
    + vnoise(x * 4.31 + 13.7, z * 4.31 + 9.4) * 0.1;
}

/* ---------------- world ---------------- */
/* Islands: gaussian bumps. x east, z south, y up, metres. North is -z. */
const ISLANDS = [
  { name: 'Pulau Landas',   x: 0,     z: 0,     r: 520,  h: 16 },
  { name: 'Sawah Terrace',  x: -420,  z: -750,  r: 560,  h: 62 },
  { name: 'Pulau Karang',   x: -950,  z: -1500, r: 420,  h: 34 },
  { name: 'Lagoon Islets',  x: 150,   z: -2100, r: 480,  h: 12 },
  { name: 'Pulau Dermaga',  x: -220,  z: -2950, r: 560,  h: 13 },
  { name: 'Pulau Timur',    x: 1150,  z: -2300, r: 520,  h: 48 },
  { name: 'Pulau Barat',    x: -1250, z: -2600, r: 460,  h: 26 },
];
const VOLCANO = { x: 620, z: -1350, r: 850, h: 330 };
const TERRACE = ISLANDS[1];

/* Runways: flat strips, heading north (-z). */
const RUNWAY_START = { x: 0, z: 20, len: 300, wid: 26, h: 6, name: 'LANDAS' };
const RUNWAY_END = { x: -220, z: -2950, len: 320, wid: 26, h: 5, name: 'DERMAGA' };

function flattenRunway(h, x, z) {
  for (const rw of [RUNWAY_START, RUNWAY_END]) {
    const dx = Math.abs(x - rw.x), dz = Math.abs(z - rw.z);
    if (dx < rw.wid * 2.2 && dz < rw.len * 0.62) {
      const t = smooth(clamp(1 - Math.max(dx / (rw.wid * 2.2), dz / (rw.len * 0.62)), 0, 1));
      h = lerp(h, rw.h, t);
    }
  }
  return h;
}

function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d2 = (dx * dx + dz * dz) / (isl.r * isl.r);
    h += isl.h * Math.exp(-d2 * 1.7);
  }
  const vdx = x - VOLCANO.x, vdz = z - VOLCANO.z;
  const vd = Math.hypot(vdx, vdz);
  if (vd < VOLCANO.r) {
    const t = 1 - vd / VOLCANO.r;
    h += VOLCANO.h * Math.pow(t, 1.55);
    if (vd < 110) h -= 46 * (1 - vd / 110); /* crater bowl */
  }
  /* rolling noise, stronger where there is land */
  const land = clamp(h / 24, 0, 1);
  h += fbm(x * 0.004, z * 0.004) * 9 * land;
  h += fbm(x * 0.02 + 3, z * 0.02 + 8) * 2.5 * land;
  h = flattenRunway(h, x, z);
  /* low departure corridor north of the home strip, so a fresh
     takeoff that levels off does not meet a noise hill */
  if (z < 170 && z > -460) {
    const t = smooth(clamp(1 - Math.abs(x) / 110, 0, 1))
      * smooth(clamp((170 - z) / 60, 0, 1))
      * smooth(clamp((z + 460) / 60, 0, 1));
    h = lerp(h, Math.min(h, 9), t);
  }
  return h;
}

/* Rings along the dawn mail route. */
const RINGS = [
  { x: 0,     z: -180,  y: 42 },
  { x: -180,  z: -480,  y: 115 },
  { x: -430,  z: -780,  y: 145 },
  { x: -60,   z: -1120, y: 200 },
  { x: 480,   z: -1420, y: 290 },
  { x: 180,   z: -1900, y: 185 },
  { x: -120,  z: -2400, y: 145 },
  { x: -220,  z: -2760, y: 105 },
];
const RING_R = 30;
for (let i = 0; i < RINGS.length; i++) {
  const a = RINGS[i], b = RINGS[i + 1] || { x: RUNWAY_END.x, z: RUNWAY_END.z, y: RUNWAY_END.h + 30 };
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  a.nx = dx / len; a.ny = dy / len; a.nz = dz / len;
  a.passed = false;
}

/* Scattered palms and village houses, deterministic. */
const rng = mulberry32(20261126);
const PALMS = [];
const HOUSES = [];
for (let i = 0; i < 900; i++) {
  const x = (rng() - 0.5) * 3800, z = 300 - rng() * 3600;
  const h = terrainHeight(x, z);
  /* keep the strips clear: nothing grows on a runway */
  let onStrip = false;
  for (const rw of [RUNWAY_START, RUNWAY_END]) {
    if (Math.abs(x - rw.x) < rw.wid / 2 + 16 && Math.abs(z - rw.z) < rw.len / 2 + 16) onStrip = true;
  }
  if (onStrip) continue;
  if (h > 2 && h < 55) {
    if (rng() < 0.72) PALMS.push({ x, z, h, s: 0.8 + rng() * 0.7, ph: rng() * TAU });
    else HOUSES.push({ x, z, h, s: 0.9 + rng() * 0.5, rot: rng() * TAU });
  }
}
const CLOUDS = [];
for (let i = 0; i < 16; i++) {
  CLOUDS.push({
    x: (rng() - 0.5) * 4200, z: 400 - rng() * 3800,
    y: 380 + rng() * 260, rx: 80 + rng() * 110, ry: 18 + rng() * 22,
    a: 0.35 + rng() * 0.3, drift: 2 + rng() * 3,
  });
}
const SMOKE = [];
for (let i = 0; i < 26; i++) {
  SMOKE.push({ t: rng(), r: 14 + rng() * 30, x: (rng() - 0.5) * 60, z: (rng() - 0.5) * 60 });
}
const BIRDS = [];
for (let i = 0; i < 5; i++) {
  BIRDS.push({ x: (rng() - 0.5) * 800, z: -400 - rng() * 2200, y: 120 + rng() * 90, ph: rng() * TAU, sp: 8 + rng() * 5 });
}

/* ---------------- canvas & camera ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const FOCAL = (H / 2) / Math.tan(35 * DEG);
const SUN = { az: 72 * DEG, el: 9 * DEG }; /* low sun, east-northeast: dawn */
const SUN_DIR = {
  x: Math.cos(SUN.el) * Math.sin(SUN.az),
  y: Math.sin(SUN.el),
  z: -Math.cos(SUN.el) * Math.cos(SUN.az),
};

const cam = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 };
function setCamera(px, py, pz, lookX, lookY, lookZ, roll) {
  let fx = lookX - px, fy = lookY - py, fz = lookZ - pz;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; /* right = forward x world-up */
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  let ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const c = Math.cos(roll), s = Math.sin(roll);
  const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s;
  const nux = ux * c - rx * s, nuy = uy * c - ry * s, nuz = uz * c - rz * s;
  cam.x = px; cam.y = py; cam.z = pz;
  cam.fx = fx; cam.fy = fy; cam.fz = fz;
  cam.rx = nrx; cam.ry = nry; cam.rz = nrz;
  cam.ux = nux; cam.uy = nuy; cam.uz = nuz;
}
function project(x, y, z) {
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const cx = dx * cam.rx + dy * cam.ry + dz * cam.rz;
  const cy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  const cz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (cz < 2) return null;
  const s = FOCAL / cz;
  return { x: W / 2 + cx * s, y: H / 2 - cy * s, d: cz, s };
}
/* view-space coordinates (no near-plane test), for terrain clipping */
function toView(x, y, z) {
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  return {
    x: dx * cam.rx + dy * cam.ry + dz * cam.rz,
    y: dx * cam.ux + dy * cam.uy + dz * cam.uz,
    z: dx * cam.fx + dy * cam.fy + dz * cam.fz,
  };
}
function projectView(v) {
  if (v.z < 2) return null;
  const s = FOCAL / v.z;
  return { x: W / 2 + v.x * s, y: H / 2 - v.y * s, d: v.z, s };
}
/* Sutherland–Hodgman clip of a view-space polygon against the
   near plane (z >= 2). Fixes the missing foreground band: the old
   code dropped a whole terrain quad when any corner sat behind the
   camera, so the ground right under the camera rendered as sea. */
function intersectNear(a, b) {
  const t = (2 - a.z) / (b.z - a.z);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 2 };
}
function clipNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prv = poly[(i + poly.length - 1) % poly.length];
    const curIn = cur.z >= 2, prvIn = prv.z >= 2;
    if (curIn) {
      if (!prvIn) out.push(intersectNear(prv, cur));
      out.push(cur);
    } else if (prvIn) {
      out.push(intersectNear(prv, cur));
    }
  }
  return out;
}

/* ---------------- game state ---------------- */
const G = {
  mode: 'menu',           /* menu | fly | landed | crashed | done */
  t: 0, timeLeft: 420, score: 0, rings: 0,
  best: 0,
  plane: null,
  msg: '', msgT: 0,
  shake: 0, flash: 0,
  camMode: 0,             /* 0 chase, 1 cockpit */
  paused: false, muted: false,
  stallWarn: false, lowFuelWarn: false,
  landQuality: null, finalBonus: 0,
  stats: { rings: 0, centerBonus: 0, landBonus: 0, timeBonus: 0, fuelBonus: 0 },
  results: null,
};
try { G.best = parseInt(localStorage.getItem('merapi-best') || '0', 10) || 0; } catch (e) { G.best = 0; }

function newPlane() {
  return {
    x: RUNWAY_START.x, y: RUNWAY_START.h + 1.2, z: RUNWAY_START.z + 20,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, vs: 0,
    onGround: true, fuel: 100, flaps: false,
    prevRingD: 0, prop: 0,
  };
}
G.plane = newPlane();

/* ---------------- input ---------------- */
const keys = {};
const mouse = { x: W / 2, y: H / 2, active: false, down: false };
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter' && G.mode === 'menu') startFlight();
  if (e.key === 'r' || e.key === 'R') { if (G.mode !== 'menu') resetFlight(); }
  if (e.key === 'c' || e.key === 'C') G.camMode = 1 - G.camMode;
  if (e.key === 'p' || e.key === 'P') G.paused = !G.paused;
  if (e.key === 'm' || e.key === 'M') { G.muted = !G.muted; setAudio(); }
  if (e.key === 'f' || e.key === 'F') { const p = G.plane; p.flaps = !p.flaps; showMsg(p.flaps ? 'FLAPS DOWN' : 'FLAPS UP'); }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
  mouse.active = true;
});
canvas.addEventListener('mousedown', e => {
  canvas.focus();
  mouse.down = true;
  if (G.mode === 'menu') startFlight();
});
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.setAttribute('tabindex', '0');

function showMsg(text, dur) { G.msg = text; G.msgT = dur || 2.2; }

function startFlight() {
  resetFlight();
  G.mode = 'fly';
  showMsg('TAKEOFF — throttle up with W, steer with arrows or mouse', 3.5);
  initAudio();
}
function resetFlight() {
  G.plane = newPlane();
  for (const r of RINGS) r.passed = false;
  G.mode = 'fly'; G.timeLeft = 420; G.score = 0; G.rings = 0;
  G.stats = { rings: 0, centerBonus: 0, landBonus: 0, timeBonus: 0, fuelBonus: 0 };
  G.results = null; G.landQuality = null; G.flash = 0; G.shake = 0;
  G.paused = false;
}

/* ---------------- flight model ---------------- */
const STALL = 19; /* m/s */
function stepFlight(dt) {
  const p = G.plane;
  if (G.mode !== 'fly') return;
  G.timeLeft -= dt;
  if (G.timeLeft <= 0) { G.timeLeft = 0; endRun('Time up — the mail is late.'); return; }

  /* throttle */
  if (keys['w'] || keys['shift']) p.throttle = clamp(p.throttle + dt * 0.55, 0, 1);
  if (keys['s'] || keys['control']) p.throttle = clamp(p.throttle - dt * 0.55, 0, 1);
  if (mouse.down) p.throttle = clamp(p.throttle + dt * 0.4, 0, 1);

  /* steering: keys, blended with mouse position */
  let rollIn = 0, pitchIn = 0;
  if (keys['arrowleft'] || keys['a']) rollIn -= 1;
  if (keys['arrowright'] || keys['d']) rollIn += 1;
  if (keys['arrowup']) pitchIn -= 1;
  if (keys['arrowdown']) pitchIn += 1;
  if (mouse.active && !keys['arrowleft'] && !keys['arrowright'] && !keys['arrowup'] && !keys['arrowdown']) {
    rollIn = clamp((mouse.x - W / 2) / (W * 0.30), -1, 1);
    pitchIn = clamp((mouse.y - H / 2) / (H * 0.30), -1, 1);
  }
  const stalled = !p.onGround && p.speed < STALL;
  G.stallWarn = stalled;
  const authority = p.onGround ? clamp(p.speed / 24, 0, 1) : (stalled ? 0.35 : 1);

  const targetRoll = rollIn * 55 * DEG * authority;
  const noPitch = pitchIn === 0 && !p.onGround;
  const targetPitch = p.onGround
    ? (pitchIn < 0 ? pitchIn * -12 * DEG : 0) * clamp(p.speed / 24, 0, 1)
    : noPitch ? 3 * DEG * authority /* gentle climb trim when hands off */
    : pitchIn * -22 * DEG * authority + (stalled ? 14 * DEG : 0);
  p.roll = lerp(p.roll, targetRoll, clamp(dt * 3.2, 0, 1));
  p.pitch = lerp(p.pitch, targetPitch, clamp(dt * 2.6, 0, 1));

  /* speed: throttle pushes toward a target, drag and climb bleed it */
  const maxSpd = p.flaps ? 52 : 78;
  const targetSpd = 12 + p.throttle * (maxSpd - 12) + (p.fuel <= 0 ? -12 : 0);
  p.speed = lerp(p.speed, Math.max(0, targetSpd), clamp(dt * 0.45, 0, 1));
  p.speed -= Math.sin(p.pitch) * 9 * dt;             /* climbing costs speed */
  p.speed = clamp(p.speed, 0, 95);
  if (p.fuel > 0) p.fuel = Math.max(0, p.fuel - dt * (0.06 + p.throttle * 0.22));
  if (p.fuel <= 0 && !G.lowFuelWarn) { G.lowFuelWarn = true; showMsg('FUEL EMPTY — glide her down!', 3); }

  /* turn: coordinated, bank drives heading */
  const turnRate = -9.81 * Math.tan(p.roll) / Math.max(p.speed, 8);
  p.heading += turnRate * dt;

  const fwdX = Math.sin(p.heading), fwdZ = -Math.cos(p.heading);

  if (p.onGround) {
    p.x += fwdX * p.speed * dt;
    p.z += fwdZ * p.speed * dt;
    p.y = terrainHeight(p.x, p.z) + 1.2;
    if (p.speed > 24 && p.pitch > 4 * DEG) { p.onGround = false; showMsg('AIRBORNE — climb to the first ring', 2.5); }
    if (p.speed > 40) { /* ran off the strip end fast: bumpy grass */ }
  } else {
    p.vs = p.speed * Math.sin(p.pitch) - (stalled ? 6 : 0);
    p.x += fwdX * p.speed * dt;
    p.z += fwdZ * p.speed * dt;
    p.y += p.vs * dt;
    if (p.y < 1) p.y = 1;
  }
  p.prop += dt * (4 + p.throttle * 40);

  /* ring crossing */
  const ring = RINGS[G.rings];
  if (ring) {
    const dx = p.x - ring.x, dy = p.y - ring.y, dz = p.z - ring.z;
    const d = dx * ring.nx + dy * ring.ny + dz * ring.nz;
    /* crossing the ring plane in either direction counts, so a
       missed ring can be retried by turning back for it */
    if ((p.prevRingD > 0 && d <= 0) || (p.prevRingD < 0 && d >= 0)) {
      const lat = Math.hypot(dx - d * ring.nx, dy - d * ring.ny, dz - d * ring.nz);
      if (lat < RING_R) {
        ring.passed = true;
        G.rings++;
        const center = Math.max(0, 200 - Math.round(lat * 5));
        G.score += 500 + center;
        G.stats.rings += 500; G.stats.centerBonus += center;
        G.timeLeft += 12;
        showMsg(center > 120 ? 'RING ' + G.rings + ' — DEAD CENTRE! +' + (500 + center)
          : 'RING ' + G.rings + '/8  +' + (500 + center), 2.2);
        ringBurst(ring);
        playChime();
      }
    }
    p.prevRingD = d;
  }

  /* ground / water contact */
  const gh = terrainHeight(p.x, p.z);
  if (!p.onGround && p.y <= gh + 1.0) {
    const rwHit = onRunway(p.x, p.z, RUNWAY_END) ? RUNWAY_END
      : onRunway(p.x, p.z, RUNWAY_START) ? RUNWAY_START : null;
    const soft = p.vs > -4.5 && p.speed < 48 && Math.abs(p.roll) < 22 * DEG;
    if (rwHit && soft) {
      landPlane(rwHit);
    } else if (gh <= 0.4) {
      crash('Ditched in the sea.');
    } else if (p.vs < -3 || p.speed > 30) {
      crash(p.y < gh + 1 && gh > 120 ? 'Clipped the volcano.' : 'Crashed into the terrain.');
    } else {
      /* gentle grass touchdown: roll out, can take off again */
      p.onGround = true; p.y = gh + 1.2; p.vs = 0;
      showMsg('Bumpy field landing — throttle up to take off again', 2.5);
    }
  }
  /* world bounds: gentle turn-back nudge */
  if (Math.abs(p.x) > 2100 || p.z > 500 || p.z < -3400) {
    showMsg('Turn back — the mail route stays over the islands', 1.5);
    p.heading += dt * 0.6 * (p.z < -3400 ? 1 : -1) * Math.sign(p.x || 1);
  }
}
function onRunway(x, z, rw) {
  return Math.abs(x - rw.x) < rw.wid / 2 + 4 && Math.abs(z - rw.z) < rw.len / 2;
}
function landPlane(rw) {
  const p = G.plane;
  p.onGround = true; p.y = rw.h + 1.2; p.vs = 0;
  if (rw === RUNWAY_END) {
    /* finished: score the landing */
    const soft = clamp(1 - Math.abs(p.vs) / 4.5, 0, 1);
    const centre = clamp(1 - Math.abs(p.x - rw.x) / 14, 0, 1);
    const landBonus = Math.round(1000 + soft * 500 + centre * 300);
    const timeBonus = Math.round(G.timeLeft * 3);
    const fuelBonus = Math.round(p.fuel * 2);
    G.stats.landBonus = landBonus; G.stats.timeBonus = timeBonus; G.stats.fuelBonus = fuelBonus;
    G.score += landBonus + timeBonus + fuelBonus;
    G.landQuality = soft > 0.75 ? 'Butter-smooth' : soft > 0.4 ? 'A firm but fair landing' : 'A hard arrival';
    finishRun();
  } else {
    showMsg('Back on the strip — throttle up and go again', 2.5);
  }
}
function crash(why) {
  G.mode = 'crashed';
  G.shake = 1; G.flash = 0.8;
  playCrash();
  G.results = { why, score: G.score, rings: G.rings };
  if (G.score > G.best) { G.best = G.score; try { localStorage.setItem('merapi-best', String(G.best)); } catch (e) {} }
}
function endRun(why) {
  G.mode = 'crashed';
  G.results = { why, score: G.score, rings: G.rings };
  if (G.score > G.best) { G.best = G.score; try { localStorage.setItem('merapi-best', String(G.best)); } catch (e) {} }
}
function finishRun() {
  G.mode = 'done';
  playChime();
  G.results = { why: 'Mail delivered!', score: G.score, rings: G.rings };
  if (G.score > G.best) { G.best = G.score; try { localStorage.setItem('merapi-best', String(G.best)); } catch (e) {} }
}

/* ring-pass particles */
const particles = [];
function ringBurst(ring) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU;
    particles.push({
      x: ring.x + Math.cos(a) * RING_R, y: ring.y + Math.sin(a) * RING_R, z: ring.z,
      vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, vz: (Math.random() - 0.5) * 8,
      life: 1, col: i % 3 ? '#ffb347' : '#fff3c4',
    });
  }
}

/* ---------------- rendering: sky ---------------- */
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b2350');
  g.addColorStop(0.42, '#4a4a86');
  g.addColorStop(0.58, '#c65f3c');
  g.addColorStop(0.68, '#f2a35e');
  g.addColorStop(0.78, '#ffd9a0');
  g.addColorStop(1, '#2c4a6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  /* stars fading near the top */
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const sx = (i * 173.3) % W, sy = (i * 97.7) % (H * 0.28);
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(i * 3.1 + G.t * 0.7);
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  /* sun: low, big, warm */
  const sunP = project(cam.x + SUN_DIR.x * 4000, cam.y + SUN_DIR.y * 4000, cam.z + SUN_DIR.z * 4000);
  if (sunP) {
    const glow = ctx.createRadialGradient(sunP.x, sunP.y, 4, sunP.x, sunP.y, 190);
    glow.addColorStop(0, 'rgba(255,236,180,0.95)');
    glow.addColorStop(0.25, 'rgba(255,190,110,0.55)');
    glow.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunP.x - 200, sunP.y - 200, 400, 400);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(sunP.x, sunP.y, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(sunP.x, sunP.y, 34, 0, TAU); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
  }
  /* horizon haze band */
  const hz = ctx.createLinearGradient(0, H * 0.52, 0, H * 0.66);
  hz.addColorStop(0, 'rgba(255,190,120,0)');
  hz.addColorStop(0.5, 'rgba(255,190,120,0.20)');
  hz.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, H * 0.52, W, H * 0.14);
}

/* ---------------- rendering: terrain ---------------- */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * f, 0, 255) | 0;
  const b = clamp((n & 255) * f, 0, 255) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function groundColor(h, slope, x, z) {
  if (h <= 0.6) return '#d9c08a';                       /* sand */
  const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (vd < VOLCANO.r * 0.75) {                          /* volcano rock */
    if (h > 250 + fbm(x * 0.01, z * 0.01) * 45) return '#e9e2d4'; /* ragged snow cap */
    if (vd < 130) return '#3d332c';                      /* crater */
    return h > 180 ? '#6e5b4c' : '#54463a';
  }
  const td = Math.hypot(x - TERRACE.x, z - TERRACE.z);
  if (td < TERRACE.r * 0.9 && h > 8) {                  /* rice terraces */
    return (Math.floor(h / 6) % 2 === 0) ? '#69b455' : '#4c9440';
  }
  /* lowland farmland patchwork */
  if (h < 30) {
    const plot = (Math.floor(x / 120) + Math.floor(z / 120)) % 2 === 0;
    return plot ? '#7fb85a' : '#5da24a';
  }
  if (h < 42) return '#4f9e44';
  if (h < 95) return '#2e7d32';
  if (h < 170) return '#6d5b45';
  return '#8a7a68';
}
let sunScreenX = W * 0.72;
function drawTerrain() {
  const p = G.plane;
  const fwdX = Math.sin(p.heading), fwdZ = -Math.cos(p.heading);
  /* sea backdrop below the horizon, so the world never ends in sky */
  const hz = project(cam.x + cam.fx * 5000, cam.y, cam.z + cam.fz * 5000);
  const horizonY = hz ? hz.y : H * 0.45;
  const sunP = project(cam.x + SUN_DIR.x * 4000, cam.y + SUN_DIR.y * 4000, cam.z + SUN_DIR.z * 4000);
  const sg = ctx.createLinearGradient(0, horizonY, 0, H);
  sg.addColorStop(0, '#2c5f8f');
  sg.addColorStop(1, '#16324f');
  ctx.fillStyle = sg;
  ctx.fillRect(0, Math.max(0, horizonY), W, H - Math.max(0, horizonY));
  if (sunP) {
    const glow = ctx.createRadialGradient(sunP.x, horizonY + 40, 10, sunP.x, horizonY + 40, 420);
    glow.addColorStop(0, 'rgba(255,180,100,0.5)');
    glow.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunP.x - 430, horizonY - 10, 860, H - horizonY + 10);
  }
  const cx0 = p.x + fwdX * 700, cz0 = p.z + fwdZ * 700;
  const STEP = 40, HALF = 1100;
  const n = Math.round(HALF * 2 / STEP);
  const x0 = Math.round((cx0 - HALF) / STEP) * STEP;
  const z0 = Math.round((cz0 - HALF) / STEP) * STEP;
  /* project grid */
  const pts = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * STEP, z = z0 + j * STEP;
      const h = terrainHeight(x, z);
      row.push({ x, z, h, pr: project(x, Math.max(h, 0), z), vw: toView(x, Math.max(h, 0), z) });
    }
    pts.push(row);
  }
  /* draw rows far -> near from the camera */
  const order = [];
  for (let j = 0; j <= n; j++) order.push(j);
  order.sort((a, b) => {
    const za = z0 + a * STEP, zb = z0 + b * STEP;
    const da = (za - cam.z) * (za - cam.z) + (x0 + n * STEP / 2 - cam.x) * (x0 + n * STEP / 2 - cam.x);
    const db = (zb - cam.z) * (zb - cam.z) + (x0 + n * STEP / 2 - cam.x) * (x0 + n * STEP / 2 - cam.x);
    return db - da;
  });
  for (const j of order) {
    if (j >= n) continue;
    for (let i = 0; i < n; i++) {
      const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], d = pts[j + 1][i + 1];
      /* screen polygon for this quad. Fast path when all four corners
         are in front of the camera; otherwise clip the quad against
         the near plane instead of dropping it (dropping it left the
         foreground ground missing, rendering as flat sea). The old
         d < 8 cull is gone: clipping handles straddling quads, and a
         quad entirely in front of the camera projects correctly
         however close it is. */
      let poly;
      if (a.pr && b.pr && c.pr && d.pr) {
        if (a.pr.d < 3 && b.pr.d < 3 && c.pr.d < 3 && d.pr.d < 3) continue;
        poly = [a.pr, b.pr, d.pr, c.pr];
      } else {
        const clipped = clipNear([a.vw, b.vw, d.vw, c.vw]);
        if (clipped.length < 3) continue;
        poly = clipped.map(projectView);
        if (poly.some(q => !q)) continue;
      }
      const minX = Math.min(...poly.map(q => q.x));
      const maxX = Math.max(...poly.map(q => q.x));
      const minY = Math.min(...poly.map(q => q.y));
      const maxY = Math.max(...poly.map(q => q.y));
      if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) continue;
      const hAvg = (a.h + b.h + c.h + d.h) / 4;
      const slope = Math.abs(a.h - d.h) / (STEP * 1.4) + Math.abs(b.h - c.h) / (STEP * 1.4);
      const jitter = 0.92 + 0.16 * fbm((a.x + d.x) * 0.004, (a.z + d.z) * 0.004);
      let col;
      if (hAvg <= 0.6) {
        /* sea: deep blue, brighter in the sun's path */
        const midX = (a.x + d.x) / 2, midZ = (a.z + d.z) / 2;
        const dxs = midX - cam.x, dzs = midZ - cam.z;
        const ang = Math.abs(Math.atan2(dxs, -dzs) - Math.atan2(SUN_DIR.x, -SUN_DIR.z));
        const glint = Math.pow(Math.max(0, Math.cos(ang)), 6) * clamp(1 - Math.hypot(dxs, dzs) / 1600, 0.15, 1);
        const base = 26 + glint * 130;
        col = 'rgb(' + Math.round(base * 0.55) + ',' + Math.round(70 + glint * 110) + ',' + Math.round(120 + glint * 110) + ')';
      } else {
        col = shade(groundColor(hAvg, slope, (a.x + d.x) / 2, (a.z + d.z) / 2),
          (1 - clamp(slope * 0.4, 0, 0.3)) * jitter);
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRunwayMarkings() {
  for (const rw of [RUNWAY_START, RUNWAY_END]) {
    const y = rw.h + 0.4;
    /* asphalt in short segments, so parts behind the camera are
       skipped individually instead of dropping the whole strip */
    ctx.fillStyle = '#33383f';
    for (let z = rw.z - rw.len / 2; z < rw.z + rw.len / 2; z += 30) {
      const z2 = Math.min(z + 30, rw.z + rw.len / 2);
      const c1 = project(rw.x - rw.wid / 2, y, z), c2 = project(rw.x + rw.wid / 2, y, z);
      const c3 = project(rw.x + rw.wid / 2, y, z2), c4 = project(rw.x - rw.wid / 2, y, z2);
      if (!c1 || !c2 || !c3 || !c4) continue;
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
      ctx.closePath(); ctx.fill();
    }
    /* centreline dashes */
    ctx.fillStyle = '#f5f0dc';
    for (let k = -4; k <= 4; k++) {
      const zc = rw.z + k * 30;
      const d1 = project(rw.x - 1.2, y + 0.05, zc - 9), d2 = project(rw.x + 1.2, y + 0.05, zc - 9);
      const d3 = project(rw.x + 1.2, y + 0.05, zc + 9), d4 = project(rw.x - 1.2, y + 0.05, zc + 9);
      if (!d1 || !d2 || !d3 || !d4) continue;
      if (d1.d < 10 || d2.d < 10 || d3.d < 10 || d4.d < 10) continue;
      ctx.beginPath();
      ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.lineTo(d4.x, d4.y);
      ctx.closePath(); ctx.fill();
    }
    /* threshold bars at both ends */
    for (const ze of [rw.z - rw.len / 2 + 12, rw.z + rw.len / 2 - 12]) {
      for (let s = -1; s <= 1; s++) {
        const t1 = project(rw.x + s * 7 - 2.5, y + 0.05, ze - 4), t2 = project(rw.x + s * 7 + 2.5, y + 0.05, ze - 4);
        const t3 = project(rw.x + s * 7 + 2.5, y + 0.05, ze + 4), t4 = project(rw.x + s * 7 - 2.5, y + 0.05, ze + 4);
        if (!t1 || !t2 || !t3 || !t4) continue;
        if (t1.d < 10 || t2.d < 10 || t3.d < 10 || t4.d < 10) continue;
        ctx.beginPath();
        ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}

/* ---------------- rendering: objects ---------------- */
function drawRings() {
  for (let i = 0; i < RINGS.length; i++) {
    const r = RINGS[i];
    if (r.passed) continue;
    const next = i === G.rings;
    const pulse = next ? 0.75 + 0.25 * Math.sin(G.t * 5) : 0.55;
    /* beacon column on the next ring: thin, and it fades out as the
       plane closes in — an uncapped width turns it into a solid brown
       wall across the sky when the ring is near */
    if (next) {
      const b1 = project(r.x, r.y, r.z), b2 = project(r.x, r.y + 260, r.z);
      if (b1 && b2) {
        const dist = Math.hypot(r.x - cam.x, r.y - cam.y, r.z - cam.z);
        const fade = clamp((dist - 90) / 180, 0, 1);
        if (fade > 0) {
          const grad = ctx.createLinearGradient(b1.x, b1.y, b2.x, b2.y);
          grad.addColorStop(0, 'rgba(255,170,60,' + (0.16 * fade) + ')');
          grad.addColorStop(1, 'rgba(255,170,60,0)');
          ctx.strokeStyle = grad; ctx.lineWidth = Math.min(12 * b1.s, 9);
          ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
        }
      }
    }
    /* ring circle: build an in-plane basis */
    let ux = 0, uy = 1, uz = 0;
    const dot = r.ny;
    ux = -r.nz * dot; uy = 1 - dot * dot; uz = r.nx * dot;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = r.nz, vy = 0, vz = -r.nx;
    const vl = Math.hypot(vx, vy, vz) || 1;
    const N = 26, ptsArr = [];
    for (let k = 0; k <= N; k++) {
      const a = k / N * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      ptsArr.push(project(
        r.x + (ux * ca + vx / vl * sa) * RING_R,
        r.y + (uy * ca) * RING_R,
        r.z + (uz * ca + vz / vl * sa) * RING_R));
    }
    if (ptsArr.some(q => q)) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,140,40,' + (0.35 * pulse) + ')';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ptsArr.forEach((q, k) => { if (q) { if (k === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); } });
      ctx.stroke();
      ctx.strokeStyle = next ? '#ffd27a' : '#ffb347';
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      /* chevrons on the ring */
      const c0 = ptsArr[0], c1 = ptsArr[6], c2 = ptsArr[13];
      ctx.fillStyle = '#fff3c4';
      for (const cc of [c0, c1, c2]) {
        if (cc) { ctx.beginPath(); ctx.arc(cc.x, cc.y, 4, 0, TAU); ctx.fill(); }
      }
    }
  }
}

function drawBillboards() {
  const p = G.plane;
  const items = [];
  for (const pl of PALMS) {
    const dx = pl.x - p.x, dz = pl.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 900 * 900) items.push({ kind: 'palm', x: pl.x, y: pl.h, z: pl.z, d: Math.sqrt(d2), s: pl.s, ph: pl.ph });
  }
  for (const hs of HOUSES) {
    const dx = hs.x - p.x, dz = hs.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 800 * 800) items.push({ kind: 'house', x: hs.x, y: hs.h, z: hs.z, d: Math.sqrt(d2), s: hs.s, ph: hs.rot });
  }
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    const pr = project(it.x, it.y, it.z);
    if (!pr || pr.d < 15 || pr.x < -30 || pr.x > W + 30 || pr.y < -30 || pr.y > H + 30) continue;
    const sc = Math.min(pr.s * it.s, 3); /* cap: a palm beside the camera must not fill the frame */
    if (it.kind === 'palm') {
      const hgt = 16 * sc;
      ctx.strokeStyle = '#5a4028'; ctx.lineWidth = Math.max(1, 2.4 * sc);
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + Math.sin(it.ph) * 3 * sc, pr.y - hgt); ctx.stroke();
      ctx.strokeStyle = '#2f8f3a'; ctx.lineWidth = Math.max(1, 2 * sc);
      for (let k = 0; k < 5; k++) {
        const a = it.ph + k * 1.25;
        ctx.beginPath();
        ctx.moveTo(pr.x + Math.sin(it.ph) * 3 * sc, pr.y - hgt);
        ctx.quadraticCurveTo(
          pr.x + Math.cos(a) * 9 * sc, pr.y - hgt - 4 * sc,
          pr.x + Math.cos(a) * 13 * sc, pr.y - hgt + 5 * sc);
        ctx.stroke();
      }
    } else {
      const wdt = 11 * sc, hgt = 8 * sc;
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(pr.x - wdt / 2, pr.y - hgt, wdt, hgt);
      ctx.fillStyle = '#b3402e';
      ctx.beginPath();
      ctx.moveTo(pr.x - wdt / 2 - 1, pr.y - hgt);
      ctx.lineTo(pr.x, pr.y - hgt - 5 * sc);
      ctx.lineTo(pr.x + wdt / 2 + 1, pr.y - hgt);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawCloudsAndSmoke() {
  const p = G.plane;
  for (const c of CLOUDS) {
    const cx = c.x + G.t * c.drift;
    const pr = project(cx, c.y, c.z);
    if (!pr) continue;
    const rx = c.rx * pr.s, ry = c.ry * pr.s;
    if (rx < 2 || pr.x < -rx - 60 || pr.x > W + rx + 60 || pr.y < -ry - 60 || pr.y > H + ry + 60) continue;
    ctx.fillStyle = 'rgba(255,235,215,' + c.a + ')';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, rx, ry, 0, 0, TAU);
    ctx.ellipse(pr.x - rx * 0.55, pr.y + ry * 0.3, rx * 0.62, ry * 0.72, 0, 0, TAU);
    ctx.ellipse(pr.x + rx * 0.55, pr.y + ry * 0.25, rx * 0.66, ry * 0.78, 0, 0, TAU);
    ctx.ellipse(pr.x - rx * 0.2, pr.y - ry * 0.45, rx * 0.55, ry * 0.6, 0, 0, TAU);
    ctx.ellipse(pr.x + rx * 0.25, pr.y - ry * 0.4, rx * 0.5, ry * 0.55, 0, 0, TAU);
    ctx.fill();
  }
  /* volcano smoke, rising and drifting */
  const peakY = terrainHeight(VOLCANO.x, VOLCANO.z);
  for (const s of SMOKE) {
    const age = (G.t * 0.05 + s.t) % 1;
    const y = peakY + 10 + age * 260;
    const x = VOLCANO.x + s.x + age * 90, z = VOLCANO.z + s.z + age * 40;
    const pr = project(x, y, z);
    if (!pr) continue;
    const r = (s.r + age * 55) * pr.s;
    if (r < 1) continue;
    ctx.fillStyle = 'rgba(120,110,105,' + (0.34 * (1 - age)) + ')';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, TAU); ctx.fill();
  }
  /* birds */
  ctx.strokeStyle = 'rgba(40,30,25,0.8)';
  ctx.lineWidth = 1.6;
  for (const b of BIRDS) {
    const bx = b.x + Math.sin(G.t * 0.1 + b.ph) * 60;
    const pr = project(bx, b.y + Math.sin(G.t * 0.8 + b.ph) * 4, b.z);
    if (!pr) continue;
    const w = 9 * pr.s;
    if (w < 1.5) continue;
    const flap = Math.sin(G.t * 6 + b.ph) * w * 0.4;
    ctx.beginPath();
    ctx.moveTo(pr.x - w, pr.y - flap);
    ctx.quadraticCurveTo(pr.x, pr.y + w * 0.3, pr.x + w, pr.y - flap);
    ctx.stroke();
  }
  /* ring-pass particles */
  for (const pt of particles) {
    const pr = project(pt.x, pt.y, pt.z);
    if (!pr) continue;
    ctx.fillStyle = pt.col;
    ctx.globalAlpha = clamp(pt.life, 0, 1);
    ctx.beginPath(); ctx.arc(pr.x, pr.y, Math.max(1.5, 4 * pr.s * pt.life), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------------- rendering: the plane (chase view) ---------------- */
function drawPlane() {
  const p = G.plane;
  const cx = W / 2, cy = H * 0.66;
  const scale = 1.05;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(p.pitch) * -30);
  ctx.rotate(p.roll * 0.85);
  ctx.scale(scale, scale);
  /* shadow of banking */
  const bank = Math.abs(p.roll);
  ctx.globalAlpha = 0.92;
  /* tail */
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-14, -58); ctx.lineTo(14, -58); ctx.lineTo(10, -84); ctx.lineTo(-10, -84);
  ctx.closePath(); ctx.fill();
  /* fuselage */
  const fg = ctx.createLinearGradient(0, -90, 0, 60);
  fg.addColorStop(0, '#fff6e0'); fg.addColorStop(0.55, '#f3e2b8'); fg.addColorStop(1, '#d9b06a');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -96);
  ctx.bezierCurveTo(13, -70, 17, -20, 15, 30);
  ctx.bezierCurveTo(14, 52, 8, 62, 0, 64);
  ctx.bezierCurveTo(-8, 62, -14, 52, -15, 30);
  ctx.bezierCurveTo(-17, -20, -13, -70, 0, -96);
  ctx.closePath(); ctx.fill();
  /* orange cheatline */
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-16, -30); ctx.quadraticCurveTo(0, -24, 16, -30);
  ctx.lineTo(15, -18); ctx.quadraticCurveTo(0, -12, -15, -18);
  ctx.closePath(); ctx.fill();
  /* high wing */
  ctx.fillStyle = '#f7ecd2';
  ctx.beginPath();
  ctx.moveTo(-150, -52); ctx.lineTo(-150, -34); ctx.lineTo(-16, -26); ctx.lineTo(16, -26);
  ctx.lineTo(150, -34); ctx.lineTo(150, -52); ctx.lineTo(16, -44); ctx.lineTo(-16, -44);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8542f';
  ctx.fillRect(-150, -48, 34, 6); ctx.fillRect(116, -48, 34, 6);
  /* wing struts */
  ctx.strokeStyle = '#8a6b3a'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-12, 6); ctx.lineTo(-70, -34); ctx.moveTo(12, 6); ctx.lineTo(70, -34);
  ctx.stroke();
  /* windows */
  ctx.fillStyle = '#274b63';
  ctx.beginPath(); ctx.ellipse(0, -58, 9, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-8, -40, 4.5, 6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -40, 4.5, 6, 0, 0, TAU); ctx.fill();
  /* tail fin + registration */
  ctx.fillStyle = '#e8542f';
  ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(10, -66); ctx.lineTo(-10, -66); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff6e0';
  ctx.font = 'bold 9px Verdana'; ctx.textAlign = 'center';
  ctx.fillText('PK-MRP', 0, -74);
  /* spinning prop at the nose (front = up on screen) */
  const propA = p.prop % TAU;
  ctx.save();
  ctx.translate(0, -98);
  ctx.rotate(propA * 0.3);
  ctx.fillStyle = 'rgba(60,50,40,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, 5, 52, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 52, 5, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c23a1e';
  ctx.beginPath(); ctx.arc(0, -98, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(0, -98, 2.5, 0, TAU); ctx.fill();
  /* nav lights */
  const blink = (G.t % 1) < 0.12;
  ctx.fillStyle = '#ff2e2e'; ctx.beginPath(); ctx.arc(-150, -43, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2eff5e'; ctx.beginPath(); ctx.arc(150, -43, 4, 0, TAU); ctx.fill();
  if (blink) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 64, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------------- rendering: cockpit panel ---------------- */
function drawDial(cx, cy, r, label, frac, ticks, warn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#10141c';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a4a63'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = warn ? '#ff5a3c' : '#cfe0ff';
  ctx.fillStyle = '#cfe0ff';
  ctx.font = 'bold 10px Verdana'; ctx.textAlign = 'center';
  for (let i = 0; i <= ticks; i++) {
    const a = -Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5;
    const x1 = Math.cos(a) * (r - 4), y1 = Math.sin(a) * (r - 4);
    const x2 = Math.cos(a) * (r - 11), y2 = Math.sin(a) * (r - 11);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  const na = -Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * (r - 8), Math.sin(na) * (r - 8)); ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
  /* label ABOVE the dial: inside the dial's bottom the text sat on
     the rim and its lower half was cut off at every resolution */
  ctx.fillStyle = '#cfe0ff';
  ctx.font = 'bold 10px Verdana';
  ctx.fillText(label, 0, -r - 12);
  ctx.restore();
}
function drawAttitude(cx, cy, r) {
  const p = G.plane;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.rotate(-p.roll);
  const off = clamp(p.pitch / (30 * DEG), -1, 1) * r * 0.7;
  ctx.fillStyle = '#6fb7e8'; ctx.fillRect(-r, -r + off, r * 2, r - off);
  ctx.fillStyle = '#8a6b46'; ctx.fillRect(-r, off, r * 2, r - off + r);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, off); ctx.lineTo(r, off); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#3a4a63'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 4, cy); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx + 16, cy);
  ctx.lineTo(cx + 16, cy + 3); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 16, cy + 3);
  ctx.closePath(); ctx.fill();
}
function drawCockpit() {
  const p = G.plane;
  /* windshield pillars */
  ctx.fillStyle = 'rgba(16,20,28,0.92)';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W * 0.07, 0); ctx.lineTo(W * 0.16, H * 0.62); ctx.lineTo(0, H * 0.66);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W * 0.93, 0); ctx.lineTo(W * 0.84, H * 0.62); ctx.lineTo(W, H * 0.66);
  ctx.closePath(); ctx.fill();
  /* dashboard */
  const pg = ctx.createLinearGradient(0, H * 0.66, 0, H);
  pg.addColorStop(0, '#1c2230'); pg.addColorStop(1, '#0d1017');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.72);
  ctx.quadraticCurveTo(W / 2, H * 0.62, W, H * 0.72);
  ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2c3648'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.quadraticCurveTo(W / 2, H * 0.62, W, H * 0.72); ctx.stroke();
  const y0 = H * 0.79;
  drawAttitude(W * 0.5, y0 + 8, 46);
  drawDial(W * 0.5 - 150, y0 + 8, 40, 'AIRSPEED', p.speed / 80, 8, p.speed < STALL && !p.onGround);
  drawDial(W * 0.5 + 150, y0 + 8, 40, 'ALTITUDE', (p.y % 1000) / 1000, 10, false);
  drawDial(W * 0.5 - 268, y0 + 8, 34, 'FUEL', p.fuel / 100, 4, p.fuel < 20);
  drawDial(W * 0.5 + 268, y0 + 8, 34, 'THROTTLE', p.throttle, 4, false);
  /* digital readouts under the dials */
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 15px Verdana'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(p.speed * 3.6) + ' km/h', W * 0.5 - 150, y0 + 66);
  ctx.fillText(Math.round(p.y) + ' m', W * 0.5 + 150, y0 + 66);
  ctx.font = '11px Verdana'; ctx.fillStyle = '#8fa3c8';
  ctx.fillText('MERAPI DAWN RUN · PK-MRP', W * 0.5, y0 + 88);
  /* warning lights */
  if (G.stallWarn) {
    ctx.fillStyle = (G.t % 0.5 < 0.25) ? '#ff3b30' : '#7a1a12';
    ctx.beginPath(); ctx.arc(W * 0.5 - 210, y0 - 34, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb3ad'; ctx.font = 'bold 11px Verdana'; ctx.textAlign = 'left';
    ctx.fillText('STALL', W * 0.5 - 198, y0 - 30);
  }
  if (p.fuel < 20) {
    ctx.fillStyle = (G.t % 0.5 < 0.25) ? '#ffb347' : '#7a5a12';
    ctx.beginPath(); ctx.arc(W * 0.5 + 210, y0 - 34, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 11px Verdana'; ctx.textAlign = 'right';
    ctx.fillText('LOW FUEL', W * 0.5 + 198, y0 - 30);
  }
}

/* ---------------- rendering: HUD ---------------- */
function headingDeg() { return ((G.plane.heading / DEG) % 360 + 360) % 360; }
function drawHUD() {
  const p = G.plane;
  ctx.textAlign = 'left';
  /* top-left: speed */
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(14, 12, 210, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(14, 12, 210, 64);
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 30px Verdana';
  ctx.fillText(Math.round(p.speed * 3.6), 26, 48);
  ctx.font = '12px Verdana'; ctx.fillStyle = '#9fb4d8';
  ctx.fillText('km/h  SPEED', 96, 46);
  ctx.fillText('V/S ' + (p.vs >= 0 ? '+' : '') + p.vs.toFixed(1) + ' m/s', 26, 68);
  /* top-right: altitude */
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(W - 224, 12, 210, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(W - 224, 12, 210, 64);
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 30px Verdana'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(p.y), W - 26, 48);
  ctx.font = '12px Verdana'; ctx.fillStyle = '#9fb4d8';
  ctx.fillText('m  ALTITUDE', W - 96, 46);
  ctx.fillText('AGL ' + Math.max(0, Math.round(p.y - terrainHeight(p.x, p.z))) + ' m', W - 26, 68);
  ctx.textAlign = 'left';
  /* top-centre: compass strip */
  const hd = headingDeg();
  const cw = 300, cx0 = W / 2 - cw / 2;
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(cx0, 12, cw, 34);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(cx0, 12, cw, 34);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx0, 12, cw, 34); ctx.clip();
  ctx.font = 'bold 13px Verdana'; ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const h = Math.round((hd + d) / 5) * 5;
    const hh = ((h % 360) + 360) % 360;
    const x = W / 2 + d * 2.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, hh % 45 === 0 ? 26 : 33); ctx.stroke();
    if (hh % 45 === 0) {
      ctx.fillStyle = '#e8f2ff';
      const lbl = hh === 0 ? 'N' : hh === 90 ? 'E' : hh === 180 ? 'S' : hh === 270 ? 'W' : String(hh);
      ctx.fillText(lbl, x, 24);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.moveTo(W / 2 - 6, 12); ctx.lineTo(W / 2 + 6, 12); ctx.lineTo(W / 2, 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 13px Verdana'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(hd) + '°', W / 2, 58);
  /* score + time, right under altitude */
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(W - 224, 84, 210, 46);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(W - 224, 84, 210, 46);
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 20px Verdana';
  ctx.fillText('SCORE ' + G.score, W - 26, 105);
  ctx.fillStyle = G.timeLeft < 60 ? '#ff7a5c' : '#9fb4d8'; ctx.font = '12px Verdana';
  const mm = Math.floor(G.timeLeft / 60), ss = Math.floor(G.timeLeft % 60);
  ctx.fillText('TIME ' + mm + ':' + String(ss).padStart(2, '0') + '   RINGS ' + G.rings + '/8', W - 26, 122);
  ctx.textAlign = 'left';
  /* throttle + fuel bars, left under speed */
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(14, 84, 210, 46);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(14, 84, 210, 46);
  ctx.fillStyle = '#9fb4d8'; ctx.font = '11px Verdana';
  ctx.fillText('THR', 24, 103);
  ctx.fillStyle = '#2c3648'; ctx.fillRect(60, 94, 150, 9);
  ctx.fillStyle = '#ffb347'; ctx.fillRect(60, 94, 150 * p.throttle, 9);
  ctx.fillStyle = '#9fb4d8';
  ctx.fillText('FUEL', 24, 121);
  ctx.fillStyle = '#2c3648'; ctx.fillRect(60, 112, 150, 9);
  ctx.fillStyle = p.fuel < 20 ? '#ff5a3c' : '#5ec96e'; ctx.fillRect(60, 112, 150 * p.fuel / 100, 9);
  /* next-ring pointer */
  const ring = RINGS[G.rings];
  if (ring && G.mode === 'fly') {
    const dx = ring.x - p.x, dy = ring.y - p.y, dz = ring.z - p.z;
    const dist = Math.hypot(dx, dy, dz);
    const rp = project(ring.x, ring.y, ring.z);
    ctx.font = 'bold 15px Verdana'; ctx.textAlign = 'center';
    /* keep the label off the plane sprite when the ring is right ahead */
    const nearPlane = rp && Math.hypot(rp.x - W / 2, rp.y - H * 0.66) < 170;
    if (dist > 70 && rp && rp.x > 30 && rp.x < W - 30 && rp.y > 110 && rp.y < H - 140 && !nearPlane) {
      /* sit the label above the ring's on-screen top edge; at rp.y - 58
         it landed inside the ring circle whenever the ring was close */
      const ringTop = rp.y - RING_R * rp.s - 16;
      const ly = ringTop > 100 ? ringTop : 100;
      const lx = ringTop > 100 ? rp.x : W / 2;
      ctx.fillStyle = '#ffb347';
      ctx.fillText('◈ RING ' + (G.rings + 1) + ' · ' + Math.round(dist) + ' m', lx, ly);
      if (ringTop > 100) {
        ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(rp.x, ly + 8); ctx.lineTo(rp.x, rp.y - RING_R * rp.s); ctx.stroke();
      }
    } else if (dist > 70 && nearPlane) {
      ctx.fillStyle = '#ffb347';
      ctx.fillText('◈ RING ' + (G.rings + 1) + ' · ' + Math.round(dist) + ' m', W / 2, 100);
    } else if (dist > 70) {
      /* off-screen arrow at the screen edge */
      const ang = Math.atan2(dx, -dz) - p.heading;
      const ax = W / 2 + Math.sin(ang) * 260, ay = H * 0.42 - Math.cos(ang) * 120;
      ctx.fillStyle = '#ffb347';
      let lx = clamp(ax, 60, W - 60), ly = clamp(ay, 110, H - 160);
      if (Math.hypot(lx - W / 2, ly - H * 0.66) < 170) ly = 100; /* keep it off the plane */
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillText('RING ' + (G.rings + 1) + ' · ' + Math.round(dist) + ' m', clamp(lx, 90, W - 90), ly + 34);
    }
  }
  /* stall warning */
  if (G.stallWarn) {
    ctx.fillStyle = (G.t % 0.4 < 0.2) ? '#ff3b30' : '#ffb3ad';
    ctx.font = 'bold 22px Verdana'; ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — NOSE DOWN, THROTTLE UP', W / 2, 120);
  }
  /* transient message */
  if (G.msgT > 0) {
    ctx.globalAlpha = clamp(G.msgT, 0, 1);
    ctx.fillStyle = '#fff3c4'; ctx.font = 'bold 20px Verdana'; ctx.textAlign = 'center';
    ctx.fillText(G.msg, W / 2, H - 150);
    ctx.globalAlpha = 1;
  }
  drawMinimap();
}
function drawMinimap() {
  const S = 132, ox = 16, oy = H - S - 16, sc = S / 3800;
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  ctx.fillRect(ox, oy, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(ox, oy, S, S);
  const toX = x => ox + (x + 1900) * sc;
  const toY = z => oy + S - (400 - z) * sc;
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(ox + 1, oy + 1, S - 2, S - 2);
  for (const isl of ISLANDS) {
    ctx.fillStyle = '#4f9e44';
    ctx.beginPath(); ctx.ellipse(toX(isl.x), toY(isl.z), isl.r * sc, isl.r * sc, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#6e5b4c'; /* the volcano cone */
  ctx.beginPath(); ctx.ellipse(toX(VOLCANO.x), toY(VOLCANO.z), VOLCANO.r * sc, VOLCANO.r * sc, 0, 0, TAU); ctx.fill();
  /* runways */
  ctx.strokeStyle = '#f5f0dc'; ctx.lineWidth = 2;
  for (const rw of [RUNWAY_START, RUNWAY_END]) {
    ctx.beginPath();
    ctx.moveTo(toX(rw.x), toY(rw.z - rw.len / 2));
    ctx.lineTo(toX(rw.x), toY(rw.z + rw.len / 2));
    ctx.stroke();
  }
  /* rings */
  for (let i = 0; i < RINGS.length; i++) {
    const r = RINGS[i];
    ctx.fillStyle = r.passed ? '#5ec96e' : (i === G.rings ? '#ffb347' : '#cfe0ff');
    ctx.beginPath(); ctx.arc(toX(r.x), toY(r.z), i === G.rings ? 4 : 2.5, 0, TAU); ctx.fill();
  }
  /* plane arrow */
  const p = G.plane;
  ctx.save();
  ctx.translate(toX(p.x), toY(p.z));
  ctx.rotate(p.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#9fb4d8'; ctx.font = '10px Verdana'; ctx.textAlign = 'left';
  ctx.fillText('MAP — N ↑', ox + 4, oy + 12);
}

/* ---------------- overlays ---------------- */
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,210,122,0.6)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}
function drawMenu() {
  panel(36, 64, 520, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 40px Verdana';
  ctx.fillText('MERAPI DAWN RUN', 296, 128);
  ctx.fillStyle = '#e8f2ff'; ctx.font = '15px Verdana';
  ctx.fillText('The dawn mail run across a volcanic archipelago', 296, 158);
  ctx.fillStyle = '#ffb347'; ctx.font = 'bold 14px Verdana';
  ctx.fillText('8 RINGS · 1 VOLCANO · 1 SHORT ISLAND STRIP', 296, 186);
  ctx.fillStyle = '#dfe9f7'; ctx.font = '13.5px Verdana'; ctx.textAlign = 'left';
  const lines = [
    'Take off from Pulau Landas, thread all eight glowing rings,',
    'then land gently on the strip at Pulau Dermaga.',
    'Rings pay 500 each (+ centre bonus) and add 12 seconds.',
    'A smooth, centred landing pays up to 1,800 more.',
    '',
    'CONTROLS',
    '  W / S ........ throttle up / down        F ... flaps',
    '  ↑ / ↓ ........ pitch (climb / dive)      C ... chase / cockpit view',
    '  ← / → ........ bank & turn               P ... pause    M ... sound',
    '  Mouse ...... steer (move) · hold click to add throttle',
    '  R .......... fly again',
  ];
  let y = 212;
  for (const ln of lines) { ctx.fillText(ln, 62, y); y += 21; }
  ctx.textAlign = 'center';
  ctx.fillStyle = (G.t % 1 < 0.6) ? '#ffd27a' : '#fff3c4';
  ctx.font = 'bold 19px Verdana';
  ctx.fillText('— Press ENTER or click to fly —', 296, 452);
  if (G.best > 0) {
    ctx.fillStyle = '#9fb4d8'; ctx.font = '13px Verdana';
    ctx.fillText('Best score: ' + G.best, 296, 478);
  }
  ctx.textAlign = 'left';
}
function drawEnd() {
  const r = G.results || { why: '', score: 0, rings: 0 };
  panel(W / 2 - 300, 150, 600, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = G.mode === 'done' ? '#7be495' : '#ff8a70';
  ctx.font = 'bold 34px Verdana';
  ctx.fillText(G.mode === 'done' ? 'MAIL DELIVERED!' : 'FLIGHT OVER', W / 2, 205);
  ctx.fillStyle = '#e8f2ff'; ctx.font = '16px Verdana';
  ctx.fillText(r.why + (G.landQuality ? ' — ' + G.landQuality : ''), W / 2, 238);
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 30px Verdana';
  ctx.fillText('SCORE  ' + r.score, W / 2, 282);
  ctx.fillStyle = '#dfe9f7'; ctx.font = '15px Verdana'; ctx.textAlign = 'left';
  const rows = [
    ['Rings flown', G.rings + ' / 8  (+' + G.stats.rings + ')'],
    ['Centre bonuses', '+' + G.stats.centerBonus],
    ['Landing', '+' + G.stats.landBonus],
    ['Time bonus', '+' + G.stats.timeBonus],
    ['Fuel bonus', '+' + G.stats.fuelBonus],
    ['Best score', String(G.best)],
  ];
  let y = 312;
  for (const [k, v] of rows) {
    ctx.fillText(k, W / 2 - 260, y);
    ctx.textAlign = 'right'; ctx.fillText(v, W / 2 + 260, y); ctx.textAlign = 'left';
    y += 24;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = (G.t % 1 < 0.6) ? '#ffd27a' : '#fff3c4';
  ctx.font = 'bold 18px Verdana';
  ctx.fillText('Press R to fly again', W / 2, 462);
  ctx.textAlign = 'left';
}
function drawPaused() {
  ctx.fillStyle = 'rgba(8,12,24,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 34px Verdana'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '15px Verdana';
  ctx.fillText('Press P to keep flying', W / 2, H / 2 + 26);
  ctx.textAlign = 'left';
}

/* ---------------- audio (synthesised, no files) ---------------- */
let AC = null, engOsc = null, engGain = null, windSrc = null, windGain = null, windFilter = null;
function initAudio() {
  if (AC || G.muted) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engOsc = AC.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.value = 55;
    const lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engGain = AC.createGain(); engGain.gain.value = 0.0;
    engOsc.connect(lp); lp.connect(engGain); engGain.connect(AC.destination);
    engOsc.start();
    const len = AC.sampleRate * 1.2;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    windSrc = AC.createBufferSource();
    windSrc.buffer = buf; windSrc.loop = true;
    windFilter = AC.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 600; windFilter.Q.value = 0.6;
    windGain = AC.createGain(); windGain.gain.value = 0.0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(AC.destination);
    windSrc.start();
  } catch (e) { AC = null; }
}
function setAudio() {
  if (!AC) return;
  const on = !G.muted;
  engGain.gain.value = on ? 0.05 : 0;
  windGain.gain.value = 0;
  if (on) AC.resume().catch(() => {});
}
function updateAudio() {
  if (!AC || G.muted) return;
  const p = G.plane;
  const flying = G.mode === 'fly';
  engOsc.frequency.value = 50 + p.throttle * 90 + p.speed * 0.35;
  engGain.gain.setTargetAtTime(flying ? 0.035 + p.throttle * 0.05 : 0.0, AC.currentTime, 0.1);
  windGain.gain.setTargetAtTime(flying ? clamp(p.speed / 90, 0, 1) * 0.09 : 0, AC.currentTime, 0.15);
  windFilter.frequency.value = 400 + p.speed * 12;
}
function blip(freq, dur, type, vol) {
  if (!AC || G.muted) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch (e) {}
}
function playChime() { blip(880, 0.35, 'sine', 0.14); setTimeout(() => blip(1318, 0.5, 'sine', 0.12), 110); }
function playCrash() {
  if (!AC || G.muted) return;
  try {
    const len = AC.sampleRate * 0.5;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = AC.createBufferSource(); src.buffer = buf;
    const g = AC.createGain(); g.gain.value = 0.3;
    src.connect(g); g.connect(AC.destination); src.start();
  } catch (e) {}
}

/* ---------------- main loop ---------------- */
let lastT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000;
  let dt = Math.min(0.05, now - (lastT || now));
  lastT = now;
  G.t += dt;
  if (G.msgT > 0) G.msgT -= dt;
  if (G.flash > 0) G.flash -= dt * 1.4;
  if (G.shake > 0) G.shake -= dt * 1.8;
  if (!G.paused) {
    if (G.mode === 'fly') stepFlight(dt);
    for (const pt of particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      pt.life -= dt * 0.9;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  }
  updateAudio();
  render();
}
function render() {
  const p = G.plane;
  const fwdX = Math.sin(p.heading), fwdZ = -Math.cos(p.heading);
  const shX = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 14 : 0;
  const shY = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 14 : 0;
  ctx.save();
  ctx.translate(shX, shY);
  if (G.mode === 'menu') {
    /* parked cinematic: high and back, shifted left so the plane
       clears the menu panel, runway and volcano in frame */
    const cx = p.x - fwdX * 26 - 14, cz = p.z - fwdZ * 26;
    setCamera(cx, p.y + 11, cz, p.x + fwdX * 80, p.y + 1, p.z + fwdZ * 80, 0);
  } else if (G.camMode === 0) {
    /* chase camera */
    const cx = p.x - fwdX * 17, cz = p.z - fwdZ * 17;
    const cy = p.y + 6.5 - Math.sin(p.pitch) * 2;
    setCamera(cx, cy, cz, p.x + fwdX * 46, p.y + 5.5 + Math.sin(p.pitch) * 14, p.z + fwdZ * 46, p.roll * 0.45);
  } else {
    /* cockpit camera */
    const cx = p.x + fwdX * 1.4, cz = p.z + fwdZ * 1.4;
    setCamera(cx, p.y + 1.6, cz, p.x + fwdX * 70, p.y - 0.5 + Math.sin(p.pitch) * 20, p.z + fwdZ * 70, p.roll * 0.7);
  }
  drawSky();
  drawTerrain();
  drawRunwayMarkings();
  drawCloudsAndSmoke();
  drawRings();
  drawBillboards();
  if (G.camMode === 0 && (G.mode === 'fly' || G.mode === 'menu')) drawPlane();
  ctx.restore();
  if (G.camMode === 1) drawCockpit();
  if (G.mode !== 'menu') drawHUD();
  if (G.mode === 'menu') drawMenu();
  if (G.mode === 'crashed' || G.mode === 'done') drawEnd();
  if (G.paused && G.mode === 'fly') drawPaused();
  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(255,80,40,' + clamp(G.flash, 0, 0.7) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  /* vignette */
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- test / staging hook ---------------- */
/* Used only by the local play-test driver to frame screenshots:
   it moves the plane to a real in-game state; every pixel on screen
   is still drawn by this file's own renderer. */
window.MERAPI = {
  state: () => ({
    mode: G.mode, x: G.plane.x, y: G.plane.y, z: G.plane.z,
    heading: G.plane.heading, pitch: G.plane.pitch, roll: G.plane.roll,
    speed: G.plane.speed, throttle: G.plane.throttle, fuel: G.plane.fuel,
    onGround: G.plane.onGround, rings: G.rings, score: G.score,
    timeLeft: G.timeLeft, camMode: G.camMode,
  }),
  errors: [],
  place: (x, y, z, headingDeg, speed, throttle) => {
    const p = G.plane;
    p.x = x; p.y = y; p.z = z;
    p.heading = headingDeg * DEG;
    p.speed = speed; p.throttle = throttle;
    p.onGround = false; p.vs = 0; p.pitch = 0; p.roll = 0;
    const ring = RINGS[G.rings];
    if (ring) {
      p.prevRingD = (p.x - ring.x) * ring.nx + (p.y - ring.y) * ring.ny + (p.z - ring.z) * ring.nz;
    }
    G.mode = 'fly'; G.results = null; G.flash = 0; G.shake = 0;
    G.msg = ''; G.msgT = 0;
    return true;
  },
  setCam: m => { G.camMode = m; },
  setRings: n => {
    for (let i = 0; i < RINGS.length; i++) RINGS[i].passed = i < n;
    G.rings = n;
    const ring = RINGS[G.rings];
    if (ring) {
      const p = G.plane;
      p.prevRingD = (p.x - ring.x) * ring.nx + (p.y - ring.y) * ring.ny + (p.z - ring.z) * ring.nz;
    }
  },
  start: () => startFlight(),
};
window.addEventListener('error', e => { window.MERAPI.errors.push(String(e.message) + ' @' + (e.filename || '') + ':' + (e.lineno || '')); });

requestAnimationFrame(frame);
