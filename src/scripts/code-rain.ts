import { Observer, getGsap } from './gsap';
import type { Observer as ObserverType } from 'gsap/Observer';

interface CodeRainOptions {
	reducedMotion?: boolean;
}

declare global {
	interface Window {
		__BG_CODE_LINES__?: string[];
	}
}

const KEYWORDS = new Set([
	'const', 'let', 'var', 'function', 'return', 'import', 'export',
	'async', 'await', 'class', 'extends', 'new', 'this', 'if', 'else',
	'for', 'while', 'switch', 'case', 'break', 'default', 'try', 'catch',
	'throw', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined',
	'@media', '@keyframes', '@import', '@layer', '@apply',
	'from', 'of', 'in', 'type', 'interface', 'enum',
]);

const CSS_PROPS = new Set([
	'display:', 'position:', 'color:', 'background:', 'border:',
	'padding:', 'margin:', 'gap:', 'width:', 'height:', 'opacity:',
	'transform:', 'transition:', 'animation:', 'grid-template-columns:',
	'flex-direction:', 'justify-content:', 'align-items:', 'z-index:',
	'font-size:', 'font-weight:', 'line-height:', 'border-radius:',
	'box-shadow:', 'backdrop-filter:', 'overflow:', 'cursor:',
	'top:', 'left:', 'right:', 'bottom:', 'inset:',
	'flex:', 'grid:', 'filter:', 'clip-path:', 'mix-blend-mode:',
	'text-transform:', 'letter-spacing:', 'white-space:', 'pointer-events:',
]);

interface Token {
	text: string;
	type: 'keyword' | 'css-prop' | 'string' | 'number' | 'punctuation' | 'normal';
}

interface CodeLine {
	tokens: Token[];
	rawLength: number;
	x: number;
	y: number;
	speed: number;
	direction: 1 | -1;
	depth: number;
	fontSize: number;
	baseOpacity: number;
	currentOpacity: number;
	currentScale: number;
	layer: 'back' | 'mid' | 'front';
}

// ── Tuning ──────────────────────────────────────────────────
const LINE_COUNT_DESKTOP = 40;
const LINE_COUNT_MOBILE = 55;
const REVERSE_RATIO = 0.38;

const LAYER_CONFIG = {
	back:  { fontMin: 8,  fontMax: 10, speedMin: 6,  speedMax: 14, opacityBase: 0.045 },
	mid:   { fontMin: 10, fontMax: 13, speedMin: 12, speedMax: 24, opacityBase: 0.07  },
	front: { fontMin: 13, fontMax: 16, speedMin: 20, speedMax: 36, opacityBase: 0.09  },
} as const;

const KEYWORD_OPACITY_MULT = 1.6;
const CSS_PROP_OPACITY_MULT = 1.35;

const FOCUS_RADIUS = 190;
const FOCUS_OPACITY = 0.28;
const FOCUS_SCALE = 1.35;
const FOCUS_SLOWDOWN = 0.08;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Tokenizer ───────────────────────────────────────────────
const tokenize = (line: string): Token[] => {
	const tokens: Token[] = [];
	const regex = /("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?(?:px|rem|em|vw|vh|%|ms|s|deg)?\b)|([\{\}\[\]\(\);:,.<>=!&|?+\-*/])|(\S+)/g;
	let match: RegExpExecArray | null;
	let lastIndex = 0;

	while ((match = regex.exec(line)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ text: line.slice(lastIndex, match.index), type: 'normal' });
		}

		if (match[1]) {
			tokens.push({ text: match[0], type: 'string' });
		} else if (match[2]) {
			tokens.push({ text: match[0], type: 'number' });
		} else if (match[3]) {
			tokens.push({ text: match[0], type: 'punctuation' });
		} else if (match[4]) {
			const word = match[4].replace(/[^a-zA-Z@\-:]/g, '');
			if (KEYWORDS.has(word)) {
				tokens.push({ text: match[0], type: 'keyword' });
			} else if (CSS_PROPS.has(word)) {
				tokens.push({ text: match[0], type: 'css-prop' });
			} else {
				tokens.push({ text: match[0], type: 'normal' });
			}
		}

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < line.length) {
		tokens.push({ text: line.slice(lastIndex), type: 'normal' });
	}

	return tokens;
};

