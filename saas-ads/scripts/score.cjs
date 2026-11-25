#!/usr/bin/env node
// Builds the ad's soundtrack: the licensed track spliced onto the video timeline, plus synthesized UI sound
// design from a cue list, mixed with delay/reverb, ducked under big hits, soft-clipped and normalized.
// Usage: node score.cjs score.json
// score.json:
// {
//   "fps": 30, "length": 56, "out": "public/audio/score.wav",
//   "track": {"file": "public/music/track.mp3", "gain": 0.9,
//             "segments": [[0, 36, 12.132], [36, 62, 78.132]],   // [videoStart s, videoEnd s, trackStart s]
//             "lift": {"until": 3.6, "gain": 2.2}},                // optional: raise a very quiet intro
//   "fxGain": 0.55,
//   "cues": [
//     {"fx": "type", "at": 2, "n": 17, "cpf": 1.5},                // at = video frame
//     {"fx": "riser", "at": 88, "to": 120},
//     {"fx": "hit", "at": 120, "duck": 0.25},
//     {"fx": "whoosh", "at": 96, "d": 0.85, "f0": 200, "f1": 5200, "p0": 0, "p1": 0, "g": 0.38, "peak": 0.9},
//     {"fx": "tick", "at": 450}, {"fx": "blip", "at": 452, "m": 84}, {"fx": "ding", "at": 1086, "m": 88},
//     {"fx": "bell", "at": 1082, "m": 84}, {"fx": "thud", "at": 420}, {"fx": "paper", "at": 452},
//     {"fx": "shimmer", "at": 122}, {"fx": "metal", "at": 726}, {"fx": "flap", "at": 696}, {"fx": "servo", "at": 1350, "d": 4}
//   ]
// }
// Needs ffmpeg on PATH (or FFMPEG=...) to decode the track.
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const FPS = spec.fps || 30;
const SR = 48000;
const LEN = spec.length;
const N = Math.round(SR * LEN);
const TAIL = SR * 2;
const bus = () => ({L: new Float32Array(N + TAIL), R: new Float32Array(N + TAIL)});
const sfx = bus();
const send = bus();
const ducks = [];
let seed = 90210;
const rnd = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 1073741823.5 - 1;
};
const uni = () => (rnd() + 1) / 2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const fr = (f) => f / FPS;

const voice = (target, t0, dur, fn, pan = 0, wet = 0) => {
	const start = Math.max(0, Math.floor(t0 * SR));
	const n = Math.floor(dur * SR);
	const panFn = typeof pan === 'function' ? pan : () => pan;
	for (let i = 0; i < n && start + i < N + TAIL; i++) {
		const v = fn(i / SR, i / n);
		const a = ((panFn(i / n) + 1) * Math.PI) / 4;
		const l = v * Math.cos(a) * Math.SQRT2;
		const r = v * Math.sin(a) * Math.SQRT2;
		target.L[start + i] += l;
		target.R[start + i] += r;
		if (wet) {
			send.L[start + i] += l * wet;
			send.R[start + i] += r * wet;
		}
	}
};
const svf = () => {
	let low = 0;
	let band = 0;
	return (x, fc, q = 0.8) => {
		const f = Math.min(1.1, 2 * Math.sin((Math.PI * Math.min(fc, SR / 3)) / SR));
		low += f * band;
		const high = x - low - q * band;
		band += f * high;
		return {low, band, high};
	};
};
const saw = (ph) => 2 * (ph % 1) - 1;

