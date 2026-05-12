export interface Project {
	id: string;
	title: string;
	category: string;
	client: string;
	description: string;
	tags: string[];
	metric?: { label: string; value: string };
	year: number;
	duration: string;
	liveUrl: string;
	caseUrl: string;
	mockup: { type: 'image' | 'video'; src: string; alt: string };
}

export const projects: Project[] = [
	{
		id: 'project-1',
		title: 'название первого',
		category: 'корпоративный сайт',
		client: 'клиент / индустрия',
		description:
			'краткое описание задачи и решения. финальный текст после согласования контента.',
		tags: ['React', 'Figma', 'Next.js'],
		year: 2024,
		duration: '6 недель',
		liveUrl: '#',
		caseUrl: '#',
		mockup: { type: 'image', src: '', alt: '' },
	},
	{
		id: 'project-2',
		title: 'название второго',
		category: 'интернет-магазин',
		client: 'клиент / индустрия',
		description:
			'краткое описание задачи и решения. финальный текст после согласования контента.',
		tags: ['TypeScript', 'Tailwind', 'Stripe'],
		year: 2024,
		duration: '8 недель',
		liveUrl: '#',
		caseUrl: '#',
		mockup: { type: 'image', src: '', alt: '' },
	},
	{
		id: 'project-3',
		title: 'название третьего',
		category: 'лендинг',
		client: 'клиент / индустрия',
		description:
			'краткое описание задачи и решения. финальный текст после согласования контента.',
		tags: ['Astro', 'GSAP', 'Figma'],
		year: 2023,
		duration: '3 недели',
		liveUrl: '#',
		caseUrl: '#',
		mockup: { type: 'image', src: '', alt: '' },
	},
];
