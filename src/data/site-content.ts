export type AboutStat = {
	value: number;
	suffix: string;
	label: string;
};

export type AboutSegment = {
	text: string;
	accent: boolean;
};

export type AboutContent = {
	title: string;
	bodyMarkup: string;
	approach: string;
	stack: string[];
	stats: AboutStat[];
};

export type ServiceContent = {
	id: string;
	label: string;
	desc: string;
	items: string[];
};

export type PortfolioMediaFormat = 'webp' | 'jpeg' | 'png' | 'avif';

export type PortfolioMediaVariant = {
	url: string;
	width: number;
	height: number;
	format: PortfolioMediaFormat;
};

export type PortfolioMedia = {
	assetId: string;
	alt: string;
	width: number;
	height: number;
	originalUrl: string;
	variants: PortfolioMediaVariant[];
	blurDataUrl?: string;
};

export type PortfolioItem = {
	id: string;
	colSpan: number;
	rowSpan: number;
	hue: number;
	animDur: number;
	category: string;
	title: string;
	client: string;
	description: string;
	tags: string[];
	year: number;
	duration: string;
	liveUrl: string;
	caseUrl: string;
	preview: PortfolioMedia | null;
	detail: PortfolioMedia | null;
	mockup: PortfolioMedia | null;
	logo: string;
	published: boolean;
};

export type SiteContent = {
	about: AboutContent;
	services: ServiceContent[];
	portfolio: PortfolioItem[];
};

const DEFAULT_ABOUT: AboutContent = {
	title: 'Рад знакомству!',
	bodyMarkup:
		'Привет! Я веб-разработчик и UI/UX-дизайнер. Делаю сайты и веб-сервисы для бизнеса [[«под ключ»]]: от структуры и визуала до [[backend-логики, админки и интеграций]]. Работаю с: [[Astro, HTML5, CSS3, JavaScript (ES6+), TypeScript, PHP, Node.js, React]], а также [[REST API, JSON, Webhook, SMTP, SQL базы данных]].',
	approach:
		'текст о принципах и подходе к работе — коротко и по делу. финальная версия после согласования контента.',
	stack: ['Figma', 'Astro', 'React', 'TypeScript', 'GSAP', 'Tailwind', 'Webflow'],
	stats: [
		{ value: 6, suffix: '', label: 'лет в разработке' },
	],
};

const DEFAULT_SERVICES: ServiceContent[] = [
	{
		id: 'design',
		label: 'веб-дизайн',
		desc: 'проектирую интерфейсы с нуля — от вайрфреймов до финального ui. фокус на визуальной иерархии, читаемости и деталях которые замечают не сразу.',
		items: ['ui/ux дизайн', 'figma', 'прототипирование', 'дизайн-система', 'адаптив'],
	},
	{
		id: 'dev',
		label: 'разработка',
		desc: 'верстаю и собираю сайты на современном стеке. код чистый, компоненты переиспользуемые, производительность на первом месте.',
		items: ['astro', 'react', 'typescript', 'tailwind', 'seo'],
	},
	{
		id: 'motion',
		label: 'анимация',
		desc: 'добавляю движение которое усиливает смысл, а не отвлекает. scroll-триггеры, микровзаимодействия, плавные переходы между состояниями.',
		items: ['gsap', 'scroll-анимации', 'lenis', 'svg-анимация', 'микровзаимодействия'],
	},
	{
		id: 'webflow',
		label: 'webflow',
		desc: 'собираю сайты в webflow с полноценными анимациями и cms. заказчик редактирует контент сам — без разработчика и без риска сломать верстку.',
		items: ['webflow cms', 'interactions', 'e-commerce', 'интеграции', 'обучение'],
	},
];

