// Timing, easing, keyframe tracks and kinetic type.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, GRAD, GRAD_DARK, K} from './brand';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const out = Easing.bezier(0.16, 1, 0.3, 1); // fast start, long settle: the default for arrivals
export const io = Easing.bezier(0.65, 0, 0.35, 1); // camera moves between two rests
export const accel = Easing.bezier(0.7, 0, 0.84, 0); // exits and build-ups
export const soft = Easing.bezier(0.33, 1, 0.68, 1);

export const ramp = (t: number, a: number, b: number, from = 0, to = 1, easing: (n: number) => number = io) => interpolate(t, [a, b], [from, to], {...clamp, easing});

// true in 9:16; use it to switch layouts and zooms
export const useV = () => {
	const {width, height} = useVideoConfig();
	return height > width;
};

export type Key = {t: number; [k: string]: number};

// Piecewise eased interpolation between keyframes; every numeric field is tracked.
// Use for cameras ({t, cx, cy, z, rx, ry}) and cursors ({t, x, y}).
export const track = (f: number, keys: Key[], ease: (n: number) => number = io): Record<string, number> => {
	if (f <= keys[0].t) return {...keys[0]};
	const last = keys[keys.length - 1];
	if (f >= last.t) return {...last};
	let i = 0;
	while (keys[i + 1].t <= f) i++;
	const a = keys[i];
	const b = keys[i + 1];
	const p = ease((f - a.t) / (b.t - a.t));
	const r: Record<string, number> = {t: f};
	Object.keys(a).forEach((k) => {
		if (k !== 't') r[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * p;
	});
	return r;
};

export type Mode = 'light' | 'dark';

export const Center: React.FC<{readonly children: React.ReactNode; readonly style?: React.CSSProperties}> = ({children, style}) => <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', ...style}}>{children}</AbsoluteFill>;

type WordsProps = {
	readonly text: string;
	readonly at: number;
	readonly per?: number; // frames between words
	readonly size: number;
	readonly mode?: Mode;
	readonly hi?: string[]; // words in the brand gradient (with or without punctuation)
	readonly mute?: string[]; // softer words
	readonly weight?: number;
	readonly exitAt?: number;
	readonly exit?: 'blur' | 'up';
	readonly drift?: number;
	readonly style?: React.CSSProperties;
	readonly align?: 'center' | 'left';
	readonly maxWidth?: number;
};

// Words arrive one by one out of a defocus blur and keep drifting a little, never fully still.
export const Words: React.FC<WordsProps> = ({text, at, per = 2.5, size, mode = 'light', hi = [], mute = [], weight = 500, exitAt, exit = 'blur', drift = 0.0007, style, align = 'center', maxWidth}) => {
	const f = useCurrentFrame();
	const words = text.split(' ');
	const ex = exitAt === undefined ? 0 : ramp(f, exitAt, exitAt + 7, 0, 1, accel);
	if (f < at - 1 || ex >= 1) return null;
	const color = mode === 'light' ? K.ink : '#f1f6ff';
	const muted = mode === 'light' ? '#8796aa' : 'rgba(205,222,245,.55)';
	return (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: align === 'center' ? 'center' : 'flex-start',
				columnGap: size * 0.26,
				rowGap: size * 0.05,
				fontFamily,
				fontSize: size,
				fontWeight: weight,
				letterSpacing: -size * 0.025,
				lineHeight: 1.12,
				maxWidth,
				transform: `scale(${1 + Math.max(0, f - at) * drift + (exit === 'blur' ? ex * 0.08 : 0)}) translateY(${exit === 'up' ? -ex * size * 0.6 : 0}px)`,
				filter: ex > 0 ? `blur(${ex * 18}px)` : undefined,
				opacity: 1 - ex,
				...style,
			}}
		>
			{words.map((w, i) => {
				const p = ramp(f, at + i * per, at + i * per + 10, 0, 1, out);
				const clean = w.replace(/[.,?!…:]/g, '');
				const isHi = hi.includes(clean) || hi.includes(w);
				const isMute = mute.includes(clean) || mute.includes(w);
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							opacity: p,
							filter: p < 1 ? `blur(${(1 - p) * 16}px)` : undefined,
							transform: `translateY(${(1 - p) * size * 0.32}px) scale(${1.08 - 0.08 * p})`,
							color: isMute ? muted : color,
							...(isHi
								? {backgroundImage: mode === 'light' ? GRAD : GRAD_DARK, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingBottom: size * 0.08, marginBottom: -size * 0.08}
								: {}),
						}}
					>
						{w}
					</span>
				);
			})}
		</div>
	);
};

// Typewriter with a caret; `hiFrom` paints the tail of the line in the brand gradient.
export const Typed: React.FC<{
	readonly text: string;
	readonly at: number;
	readonly cpf?: number; // characters per frame
	readonly size: number;
	readonly mode?: Mode;
	readonly hiFrom?: number;
	readonly caret?: boolean;
	readonly caretUntil?: number;
	readonly weight?: number;
	readonly color?: string;
	readonly style?: React.CSSProperties;
}> = ({text, at, cpf = 1.5, size, mode = 'light', hiFrom, caret = true, caretUntil, weight = 500, color, style}) => {
	const f = useCurrentFrame();
	const n = Math.max(0, Math.min(text.length, Math.floor((f - at) * cpf)));
	const typing = n < text.length && f >= at;
	const showCaret = caret && (caretUntil === undefined || f < caretUntil) && (typing || Math.floor(f / 9) % 2 === 0);
	const base = color ?? (mode === 'light' ? K.ink : '#f1f6ff');
	const head = hiFrom === undefined ? text.slice(0, n) : text.slice(0, Math.min(n, hiFrom));
	const tail = hiFrom === undefined ? '' : text.slice(hiFrom, n);
	return (
		<div style={{fontFamily, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.02, color: base, whiteSpace: 'pre', lineHeight: 1.15, ...style}}>
			{head}
			{tail ? <span style={{backgroundImage: mode === 'light' ? GRAD : GRAD_DARK, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>{tail}</span> : null}
			<span style={{display: 'inline-block', width: Math.max(3, size * 0.06), height: size * 0.95, marginLeft: size * 0.06, verticalAlign: '-0.12em', background: mode === 'light' ? K.brand : K.sky, borderRadius: 2, opacity: showCaret ? 1 : 0}} />
		</div>
	);
};

// A caption band at the bottom with a soft gradient so it never sits on busy UI.
export const Caption: React.FC<{readonly text: string; readonly at: number; readonly exitAt: number; readonly hi: string[]; readonly mode?: Mode}> = ({text, at, exitAt, hi, mode = 'dark'}) => {
	const v = useV();
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: v ? 170 : 64, background: mode === 'dark' ? 'linear-gradient(transparent 72%, rgba(7,16,29,.75))' : undefined}}>
			<Words text={text} at={at} size={v ? 70 : 76} mode={mode} weight={600} hi={hi} exitAt={exitAt} maxWidth={v ? 940 : undefined} />
		</AbsoluteFill>
	);
};
