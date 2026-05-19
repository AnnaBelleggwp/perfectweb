import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let isRegistered = false;

export const getGsap = () => {
	if (!isRegistered) {
		gsap.registerPlugin(ScrollTrigger, Observer);
		ScrollTrigger.config({ ignoreMobileResize: true });
		isRegistered = true;
	}

	return gsap;
};

export { Observer, ScrollTrigger };