// ---------- sound design ----------
const FX = {
	whoosh: ({at, d = 0.5, f0 = 300, f1 = 3000, p0 = -0.5, p1 = 0.5, q = 0.7, g = 0.3, shape = 2, peak = 0.62, wet = 0.16}) => {
		const a = svf();
		const b = svf();
		voice(sfx, at, d, (t, p) => {
			const fc = f0 * (f1 / f0) ** Math.min(1, p / peak);
			const env = p < peak ? (p / peak) ** shape : (1 - (p - peak) / (1 - peak)) ** 1.7;
			return (a(rnd(), fc, q).band + 0.5 * b(rnd(), fc * 1.8, 0.45).band) * env * g;
		}, (p) => p0 + (p1 - p0) * p, wet);
	},
	riser: ({at, to, g = 0.36, base = 120}) => {
		const d = to - at;
		const f = svf();
		let ph = 0;
		let ph2 = 0;
		voice(sfx, at, d + 0.03, (t, p) => {
			ph += (base * 2 ** (p * 3.4)) / SR;
			ph2 += (base * 1.5 * 2 ** (p * 3.4)) / SR;
			const trem = 0.72 + 0.28 * Math.sin(2 * Math.PI * (3 + p * p * 26) * t);
			return (f(rnd(), 380 * 2 ** (p * 4.3), 0.5).band * 0.8 + (saw(ph) + saw(ph2)) * 0.11) * p ** 2.3 * trem * g * Math.min(1, (d + 0.03 - t) / 0.012);
		}, (p) => Math.sin(p * 26) * 0.3, 0.2);
	},
	hit: ({at, g = 0.9, low = 34, duck = 0.3}) => {
		let ph = 0;
		const f = svf();
		const f2 = svf();
		voice(sfx, at, 2.1, (t) => {
			ph += (low + 92 * Math.exp(-t / 0.05)) / SR;
			const sub = Math.tanh(Math.sin(2 * Math.PI * ph) * 1.8) * Math.exp(-t / 0.5);
			return (sub * 0.72 + f(rnd(), 1900, 0.7).band * Math.exp(-t / 0.03) * 0.7 + f2(rnd(), 5200, 0.8).band * Math.exp(-t / 0.38) * 0.24) * g;
		}, 0, 0.3);
		ducks.push([at, duck]);
	},
	thud: ({at, g = 0.45, hz = 70}) => {
		let ph = 0;
		voice(sfx, at, 0.42, (t) => {
			ph += (hz + 74 * Math.exp(-t / 0.03)) / SR;
			return (Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.13) + rnd() * 0.22 * Math.exp(-t / 0.006)) * g;
		});
	},
	tick: ({at, g = 0.32, hz = 2700, pan = 0}) => voice(sfx, at, 0.03, (t) => (Math.sin(2 * Math.PI * hz * t) + rnd() * 0.5) * Math.exp(-t / 0.0035) * g, pan),
	blip: ({at, m = 84, g = 0.18, pan = 0}) => {
		let ph = 0;
		voice(sfx, at, 0.2, (t) => {
			ph += (mtof(m) * (1 + 0.25 * Math.exp(-t / 0.012))) / SR;
			return Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.045) * Math.min(1, t / 0.001) * g;
		}, pan, 0.28);
	},
	bell: ({at, m = 88, g = 0.4, pan = 0, wet = 0.55}) => {
		const hz = mtof(m);
		voice(sfx, at, 1.5, (t) => Math.sin(2 * Math.PI * hz * t + 2.2 * Math.exp(-t / 0.18) * Math.sin(2 * Math.PI * hz * 3.51 * t)) * Math.exp(-t / 0.42) * Math.min(1, t / 0.002) * 0.24 * g, pan, wet);
	},
	ding: ({at, m = 88, g = 0.3, pan = 0}) => {
		FX.bell({at, m, g, pan, wet: 0.5});
		FX.bell({at: at + 0.07, m: m + 7, g: g * 0.7, pan, wet: 0.5});
	},
	metal: ({at, g = 0.15}) => {
		const ratios = [1, 1.52, 2.27, 3.41, 4.73];
		voice(sfx, at, 1, (t) => ratios.reduce((s, r, i) => s + Math.sin(2 * Math.PI * 412 * r * t) * Math.exp(-t / (0.32 / (i + 1))), 0) * 0.2 * g, 0, 0.45);
	},
	shimmer: ({at, d = 1, g = 0.12}) => {
		[81, 84, 88, 91, 93, 96].forEach((m, i) => FX.bell({at: at + i * 0.035, m, g: g * 3, pan: Math.sin(i * 2.2) * 0.7, wet: 0.62}));
		FX.whoosh({at, d, f0: 4200, f1: 9500, p0: -0.3, p1: 0.3, g: 0.1, peak: 0.2});
	},
	servo: ({at, d = 2, g = 0.06}) => {
		let ph = 0;
		voice(sfx, at, d, (t, p) => {
			ph += (130 + 720 * Math.sin(Math.PI * p)) / SR;
			return (saw(ph) * 0.5 + Math.sin(2 * Math.PI * ph * 2)) * Math.sin(Math.PI * p) * g;
		}, (p) => Math.sin(p * 18) * 0.7, 0.12);
	},
	paper: ({at, g = 0.18, pan = 0}) => {
		const f = svf();
		voice(sfx, at, 0.075, (t) => f(rnd(), 2600 + 3200 * Math.exp(-t / 0.02), 1.2).band * Math.exp(-t / 0.018) * g, pan);
	},
	flap: ({at, g = 0.28, pan = 0}) => {
		const f = svf();
		const hz = 900 + uni() * 700;
		voice(sfx, at, 0.05, (t) => (f(rnd(), hz, 0.5).band + Math.sin(2 * Math.PI * hz * 0.6 * t) * 0.5) * Math.exp(-t / 0.008) * g, pan);
	},
	key: ({at, g = 0.22}) => {
		const f = svf();
		const fc = 1500 + uni() * 1700;
		voice(sfx, at, 0.05, (t) => f(rnd(), fc, 0.6).band * Math.exp(-t / 0.008) * g, (uni() - 0.5) * 0.4);
	},
	// typing: one key per character at the on-screen typing speed (characters per frame)
	type: ({at, n, cpf = 1.5, g = 0.22}) => {
		for (let k = 1; k <= n; k++) FX.key({at: at + fr(k / cpf) * 1, g});
	},
};

