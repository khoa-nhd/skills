// Product-ad UI pieces: cards, glass, chips, the hand cursor, check ring, confetti, logo tile, orb, toast,
// the comet (logo tile flying as a transition), and scene wrappers (whip, punch, beat pulse).
import React from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {BRAND, fontFamily, K} from './brand';
import {accel, io, type Mode, out, ramp} from './motion';

// Dark product card that floats on either background.
export const card = (mode: Mode, r = 26): React.CSSProperties =>
	mode === 'dark'
		? {background: 'linear-gradient(180deg, rgba(30,52,84,.92), rgba(17,33,54,.94))', border: '1px solid rgba(143,182,232,.22)', borderRadius: r, boxShadow: '0 40px 90px -30px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.08)', color: '#eef4ff'}
		: {background: 'linear-gradient(180deg, #16304f, #0f2036)', border: '1px solid rgba(143,182,232,.25)', borderRadius: r, boxShadow: '0 50px 90px -30px rgba(15,32,54,.55), 0 10px 30px -10px rgba(15,32,54,.35), inset 0 1px 0 rgba(255,255,255,.09)', color: '#eef4ff'};

// Glass pills and bubbles. Avoid backdrop-filter inside 3D scenes (it mirrors content at its edges).
export const glass = (mode: Mode, r = 999): React.CSSProperties =>
	mode === 'dark'
		? {background: 'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))', border: '1px solid rgba(170,210,255,.30)', borderRadius: r, boxShadow: '0 0 40px rgba(47,111,224,.35), inset 0 1px 0 rgba(255,255,255,.18)'}
		: {background: 'rgba(255,255,255,.82)', border: '1px solid rgba(47,111,224,.16)', borderRadius: r, boxShadow: '0 30px 60px -24px rgba(30,70,140,.35), inset 0 1px 0 #fff'};

type Tone = 'blue' | 'amber' | 'red' | 'green' | 'plain';
export const Chip: React.FC<{readonly children: React.ReactNode; readonly tone?: Tone; readonly size?: number; readonly style?: React.CSSProperties}> = ({children, tone = 'blue', size = 22, style}) => {
	const t = {
		blue: ['rgba(91,156,255,.16)', '#9cc4ff', 'rgba(124,180,255,.35)'],
		amber: ['rgba(240,178,90,.14)', '#f6c57d', 'rgba(240,178,90,.45)'],
		red: ['rgba(239,125,125,.14)', '#f59b9b', 'rgba(239,125,125,.45)'],
		green: ['rgba(62,213,152,.14)', '#6fe3b2', 'rgba(62,213,152,.45)'],
		plain: ['rgba(255,255,255,.06)', '#c8d6ea', 'rgba(255,255,255,.14)'],
	}[tone];
	return (
		<span style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.35, padding: `${size * 0.28}px ${size * 0.6}px`, borderRadius: 999, background: t[0], color: t[1], border: `1px solid ${t[2]}`, fontFamily, fontWeight: 600, fontSize: size, whiteSpace: 'nowrap', ...style}}>
			{children}
		</span>
	);
};

// The pointing hand, pressed down around each frame in `press`, with a ripple.
// Inside a zoomed page group pass size = 84 / zoom so it stays the same on screen.
export const Hand: React.FC<{readonly x: number; readonly y: number; readonly press?: number[]; readonly size?: number; readonly opacity?: number}> = ({x, y, press = [], size = 64, opacity = 1}) => {
	const f = useCurrentFrame();
	const down = press.reduce((m, p) => Math.max(m, ramp(f, p - 3, p, 0, 1) * ramp(f, p + 2, p + 8, 1, 0)), 0);
	return (
		<div style={{position: 'absolute', left: x, top: y, width: size, height: size, transform: `translate(-30%, -8%) scale(${1 - down * 0.14})`, opacity, filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.35))'}}>
			<svg viewBox="0 0 24 24" width={size} height={size}>
				<path d="M9 11.2V4.6a1.6 1.6 0 0 1 3.2 0v5.2l.1-1a1.6 1.6 0 0 1 3.1.4v.9a1.6 1.6 0 0 1 3.1.3v1a1.6 1.6 0 0 1 3 .5v4.1c0 3.4-2.5 6-5.9 6h-2.2c-2 0-3.4-.8-4.6-2.3l-3.4-4.4a1.7 1.7 0 0 1 2.5-2.3L9 13.1z" fill="#fff" stroke="#0f2036" strokeWidth={1.25} strokeLinejoin="round" />
			</svg>
			{press.map((p) => {
				const r = ramp(f, p, p + 14, 0, 1, out);
				if (f < p || r >= 1) return null;
				return <div key={p} style={{position: 'absolute', left: size * 0.3 - 40 * r, top: size * 0.08 - 40 * r, width: 80 * r, height: 80 * r, borderRadius: '50%', border: `3px solid rgba(124,196,255,${1 - r})`}} />;
			})}
		</div>
	);
};

