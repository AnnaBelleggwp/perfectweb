import {
	DEFAULT_SITE_CONTENT,
	normalizeSiteContent,
	type PortfolioItem,
	type PortfolioMedia,
	type SiteContent,
} from '../data/site-content';

const API_URL = '/api/cms/content.json';
const MEDIA_UPLOAD_URL = '/api/cms/media/upload';
const MEDIA_ITEM_URL = '/api/cms/media';
const TOKEN_STORAGE_KEY = 'perfectweb.cms.token';

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const cloneContent = (content: SiteContent): SiteContent => {
	if (typeof structuredClone === 'function') {
		return structuredClone(content);
	}
	return JSON.parse(JSON.stringify(content)) as SiteContent;
};

const parseList = (value: string) =>
	value
		.split(/[\n,]/g)
		.map((item) => item.trim())
		.filter(Boolean);

const moveItem = <T>(list: T[], from: number, to: number) => {
	if (to < 0 || to >= list.length || from < 0 || from >= list.length) return;
	const [item] = list.splice(from, 1);
	list.splice(to, 0, item);
};

const newPortfolioItem = (index: number): PortfolioItem => ({
	id: `portfolio-${index + 1}`,
	colSpan: 1,
	rowSpan: 1,
	hue: 220,
	animDur: 3,
	category: 'категория',
	title: 'новый проект',
	client: 'клиент / индустрия',
	description: 'описание проекта',
	tags: ['Astro'],
	year: new Date().getFullYear(),
	duration: '4 недели',
	liveUrl: '#',
	caseUrl: '#',
	preview: null,
	detail: null,
	mockup: null,
	published: true,
});

const mediaLabel = (media: PortfolioMedia | null) => {
	if (!media) return 'не загружено';
	return `${media.width}×${media.height}`;
};

const renderMediaSlot = (
	item: PortfolioItem,
	index: number,
	key: 'preview' | 'detail' | 'mockup',
	label: string,
) => {
	const media = item[key];
	const mediaInfo = media
		? `
			<div class="admin-media-info">
				<span>${mediaLabel(media)}</span>
				<button type="button" data-action="remove-portfolio-media" data-portfolio-index="${index}" data-media-key="${key}">
					удалить файл
				</button>
			</div>
			<label>
				<span>alt</span>
				<input
					type="text"
					value="${escapeHtml(media.alt)}"
					data-portfolio-index="${index}"
					data-media-alt-key="${key}"
				/>
			</label>
		`
		: '<p class="admin-media-empty">файл не выбран</p>';

	return `
		<div class="admin-media-slot">
			<p class="admin-media-title">${label}</p>
			${mediaInfo}
			<label class="admin-upload-inline">
				<span>загрузить изображение</span>
				<input
					type="file"
					accept="image/*"
					data-portfolio-index="${index}"
					data-media-upload-key="${key}"
				/>
			</label>
		</div>
	`;
};

const renderStats = (state: SiteContent) =>
	state.about.stats
		.map(
			(stat, index) => `
				<div class="admin-inline-grid admin-stat-row">
					<input type="number" min="0" max="9999" value="${stat.value}" data-stat-index="${index}" data-stat-field="value" />
					<input type="text" value="${escapeHtml(stat.suffix)}" data-stat-index="${index}" data-stat-field="suffix" placeholder="суффикс (+)" />
					<input type="text" value="${escapeHtml(stat.label)}" data-stat-index="${index}" data-stat-field="label" placeholder="подпись" />
					<div class="admin-row-actions">
						<button type="button" data-action="move-stat-up" data-stat-index="${index}">↑</button>
						<button type="button" data-action="move-stat-down" data-stat-index="${index}">↓</button>
						<button type="button" data-action="remove-stat" data-stat-index="${index}">удалить</button>
					</div>
				</div>
			`,
		)
		.join('');