const DEFAULT_PORTFOLIO: PortfolioItem[] = [
	{
		id: 'portfolio-1',
		colSpan: 2,
		rowSpan: 2,
		hue: 214,
		animDur: 4,
		category: 'корпоративный сайт',
		title: 'название первого',
		client: 'клиент / индустрия',
		description: '',
		tags: [],
		year: 2024,
		duration: '6 недель',
		liveUrl: '#',
		caseUrl: '#',
		preview: null,
		detail: null,
		mockup: null,
		logo: '/logos/mervis.svg',
		published: true,
	},
	{
		id: 'portfolio-2',
		colSpan: 1,
		rowSpan: 1,
		hue: 268,
		animDur: 3,
		category: 'интернет-магазин',
		title: 'название второго',
		client: 'клиент / индустрия',
		description: '',
		tags: ['TypeScript', 'Tailwind', 'Stripe'],
		year: 2024,
		duration: '8 недель',
		liveUrl: '#',
		caseUrl: '#',
		preview: null,
		detail: null,
		mockup: null,
		logo: '',
		published: true,
	},
	{
		id: 'portfolio-3',
		colSpan: 1,
		rowSpan: 1,
		hue: 152,
		animDur: 2.5,
		category: 'лендинг',
		title: 'название третьего',
		client: 'клиент / индустрия',
		description: '',
		tags: ['Astro', 'GSAP', 'Figma'],
		year: 2023,
		duration: '3 недели',
		liveUrl: '#',
		caseUrl: '#',
		preview: null,
		detail: null,
		mockup: null,
		logo: '',
		published: true,
	},
	{
		id: 'portfolio-4',
		colSpan: 2,
		rowSpan: 1,
		hue: 328,
		animDur: 3.5,
		category: 'веб-приложение',
		title: 'название четвёртого',
		client: 'клиент / индустрия',
		description: '',
		tags: ['React', 'Node.js', 'PostgreSQL'],
		year: 2023,
		duration: '12 недель',
		liveUrl: '#',
		caseUrl: '#',
		preview: null,
		detail: null,
		mockup: null,
		logo: '',
		published: true,
	},
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
	about: DEFAULT_ABOUT,
	services: DEFAULT_SERVICES,
	portfolio: DEFAULT_PORTFOLIO,
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const sanitizeText = (value: unknown, fallback: string, max = 1200) => {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	if (!trimmed) return fallback;
	return trimmed.slice(0, max);
};

const sanitizeArray = (value: unknown, fallback: string[], maxLen = 20, itemMax = 80) => {
	if (!Array.isArray(value)) return fallback;
	const next = value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, maxLen)
		.map((item) => item.slice(0, itemMax));
	return next.length ? next : fallback;
};

const sanitizeUrl = (value: unknown, fallback: string, max = 500) => {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	if (!trimmed) return fallback;
	if (!trimmed.startsWith('/') && !trimmed.startsWith('http')) return fallback;
	return trimmed.slice(0, max);
};

const sanitizeInt = (value: unknown, fallback: number, min: number, max: number) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.max(min, Math.min(max, Math.round(num)));
};

const sanitizeFloat = (value: unknown, fallback: number, min: number, max: number) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.max(min, Math.min(max, Number(num.toFixed(2))));
};

const sanitizeBool = (value: unknown, fallback: boolean) =>
	typeof value === 'boolean' ? value : fallback;

const sanitizeStat = (value: unknown, fallback: AboutStat): AboutStat => {
	const record = asRecord(value);
	if (!record) return fallback;

	const rawNumber = Number(record.value);
	const safeValue = Number.isFinite(rawNumber) ? Math.max(0, Math.min(9999, Math.round(rawNumber))) : fallback.value;

	return {
		value: safeValue,
		suffix: sanitizeText(record.suffix, fallback.suffix, 4),
		label: sanitizeText(record.label, fallback.label, 80),
	};
};

const toSlug = (value: string, index: number, prefix = 'item') => {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9а-яё]+/giu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	return slug || `${prefix}-${index + 1}`;
};

export const parseAccentMarkup = (markup: string): AboutSegment[] => {
	const result: AboutSegment[] = [];
	const pattern = /\[\[(.+?)\]\]/gs;
	let lastIndex = 0;

	for (const match of markup.matchAll(pattern)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;

		if (start > lastIndex) {
			result.push({ text: markup.slice(lastIndex, start), accent: false });
		}

		result.push({ text: match[1], accent: true });
		lastIndex = end;
	}

	if (lastIndex < markup.length) {
		result.push({ text: markup.slice(lastIndex), accent: false });
	}

	if (!result.length) {
		return [{ text: markup, accent: false }];
	}

	return result.filter((part) => part.text.length > 0);
};

const sanitizeServices = (value: unknown): ServiceContent[] => {
	if (!Array.isArray(value)) {
		return DEFAULT_SERVICES;
	}

	const usedIds = new Set<string>();
	const next = value
		.slice(0, 20)
		.map((item, index) => {
			const record = asRecord(item);
			const fallback = DEFAULT_SERVICES[index % DEFAULT_SERVICES.length];
			if (!record) {
				return {
					...fallback,
					id: `service-${index + 1}`,
				};
			}

			const label = sanitizeText(record.label, fallback.label, 90);
			const idSeed = sanitizeText(record.id, toSlug(label, index, 'service'), 40);
			let id = toSlug(idSeed, index, 'service');
			while (usedIds.has(id)) {
				id = `${id}-${index + 1}`;
			}
			usedIds.add(id);

			return {
				id,
				label,
				desc: sanitizeText(record.desc, fallback.desc, 1200),
				items: sanitizeArray(record.items, fallback.items, 14, 48),
			};
		})
		.filter(Boolean) as ServiceContent[];

	return next.length ? next : DEFAULT_SERVICES;
};

const sanitizeMediaVariant = (value: unknown, fallback: PortfolioMediaVariant | null): PortfolioMediaVariant | null => {
	const record = asRecord(value);
	if (!record) return fallback;

	const formatRaw = sanitizeText(record.format, fallback?.format ?? 'webp', 8).toLowerCase();
	const format: PortfolioMediaFormat =
		formatRaw === 'avif' || formatRaw === 'jpeg' || formatRaw === 'png' || formatRaw === 'webp'
			? formatRaw
			: (fallback?.format ?? 'webp');

	return {
		url: sanitizeUrl(record.url, fallback?.url ?? ''),
		width: sanitizeInt(record.width, fallback?.width ?? 1200, 1, 8000),
		height: sanitizeInt(record.height, fallback?.height ?? 800, 1, 8000),
		format,
	};
};