export const CheckRing: React.FC<{readonly at: number; readonly size: number; readonly color?: string}> = ({at, size, color = K.green}) => {
	const f = useCurrentFrame();
	const ring = ramp(f, at, at + 16, 0, 1, out);
	const tick = ramp(f, at + 9, at + 22, 0, 1, out);
	const C = 2 * Math.PI * 44;
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.12}px ${color}88)`}}>
			<circle cx={50} cy={50} r={44} fill="none" stroke={`${color}33`} strokeWidth={5} />
			<circle cx={50} cy={50} r={44} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 50 50)" />
			<path d="M31 51 L44 63 L70 37" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={60} strokeDashoffset={60 * (1 - tick)} />
		</svg>
	);
};

// A small filled check, for ticking rows in a list.
export const TickDot: React.FC<{readonly p: number; readonly size?: number}> = ({p, size = 28}) => (
	<div style={{width: size, height: size, borderRadius: '50%', background: K.green, display: 'grid', placeItems: 'center', boxShadow: `0 0 ${16 * p}px ${K.green}`, transform: `scale(${1 + Math.sin(p * Math.PI) * 0.35})`, opacity: Math.min(1, p * 3)}}>
		<svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24">
			<path d="M5 12.5 L10 17 L19 7" fill="none" stroke="#06231a" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - p)} />
		</svg>
	</div>
);

// Paper confetti from the centre of its parent.
export const Confetti: React.FC<{readonly at: number; readonly n?: number; readonly spread?: number; readonly seed?: string}> = ({at, n = 46, spread = 900, seed = 'c'}) => {
	const f = useCurrentFrame();
	const t = f - at;
	if (t < 0 || t > 70) return null;
	const colors = [K.brand, K.brand2, '#7cc4ff', K.amber, K.green, '#ff8fb3', '#ffffff'];
	return (
		<>
			{Array.from({length: n}).map((_, i) => {
				const a = random(`${seed}a${i}`) * Math.PI * 2;
				const v = (0.45 + random(`${seed}v${i}`) * 0.55) * spread;
				const p = ramp(t, 0, 60, 0, 1, out);
				const rot = random(`${seed}r${i}`) * 720 * p;
				const w = 10 + random(`${seed}w${i}`) * 14;
				return <div key={i} style={{position: 'absolute', left: Math.cos(a) * v * p, top: Math.sin(a) * v * p * 0.75 + t * t * 0.09, width: w, height: w * 0.45, background: colors[i % colors.length], borderRadius: 2, transform: `rotate(${rot}deg) rotateX(${rot * 1.7}deg)`, opacity: ramp(t, 45, 70, 1, 0)}} />;
			})}
		</>
	);
};

// The brand tile: the recurring character. Swap the monogram for the real logo if there is one.
export const Tile: React.FC<{readonly size: number; readonly glow?: number; readonly style?: React.CSSProperties}> = ({size, glow = 0.6, style}) => (
	<div
		style={{
			width: size,
			height: size,
			borderRadius: size * 0.26,
			display: 'grid',
			placeItems: 'center',
			background: `linear-gradient(145deg, ${K.brand2} 0%, #2a4f86 45%, #172e4f 100%)`,
			border: `${Math.max(1, size * 0.02)}px solid rgba(197,224,255,.55)`,
			boxShadow: `0 0 ${size * 0.6}px rgba(91,156,255,${0.55 * glow}), inset 0 ${size * 0.04}px ${size * 0.08}px rgba(255,255,255,.25)`,
			color: '#fff',
			fontFamily,
			fontWeight: 800,
			fontSize: size * 0.36,
			...style,
		}}
	>
		{BRAND.monogram}
	</div>
);