const renderServices = (state: SiteContent) =>
	state.services
		.map(
			(service, index) => `
				<article class="admin-block admin-service">
					<div class="admin-service-head">
						<h3>услуга ${String(index + 1).padStart(2, '0')}</h3>
						<div class="admin-row-actions">
							<button type="button" data-action="move-service-up" data-service-index="${index}">↑</button>
							<button type="button" data-action="move-service-down" data-service-index="${index}">↓</button>
							<button type="button" data-action="remove-service" data-service-index="${index}">удалить</button>
						</div>
					</div>

					<label>
						<span>название</span>
						<input type="text" value="${escapeHtml(service.label)}" data-service-index="${index}" data-service-field="label" />
					</label>

					<label>
						<span>основной текст</span>
						<textarea rows="4" data-service-index="${index}" data-service-field="desc">${escapeHtml(service.desc)}</textarea>
					</label>

					<label>
						<span>стек (по одному в строке)</span>
						<textarea rows="4" data-service-index="${index}" data-service-field="items">${escapeHtml(service.items.join('\n'))}</textarea>
					</label>
				</article>
			`,
		)
		.join('');

const renderPortfolio = (state: SiteContent) =>
	state.portfolio
		.map(
			(item, index) => `
				<article class="admin-block admin-portfolio-item">
					<div class="admin-service-head">
						<h3>карточка ${String(index + 1).padStart(2, '0')}</h3>
						<div class="admin-row-actions">
							<button type="button" data-action="move-portfolio-up" data-portfolio-index="${index}">↑</button>
							<button type="button" data-action="move-portfolio-down" data-portfolio-index="${index}">↓</button>
							<button type="button" data-action="duplicate-portfolio" data-portfolio-index="${index}">дубль</button>
							<button type="button" data-action="remove-portfolio" data-portfolio-index="${index}">удалить</button>
						</div>
					</div>

					<div class="admin-portfolio-grid">
						<label>
							<span>id</span>
							<input type="text" value="${escapeHtml(item.id)}" data-portfolio-index="${index}" data-portfolio-field="id" />
						</label>
						<label>
							<span>название</span>
							<input type="text" value="${escapeHtml(item.title)}" data-portfolio-index="${index}" data-portfolio-field="title" />
						</label>
						<label>
							<span>категория</span>
							<input type="text" value="${escapeHtml(item.category)}" data-portfolio-index="${index}" data-portfolio-field="category" />
						</label>
						<label>
							<span>клиент / индустрия</span>
							<input type="text" value="${escapeHtml(item.client)}" data-portfolio-index="${index}" data-portfolio-field="client" />
						</label>
						<label>
							<span>описание</span>
							<textarea rows="3" data-portfolio-index="${index}" data-portfolio-field="description">${escapeHtml(item.description)}</textarea>
						</label>
						<label>
							<span>теги (по одному в строке)</span>
							<textarea rows="3" data-portfolio-index="${index}" data-portfolio-field="tags">${escapeHtml(item.tags.join('\n'))}</textarea>
						</label>
					</div>

					<div class="admin-inline-grid admin-portfolio-layout-grid">
						<label><span>colSpan</span><input type="number" min="1" max="4" value="${item.colSpan}" data-portfolio-index="${index}" data-portfolio-field="colSpan" /></label>
						<label><span>rowSpan</span><input type="number" min="1" max="4" value="${item.rowSpan}" data-portfolio-index="${index}" data-portfolio-field="rowSpan" /></label>
						<label><span>hue</span><input type="number" min="0" max="360" value="${item.hue}" data-portfolio-index="${index}" data-portfolio-field="hue" /></label>
						<label><span>animDur</span><input type="number" min="0.5" max="12" step="0.1" value="${item.animDur}" data-portfolio-index="${index}" data-portfolio-field="animDur" /></label>
						<label><span>год</span><input type="number" min="2000" max="2100" value="${item.year}" data-portfolio-index="${index}" data-portfolio-field="year" /></label>
						<label><span>длительность</span><input type="text" value="${escapeHtml(item.duration)}" data-portfolio-index="${index}" data-portfolio-field="duration" /></label>
						<label><span>live url</span><input type="text" value="${escapeHtml(item.liveUrl)}" data-portfolio-index="${index}" data-portfolio-field="liveUrl" /></label>
						<label><span>case url</span><input type="text" value="${escapeHtml(item.caseUrl)}" data-portfolio-index="${index}" data-portfolio-field="caseUrl" /></label>
						<label class="admin-checkbox-row"><input type="checkbox" ${item.published ? 'checked' : ''} data-portfolio-index="${index}" data-portfolio-field="published" /> опубликовано</label>
					</div>

					<div class="admin-portfolio-media-grid">
						${renderMediaSlot(item, index, 'preview', 'preview (плитка)')}
						${renderMediaSlot(item, index, 'detail', 'detail (оверлей)')}
						${renderMediaSlot(item, index, 'mockup', 'mockup (правая колонка)')}
					</div>
				</article>
			`,
		)
		.join('');

