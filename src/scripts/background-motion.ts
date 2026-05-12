import type { Observer as ObserverType } from 'gsap/Observer';
import { Observer, getGsap } from './gsap';

interface BackgroundMotionOptions {
	reducedMotion?: boolean;
}

interface ShapeState {
	shape: SVGGElement;
	x: number;
	y: number;
	scale: number;
	width: number;
	height: number;
	depth: number;
	vx: number;
	vy: number;
	frameSpeedFactor: number;
	frameVelocityX: number;
	frameVelocityY: number;
	speedBoost: { value: number };
	burst: { x: number; y: number };
	setSpeedBoost: (value: number) => void;
	setBurstX: (value: number) => void;
	setBurstY: (value: number) => void;
}

const FALLBACK_VIEWBOX = { width: 1440, height: 1320 };
const BASE_SPEED_MIN = 14;
const BASE_SPEED_MAX = 82;
const WRAP_PADDING = 260;

const randomSign = () => (Math.random() > 0.5 ? 1 : -1);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const parseNumber = (value: string | null | undefined, fallback: number) => {
	if (!value) return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

// ─── Motion ───────────────────────────────────────────────────────────────────

const wrapShape = (state: ShapeState, bounds: { width: number; height: number }) => {
	if (state.x > bounds.width + WRAP_PADDING)  state.x = -state.width - WRAP_PADDING;
	if (state.x + state.width < -WRAP_PADDING)  state.x = bounds.width + WRAP_PADDING;
	if (state.y > bounds.height + WRAP_PADDING) state.y = -state.height - WRAP_PADDING;
	if (state.y + state.height < -WRAP_PADDING) state.y = bounds.height + WRAP_PADDING;
};

const enforceBaseSpeed = (state: ShapeState) => {
	const speed = Math.hypot(state.vx, state.vy);
	if (speed < 0.0001) {
		const angle = Math.random() * Math.PI * 2;
		state.vx = Math.cos(angle) * BASE_SPEED_MIN;
		state.vy = Math.sin(angle) * BASE_SPEED_MIN;
		return;
	}
	if (speed < BASE_SPEED_MIN) {
		const r = BASE_SPEED_MIN / speed;
		state.vx *= r; state.vy *= r;
	} else if (speed > BASE_SPEED_MAX) {
		const r = BASE_SPEED_MAX / speed;
		state.vx *= r; state.vy *= r;
	}
};

const syncFrameVelocityToBase = (state: ShapeState) => {
	const f = Math.max(state.frameSpeedFactor, 0.01);
	state.vx = clamp((state.frameVelocityX - state.burst.x) / f, -BASE_SPEED_MAX, BASE_SPEED_MAX);
	state.vy = clamp((state.frameVelocityY - state.burst.y) / f, -BASE_SPEED_MAX, BASE_SPEED_MAX);
	enforceBaseSpeed(state);
};

export const initBackgroundMotion = ({
	reducedMotion = false,
}: BackgroundMotionOptions = {}) => {
	if (reducedMotion) return () => {};

	const gsap = getGsap();
	const allShapeEls = gsap.utils.toArray<SVGGElement>('[data-floating-shape]');
	const svgRoot = document.querySelector<SVGSVGElement>('.background-layer svg');

	if (!allShapeEls.length || !svgRoot) return () => {};

	// Reduce shape count on mobile to ease GPU load
	const isMobile = window.matchMedia('(max-width: 767px)').matches;
	const shapeEls = isMobile ? allShapeEls.slice(0, 14) : allShapeEls;

	// Hide unused shapes on mobile
	if (isMobile) {
		allShapeEls.slice(14).forEach(el => { el.style.display = 'none'; });
	}

	const viewBox = svgRoot.viewBox.baseVal;
	const bounds = {
		width: viewBox?.width || FALLBACK_VIEWBOX.width,
		height: viewBox?.height || FALLBACK_VIEWBOX.height,
	};

	const scrollBoost = { value: 0 };
	const setScrollBoost = gsap.quickTo(scrollBoost, 'value', {
		duration: 1,
		ease: 'power2.out',
	});
	const delayedCalls: gsap.core.Tween[] = [];

	const shapeStates: ShapeState[] = shapeEls.map((shape, index) => {
		const dataX = parseNumber(shape.dataset.x, 0);
		const dataY = parseNumber(shape.dataset.y, 0);
		const dataScale = parseNumber(shape.dataset.scale, 1);
		const depth = parseNumber(shape.dataset.depth, 0.6);
		const useNode = shape.querySelector<SVGUseElement>('use');
		const baseWidth = parseNumber(useNode?.getAttribute('width'), 240);
		const baseHeight = parseNumber(useNode?.getAttribute('height'), 240);
		const width = baseWidth * dataScale;
		const height = baseHeight * dataScale;

		const angleBase = index % 2 === 0 ? 0 : Math.PI;
		const angle = angleBase + gsap.utils.random(-0.92, 0.92, 0.01);
		const baseSpeed = gsap.utils.mapRange(0.4, 0.85, 22, 42, depth);

		const speedBoost = { value: 1 };
		const burst = { x: 0, y: 0 };

		const state: ShapeState = {
			shape,
			x: dataX, y: dataY,
			scale: dataScale, width, height, depth,
			vx: Math.cos(angle) * baseSpeed,
			vy: Math.sin(angle) * baseSpeed * 0.88,
			frameSpeedFactor: 1,
			frameVelocityX: 0,
			frameVelocityY: 0,
			speedBoost, burst,
			setSpeedBoost: gsap.quickTo(speedBoost, 'value', {
				duration: 1.2,
				ease: 'power2.out',
			}),
			setBurstX: gsap.quickTo(burst, 'x', {
				duration: 1.15,
				ease: 'power3.out',
			}),
			setBurstY: gsap.quickTo(burst, 'y', {
				duration: 1.15,
				ease: 'power3.out',
			}),
		};

		enforceBaseSpeed(state);
		shape.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.scale})`);
		return state;
	});

	const scheduleBurst = (state: ShapeState) => {
		const launchCall = gsap.delayedCall(gsap.utils.random(5, 10, 0.1), () => {
			const burstPowerX = gsap.utils.random(20, 52, 0.1) * state.depth * randomSign();
			const burstPowerY = gsap.utils.random(14, 42, 0.1) * state.depth * randomSign();
			const burstSpeed = gsap.utils.random(1.15, 1.48, 0.01);

			state.setBurstX(burstPowerX);
			state.setBurstY(burstPowerY);
			state.setSpeedBoost(burstSpeed);

			const settleCall = gsap.delayedCall(gsap.utils.random(1.5, 2.6, 0.1), () => {
				state.setBurstX(0);
				state.setBurstY(0);
				state.setSpeedBoost(1);
			});

			delayedCalls.push(settleCall);
			scheduleBurst(state);
		});
		delayedCalls.push(launchCall);
	};

	shapeStates.forEach((state) => scheduleBurst(state));

	const observer: ObserverType = Observer.create({
		target: window,
		type: 'wheel,touch,scroll,pointer',
		onChangeY: (self) => {
			const normalizedVelocity = Math.min(Math.abs(self.velocityY), 3200) / 1200;
			setScrollBoost(normalizedVelocity);
		},
		onStop: () => setScrollBoost(0),
		onStopDelay: 0.1,
	});

	const applyMotion = (_time: number, deltaMs: number) => {
		const dt = Math.min(Math.max((deltaMs || 16.67) / 1000, 0.006), 0.05);

		for (const state of shapeStates) {
			const speedFactor = state.speedBoost.value * (1 + scrollBoost.value * 1.12);
			state.frameSpeedFactor = Math.max(speedFactor, 0.01);
			state.frameVelocityX = state.vx * state.frameSpeedFactor + state.burst.x;
			state.frameVelocityY = state.vy * state.frameSpeedFactor + state.burst.y;
			state.x += state.frameVelocityX * dt;
			state.y += state.frameVelocityY * dt;
			wrapShape(state, bounds);
			syncFrameVelocityToBase(state);
			state.shape.setAttribute(
				'transform',
				`translate(${state.x.toFixed(2)} ${state.y.toFixed(2)}) scale(${state.scale})`,
			);
		}
	};

	gsap.ticker.add(applyMotion);

	return () => {
		observer.kill();
		delayedCalls.forEach((call) => call.kill());
		gsap.ticker.remove(applyMotion);
	};
};