// Glass orb: a guide that taps UI and can fill the lens as a transition.
export const Orb: React.FC<{readonly size: number; readonly style?: React.CSSProperties}> = ({size, style}) => (
	<div
		style={{
			width: size,
			height: size,
			borderRadius: '50%',
			background: 'radial-gradient(circle at 34% 28%, rgba(255,255,255,.98) 0%, rgba(214,235,255,.75) 18%, rgba(140,195,255,.30) 48%, rgba(91,156,255,.18) 70%, rgba(255,255,255,.75) 100%)',
			border: '1.5px solid rgba(255,255,255,.85)',
			boxShadow: `0 ${size * 0.25}px ${size * 0.5}px rgba(30,70,140,.35), inset ${-size * 0.12}px ${-size * 0.16}px ${size * 0.35}px rgba(47,111,224,.45), inset ${size * 0.05}px ${size * 0.05}px ${size * 0.12}px rgba(255,255,255,.8)`,
			...style,
		}}
	/>
);

export const Toast: React.FC<{readonly icon: React.ReactNode; readonly tag: string; readonly tone: string; readonly title: string; readonly width: number; readonly when?: string}> = ({icon, tag, tone, title, width, when = 'now'}) => (
	<div style={{width, display: 'flex', alignItems: 'center', gap: 22, padding: '22px 26px', borderRadius: 30, background: 'linear-gradient(180deg, rgba(36,62,100,.92), rgba(18,34,58,.94))', border: '1px solid rgba(160,205,255,.32)', boxShadow: `0 30px 70px -20px rgba(0,0,0,.75), 0 0 40px ${tone}33, inset 0 1px 0 rgba(255,255,255,.12)`, fontFamily, color: '#eef4ff'}}>
		<div style={{width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', background: `${tone}26`, border: `1.5px solid ${tone}88`, flexShrink: 0}}>{icon}</div>
		<div style={{flex: 1, minWidth: 0}}>
			<div style={{display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, letterSpacing: 1.5, color: tone}}>
				<span>{tag}</span>
				<span style={{color: '#8fa6c4', fontWeight: 500, letterSpacing: 0}}>{when}</span>
			</div>
			<div style={{fontSize: 32, fontWeight: 600, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</div>
		</div>
	</div>
);

// The logo tile flying along a curve with a fading trail. `path` maps 0..1 to [x, y, scale] in screen px.
export const Comet: React.FC<{readonly from: number; readonly to: number; readonly path: (p: number) => [number, number, number]; readonly size?: number}> = ({from, to, path, size = 90}) => {
	const f = useCurrentFrame();
	if (f < from || f > to + 6) return null;
	const trail = 9;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: trail}).map((_, k) => {
				const p = ramp(f - k * 1.1, from, to, 0, 1, io);
				const [x, y, s] = path(p);
				const head = k === 0;
				return (
					<div key={k} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${s * (1 - k * 0.07)})`, opacity: head ? 1 : 0.32 * (1 - k / trail), filter: head ? undefined : `blur(${2 + k * 1.5}px)`}}>
						<Tile size={size} glow={head ? 1 : 0.3} />
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// Whip in from the right and/or out to the left with blur: the cheapest seam between two scenes.
export const Whip: React.FC<{readonly inAt?: number; readonly outAt?: number; readonly children: React.ReactNode}> = ({inAt, outAt, children}) => {
	const f = useCurrentFrame();
	const {width: W} = useVideoConfig();
	const a = inAt === undefined ? 1 : ramp(f, inAt, inAt + 10, 0, 1, out);
	const b = outAt === undefined ? 0 : ramp(f, outAt, outAt + 12, 0, 1, accel);
	const dx = (1 - a) * W * 0.8 - b * W * 0.8;
	return <AbsoluteFill style={dx !== 0 ? {transform: `translateX(${dx}px)`, filter: `blur(${(1 - a) * 26 + b * 26}px)`} : undefined}>{children}</AbsoluteFill>;
};

// A short punch-in out of a blur as a scene starts. Use on hard cuts only.
export const Punch: React.FC<{readonly children: React.ReactNode}> = ({children}) => {
	const f = useCurrentFrame();
	if (f >= 7) return <AbsoluteFill>{children}</AbsoluteFill>;
	const p = ramp(f, 0, 7, 0, 1, out);
	return <AbsoluteFill style={{transform: `scale(${1.08 - 0.08 * p})`, filter: `blur(${(1 - p) * 10}px)`}}>{children}</AbsoluteFill>;
};

// The whole frame breathes on the beat between `from` and `to`, a little harder on each downbeat.
export const Pulse: React.FC<{readonly from: number; readonly to: number; readonly beat?: number; readonly children: React.ReactNode}> = ({from, to, beat = 15, children}) => {
	const f = useCurrentFrame();
	const on = f >= from && f < to;
	const k = Math.exp(-(f % beat) / 3.5);
	const s = on ? 1 + 0.005 * k + (f % (beat * 4) < beat ? 0.008 * k : 0) : 1;
	return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};
