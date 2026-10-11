import { TRACKS } from "./tracks.js";
import { online, submitRun, topRuns, recordGhost } from "./firebase.js";

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const nameEl = document.getElementById("name");
const boardEl = document.getElementById("board");
const noteEl = document.getElementById("note");
const tracksEl = document.getElementById("tracks");

const LAPS = 3;
const STEP = 0.1; // ghost sample interval (seconds)
const keys = {};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

nameEl.value = store.get("gallop-name") || "";
nameEl.addEventListener("input", () => store.set("gallop-name", nameEl.value.trim()));

let T, P, N, mud, carrots, h, state, count, time, total, idx, lap;
let stamina, msg, msgT, rec, recT, pb, world, ghostMode, doneNote;

// ---------- track building ----------
function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
function smooth(raw, per = 16) {
  const out = [], n = raw.length;
  for (let i = 0; i < n; i++) {
    const p0 = raw[(i - 1 + n) % n], p1 = raw[i], p2 = raw[(i + 1) % n], p3 = raw[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      out.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), y: cr(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  return out;
}
// nearest centerline point, searching only near where we last were
function nearest(x, y, from) {
  let best = Infinity, bi = from;
  for (let k = -25; k <= 25; k++) {
    const i = (from + k + N) % N, p = P[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return [bi, Math.sqrt(best)];
}

function loadTrack(i) {
  T = TRACKS[i];
  P = smooth(T.pts);
  N = P.length;
  const at = (f, o) => {
    const k = Math.floor(f * N) % N, a = P[k], b = P[(k + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: a.x - (dy / l) * o * (T.width / 2), y: a.y + (dx / l) * o * (T.width / 2) };
  };
  mud = T.mud.map(([f, o]) => ({ ...at(f, o), r: 28 }));
  carrots = T.carrots.map(([f, o]) => ({ ...at(f, o), on: true, back: 0 }));
  let saved = null;
  try { saved = JSON.parse(store.get("gallop-pb-" + T.id)); } catch (e) {}
  pb = saved;
  world = null;
  ghostMode = pb ? 1 : 0;
  [...tracksEl.children].forEach((b, j) => b.classList.toggle("on", j === i));
  reset();
  refresh();
}

async function refresh() {
  const id = T.id;
  boardEl.innerHTML = "";
  noteEl.textContent = online ? "Loading..." : "Add your Firebase config to turn on the shared leaderboard.";
  if (!online) return;
  const [runs, rg] = await Promise.all([topRuns(id), recordGhost(id)]);
  if (T.id !== id) return; // switched tracks while loading
  world = rg && rg.ghost ? rg : null;
  if (ghostMode === 0 && world) ghostMode = 2;
  boardEl.innerHTML = "";
  runs.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.name + "  " + r.time.toFixed(2) + "s";
    boardEl.appendChild(li);
  });
  noteEl.textContent = runs.length ? "" : "No times yet. Set the first one.";
}

// ---------- state ----------
function reset() {
  const a = P[0], b = P[1];
  h = { x: a.x, y: a.y, a: Math.atan2(b.y - a.y, b.x - a.x), v: 0 };
  state = "count"; count = 3.2; time = 0; total = 0; idx = 0; lap = 1;
  stamina = 60; msg = ""; msgT = 0; rec = []; recT = 0; doneNote = "";
  carrots.forEach((c) => (c.on = true));
}
const flash = (m) => { msg = m; msgT = 1.6; };

function activeGhost() {
  return ghostMode === 1 ? pb : ghostMode === 2 ? world : null;
}
function cycleGhost() {
  for (let k = 1; k <= 3; k++) {
    const m = (ghostMode + k) % 3;
    if (m === 0 || (m === 1 && pb) || (m === 2 && world)) { ghostMode = m; return; }
  }
}
function ghostPos(g, t) {
  const arr = g.ghost, k = t / STEP, i = Math.floor(k), f = k - i;
  if ((i + 1) * 3 + 2 >= arr.length) return null;
  const a = arr.slice(i * 3, i * 3 + 3), b = arr.slice(i * 3 + 3, i * 3 + 6);
  let da = b[2] - a[2];
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, a: a[2] + da * f };
}

// ---------- input ----------
const block = ["arrowup", "arrowdown", "arrowleft", "arrowright", " "];
addEventListener("keydown", (e) => {
  if (e.target === nameEl) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (block.includes(k)) e.preventDefault();
  if (k === "r") reset();
  if (k === "g") cycleGhost();
});
addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// ---------- update ----------
function update(dt) {
  if (msgT > 0) msgT -= dt;
  carrots.forEach((c) => { if (!c.on) { c.back -= dt; if (c.back <= 0) c.on = true; } });

  if (state === "count") {
    count -= dt;
    if (count <= 0) { state = "race"; rec.push(+h.x.toFixed(1), +h.y.toFixed(1), +h.a.toFixed(2)); }
    return;
  }
  if (state !== "race") return;
  time += dt;

  const sprint = keys[" "] && stamina > 0; // sprint also pushes forward, so one thumb can do both
  const up = keys["arrowup"] || keys["w"] || sprint, dn = keys["arrowdown"] || keys["s"];
  const lf = keys["arrowleft"] || keys["a"], rt = keys["arrowright"] || keys["d"];
  let max = 230, acc = 170;
  if (sprint) { max = 360; acc = 320; stamina = Math.max(0, stamina - 40 * dt); }

  const [ni, dist] = nearest(h.x, h.y, idx);
  let di = ni - idx;
  if (di > N / 2) di -= N;
  if (di < -N / 2) di += N;
  total += di; idx = ni;
  if (dist > T.width / 2) max = 80;
  if (mud.some((m) => Math.hypot(h.x - m.x, h.y - m.y) < m.r)) max = Math.min(max, 70);

  if (up) h.v += acc * dt; else if (dn) h.v -= 200 * dt; else h.v -= Math.sign(h.v) * 90 * dt;
  if (h.v > max) h.v -= 300 * dt;
  h.v = Math.max(-60, Math.min(h.v, 400));
  const turn = 2.7 * Math.min(1, Math.abs(h.v) / 90) * Math.sign(h.v || 1);
  if (lf) h.a -= turn * dt;
  if (rt) h.a += turn * dt;
  h.x = Math.max(10, Math.min(790, h.x + Math.cos(h.a) * h.v * dt));
  h.y = Math.max(10, Math.min(590, h.y + Math.sin(h.a) * h.v * dt));

  carrots.forEach((c) => {
    if (c.on && Math.hypot(h.x - c.x, h.y - c.y) < 22) { c.on = false; c.back = 6; stamina = Math.min(100, stamina + 40); }
  });

  recT += dt;
  while (recT >= STEP) { recT -= STEP; rec.push(+h.x.toFixed(1), +h.y.toFixed(1), +h.a.toFixed(2)); }

  const nl = Math.min(LAPS, Math.floor(total / N) + 1);
  if (nl > lap) { lap = nl; flash("Lap " + lap); }
  if (total >= N * LAPS) finish();
}

async function finish() {
  state = "done";
  const finalTime = time;
  if (!pb || finalTime < pb.time) {
    pb = { time: finalTime, ghost: rec };
    store.set("gallop-pb-" + T.id, JSON.stringify(pb));
    doneNote = "New personal best";
    if (ghostMode === 0) ghostMode = 1;
  } else {
    doneNote = "Your best: " + pb.time.toFixed(2) + "s";
  }
  const name = nameEl.value.trim().slice(0, 12);
  if (online && name) {
    await submitRun(T.id, name, finalTime, rec);
    refresh();
  } else if (online) {
    doneNote += " (add a name to post it)";
  }
}

// ---------- drawing ----------
function strokeTrack(w, c) {
  ctx.beginPath();
  P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = "round";
  ctx.stroke();
}
function horse(x, y, a, body, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(2, 4, 20, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(21, 0, 9, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a1a0d"; ctx.fillRect(-26, -2, 8, 4);
  ctx.fillStyle = "#d94a3a"; ctx.beginPath(); ctx.arc(-2, 0, 6, 0, 7); ctx.fill();
  ctx.restore();
}
const fmt = (t) => (t == null ? "--" : t.toFixed(2) + "s");

function draw() {
  ctx.fillStyle = T.grass; ctx.fillRect(0, 0, 800, 600);
  strokeTrack(T.width + 12, "#f1e3c4");
  strokeTrack(T.width, T.dirt);

  // start line
  const a = P[0], b = P[1], ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
  for (let k = -T.width / 2, n = 0; k < T.width / 2; k += 10, n++) {
    ctx.fillStyle = n % 2 ? "#222" : "#fff"; ctx.fillRect(-5, k, 5, 10);
    ctx.fillStyle = n % 2 ? "#fff" : "#222"; ctx.fillRect(0, k, 5, 10);
  }
  ctx.restore();

  ctx.fillStyle = "#6b4a2b";
  mud.forEach((m) => { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill(); });
  carrots.forEach((c) => {
    if (!c.on) return;
    ctx.fillStyle = "#e8892b"; ctx.beginPath(); ctx.moveTo(c.x - 7, c.y - 7); ctx.lineTo(c.x + 7, c.y - 7); ctx.lineTo(c.x, c.y + 11); ctx.fill();
    ctx.fillStyle = "#3e7d2a"; ctx.fillRect(c.x - 4, c.y - 12, 8, 5);
  });

  const g = activeGhost();
  if (g && state === "race") {
    const gp = ghostPos(g, time);
    if (gp) horse(gp.x, gp.y, gp.a, "#dfe6ff", 0.45);
  }
  horse(h.x, h.y, h.a, "#8a4b24", 1);

  // HUD
  ctx.fillStyle = "rgba(31,50,28,.82)"; ctx.fillRect(10, 10, 210, 106);
  ctx.fillStyle = "#fff7e6"; ctx.font = "16px Georgia"; ctx.textAlign = "left";
  ctx.fillText(T.name, 20, 30);
  ctx.fillText("Lap " + Math.min(lap, LAPS) + " / " + LAPS + "   " + fmt(time), 20, 50);
  ctx.fillText("Best " + fmt(pb && pb.time), 20, 70);
  const gl = ghostMode === 1 ? "Mine" : ghostMode === 2 ? "Record" : "Off";
  ctx.fillText("Ghost: " + gl, 20, 90);
  ctx.fillStyle = "#333"; ctx.fillRect(20, 99, 180, 8);
  ctx.fillStyle = "#e8892b"; ctx.fillRect(20, 99, 180 * (stamina / 100), 8);

  ctx.textAlign = "center"; ctx.fillStyle = "#fff7e6";
  if (state === "count") { ctx.font = "bold 90px Georgia"; ctx.fillText(count > 0.2 ? Math.ceil(count - 0.2) : "Go", 400, 330); }
  if (msgT > 0 && state === "race") { ctx.font = "italic 34px Georgia"; ctx.fillText(msg, 400, 70); }
  if (state === "done") {
    ctx.fillStyle = "rgba(31,50,28,.88)"; ctx.fillRect(200, 210, 400, 180);
    ctx.fillStyle = "#fff7e6"; ctx.font = "italic 34px Georgia"; ctx.fillText("Finished in " + fmt(time), 400, 265);
    ctx.font = "20px Georgia"; ctx.fillText(doneNote, 400, 308); ctx.fillText("Press R or tap to ride again", 400, 350);
  }
}

// ---------- boot ----------
TRACKS.forEach((t, i) => {
  const btn = document.createElement("button");
  btn.textContent = t.name;
  btn.addEventListener("click", () => { loadTrack(i); btn.blur(); });
  tracksEl.appendChild(btn);
});

// ---------- touch + buttons ----------
document.querySelectorAll("#pad [data-key]").forEach((b) => {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys[k] = true; b.classList.add("down");
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  const off = () => { keys[k] = false; b.classList.remove("down"); };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => b.addEventListener(t, off));
});
document.getElementById("pad").addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true, passive: true });
cv.addEventListener("pointerdown", () => { if (state === "done") reset(); }); // tap the result screen to ride again
["btnRestart", "btnGhost"].forEach((id) => {
  const b = document.getElementById(id);
  b.addEventListener("click", () => { (id === "btnRestart" ? reset : cycleGhost)(); b.blur(); });
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt); draw();
  requestAnimationFrame(loop);
}
loadTrack(0);
requestAnimationFrame(loop);
