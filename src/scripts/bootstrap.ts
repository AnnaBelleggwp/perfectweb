import { initCodeRain } from './code-rain';
import { initHeaderOffset } from './header-offset';
import { initLenis } from './lenis';
import { initScrollSpy } from './scroll-spy';
import { initTheme } from './theme';

type CleanupFn = () => void;

export const bootstrapApp = () => {
	const cleanups: CleanupFn[] = [];
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const hasCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
	const shouldUseLenis = !reduceMotion && !hasCoarsePointer;

	document.documentElement.classList.toggle('reduce-motion', reduceMotion);

	cleanups.push(initTheme());
	cleanups.push(initHeaderOffset());
	cleanups.push(initScrollSpy());
	cleanups.push(initCodeRain({ reducedMotion: reduceMotion }));

	if (shouldUseLenis) {
		cleanups.push(initLenis());
	}

	window.addEventListener(
		'pagehide',
		() => {
			cleanups.forEach((cleanup) => cleanup());
		},
		{ once: true },
	);
};
