#!/usr/bin/env node
// Captures high-DPR screenshots ("plates") of a product's pages plus the rectangles of chosen elements,
// and writes a typed src/plates.ts for the scenes. Run from the Remotion project root:
//   node capture-plates.mjs plates.config.json
// Config (see references/capture-ui.md):
// {
//   "out": "public/plates", "ts": "src/plates.ts",
//   "viewports": {"desktop": {"width": 1600, "height": 900, "scale": 2.5},
//                 "mobile": {"width": 412, "height": 700, "scale": 4, "fullPage": true}},
//   "pages": [{"name": "dashboard", "url": "http://localhost:3000/", "selectors": {"sidebar": "aside"},
//              "css": ".cookie{display:none}", "js": "document.querySelectorAll('.name').forEach(e=>e.textContent='Alex')",
//              "viewports": ["desktop", "mobile"]}]
// }
// Elements with data-promo="key" are measured too. Uses Remotion's chrome-headless-shell (or CHROME=/path).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(cfg.out || 'public/plates');
const tsFile = path.resolve(cfg.ts || 'src/plates.ts');
fs.mkdirSync(outDir, {recursive: true});
const publicRoot = path.resolve('public');

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
if (!chrome) throw new Error('chrome-headless-shell not found; run `npx remotion browser ensure` or set CHROME');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9200 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'plates-'));
const proc = spawn(chrome, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});

const measure = (selectors) => `(async()=>{
await document.fonts.ready; await new Promise(r=>setTimeout(r,300));
const R={}; const S=${JSON.stringify(selectors || {})};
const add=(k,e)=>{if(!e)return;const b=e.getBoundingClientRect();if(b.width<2||b.height<2)return;R[k]={x:Math.round(b.x*10)/10,y:Math.round((b.y+scrollY)*10)/10,w:Math.round(b.width*10)/10,h:Math.round(b.height*10)/10};};
document.querySelectorAll('[data-promo]').forEach(e=>add(e.dataset.promo,e));
for (const [k,s] of Object.entries(S)) { const all=[...document.querySelectorAll(s)]; if(all.length===1) add(k,all[0]); else all.forEach((e,i)=>add(k+i,e)); }
return JSON.stringify({docH:Math.ceil(document.documentElement.scrollHeight),rects:R});
})()`;

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
	await new Promise((res, rej) => {
		ws.onopen = res;
		ws.onerror = rej;
	});
	let id = 0;
	const waiting = new Map();
	const listeners = [];
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id && waiting.has(m.id)) {
			const {res, rej} = waiting.get(m.id);
			waiting.delete(m.id);
			m.error ? rej(new Error(m.error.message)) : res(m.result);
		} else listeners.forEach((l) => l(m));
	};
	const send = (method, params = {}) =>
		new Promise((res, rej) => {
			const n = ++id;
			waiting.set(n, {res, rej});
			ws.send(JSON.stringify({id: n, method, params}));
		});
	await send('Page.enable');
	await send('Runtime.enable');
	const open = async (url) => {
		const loaded = new Promise((res) => {
			const l = (m) => {
				if (m.method === 'Page.loadEventFired') {
					listeners.splice(listeners.indexOf(l), 1);
					res();
				}
			};
			listeners.push(l);
		});
		await send('Page.navigate', {url});
		await Promise.race([loaded, sleep(20000)]);
		await sleep(600);
	};
	const viewport = (w, h, s) => send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: s, mobile: w < 600});
	const evalJs = async (expr) => (await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true})).result.value;

	const result = {};
	for (const page of cfg.pages) {
		for (const vpName of page.viewports || Object.keys(cfg.viewports)) {
			const vp = cfg.viewports[vpName];
			await viewport(vp.width, vp.height, 1);
			await open(page.url);
			if (page.css) await evalJs(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(page.css)};document.head.appendChild(s);})()`);
			if (page.js) await evalJs(`(()=>{${page.js}})()`);
			let data = JSON.parse(await evalJs(measure(page.selectors)));
			const h = vp.fullPage ? Math.max(vp.height, data.docH) : vp.height;
			if (h !== vp.height) {
				await viewport(vp.width, h, 1);
				data = JSON.parse(await evalJs(measure(page.selectors)));
			}
			await viewport(vp.width, h, vp.scale || 2);
			await sleep(500);
			const {data: img} = await send('Page.captureScreenshot', {format: 'jpeg', quality: 93, clip: {x: 0, y: 0, width: vp.width, height: h, scale: 1}});
			const file = path.join(outDir, `${vpName}-${page.name}.jpg`);
			fs.writeFileSync(file, Buffer.from(img, 'base64'));
			result[vpName] ??= {};
			result[vpName][page.name] = {src: path.relative(publicRoot, file).replace(/\\/g, '/'), w: vp.width, h, rects: data.rects};
			console.log(`${vpName} ${page.name} ${vp.width}x${h} @${vp.scale || 2}x, ${Object.keys(data.rects).length} rects`);
		}
	}
	fs.mkdirSync(path.dirname(tsFile), {recursive: true});
	fs.writeFileSync(
		tsFile,
		`// Generated by saas-ads/scripts/capture-plates.mjs. Positions are CSS px of the capture viewport.\nimport type {Plate} from './kit/stage';\nexport const PLATES = ${JSON.stringify(result, null, 1)} as const satisfies Record<string, Record<string, Plate>>;\n`,
	);
	console.log(`wrote ${tsFile}`);
	ws.close();
} finally {
	proc.kill();
	// Windows keeps the profile locked until Chrome has really exited
	await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(3000)]);
	try {
		fs.rmSync(profile, {recursive: true, force: true, maxRetries: 8, retryDelay: 250});
	} catch {
		// leftover temp files are harmless
	}
}
process.exit(0);