for (const c of spec.cues || []) {
	const fn = FX[c.fx];
	if (!fn) throw new Error(`unknown fx "${c.fx}" (have: ${Object.keys(FX).join(', ')})`);
	const args = {...c, at: fr(c.at)};
	if (c.to !== undefined) args.to = fr(c.to);
	if (c.fx === 'type') {
		FX.type({...args, at: fr(c.at)});
		continue;
	}
	fn(args);
}

// ---------- the track, spliced onto the video timeline ----------
const track = {L: new Float32Array(N + TAIL), R: new Float32Array(N + TAIL)};
if (spec.track) {
	const dec = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-i', spec.track.file, '-ac', '2', '-ar', String(SR), '-f', 's16le', '-'], {maxBuffer: 1 << 30});
	if (dec.status !== 0) throw new Error(String(dec.stderr || 'ffmpeg failed'));
	const pcm = new Int16Array(dec.stdout.buffer, dec.stdout.byteOffset, dec.stdout.length >> 1);
	const frames = pcm.length / 2;
	const XF = Math.floor(0.012 * SR);
	const segs = spec.track.segments || [[0, LEN, 0]];
	segs.forEach(([v0, v1, t0], si) => {
		const a = Math.floor(v0 * SR);
		const b = Math.min(N + TAIL, Math.floor(v1 * SR));
		const src = Math.floor(t0 * SR);
		const last = si === segs.length - 1;
		for (let i = a - (si ? XF : 0); i < b + (last ? 0 : XF) && i < N + TAIL; i++) {
			if (i < 0) continue;
			const s = src + (i - a);
			if (s < 0 || s >= frames) continue;
			let g = 1;
			if (si && i < a + XF) g = (i - (a - XF)) / (2 * XF);
			if (!last && i >= b - XF) g = Math.max(0, 1 - (i - (b - XF)) / (2 * XF));
			track.L[i] += (pcm[s * 2] / 32768) * g;
			track.R[i] += (pcm[s * 2 + 1] / 32768) * g;
		}
	});
}