const render = (root: HTMLElement, state: SiteContent) => {
	root.innerHTML = `
		<section class="admin-block">
			<h2>обо мне</h2>

			<label>
				<span>заголовок</span>
				<input type="text" value="${escapeHtml(state.about.title)}" data-bind="about.title" />
			</label>

			<label>
				<span>основной текст</span>
				<textarea rows="7" data-bind="about.bodyMarkup">${escapeHtml(state.about.bodyMarkup)}</textarea>
				<small>золотые фрагменты оборачивай в [[двойные скобки]], например [[под ключ]].</small>
			</label>

			<label>
				<span>подплитка «подход»</span>
				<textarea rows="4" data-bind="about.approach">${escapeHtml(state.about.approach)}</textarea>
			</label>

			<label>
				<span>подплитка «стек» (по одному в строке)</span>
				<textarea rows="5" data-bind="about.stack">${escapeHtml(state.about.stack.join('\n'))}</textarea>
			</label>

			<div class="admin-subhead">статистика</div>
			<div class="admin-list">
				${renderStats(state)}
			</div>
			<button type="button" data-action="add-stat">добавить статистику</button>
		</section>

		<section class="admin-block">
			<div class="admin-service-head">
				<h2>услуги</h2>
				<button type="button" data-action="add-service">добавить услугу</button>
			</div>
			<div class="admin-list">
				${renderServices(state)}
			</div>
		</section>

		<section class="admin-block">
			<div class="admin-service-head">
				<h2>портфолио</h2>
				<button type="button" data-action="add-portfolio">добавить карточку</button>
			</div>
			<div class="admin-list">
				${renderPortfolio(state)}
			</div>
		</section>
	`;
};

const fetchContent = async () => {
	const response = await fetch(API_URL, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
		},
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`GET ${response.status}`);
	}

	return normalizeSiteContent((await response.json()) as unknown);
};

const saveContent = async (content: SiteContent, token: string) => {
	const response = await fetch(API_URL, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(content),
	});

	if (!response.ok) {
		throw new Error(`PUT ${response.status}`);
	}

	return normalizeSiteContent((await response.json()) as unknown);
};

const resetContent = async (token: string) => {
	const response = await fetch(API_URL, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({}),
	});

	if (!response.ok) {
		throw new Error(`DELETE ${response.status}`);
	}

	return normalizeSiteContent((await response.json()) as unknown);
};

const uploadMedia = async (token: string, file: File) => {
	const formData = new FormData();
	formData.append('file', file);

	const response = await fetch(MEDIA_UPLOAD_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: formData,
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as { error?: string };
		throw new Error(payload.error ? `UPLOAD ${payload.error}` : `UPLOAD ${response.status}`);
	}

	return (await response.json()) as PortfolioMedia;
};

