import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getGsap } from './gsap';

let activeLenis: Lenis | null = null;

export const getLenis = () => activeLenis;

export const initLenis = () => {
	const gsap = getGsap();
	const lenis = new Lenis({
		autoRaf: false,
		smoothWheel: true,
		syncTouch: false,
		wheelMultiplier: 1,
	});

	lenis.on('scroll', ScrollTrigger.update);

	const onTick = (time: number) => {
		lenis.raf(time * 1000);
	};

	gsap.ticker.add(onTick);
	gsap.ticker.lagSmoothing(0);
	activeLenis = lenis;

	return () => {
		activeLenis = null;
		gsap.ticker.remove(onTick);
		lenis.destroy();
	};
};
