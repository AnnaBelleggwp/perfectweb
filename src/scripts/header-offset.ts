import { ScrollTrigger, getGsap } from './gsap';

const HEADER_HEIGHT_VAR = '--header-height';

export const initHeaderOffset = () => {
	getGsap();

	const header = document.querySelector<HTMLElement>('.page-header');
	if (!header) {
		return () => {};
	}

	const root = document.documentElement;
	let lastHeight = -1;
	let refreshFrame: number | null = null;

	const scheduleRefresh = () => {
		if (refreshFrame !== null) return;
		refreshFrame = window.requestAnimationFrame(() => {
			refreshFrame = null;
			ScrollTrigger.refresh();
		});
	};

	const applyOffset = () => {
		const nextHeight = Math.ceil(header.getBoundingClientRect().height);
		if (nextHeight === lastHeight) return;

		lastHeight = nextHeight;
		root.style.setProperty(HEADER_HEIGHT_VAR, `${nextHeight}px`);
		scheduleRefresh();
	};

	applyOffset();

	let resizeObserver: ResizeObserver | null = null;
	if ('ResizeObserver' in window) {
		resizeObserver = new ResizeObserver(() => applyOffset());
		resizeObserver.observe(header);
	}

	window.addEventListener('resize', applyOffset);
	window.addEventListener('orientationchange', applyOffset);

	return () => {
		if (refreshFrame !== null) {
			window.cancelAnimationFrame(refreshFrame);
			refreshFrame = null;
		}
		resizeObserver?.disconnect();
		window.removeEventListener('resize', applyOffset);
		window.removeEventListener('orientationchange', applyOffset);
	};
};
