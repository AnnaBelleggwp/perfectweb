import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import { ScrollTrigger, getGsap } from './gsap';
import { getLenis } from './lenis';

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const initScrollSpy = () => {
	const gsap = getGsap();

	const links = Array.from(
		document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'),
	);

	if (!links.length) {
		return () => {};
	}

	const triggers: ScrollTriggerType[] = [];
	const linkClickCleanups: Array<() => void> = [];
	const tweenState = { y: window.scrollY };

	links.forEach((link) => {
		const hash = link.getAttribute('href');
		if (!hash?.startsWith('#')) {
			return;
		}

		const section = document.querySelector<HTMLElement>(hash);
		const labels = Array.from(
			link.querySelectorAll<HTMLElement>('[data-nav-label]'),
		);

		if (!section || !labels.length) {
			return;
		}

		const mark = section.querySelector<HTMLElement>('.section-mark');
		const readOffset = () => {
			const rootStyles = window.getComputedStyle(document.documentElement);
			const headerHeight = parseFloat(rootStyles.getPropertyValue('--header-height')) || 0;
			const headerGap = parseFloat(rootStyles.getPropertyValue('--header-gap')) || 0;
			return headerHeight + headerGap;
		};
		const scrollToSection = () => {
			const targetTop = Math.max(
				0,
				window.scrollY + section.getBoundingClientRect().top - readOffset(),
			);

			const lenis = getLenis();
			if (lenis) {
				lenis.scrollTo(targetTop, {
					duration: 0.48,
					easing: (t: number) => 1 - Math.pow(1 - t, 3),
				});
				return;
			}

			gsap.killTweensOf(tweenState);
			tweenState.y = window.scrollY;
			gsap.to(tweenState, {
				y: targetTop,
				duration: 0.48,
				ease: 'power3.out',
				overwrite: true,
				onUpdate: () => {
					window.scrollTo(0, tweenState.y);
				},
			});
		};

		const setFill = (progress: number) => {
			const fillValue = `${Math.round(clamp(progress, 0, 1) * 100)}%`;
			labels.forEach((label) => label.style.setProperty('--nav-fill', fillValue));
		};

		setFill(0);

		const trigger = ScrollTrigger.create({
			trigger: section,
			start: 'top center',
			end: 'bottom center',
			scrub: true,
			onUpdate: (self) => {
				setFill(self.progress);
			},
			onToggle: (self) => {
				link.classList.toggle('is-active', self.isActive);
				mark?.classList.toggle('is-active', self.isActive);
			},
		});

		triggers.push(trigger);

		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

			event.preventDefault();
			scrollToSection();

			if (window.location.hash !== hash) {
				window.history.pushState(null, '', hash);
			}
		};

		link.addEventListener('click', onClick);
		linkClickCleanups.push(() => link.removeEventListener('click', onClick));
	});

	ScrollTrigger.refresh();

	return () => {
		linkClickCleanups.forEach((cleanup) => cleanup());
		gsap.killTweensOf(tweenState);
		triggers.forEach((trigger) => trigger.kill());
	};
};
