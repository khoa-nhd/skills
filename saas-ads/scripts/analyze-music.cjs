#!/usr/bin/env node
// Tempo, beat phase, loudness per second and section edges of a music track.
// Usage: node analyze-music.cjs <track.(mp3|wav)> [--around 16,96] [--json]
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).
const {spawnSync} = require('child_process');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
	console.error('usage: node analyze-music.cjs <track> [--around 16,96] [--json]');
	process.exit(2);
}
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const SR = 22050;
const ff = process.env.FFMPEG || 'ffmpeg';
const dec = spawnSync(ff, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {maxBuffer: 1 << 30});
if (dec.status !== 0) {
	console.error(String(dec.stderr || 'ffmpeg failed'));
	process.exit(1);
}
const pcm = new Int16Array(dec.stdout.buffer, dec.stdout.byteOffset, dec.stdout.length >> 1);
const dur = pcm.length / SR;

// onset envelope: positive change of log energy per hop
const hop = 128;
const n = Math.floor(pcm.length / hop);
const e = new Float64Array(n);
for (let i = 0; i < n; i++) {
	let s = 0;
	for (let j = 0; j < hop; j++) {
		const v = pcm[i * hop + j] / 32768;
		s += v * v;
	}
	e[i] = Math.log(1e-5 + Math.sqrt(s / hop));
}
const on = new Float64Array(n);
for (let i = 4; i < n; i++) on[i] = Math.max(0, e[i] - e[i - 4]);
const fps = SR / hop;
const from = Math.min(dur * 0.15, 10);
const to = dur - 2;

// coarse tempo by autocorrelation, then a fine grid search for period and phase
const lo = Math.floor((fps * 60) / 180);
const hi = Math.floor((fps * 60) / 60);
const st = Math.floor(from * fps);
const en = Math.floor(to * fps);
const ac = [];
for (let l = lo; l <= hi; l++) {
	let s = 0;
	for (let i = st; i < en - l; i++) s += on[i] * on[i + l];
	ac.push([l, s]);
}
ac.sort((a, b) => b[1] - a[1]);
const candidates = ac.slice(0, 6).map(([l]) => +((60 * fps) / l).toFixed(1));
let bpm0 = candidates[0];
while (bpm0 < 80) bpm0 *= 2;
while (bpm0 > 160) bpm0 /= 2;
let best = [-1, 0, 0];
const p0 = 60 / bpm0;
for (let per = p0 * 0.97; per <= p0 * 1.03; per += 0.0002) {
	for (let ph = 0; ph < per; ph += 0.004) {
		let s = 0;
		for (let t = ph; t < to; t += per) {
			if (t < from) continue;
			const i = Math.round(t * fps);
			s += on[i] + 0.5 * ((on[i - 1] || 0) + (on[i + 1] || 0));
		}
		if (s > best[0]) best = [s, per, ph];
	}
}
const period = best[1];
const phase = best[2];

// loudness per second and section edges (jumps of 5 dB or more against the previous two seconds)
const rms = (a, b) => {
	let s = 0;
	let m = 0;
	for (let i = Math.floor(a * SR); i < Math.min(pcm.length, Math.floor(b * SR)); i++) {
		s += (pcm[i] / 32768) ** 2;
		m++;
	}
	return 10 * Math.log10(s / Math.max(1, m) + 1e-9);
};
const loud = [];
for (let s = 0; s < Math.floor(dur); s++) loud.push(+rms(s, s + 1).toFixed(1));
const edges = [];
for (let s = 2; s < loud.length; s++) {
	const prev = (loud[s - 1] + loud[s - 2]) / 2;
	if (Math.abs(loud[s] - prev) >= 5) edges.push({second: s, from: +prev.toFixed(1), to: loud[s]});
}
// snap edges to the nearest beat
const snap = (t) => +(phase + Math.round((t - phase) / period) * period).toFixed(3);
edges.forEach((x) => (x.beat = snap(x.second)));

const around = (opt('--around') || '')
	.split(',')
	.filter(Boolean)
	.map(Number)
	.map((c) => {
		const rows = [];
		for (let t = Math.max(0, c - 1.5); t < Math.min(dur, c + 1.5); t += 0.25) rows.push(`${t.toFixed(2)}:${rms(t, t + 0.25).toFixed(0)}`);
		return {at: c, quarterSeconds: rows.join(' ')};
	});

const result = {file, duration: +dur.toFixed(2), tempoCandidates: candidates, bpm: +(60 / period).toFixed(2), beatPeriod: +period.toFixed(4), firstBeat: +phase.toFixed(3), loudnessPerSecond: loud, sectionEdges: edges, around};
if (args.includes('--json')) {
	console.log(JSON.stringify(result, null, 2));
} else {
	console.log(`duration ${result.duration}s  bpm ${result.bpm} (period ${result.beatPeriod}s, first beat at ${result.firstBeat}s)  candidates ${candidates.join(' ')}`);
	console.log('loudness dB/s: ' + loud.map((v, s) => `${s}:${v.toFixed(0)}`).join(' '));
	console.log('section edges: ' + (edges.map((x) => `${x.beat}s (${x.from}→${x.to})`).join(', ') || 'none found'));
	around.forEach((a) => console.log(`around ${a.at}s: ${a.quarterSeconds}`));
	console.log('Beat k is at firstBeat + k*period. At 30 fps one beat = ' + (30 * period).toFixed(2) + ' frames.');
}
