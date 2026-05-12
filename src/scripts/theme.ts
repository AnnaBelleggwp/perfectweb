export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const getInitialTheme = (): Theme => {
	const attr = document.documentElement.getAttribute('data-theme');
	if (attr === 'light' || attr === 'dark') return attr;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch (_) {
		/* ignore */
	}
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme: Theme) => {
	document.documentElement.setAttribute('data-theme', theme);
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch (_) {
		/* ignore */
	}
	window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: theme }));
};

export const getTheme = (): Theme => getInitialTheme();

export const setTheme = (theme: Theme) => applyTheme(theme);

export const toggleTheme = () => applyTheme(getTheme() === 'light' ? 'dark' : 'light');

export const initTheme = () => {
	const current = getInitialTheme();
	document.documentElement.setAttribute('data-theme', current);

	const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
	const syncButtons = () => {
		const theme = getTheme();
		buttons.forEach((button) => {
			button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
			button.setAttribute(
				'aria-label',
				theme === 'light' ? 'переключить на тёмную тему' : 'переключить на светлую тему',
			);
			button.dataset.themeState = theme;
		});
	};

	const onClick = () => toggleTheme();
	buttons.forEach((button) => button.addEventListener('click', onClick));

	window.addEventListener('themechange', syncButtons);
	syncButtons();

	const media = window.matchMedia('(prefers-color-scheme: light)');
	const onSystemChange = (event: MediaQueryListEvent) => {
		try {
			if (localStorage.getItem(STORAGE_KEY)) return;
		} catch (_) {
			/* ignore */
		}
		applyTheme(event.matches ? 'light' : 'dark');
	};
	media.addEventListener('change', onSystemChange);

	return () => {
		buttons.forEach((button) => button.removeEventListener('click', onClick));
		window.removeEventListener('themechange', syncButtons);
		media.removeEventListener('change', onSystemChange);
	};
};
