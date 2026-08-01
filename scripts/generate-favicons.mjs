// Пересобирает набор иконок сайта из logo.png в public/.
// Запуск: node scripts/generate-favicons.mjs [путь-к-исходнику]
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ?? path.join(root, 'logo.png');
const outDir = path.join(root, 'public');

const png = (size) =>
	sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

// ICO — контейнер с PNG внутри; заголовок 6 байт + по 16 байт на запись.
const buildIco = (images) => {
	const count = images.length;
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(count, 4);

	let offset = 6 + count * 16;
	const entries = [];
	for (const { size, data } of images) {
		const e = Buffer.alloc(16);
		e.writeUInt8(size >= 256 ? 0 : size, 0);
		e.writeUInt8(size >= 256 ? 0 : size, 1);
		e.writeUInt8(0, 2);
		e.writeUInt8(0, 3);
		e.writeUInt16LE(1, 4);
		e.writeUInt16LE(32, 6);
		e.writeUInt32LE(data.length, 8);
		e.writeUInt32LE(offset, 12);
		entries.push(e);
		offset += data.length;
	}

	return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
};

const pngSizes = [16, 32, 48, 96, 180, 192, 512];
const written = [];

for (const size of pngSizes) {
	const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
	const data = await png(size);
	await writeFile(path.join(outDir, name), data);
	written.push(`${name} (${data.length} B)`);
}

const ico = buildIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) }))));
await writeFile(path.join(outDir, 'favicon.ico'), ico);
written.push(`favicon.ico (${ico.length} B)`);

// SVG-обёртка: тот же растр, но отдаётся браузерам, которые просят image/svg+xml.
const embedded = (await png(128)).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <image href="data:image/png;base64,${embedded}" width="128" height="128" />
</svg>
`;
await writeFile(path.join(outDir, 'favicon.svg'), svg);
written.push(`favicon.svg (${Buffer.byteLength(svg)} B)`);

const manifest = {
	name: 'kerizov.design',
	short_name: 'kerizov',
	icons: [
		{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
		{ src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
	],
	theme_color: '#020202',
	background_color: '#020202',
	display: 'standalone',
};
const manifestJson = `${JSON.stringify(manifest, null, '\t')}\n`;
await writeFile(path.join(outDir, 'site.webmanifest'), manifestJson);
written.push(`site.webmanifest (${Buffer.byteLength(manifestJson)} B)`);

console.log(`источник: ${source}`);
written.forEach((w) => console.log('  ' + w));
