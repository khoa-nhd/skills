#!/usr/bin/env node
// Renders chosen frames of a Remotion composition and tiles them into one labelled contact sheet.
// Run from the Remotion project root:
//   node contact-sheet.mjs --comp PromoNgang --frames 20,45,90,130 --out sheet.jpg [--cols 6] [--scale 0.22] [--cell 400]
// Frames are sorted ascending (Remotion writes them in that order), so labels always match.
// Uses Remotion's bundled chrome-headless-shell (or CHROME=/path) to tile; run one sheet at a time.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : def;
};
const comp = opt('comp');
const frames = (opt('frames') || '')
	.split(',')
	.filter(Boolean)
	.map(Number)
	.sort((a, b) => a - b);
if (!comp || !frames.length) {
	console.error('usage: node contact-sheet.mjs --comp <id> --frames 1,2,3 --out sheet.jpg [--cols 6] [--scale 0.22] [--cell 400]');
	process.exit(2);
}
const out = path.resolve(opt('out', `sheet-${comp}.jpg`));
const cols = Number(opt('cols', 6));
const scale = opt('scale', '0.22');
const cell = Number(opt('cell', 400));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));

const render = spawnSync(`npx remotion render ${comp} "${path.join(dir, 'raw')}" --muted --frames=${frames.join(',')} --image-format=jpeg --scale=${scale} --log=error`, {stdio: 'inherit', shell: true});
if (render.status !== 0) process.exit(render.status ?? 1);
const files = fs
	.readdirSync(path.join(dir, 'raw'))
	.filter((f) => /\.jpe?g$/.test(f))
	.sort()
	.map((f) => path.join(dir, 'raw', f));

const find = (d, name) => {
	if (!fs.existsSync(d)) return null;
	for (const e of fs.readdirSync(d, {withFileTypes: true})) {
		const p = path.join(d, e.name);
		if (e.isFile() && (e.name === name || e.name === `${name}.exe`)) return p;
		if (e.isDirectory()) {
			const hit = find(p, name);
			if (hit) return hit;
		}
	}
	return null;
};
const chrome = process.env.CHROME || find(path.join(process.cwd(), 'node_modules', '.remotion'), 'chrome-headless-shell');
if (!chrome) throw new Error('chrome-headless-shell not found; render once with Remotion or set CHROME');

const url = (p) => 'file:///' + p.replace(/\\/g, '/');
const html = `<!doctype html><body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:3px;width:${cols * cell + (cols - 1) * 3}px">${files
	.map((f, i) => `<div style="position:relative;line-height:0"><img style="width:${cell}px" src="${url(f)}"><span style="position:absolute;left:3px;top:3px;background:#000c;color:#fff;font:12px monospace;line-height:15px;padding:0 4px">${frames[i] ?? i}</span></div>`)
	.join('')}</body>`;
const page = path.join(dir, 'sheet.html');
fs.writeFileSync(page, html);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 90);
const proc = spawn(chrome, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(dir, 'profile')}`, 'about:blank'], {stdio: 'ignore'});
try {
	let target;
	for (let i = 0; i < 75 && !target; i++) {
		await sleep(200);
		try {
			target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
		} catch {}
	}
	if (!target) throw new Error('headless chrome did not start');
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => (ws.onopen = r));
	let id = 0;
	const wait = new Map();
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id && wait.has(m.id)) {
			wait.get(m.id)(m.result);
			wait.delete(m.id);
		}
	};
	const send = (method, params = {}) =>
		new Promise((r) => {
			const n = ++id;
			wait.set(n, r);
			ws.send(JSON.stringify({id: n, method, params}));
		});
	await send('Page.enable');
	await send('Page.navigate', {url: url(page)});
	await sleep(1200);
	const size = await send('Runtime.evaluate', {expression: 'Promise.all([...document.images].map(i=>i.decode().catch(()=>0))).then(()=>JSON.stringify([document.body.scrollWidth,document.body.scrollHeight]))', awaitPromise: true, returnByValue: true});
	const [w, h] = JSON.parse(size.result.value);
	await send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
	await sleep(300);
	const {data} = await send('Page.captureScreenshot', {format: 'jpeg', quality: 86});
	fs.writeFileSync(out, Buffer.from(data, 'base64'));
	ws.close();
	console.log(`sheet ${out} (${w}x${h}, ${files.length} frames: ${frames.join(',')})`);
} finally {
	proc.kill();
	// Windows keeps the profile locked until Chrome has really exited
	await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(3000)]);
	try {
		fs.rmSync(dir, {recursive: true, force: true, maxRetries: 8, retryDelay: 250});
	} catch {
		// leftover temp files are harmless
	}
}
process.exit(0);
