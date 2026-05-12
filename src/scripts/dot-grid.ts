import { getGsap } from './gsap';

type Dot = {
	cx: number;
	cy: number;
	xOffset: number;
	yOffset: number;
	_inertiaApplied: boolean;
};

type DotGridOptions = {
	dotSize?: number;
	gap?: number;
	edgeTrimX?: number;
	edgeTrimY?: number;
	trimCornerDots?: boolean;
	baseColor?: string;
	activeColor?: string;
	proximity?: number;
	speedTrigger?: number;
	shockRadius?: number;
	shockStrength?: number;
	maxSpeed?: number;
	resistance?: number;
	returnDuration?: number;
};

const hexToRgb = (hex: string) => {
	const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
	if (!m) return { r: 0, g: 0, b: 0 };
	return {
		r: parseInt(m[1], 16),
		g: parseInt(m[2], 16),
		b: parseInt(m[3], 16),
	};
};

const readCssColor = (el: HTMLElement, prop: string, fallback: string) => {
	const raw = getComputedStyle(el).getPropertyValue(prop).trim();
	return raw || fallback;
};

const throttle = <A extends unknown[]>(fn: (...args: A) => void, limit: number) => {
	let last = 0;
	return (...args: A) => {
		const now = performance.now();
		if (now - last >= limit) {
			last = now;
			fn(...args);
		}
	};
};