// ---------- effects and master ----------
const fxL = new Float32Array(N + TAIL);
const fxR = new Float32Array(N + TAIL);
const delay = Math.floor(0.375 * SR);
for (let i = delay; i < N + TAIL; i++) {
	fxL[i] = send.L[i - delay] * 0.3 + fxR[i - delay] * 0.36;
	fxR[i] = send.R[i - delay] * 0.12 + fxL[i - delay] * 0.36;
}
const reverb = (input, offset) => {
	const output = new Float32Array(input.length);
	[1557, 1617, 1491, 1422, 1277, 1356].forEach((len) => {
		const d = len * 2 + offset;
		const line = new Float32Array(d);
		let idx = 0;
		let damp = 0;
		for (let i = 0; i < input.length; i++) {
			const y = line[idx];
			damp = y * 0.62 + damp * 0.38;
			line[idx] = input[i] * 0.16 + damp * 0.83;
			idx = (idx + 1) % d;
			output[i] += y;
		}
	});
	return output;
};
const revL = reverb(send.L, 0);
const revR = reverb(send.R, 23);
const duck = new Float32Array(N + TAIL).fill(1);
ducks.forEach(([at, depth]) => {
	const s = Math.floor(at * SR);
	for (let i = 0; i < 0.9 * SR && s + i < duck.length; i++) duck[s + i] = Math.min(duck[s + i], 1 - depth * Math.exp(-(i / SR) / 0.28));
});
const lift = spec.track && spec.track.lift;
const liftGain = (i) => (lift ? 1 + (lift.gain - 1) * (1 - Math.min(1, Math.max(0, (i / SR - lift.until) / 0.4))) : 1);
const tg0 = spec.track ? spec.track.gain ?? 0.9 : 0;
const fxg = spec.fxGain ?? 0.55;
const outL = new Float32Array(N);
const outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
	const fade = Math.min(1, i / (0.05 * SR), (N - i) / (0.3 * SR));
	const tg = tg0 * duck[i] * liftGain(i);
	const l = (track.L[i] * tg + sfx.L[i] * fxg + fxL[i] * 0.28 + revL[i] * 0.24) * fade;
	const r = (track.R[i] * tg + sfx.R[i] * fxg + fxR[i] * 0.28 + revR[i] * 0.24) * fade;
	outL[i] = Math.tanh(l * 1.05);
	outR[i] = Math.tanh(r * 1.05);
	peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const gain = 0.89 / Math.max(peak, 1e-6);
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
	data.writeInt16LE(Math.round(outL[i] * gain * 32767), i * 4);
	data.writeInt16LE(Math.round(outR[i] * gain * 32767), i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write('RIFF', 0);
head.writeUInt32LE(36 + data.length, 4);
head.write('WAVEfmt ', 8);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write('data', 36);
head.writeUInt32LE(data.length, 40);
fs.mkdirSync(path.dirname(spec.out), {recursive: true});
fs.writeFileSync(spec.out, Buffer.concat([head, data]));
const secs = [];
for (let s = 0; s + 4 <= LEN; s += 4) {
	let a = 0;
	for (let i = s * SR; i < (s + 4) * SR; i++) a += (outL[i] * gain) ** 2;
	secs.push(`${s}s:${(10 * Math.log10(a / (4 * SR) + 1e-12)).toFixed(1)}`);
}
console.log(`wrote ${spec.out} (${LEN}s, ${(spec.cues || []).length} cues, peak before gain ${peak.toFixed(3)})`);
console.log('loudness per 4 s (dBFS): ' + secs.join(' '));
