import gsap from 'gsap';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let isRegistered = false;

export const getGsap = () => {
	if (!isRegistered) {
		gsap.registerPlugin(ScrollTrigger, Observer, InertiaPlugin);
		ScrollTrigger.config({ ignoreMobileResize: true });
		isRegistered = true;
	}

	return gsap;
};

export { InertiaPlugin, Observer, ScrollTrigger };
