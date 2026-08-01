export type Theme = 'light' | 'dark';

// Светлая тема отключена: сайт всегда тёмный. Системная схема и localStorage
// больше не опрашиваются, переключателя нет. CSS-правила :root[data-theme="light"]
// оставлены в компонентах — селектор просто не срабатывает.
const THEME: Theme = 'dark';

export const getTheme = (): Theme => THEME;

export const setTheme = (_theme: Theme) => {
	/* тема зафиксирована */
};

export const toggleTheme = () => {
	/* тема зафиксирована */
};

export const initTheme = () => {
	document.documentElement.setAttribute('data-theme', THEME);
	window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: THEME }));
	return () => {};
};