// ── Main ────────────────────────────────────────────────────
export const initCodeRain = ({ reducedMotion = false }: CodeRainOptions = {}) => {
	if (reducedMotion) return () => {};

	const gsap = getGsap();
	const container = document.querySelector<HTMLElement>('.background-layer');
	if (!container) return () => {};

	const sourceLines = window.__BG_CODE_LINES__ ?? [];
	if (!sourceLines.length) return () => {};

	const canvas = document.createElement('canvas');
	canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
	container.innerHTML = '';
	container.appendChild(canvas);

	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) return () => {};

	let width = 0;
	let height = 0;
	let lines: CodeLine[] = [];
	let mouseX = -9999;
	let mouseY = -9999;
	let scrollBoost = 0;
	let isDark = document.documentElement.dataset.theme !== 'light';
	let lineIndex = 0;

	const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
	const getTextRgb = (): [number, number, number] => isDark ? [245, 245, 245] : [30, 30, 30];
	const getGoldRgb = (): [number, number, number] => [255, 215, 0];

	const nextSourceLine = (): string => {
		const line = sourceLines[lineIndex % sourceLines.length];
		lineIndex++;
		return line;
	};

	const pickLayer = (i: number, total: number): 'back' | 'mid' | 'front' => {
		const ratio = i / total;
		if (ratio < 0.4) return 'back';
		if (ratio < 0.75) return 'mid';
		return 'front';
	};

	const createLine = (index: number, total: number, initY?: number): CodeLine => {
		const layer = pickLayer(index, total);
		const cfg = LAYER_CONFIG[layer];

		const depthRand = Math.random();
		const fontSize = cfg.fontMin + depthRand * (cfg.fontMax - cfg.fontMin);
		const speed = cfg.speedMin + depthRand * (cfg.speedMax - cfg.speedMin);
		const baseOpacity = cfg.opacityBase * (0.7 + depthRand * 0.3);
		const depth = layer === 'back' ? 0.2 + depthRand * 0.25
			: layer === 'mid' ? 0.45 + depthRand * 0.25
			: 0.7 + depthRand * 0.3;

		const direction: 1 | -1 = Math.random() < REVERSE_RATIO ? -1 : 1;
		const raw = nextSourceLine();
		const estWidth = raw.length * fontSize * 0.55;

		let x: number;
		if (initY !== undefined) {
			x = direction === 1
				? -(Math.random() * width * 0.7)
				: width + Math.random() * width * 0.3;
		} else {
			x = direction === 1
				? width + Math.random() * 400
				: -(estWidth + Math.random() * 400);
		}

		return {
			tokens: tokenize(raw),
			rawLength: raw.length,
			x,
			y: initY !== undefined ? initY : Math.random() * height,
			speed,
			direction,
			depth,
			fontSize,
			baseOpacity,
			currentOpacity: baseOpacity,
			currentScale: 1,
			layer,
		};
	};

	const buildLines = () => {
		const count = isMobile() ? LINE_COUNT_MOBILE : LINE_COUNT_DESKTOP;
		lines = [];
		lineIndex = 0;
		const spacing = height / count;
		for (let i = 0; i < count; i++) {
			const y = i * spacing + (Math.random() - 0.5) * spacing * 0.4;
			lines.push(createLine(i, count, y));
		}
	};

	const resize = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		buildLines();
	};

	const updateTheme = () => {
		isDark = document.documentElement.dataset.theme !== 'light';
	};

	const themeObserver = new MutationObserver(updateTheme);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});

	resize();
	window.addEventListener('resize', resize);

	const onMouseMove = (e: MouseEvent) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
	};
	const onMouseLeave = () => {
		mouseX = -9999;
		mouseY = -9999;
	};

	window.addEventListener('mousemove', onMouseMove);
	document.addEventListener('mouseleave', onMouseLeave);

	const scrollObj = { value: 0 };
	const observer: ObserverType = Observer.create({
		target: window,
		type: 'wheel,touch,scroll',
		onChangeY: (self) => {
			const v = Math.min(Math.abs(self.velocityY), 3000) / 500;
			gsap.to(scrollObj, {
				value: v,
				duration: 0.25,
				ease: 'power2.out',
				onUpdate() { scrollBoost = scrollObj.value; },
			});
		},
		onStop: () => {
			gsap.to(scrollObj, {
				value: 0,
				duration: 1.4,
				ease: 'power2.out',
				onUpdate() { scrollBoost = scrollObj.value; },
			});
		},
		onStopDelay: 0.12,
	});

	// ── Token coloring ──────────────────────────────────────
	const getTokenColor = (
		token: Token,
		textRgb: [number, number, number],
		goldRgb: [number, number, number],
		opacity: number,
		focusBlend: number,
	): string => {
		const b = Math.min(focusBlend, 1);

		switch (token.type) {
			case 'keyword': {
				const r = Math.round(lerp(textRgb[0], goldRgb[0], 0.4 + b * 0.6));
				const g = Math.round(lerp(textRgb[1], goldRgb[1], 0.4 + b * 0.6));
				const bl = Math.round(lerp(textRgb[2], goldRgb[2], 0.4 + b * 0.6));
				return `rgba(${r},${g},${bl},${opacity * KEYWORD_OPACITY_MULT})`;
			}
			case 'css-prop': {
				const r = Math.round(lerp(textRgb[0], goldRgb[0], 0.3 + b * 0.5));
				const g = Math.round(lerp(textRgb[1], goldRgb[1], 0.3 + b * 0.5));
				const bl = Math.round(lerp(textRgb[2], goldRgb[2], 0.3 + b * 0.5));
				return `rgba(${r},${g},${bl},${opacity * CSS_PROP_OPACITY_MULT})`;
			}
			case 'string':
				return `rgba(${textRgb[0]},${textRgb[1]},${textRgb[2]},${opacity * 0.65})`;
			case 'number': {
				const r = Math.round(lerp(textRgb[0], goldRgb[0], 0.2 + b * 0.35));
				const g = Math.round(lerp(textRgb[1], goldRgb[1], 0.2 + b * 0.35));
				const bl = Math.round(lerp(textRgb[2], goldRgb[2], 0.2 + b * 0.35));
				return `rgba(${r},${g},${bl},${opacity * 1.1})`;
			}
			case 'punctuation':
				return `rgba(${textRgb[0]},${textRgb[1]},${textRgb[2]},${opacity * 0.4})`;
			default: {
				if (b > 0.01) {
					const r = Math.round(lerp(textRgb[0], goldRgb[0], b * 0.25));
					const g = Math.round(lerp(textRgb[1], goldRgb[1], b * 0.25));
					const bl = Math.round(lerp(textRgb[2], goldRgb[2], b * 0.25));
					return `rgba(${r},${g},${bl},${opacity})`;
				}
				return `rgba(${textRgb[0]},${textRgb[1]},${textRgb[2]},${opacity})`;
			}
		}
	};

	// ── Draw loop ───────────────────────────────────────────
	const draw = (_time: number, deltaMs: number) => {
		const dt = Math.min(Math.max((deltaMs || 16.67) / 1000, 0.005), 0.05);
		ctx.clearRect(0, 0, width, height);

		const textRgb = getTextRgb();
		const goldRgb = getGoldRgb();
		const lineCount = lines.length;

		for (let li = 0; li < lineCount; li++) {
			const line = lines[li];
			const estWidth = line.rawLength * line.fontSize * 0.52;
			const midX = line.direction === 1
				? line.x + estWidth * 0.5
				: line.x - estWidth * 0.5;
			const midY = line.y;

			const dx = midX - mouseX;
			const dy = midY - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			let targetOpacity = line.baseOpacity;
			let targetScale = 1;
			let speedFactor = 1 + scrollBoost * (1.2 + line.depth * 1.4);
			let focusBlend = 0;

			if (dist < FOCUS_RADIUS) {
				const proximity = 1 - dist / FOCUS_RADIUS;
				const eased = proximity * proximity;
				targetOpacity = lerp(line.baseOpacity, FOCUS_OPACITY, eased);
				targetScale = lerp(1, FOCUS_SCALE, eased * 0.5);
				speedFactor *= lerp(1, FOCUS_SLOWDOWN, eased);
				focusBlend = eased;
			}

			line.currentOpacity += (targetOpacity - line.currentOpacity) * 0.09;
			line.currentScale += (targetScale - line.currentScale) * 0.1;

			line.x += line.speed * line.direction * speedFactor * dt;

			// Wrap: line exited screen
			if (line.direction === 1 && line.x > width + 100) {
				const raw = nextSourceLine();
				line.tokens = tokenize(raw);
				line.rawLength = raw.length;
				line.x = -(raw.length * line.fontSize * 0.55) - Math.random() * 300;
				line.y = Math.random() * height;
			} else if (line.direction === -1 && line.x < -(estWidth + 100)) {
				const raw = nextSourceLine();
				line.tokens = tokenize(raw);
				line.rawLength = raw.length;
				line.x = width + Math.random() * 300;
				line.y = Math.random() * height;
			}

			if (line.currentOpacity < 0.002) continue;

			ctx.save();

			const anchorX = line.direction === 1 ? line.x : line.x;
			const anchorY = line.y;

			if (line.currentScale !== 1) {
				ctx.translate(anchorX, anchorY);
				ctx.scale(line.currentScale, line.currentScale);
				ctx.translate(-anchorX, -anchorY);
			}

			ctx.font = `300 ${line.fontSize}px "JetBrains Mono", "SF Mono", "Fira Code", monospace`;
			ctx.textBaseline = 'middle';

			let cursorX = line.x;
			for (const token of line.tokens) {
				ctx.fillStyle = getTokenColor(token, textRgb, goldRgb, line.currentOpacity, focusBlend);
				ctx.fillText(token.text, cursorX, line.y);
				cursorX += ctx.measureText(token.text).width;
			}

			ctx.restore();
		}
	};

	gsap.ticker.add(draw);

	return () => {
		gsap.ticker.remove(draw);
		observer.kill();
		window.removeEventListener('resize', resize);
		window.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseleave', onMouseLeave);
		themeObserver.disconnect();
	};
};
