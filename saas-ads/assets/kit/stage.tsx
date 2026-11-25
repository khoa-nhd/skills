// Stages and 3D: backdrops, the glowing horizon, a CSS 3D space, plates of the real UI, a page camera.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {K} from './brand';
import {type Mode, useV} from './motion';

export type Rect = {x: number; y: number; w: number; h: number};
export type Plate = {src: string; w: number; h: number; rects: Record<string, Rect>};

// Near-solid backdrop with one slow gradient blob; dark scenes can add a top light cone.
export const Backdrop: React.FC<{readonly mode: Mode; readonly beam?: number; readonly blob?: [number, number]}> = ({mode, beam = 0, blob = [30, 70]}) => {
	const f = useCurrentFrame();
	const bx = blob[0] + Math.sin(f / 70) * 8;
	const by = blob[1] + Math.cos(f / 90) * 6;
	if (mode === 'light') {
		return (
			<AbsoluteFill style={{background: K.paper}}>
				<AbsoluteFill style={{background: `radial-gradient(55% 45% at ${bx}% ${by}%, rgba(91,156,255,.30), transparent 70%)`}} />
				<AbsoluteFill style={{background: `radial-gradient(45% 40% at ${100 - bx}% ${100 - by}%, rgba(143,182,232,.28), transparent 70%)`}} />
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill style={{background: `radial-gradient(120% 90% at 50% 110%, #12305a 0%, ${K.navy} 45%, ${K.night} 100%)`}}>
			<AbsoluteFill style={{background: `radial-gradient(40% 35% at ${bx}% ${by}%, rgba(47,111,224,.22), transparent 70%)`}} />
			{beam > 0 ? (
				<AbsoluteFill
					style={{
						background: 'conic-gradient(from 180deg at 50% -8%, transparent 160deg, rgba(124,196,255,.20) 176deg, rgba(160,210,255,.34) 180deg, rgba(124,196,255,.20) 184deg, transparent 200deg)',
						opacity: beam,
						filter: 'blur(18px)',
					}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

// The glowing planet rim. It is filled, so anything drawn before it is hidden below the horizon:
// draw a dashboard first, then the planet, and animate `top` downward to make the dashboard rise from behind it.
export const PLANET_TOP = (v: boolean) => (v ? 78 : 82); // % from the top when fully risen
export const Planet: React.FC<{readonly top: number}> = ({top}) => {
	const v = useV();
	const arcW = v ? 190 : 150;
	return (
		<div
			style={{
				position: 'absolute',
				left: `${50 - arcW / 2}%`,
				width: `${arcW}%`,
				height: v ? '60%' : '120%',
				top: `${top}%`,
				borderRadius: '50%',
				borderTop: '3px solid rgba(170,215,255,.95)',
				boxShadow: '0 -30px 120px 30px rgba(47,111,224,.55), inset 0 40px 120px rgba(91,156,255,.35)',
				background: 'radial-gradient(60% 40% at 50% 0%, #163a6e 0%, #0b1a30 40%, #07101d 70%)',
			}}
		/>
	);
};

// A 3D space whose origin sits at (cx, cy) of the frame.
export const Space: React.FC<{readonly perspective?: number; readonly cx?: string; readonly cy?: string; readonly children: React.ReactNode}> = ({perspective = 1800, cx = '50%', cy = '50%', children}) => (
	<AbsoluteFill style={{perspective, perspectiveOrigin: `${cx} ${cy}`, overflow: 'hidden'}}>
		<div style={{position: 'absolute', left: cx, top: cy, width: 0, height: 0, transformStyle: 'preserve-3d'}}>{children}</div>
	</AbsoluteFill>
);

// A transformed group inside a Space; children are positioned in its own coordinates.
export const Group: React.FC<{readonly transform: string; readonly children: React.ReactNode}> = ({transform, children}) => (
	<div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform, transformOrigin: '0 0', transformStyle: 'preserve-3d'}}>{children}</div>
);

// Crop any rectangle (CSS px of the capture viewport) out of a plate.
export const PlateCrop: React.FC<{readonly plate: Plate; readonly r: Rect; readonly radius?: number; readonly style?: React.CSSProperties}> = ({plate, r, radius = 14, style}) => (
	<div style={{position: 'relative', width: r.w, height: r.h, overflow: 'hidden', borderRadius: radius, ...style}}>
		<Img src={staticFile(plate.src)} style={{position: 'absolute', left: -r.x, top: -r.y, width: plate.w, height: plate.h, maxWidth: 'none', filter: 'brightness(1.1) saturate(1.06)'}} />
	</div>
);

// Rim light for floating pages and cards.
export const RIM = '0 0 0 1.5px rgba(160,205,255,.45), 0 0 60px rgba(91,156,255,.35), 0 60px 140px rgba(0,0,0,.6)';

// Camera over a page in page coordinates. `fit` is the zoom at which the page fills the frame width
// (frameWidth / pageWidth). Vertical frames zoom harder so UI stays readable.
export const pageZoom = (v: boolean, z: number, fit: number) => (v ? 1 + (z - 1) * 1.7 : z) * fit;
export const PageCam: React.FC<{readonly c: Record<string, number>; readonly fit: number; readonly children: React.ReactNode}> = ({c, fit, children}) => {
	const v = useV();
	return (
		<Space perspective={v ? 1400 : 1800}>
			<Group transform={`rotateX(${c.rx}deg) rotateY(${c.ry}deg) scale(${pageZoom(v, c.z, fit)}) translate(${-c.cx}px, ${-c.cy}px)`}>{children}</Group>
		</Space>
	);
};