const sanitizeMedia = (value: unknown): PortfolioMedia | null => {
	const record = asRecord(value);
	if (!record) return null;

	const assetId = sanitizeText(record.assetId, '', 80);
	const originalUrl = sanitizeUrl(record.originalUrl, '');
	if (!assetId || !originalUrl) return null;

	const variantsRaw = Array.isArray(record.variants) ? record.variants : [];
	const variants = variantsRaw
		.map((variant) => sanitizeMediaVariant(variant, null))
		.filter((variant): variant is PortfolioMediaVariant => Boolean(variant && variant.url));

	const blur = typeof record.blurDataUrl === 'string' ? record.blurDataUrl.slice(0, 5000) : undefined;

	return {
		assetId,
		alt: sanitizeText(record.alt, '', 160),
		width: sanitizeInt(record.width, 1200, 1, 8000),
		height: sanitizeInt(record.height, 800, 1, 8000),
		originalUrl,
		variants,
		...(blur ? { blurDataUrl: blur } : {}),
	};
};

const sanitizePortfolio = (value: unknown): PortfolioItem[] => {
	if (!Array.isArray(value)) {
		return DEFAULT_PORTFOLIO;
	}

	const usedIds = new Set<string>();
	const next = value
		.slice(0, 40)
		.map((item, index) => {
			const record = asRecord(item);
			const fallback = DEFAULT_PORTFOLIO[index % DEFAULT_PORTFOLIO.length];
			if (!record) {
				return {
					...fallback,
					id: `portfolio-${index + 1}`,
				};
			}

			const title = sanitizeText(record.title, fallback.title, 140);
			const idSeed = sanitizeText(record.id, toSlug(title, index, 'portfolio'), 50);
			let id = toSlug(idSeed, index, 'portfolio');
			while (usedIds.has(id)) {
				id = `${id}-${index + 1}`;
			}
			usedIds.add(id);

			return {
				id,
				colSpan: sanitizeInt(record.colSpan, fallback.colSpan, 1, 4),
				rowSpan: sanitizeInt(record.rowSpan, fallback.rowSpan, 1, 4),
				hue: sanitizeInt(record.hue, fallback.hue, 0, 360),
				animDur: sanitizeFloat(record.animDur, fallback.animDur, 0.5, 12),
				category: sanitizeText(record.category, fallback.category, 120),
				title,
				client: sanitizeText(record.client, fallback.client, 160),
				description: sanitizeText(record.description, fallback.description, 1600),
				tags: sanitizeArray(record.tags, fallback.tags, 24, 60),
				year: sanitizeInt(record.year, fallback.year, 2000, 2100),
				duration: sanitizeText(record.duration, fallback.duration, 120),
				liveUrl: sanitizeUrl(record.liveUrl, fallback.liveUrl, 500),
				caseUrl: sanitizeUrl(record.caseUrl, fallback.caseUrl, 500),
				preview: sanitizeMedia(record.preview),
				detail: sanitizeMedia(record.detail),
				mockup: sanitizeMedia(record.mockup),
				logo: sanitizeText(record.logo, fallback.logo, 500),
				published: sanitizeBool(record.published, true),
			};
		})
		.filter(Boolean) as PortfolioItem[];

	return next.length ? next : DEFAULT_PORTFOLIO;
};

export const normalizeSiteContent = (value: unknown): SiteContent => {
	const root = asRecord(value);
	if (!root) {
		return DEFAULT_SITE_CONTENT;
	}

	const aboutRecord = asRecord(root.about) ?? {};
	const aboutStatsRaw = Array.isArray(aboutRecord.stats) ? aboutRecord.stats : DEFAULT_ABOUT.stats;
	const stats = aboutStatsRaw
		.slice(0, 6)
		.map((stat, index) => sanitizeStat(stat, DEFAULT_ABOUT.stats[index % DEFAULT_ABOUT.stats.length]))
		.filter(Boolean);

	return {
		about: {
			title: sanitizeText(aboutRecord.title, DEFAULT_ABOUT.title, 120),
			bodyMarkup: sanitizeText(aboutRecord.bodyMarkup, DEFAULT_ABOUT.bodyMarkup, 4000),
			approach: sanitizeText(aboutRecord.approach, DEFAULT_ABOUT.approach, 1200),
			stack: sanitizeArray(aboutRecord.stack, DEFAULT_ABOUT.stack, 20, 48),
			stats: stats.length ? stats : DEFAULT_ABOUT.stats,
		},
		services: sanitizeServices(root.services),
		portfolio: sanitizePortfolio(root.portfolio),
	};
};