export const initDotGrid = (wrap: HTMLElement, options: DotGridOptions = {}) => {
	const gsap = getGsap();

	const {
		dotSize = 16,
		gap = 32,
		edgeTrimX = 0,
		edgeTrimY = 0,
		trimCornerDots = false,
		baseColor,
		activeColor,
		proximity = 150,
		speedTrigger = 100,
		shockRadius = 250,
		shockStrength = 5,
		maxSpeed = 5000,
		resistance = 750,
		returnDuration = 1.5,
	} = options;

	const reduceMotion =
		document.documentElement.classList.contains('reduce-motion') ||
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const canvas = document.createElement('canvas');
	canvas.className = 'dot-grid__canvas';
	wrap.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	if (!ctx) return () => canvas.remove();

	let baseColorValue = baseColor ?? readCssColor(wrap, '--dot-base', '#2a2a2a');
	let activeColorValue = activeColor ?? readCssColor(wrap, '--dot-active', '#ffd700');
	let baseRgb = hexToRgb(baseColorValue);
	let activeRgb = hexToRgb(activeColorValue);

	const syncColors = () => {
		if (!baseColor) {
			baseColorValue = readCssColor(wrap, '--dot-base', '#2a2a2a');
			baseRgb = hexToRgb(baseColorValue);
		}
		if (!activeColor) {
			activeColorValue = readCssColor(wrap, '--dot-active', '#ffd700');
			activeRgb = hexToRgb(activeColorValue);
		}
	};

	const proxSq = proximity * proximity;

	const circlePath = typeof Path2D !== 'undefined' ? new Path2D() : null;
	circlePath?.arc(0, 0, dotSize / 2, 0, Math.PI * 2);

	const dots: Dot[] = [];
	const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lastTime: 0, lastX: 0, lastY: 0 };

	const buildGrid = () => {
		syncColors();

		const { width, height } = wrap.getBoundingClientRect();
		if (!width || !height) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(dpr, dpr);

		const rawCols = Math.floor((width + gap) / (dotSize + gap));
		const rawRows = Math.floor((height + gap) / (dotSize + gap));
		const cols = Math.max(1, rawCols - edgeTrimX * 2);
		const rows = Math.max(1, rawRows - edgeTrimY * 2);
		const cell = dotSize + gap;

		const gridW = cell * cols - gap;
		const gridH = cell * rows - gap;
		const startX = (width - gridW) / 2 + dotSize / 2;
		const startY = (height - gridH) / 2 + dotSize / 2;

		dots.length = 0;
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const isCorner =
					(y === 0 || y === rows - 1) &&
					(x === 0 || x === cols - 1);
				if (trimCornerDots && isCorner) continue;

				dots.push({
					cx: startX + x * cell,
					cy: startY + y * cell,
					xOffset: 0,
					yOffset: 0,
					_inertiaApplied: false,
				});
			}
		}
	};

	const refreshGrid = () => {
		syncColors();
		buildGrid();
	};

	let rafId = 0;
	const draw = () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const { x: px, y: py } = pointer;

		for (const dot of dots) {
			const ox = dot.cx + dot.xOffset;
			const oy = dot.cy + dot.yOffset;
			const dx = dot.cx - px;
			const dy = dot.cy - py;
			const dsq = dx * dx + dy * dy;

			let fill = baseColorValue;
			if (dsq <= proxSq) {
				const t = 1 - Math.sqrt(dsq) / proximity;
				const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
				const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
				const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
				fill = `rgb(${r},${g},${b})`;
			}

			ctx.save();
			ctx.translate(ox, oy);
			ctx.fillStyle = fill;
			if (circlePath) {
				ctx.fill(circlePath);
			} else {
				ctx.beginPath();
				ctx.arc(0, 0, dotSize / 2, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}

		rafId = requestAnimationFrame(draw);
	};

	const onMove = (e: MouseEvent) => {
		const now = performance.now();
		const dt = pointer.lastTime ? now - pointer.lastTime : 16;
		const dx = e.clientX - pointer.lastX;
		const dy = e.clientY - pointer.lastY;
		let vx = (dx / dt) * 1000;
		let vy = (dy / dt) * 1000;
		let speed = Math.hypot(vx, vy);
		if (speed > maxSpeed) {
			const scale = maxSpeed / speed;
			vx *= scale;
			vy *= scale;
			speed = maxSpeed;
		}
		pointer.lastTime = now;
		pointer.lastX = e.clientX;
		pointer.lastY = e.clientY;
		pointer.vx = vx;
		pointer.vy = vy;
		pointer.speed = speed;

		const rect = canvas.getBoundingClientRect();
		pointer.x = e.clientX - rect.left;
		pointer.y = e.clientY - rect.top;

		if (reduceMotion) return;

		for (const dot of dots) {
			const dist = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);
			if (speed > speedTrigger && dist < proximity && !dot._inertiaApplied) {
				dot._inertiaApplied = true;
				gsap.killTweensOf(dot);
				const pushX = dot.cx - pointer.x + vx * 0.005;
				const pushY = dot.cy - pointer.y + vy * 0.005;
				gsap.to(dot, {
					inertia: { xOffset: pushX, yOffset: pushY, resistance },
					onComplete: () => {
						gsap.to(dot, {
							xOffset: 0,
							yOffset: 0,
							duration: returnDuration,
							ease: 'elastic.out(1,0.75)',
						});
						dot._inertiaApplied = false;
					},
				});
			}
		}
	};

	const onClick = (e: MouseEvent) => {
		if (reduceMotion) return;
		const rect = canvas.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;
		if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return;

		for (const dot of dots) {
			const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
			if (dist < shockRadius && !dot._inertiaApplied) {
				dot._inertiaApplied = true;
				gsap.killTweensOf(dot);
				const falloff = Math.max(0, 1 - dist / shockRadius);
				const pushX = (dot.cx - cx) * shockStrength * falloff;
				const pushY = (dot.cy - cy) * shockStrength * falloff;
				gsap.to(dot, {
					inertia: { xOffset: pushX, yOffset: pushY, resistance },
					onComplete: () => {
						gsap.to(dot, {
							xOffset: 0,
							yOffset: 0,
							duration: returnDuration,
							ease: 'elastic.out(1,0.75)',
						});
						dot._inertiaApplied = false;
					},
				});
			}
		}
	};

	refreshGrid();
	rafId = requestAnimationFrame(draw);

	const ro = 'ResizeObserver' in window ? new ResizeObserver(() => refreshGrid()) : null;
	ro?.observe(wrap);
	if (!ro) window.addEventListener('resize', refreshGrid);

	const lateRefreshId = requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			refreshGrid();
		});
	});

	const onLoad = () => refreshGrid();
	window.addEventListener('load', onLoad);

	const fonts = 'fonts' in document ? document.fonts : null;
	const onFontsReady = () => refreshGrid();
	fonts?.ready.then(onFontsReady).catch(() => {
		// Ignore font readiness failures and keep the current grid.
	});

	const throttledMove = throttle(onMove, 50);
	window.addEventListener('mousemove', throttledMove, { passive: true });
	window.addEventListener('click', onClick);
	window.addEventListener('themechange', syncColors);

	return () => {
		cancelAnimationFrame(rafId);
		cancelAnimationFrame(lateRefreshId);
		ro?.disconnect();
		if (!ro) window.removeEventListener('resize', refreshGrid);
		window.removeEventListener('load', onLoad);
		window.removeEventListener('mousemove', throttledMove);
		window.removeEventListener('click', onClick);
		window.removeEventListener('themechange', syncColors);
		gsap.killTweensOf(dots);
		canvas.remove();
	};
};