const deleteMedia = async (token: string, assetId: string) => {
	const response = await fetch(`${MEDIA_ITEM_URL}/${encodeURIComponent(assetId)}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`MEDIA_DELETE ${response.status}`);
	}
};

const updatePortfolioField = (item: PortfolioItem, field: string, value: string | boolean) => {
	if (field === 'id' && typeof value === 'string') item.id = value;
	if (field === 'title' && typeof value === 'string') item.title = value;
	if (field === 'category' && typeof value === 'string') item.category = value;
	if (field === 'client' && typeof value === 'string') item.client = value;
	if (field === 'description' && typeof value === 'string') item.description = value;
	if (field === 'duration' && typeof value === 'string') item.duration = value;
	if (field === 'liveUrl' && typeof value === 'string') item.liveUrl = value;
	if (field === 'caseUrl' && typeof value === 'string') item.caseUrl = value;
	if (field === 'tags' && typeof value === 'string') item.tags = parseList(value);
	if (field === 'colSpan' && typeof value === 'string') item.colSpan = Number(value || 1);
	if (field === 'rowSpan' && typeof value === 'string') item.rowSpan = Number(value || 1);
	if (field === 'hue' && typeof value === 'string') item.hue = Number(value || 0);
	if (field === 'animDur' && typeof value === 'string') item.animDur = Number(value || 1);
	if (field === 'year' && typeof value === 'string') item.year = Number(value || new Date().getFullYear());
	if (field === 'published' && typeof value === 'boolean') item.published = value;
};

export const initAdminApp = () => {
	const root = document.querySelector<HTMLElement>('[data-admin-root]');
	const status = document.querySelector<HTMLElement>('[data-admin-status]');
	const saveButton = document.querySelector<HTMLButtonElement>('[data-admin-save]');
	const resetButton = document.querySelector<HTMLButtonElement>('[data-admin-reset]');
	const exportButton = document.querySelector<HTMLButtonElement>('[data-admin-export]');
	const importInput = document.querySelector<HTMLInputElement>('[data-admin-import]');
	const tokenInput = document.querySelector<HTMLInputElement>('[data-admin-token]');

	if (!root || !status || !saveButton || !resetButton || !exportButton || !importInput || !tokenInput) {
		return;
	}

	let state = cloneContent(DEFAULT_SITE_CONTENT);
	let isDirty = false;
	let authToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
	tokenInput.value = authToken;

	const setStatus = (text: string, tone: 'ok' | 'warn' = 'ok') => {
		status.textContent = text;
		status.dataset.tone = tone;
	};

	const markDirty = () => {
		isDirty = true;
		setStatus('есть несохраненные изменения', 'warn');
	};

	const rerender = () => {
		render(root, state);
	};

	const requireToken = () => {
		authToken = tokenInput.value.trim();
		sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
		if (!authToken) {
			setStatus('введи cms token', 'warn');
			return false;
		}
		return true;
	};

	const load = async () => {
		setStatus('загрузка данных...');
		try {
			state = await fetchContent();
			rerender();
			isDirty = false;
			setStatus('данные загружены');
		} catch {
			state = cloneContent(DEFAULT_SITE_CONTENT);
			rerender();
			setStatus('не удалось загрузить данные с сервера, показан дефолт', 'warn');
		}
	};

	void load();

	root.addEventListener('input', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

		const bindKey = target.dataset.bind;
		if (bindKey === 'about.title') {
			state.about.title = target.value;
			markDirty();
			return;
		}

		if (bindKey === 'about.bodyMarkup') {
			state.about.bodyMarkup = target.value;
			markDirty();
			return;
		}

		if (bindKey === 'about.approach') {
			state.about.approach = target.value;
			markDirty();
			return;
		}

		if (bindKey === 'about.stack') {
			state.about.stack = parseList(target.value);
			markDirty();
			return;
		}

		const statIndex = Number(target.dataset.statIndex);
		const statField = target.dataset.statField;
		if (Number.isInteger(statIndex) && statIndex >= 0 && statField) {
			const stat = state.about.stats[statIndex];
			if (!stat) return;
			if (statField === 'value') stat.value = Number(target.value || 0);
			if (statField === 'suffix') stat.suffix = target.value;
			if (statField === 'label') stat.label = target.value;
			markDirty();
			return;
		}

		const serviceIndex = Number(target.dataset.serviceIndex);
		const serviceField = target.dataset.serviceField;
		if (Number.isInteger(serviceIndex) && serviceIndex >= 0 && serviceField) {
			const service = state.services[serviceIndex];
			if (!service) return;
			if (serviceField === 'label') service.label = target.value;
			if (serviceField === 'desc') service.desc = target.value;
			if (serviceField === 'items') service.items = parseList(target.value);
			markDirty();
			return;
		}

		const portfolioIndex = Number(target.dataset.portfolioIndex);
		const portfolioField = target.dataset.portfolioField;
		if (Number.isInteger(portfolioIndex) && portfolioIndex >= 0 && portfolioField) {
			const item = state.portfolio[portfolioIndex];
			if (!item) return;
			if (target instanceof HTMLInputElement && target.type === 'checkbox') {
				updatePortfolioField(item, portfolioField, target.checked);
			} else {
				updatePortfolioField(item, portfolioField, target.value);
			}
			markDirty();
			return;
		}

		const mediaAltKey = target.dataset.mediaAltKey as 'preview' | 'detail' | 'mockup' | undefined;
		if (Number.isInteger(portfolioIndex) && portfolioIndex >= 0 && mediaAltKey) {
			const item = state.portfolio[portfolioIndex];
			const media = item?.[mediaAltKey];
			if (media) {
				media.alt = target.value;
				markDirty();
			}
		}
	});

	root.addEventListener('change', async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return;
		if (target.type !== 'file') return;

		const index = Number(target.dataset.portfolioIndex);
		const mediaKey = target.dataset.mediaUploadKey as 'preview' | 'detail' | 'mockup' | undefined;
		if (!Number.isInteger(index) || index < 0 || !mediaKey) return;

		const file = target.files?.[0];
		target.value = '';
		if (!file) return;

		if (!requireToken()) return;

		setStatus(`загрузка файла (${mediaKey})...`);
		try {
			const item = state.portfolio[index];
			if (!item) throw new Error('portfolio_item_not_found');

			const prevAssetId = item[mediaKey]?.assetId;
			const uploaded = await uploadMedia(authToken, file);
			uploaded.alt = item[mediaKey]?.alt || item.title;
			item[mediaKey] = uploaded;

			if (prevAssetId && prevAssetId !== uploaded.assetId) {
				await deleteMedia(authToken, prevAssetId).catch(() => undefined);
			}

			rerender();
			markDirty();
			setStatus(`файл загружен (${mediaKey})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'upload_failed';
			setStatus(`ошибка загрузки (${message})`, 'warn');
		}
	});

	root.addEventListener('click', async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		const button = target.closest<HTMLButtonElement>('[data-action]');
		if (!button) return;

		const action = button.dataset.action;
		const statIndex = Number(button.dataset.statIndex);
		const serviceIndex = Number(button.dataset.serviceIndex);
		const portfolioIndex = Number(button.dataset.portfolioIndex);
		const mediaKey = button.dataset.mediaKey as 'preview' | 'detail' | 'mockup' | undefined;

		if (action === 'add-stat') {
			state.about.stats.push({ value: 0, suffix: '', label: 'новый пункт' });
			rerender();
			markDirty();
			return;
		}

		if (action === 'remove-stat' && Number.isInteger(statIndex)) {
			state.about.stats.splice(statIndex, 1);
			if (!state.about.stats.length) {
				state.about.stats.push({ value: 0, suffix: '', label: 'новый пункт' });
			}
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-stat-up' && Number.isInteger(statIndex)) {
			moveItem(state.about.stats, statIndex, statIndex - 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-stat-down' && Number.isInteger(statIndex)) {
			moveItem(state.about.stats, statIndex, statIndex + 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'add-service') {
			state.services.push({
				id: `service-${state.services.length + 1}`,
				label: 'новая услуга',
				desc: 'описание услуги',
				items: ['инструмент'],
			});
			rerender();
			markDirty();
			return;
		}

		if (action === 'remove-service' && Number.isInteger(serviceIndex)) {
			state.services.splice(serviceIndex, 1);
			if (!state.services.length) {
				state.services.push(cloneContent(DEFAULT_SITE_CONTENT).services[0]);
			}
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-service-up' && Number.isInteger(serviceIndex)) {
			moveItem(state.services, serviceIndex, serviceIndex - 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-service-down' && Number.isInteger(serviceIndex)) {
			moveItem(state.services, serviceIndex, serviceIndex + 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'add-portfolio') {
			state.portfolio.push(newPortfolioItem(state.portfolio.length));
			rerender();
			markDirty();
			return;
		}

		if (action === 'remove-portfolio' && Number.isInteger(portfolioIndex)) {
			state.portfolio.splice(portfolioIndex, 1);
			if (!state.portfolio.length) {
				state.portfolio.push(newPortfolioItem(0));
			}
			rerender();
			markDirty();
			return;
		}

		if (action === 'duplicate-portfolio' && Number.isInteger(portfolioIndex)) {
			const source = state.portfolio[portfolioIndex];
			if (!source) return;
			const clone = JSON.parse(JSON.stringify(source)) as PortfolioItem;
			clone.id = `${clone.id}-copy-${Date.now()}`;
			state.portfolio.splice(portfolioIndex + 1, 0, clone);
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-portfolio-up' && Number.isInteger(portfolioIndex)) {
			moveItem(state.portfolio, portfolioIndex, portfolioIndex - 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'move-portfolio-down' && Number.isInteger(portfolioIndex)) {
			moveItem(state.portfolio, portfolioIndex, portfolioIndex + 1);
			rerender();
			markDirty();
			return;
		}

		if (action === 'remove-portfolio-media' && Number.isInteger(portfolioIndex) && mediaKey) {
			if (!requireToken()) return;

			const item = state.portfolio[portfolioIndex];
			if (!item) return;
			const media = item[mediaKey];
			if (!media) return;

			setStatus('удаление файла...');
			try {
				await deleteMedia(authToken, media.assetId);
				item[mediaKey] = null;
				rerender();
				markDirty();
				setStatus('файл удалён');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'media_delete_failed';
				setStatus(`ошибка удаления файла (${message})`, 'warn');
			}
		}
	});

	tokenInput.addEventListener('change', () => {
		authToken = tokenInput.value.trim();
		sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
	});

	saveButton.addEventListener('click', async () => {
		if (!requireToken()) return;
		setStatus('сохранение...');
		try {
			state = await saveContent(state, authToken);
			isDirty = false;
			rerender();
			setStatus('сохранено на сервере');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'ошибка сохранения';
			setStatus(`не удалось сохранить (${message})`, 'warn');
		}
	});

	resetButton.addEventListener('click', async () => {
		if (!requireToken()) return;
		if (!window.confirm('Сбросить контент на сервере к дефолту?')) return;
		setStatus('сброс...');
		try {
			state = await resetContent(authToken);
			isDirty = false;
			rerender();
			setStatus('контент сброшен');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'ошибка сброса';
			setStatus(`не удалось сбросить (${message})`, 'warn');
		}
	});

	exportButton.addEventListener('click', () => {
		const blob = new Blob([JSON.stringify(normalizeSiteContent(state), null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'perfectweb-content.json';
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		setStatus('экспорт готов');
	});

	importInput.addEventListener('change', async () => {
		const file = importInput.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const json = JSON.parse(text) as unknown;
			state = normalizeSiteContent(json);
			rerender();
			markDirty();
			setStatus('файл импортирован, нажми «сохранить»');
		} catch {
			setStatus('ошибка импорта файла', 'warn');
		}
		importInput.value = '';
	});

	window.addEventListener('beforeunload', (event) => {
		if (!isDirty) return;
		event.preventDefault();
		event.returnValue = '';
	});
};
