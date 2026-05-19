import {
	DEFAULT_SITE_CONTENT,
	normalizeSiteContent,
	type PortfolioItem,
	type PortfolioMedia,
	type SiteContent,
} from '../data/site-content';

const API_URL = '/api/cms/content.json';
const SESSION_URL = '/api/cms/session.json';
const MEDIA_UPLOAD_URL = '/api/cms/media/upload';
const MEDIA_ITEM_URL = '/api/cms/media';
const MEDIA_REPAIR_URL = '/api/cms/media/repair';
const CONTACT_SUBMISSIONS_URL = '/api/cms/contact-submissions.json';
const CONTACT_SUBMISSION_ITEM_URL = '/api/cms/contact-submissions';
const REVIEWS_ADMIN_URL = '/api/cms/reviews.json';
const REVIEW_ITEM_URL = '/api/cms/reviews';
const STATUS_URL = '/api/cms/status.json';
const BACKUPS_URL = '/api/cms/backups.json';
const BACKUP_ITEM_URL = '/api/cms/backups';
const TOKEN_STORAGE_KEY = 'perfectweb.cms.token';

type ContactSubmission = {
	id: string;
	createdAt: string;
	updatedAt?: string;
	email: string;
	question: string;
	ip: string | null;
	userAgent: string | null;
	status: 'new' | 'read' | 'archived';
};

type CmsReview = {
	id: string;
	name: string;
	role: string;
	message: string;
	project: string;
	stars: number;
	approved: boolean;
	createdAt: string;
	updatedAt?: string;
	ip: string | null;
};

type BackupSummary = {
	id: string;
	createdAt: string;
	note: string;
	fileCount: number;
	byteSize: number;
	archiveSize: number;
};

type FileStatus = {
	exists: boolean;
	size: number;
	mtime: string | null;
};

type CmsStatus = {
	storage: {
		path: string;
		exists: boolean;
		writable: boolean;
	};
	sessions?: {
		exists: boolean;
		activeCount: number;
		writable: boolean;
	};
	files: {
		content: FileStatus;
		contactSubmissions: FileStatus;
		reviews: FileStatus;
		mediaManifest: FileStatus;
		mediaFileCount: number;
		backups?: {
			count: number;
			latest: BackupSummary | null;
		};
	};
	mediaIntegrity?: {
		assetCount: number;
		manifestFileCount: number;
		diskFileCount: number;
		missingFiles: { assetId: string; fileName: string }[];
		orphanFiles: { assetId: string; fileName: string }[];
		duplicateManifestFiles: { assetId: string; fileName: string; count: number }[];
		invalidAssets: { assetId: string; error: string }[];
	} | null;
};

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

const formatDate = (value: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

const formatBytes = (value: number) => {
	if (!Number.isFinite(value) || value <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = value;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const fileStatusLabel = (file: FileStatus) => {
	if (!file.exists) return 'missing';
	return `${formatBytes(file.size)}${file.mtime ? ` · ${formatDate(file.mtime)}` : ''}`;
};

const mediaIntegrityLabel = (status: CmsStatus['mediaIntegrity']) => {
	if (!status) return 'unknown';
	const issueCount =
		status.missingFiles.length +
		status.orphanFiles.length +
		status.duplicateManifestFiles.length +
		status.invalidAssets.length;
	if (issueCount === 0) {
		return `ok · ${status.assetCount} assets · ${status.diskFileCount} files`;
	}
	return [
		`${issueCount} issues`,
		`missing ${status.missingFiles.length}`,
		`orphan ${status.orphanFiles.length}`,
		`dup ${status.duplicateManifestFiles.length}`,
		`invalid ${status.invalidAssets.length}`,
	].join(' · ');
};

const mediaIntegrityDetails = (status: CmsStatus['mediaIntegrity']) => {
	if (!status) return '';
	const lines = [
		...status.missingFiles.map((file) => `missing ${file.assetId}/${file.fileName}`),
		...status.orphanFiles.map((file) => `orphan ${file.assetId}/${file.fileName}`),
		...status.duplicateManifestFiles.map((file) => `duplicate ${file.assetId}/${file.fileName} x${file.count}`),
		...status.invalidAssets.map((asset) => `invalid ${asset.assetId}: ${asset.error}`),
	];
	if (!lines.length) return '';
	const visible = lines.slice(0, 6).join(' · ');
	const rest = lines.length > 6 ? ` · +${lines.length - 6}` : '';
	return `<small>${escapeHtml(`${visible}${rest}`)}</small>`;
};

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
	logo: '',
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

const renderContacts = (submissions: ContactSubmission[]) => {
	if (!submissions.length) {
		return '<p class="admin-empty">заявок пока нет</p>';
	}

	return submissions
		.map(
			(submission) => `
				<article class="admin-block admin-inbox-item">
					<div class="admin-service-head">
						<h3>${escapeHtml(submission.email)}</h3>
						<span class="admin-badge">${escapeHtml(submission.status)}</span>
					</div>
					<p class="admin-meta">${escapeHtml(formatDate(submission.createdAt))}${submission.ip ? ` · ${escapeHtml(submission.ip)}` : ''}</p>
					<p class="admin-message">${escapeHtml(submission.question)}</p>
					<div class="admin-row-actions">
						<button type="button" data-action="contact-status" data-contact-id="${escapeHtml(submission.id)}" data-contact-status="new">новая</button>
						<button type="button" data-action="contact-status" data-contact-id="${escapeHtml(submission.id)}" data-contact-status="read">прочитана</button>
						<button type="button" data-action="contact-status" data-contact-id="${escapeHtml(submission.id)}" data-contact-status="archived">архив</button>
						<button type="button" data-action="delete-contact" data-contact-id="${escapeHtml(submission.id)}">удалить</button>
					</div>
				</article>
			`,
		)
		.join('');
};

const renderReviews = (reviews: CmsReview[]) => {
	if (!reviews.length) {
		return '<p class="admin-empty">отзывов пока нет</p>';
	}

	return reviews
		.map(
			(review) => `
				<article class="admin-block admin-inbox-item">
					<div class="admin-service-head">
						<h3>${escapeHtml(review.name)}</h3>
						<span class="admin-badge">${review.approved ? 'approved' : 'pending'}</span>
					</div>
					<p class="admin-meta">
						${escapeHtml(formatDate(review.createdAt))}
						${review.role ? ` · ${escapeHtml(review.role)}` : ''}
						${review.project ? ` · ${escapeHtml(review.project)}` : ''}
						· ${'★'.repeat(review.stars)}${'☆'.repeat(5 - review.stars)}
					</p>
					<p class="admin-message">${escapeHtml(review.message)}</p>
					<div class="admin-row-actions">
						<button type="button" data-action="review-approval" data-review-id="${escapeHtml(review.id)}" data-review-approved="true">опубликовать</button>
						<button type="button" data-action="review-approval" data-review-id="${escapeHtml(review.id)}" data-review-approved="false">скрыть</button>
						<button type="button" data-action="delete-review" data-review-id="${escapeHtml(review.id)}">удалить</button>
					</div>
				</article>
			`,
		)
		.join('');
};

const renderStatusPanel = (cmsStatus: CmsStatus | null, backups: BackupSummary[]) => {
	const statusHtml = cmsStatus
		? `
			<div class="admin-status-grid">
				<div>
					<span>storage</span>
					<strong>${cmsStatus.storage.exists ? 'exists' : 'missing'} / ${cmsStatus.storage.writable ? 'writable' : 'readonly'}</strong>
				</div>
				<div>
					<span>content</span>
					<strong>${escapeHtml(fileStatusLabel(cmsStatus.files.content))}</strong>
				</div>
				<div>
					<span>заявки</span>
					<strong>${escapeHtml(fileStatusLabel(cmsStatus.files.contactSubmissions))}</strong>
				</div>
				<div>
					<span>отзывы</span>
					<strong>${escapeHtml(fileStatusLabel(cmsStatus.files.reviews))}</strong>
				</div>
				<div>
					<span>media manifest</span>
					<strong>${escapeHtml(fileStatusLabel(cmsStatus.files.mediaManifest))}</strong>
				</div>
				<div>
					<span>media files</span>
					<strong>${cmsStatus.files.mediaFileCount}</strong>
				</div>
				<div>
					<span>admin sessions</span>
					<strong>${cmsStatus.sessions ? `${cmsStatus.sessions.activeCount} / ${cmsStatus.sessions.writable ? 'writable' : 'readonly'}` : 'n/a'}</strong>
				</div>
				<div>
					<span>media integrity</span>
					<strong>${escapeHtml(mediaIntegrityLabel(cmsStatus.mediaIntegrity))}</strong>
				</div>
			</div>
			${mediaIntegrityDetails(cmsStatus.mediaIntegrity)}
			<small>${escapeHtml(cmsStatus.storage.path)}</small>
		`
		: '<p class="admin-empty">статус еще не загружен</p>';

	const backupsHtml = backups.length
		? backups.map((backup) => `
			<article class="admin-backup-row">
				<div>
					<strong>${escapeHtml(formatDate(backup.createdAt))}</strong>
					<p>${escapeHtml(backup.note)} · ${backup.fileCount} files · ${formatBytes(backup.byteSize)} data · ${formatBytes(backup.archiveSize)} archive</p>
				</div>
				<div class="admin-row-actions">
					<button type="button" data-action="restore-backup" data-backup-id="${escapeHtml(backup.id)}">restore</button>
					<button type="button" data-action="delete-backup" data-backup-id="${escapeHtml(backup.id)}">delete</button>
				</div>
			</article>
		`).join('')
		: '<p class="admin-empty">backup-архивов пока нет</p>';

	return `
		<section class="admin-block">
			<div class="admin-service-head">
				<h2>статус и backup</h2>
				<div class="admin-row-actions">
					<button type="button" data-action="refresh-system">обновить</button>
					<button type="button" data-action="repair-media">repair media</button>
					<button type="button" data-action="create-backup">создать backup</button>
				</div>
			</div>
			${statusHtml}
			<div class="admin-list">
				${backupsHtml}
			</div>
		</section>
	`;
};

const render = (
	root: HTMLElement,
	state: SiteContent,
	submissions: ContactSubmission[],
	reviews: CmsReview[],
	cmsStatus: CmsStatus | null,
	backups: BackupSummary[],
) => {
	root.innerHTML = `
		<div data-panel="content">
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
				<button type="button" data-action="add-stat">+ статистика</button>
			</section>

			<section class="admin-block">
				<div class="admin-service-head">
					<h2>услуги</h2>
					<button type="button" data-action="add-service">+ услуга</button>
				</div>
				<div class="admin-list">
					${renderServices(state)}
				</div>
			</section>
		</div>

		<div data-panel="portfolio" hidden>
			<section class="admin-block">
				<div class="admin-service-head">
					<h2>портфолио</h2>
					<button type="button" data-action="add-portfolio">+ карточка</button>
				</div>
				<div class="admin-list">
					${renderPortfolio(state)}
				</div>
			</section>
		</div>

		<div data-panel="inbox" hidden>
			<section class="admin-block">
				<div class="admin-service-head">
					<h2>заявки</h2>
					<button type="button" data-action="refresh-inbox">обновить</button>
				</div>
				<div class="admin-list">
					${renderContacts(submissions)}
				</div>
			</section>

			<section class="admin-block">
				<div class="admin-service-head">
					<h2>отзывы</h2>
					<button type="button" data-action="refresh-inbox">обновить</button>
				</div>
				<div class="admin-list">
					${renderReviews(reviews)}
				</div>
			</section>
		</div>

		<div data-panel="system" hidden>
			${renderStatusPanel(cmsStatus, backups)}
		</div>
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

const authHeaders = (token: string): Record<string, string> =>
	token ? { Authorization: `Bearer ${token}` } : {};

const saveContent = async (content: SiteContent, token: string) => {
	const response = await fetch(API_URL, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders(token),
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
			'Content-Type': 'application/json',
			...authHeaders(token),
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
		headers: authHeaders(token),
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
		headers: authHeaders(token),
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`MEDIA_DELETE ${response.status}`);
	}
};

const repairMediaStorage = async (token: string) => {
	const response = await fetch(MEDIA_REPAIR_URL, {
		method: 'POST',
		headers: authHeaders(token),
	});
	if (!response.ok) throw new Error(`MEDIA_REPAIR ${response.status}`);
};

const fetchContactSubmissions = async (token: string) => {
	const response = await fetch(CONTACT_SUBMISSIONS_URL, {
		method: 'GET',
		headers: authHeaders(token),
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`CONTACTS_GET ${response.status}`);
	const payload = (await response.json()) as { submissions?: ContactSubmission[] };
	return payload.submissions ?? [];
};

const updateContactStatus = async (
	token: string,
	id: string,
	status: ContactSubmission['status'],
) => {
	const response = await fetch(`${CONTACT_SUBMISSION_ITEM_URL}/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders(token),
		},
		body: JSON.stringify({ status }),
	});
	if (!response.ok) throw new Error(`CONTACT_PATCH ${response.status}`);
	const payload = (await response.json()) as { submission?: ContactSubmission };
	return payload.submission;
};

const deleteContactSubmission = async (token: string, id: string) => {
	const response = await fetch(`${CONTACT_SUBMISSION_ITEM_URL}/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: authHeaders(token),
	});
	if (!response.ok && response.status !== 404) throw new Error(`CONTACT_DELETE ${response.status}`);
};

const fetchReviews = async (token: string) => {
	const response = await fetch(REVIEWS_ADMIN_URL, {
		method: 'GET',
		headers: authHeaders(token),
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`REVIEWS_GET ${response.status}`);
	const payload = (await response.json()) as { reviews?: CmsReview[] };
	return payload.reviews ?? [];
};

const updateReviewApproval = async (token: string, id: string, approved: boolean) => {
	const response = await fetch(`${REVIEW_ITEM_URL}/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders(token),
		},
		body: JSON.stringify({ approved }),
	});
	if (!response.ok) throw new Error(`REVIEW_PATCH ${response.status}`);
	const payload = (await response.json()) as { review?: CmsReview };
	return payload.review;
};

const deleteReview = async (token: string, id: string) => {
	const response = await fetch(`${REVIEW_ITEM_URL}/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: authHeaders(token),
	});
	if (!response.ok && response.status !== 404) throw new Error(`REVIEW_DELETE ${response.status}`);
};

const fetchCmsStatus = async (token: string) => {
	const response = await fetch(STATUS_URL, {
		method: 'GET',
		headers: authHeaders(token),
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`STATUS_GET ${response.status}`);
	return (await response.json()) as CmsStatus;
};

const fetchBackups = async (token: string) => {
	const response = await fetch(BACKUPS_URL, {
		method: 'GET',
		headers: authHeaders(token),
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`BACKUPS_GET ${response.status}`);
	const payload = (await response.json()) as { backups?: BackupSummary[] };
	return payload.backups ?? [];
};

const createCmsBackup = async (token: string, note: string) => {
	const response = await fetch(BACKUPS_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders(token),
		},
		body: JSON.stringify({ note }),
	});
	if (!response.ok) throw new Error(`BACKUP_CREATE ${response.status}`);
	const payload = (await response.json()) as { backup?: BackupSummary };
	return payload.backup;
};

const restoreCmsBackup = async (token: string, id: string) => {
	const response = await fetch(`${BACKUP_ITEM_URL}/${encodeURIComponent(id)}/restore`, {
		method: 'POST',
		headers: authHeaders(token),
	});
	if (!response.ok) throw new Error(`BACKUP_RESTORE ${response.status}`);
};

const deleteCmsBackup = async (token: string, id: string) => {
	const response = await fetch(`${BACKUP_ITEM_URL}/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: authHeaders(token),
	});
	if (!response.ok && response.status !== 404) throw new Error(`BACKUP_DELETE ${response.status}`);
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

const initLogin = () => {
	const form = document.querySelector<HTMLFormElement>('[data-admin-login]');
	if (!form) return;

	const usernameInput = form.querySelector<HTMLInputElement>('[data-admin-login-username]');
	const passwordInput = form.querySelector<HTMLInputElement>('[data-admin-login-password]');
	const status = form.querySelector<HTMLElement>('[data-admin-login-status]');
	if (!usernameInput || !passwordInput || !status) return;

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const username = usernameInput.value.trim();
		const password = passwordInput.value.trim();
		if (!username || !password) {
			status.textContent = 'введи логин и пароль';
			status.dataset.tone = 'warn';
			return;
		}

		status.textContent = 'проверка доступа...';
		status.dataset.tone = 'ok';

		try {
			const response = await fetch(SESSION_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			if (!response.ok) {
				status.textContent = 'неверный логин или пароль';
				status.dataset.tone = 'warn';
				return;
			}
			sessionStorage.removeItem(TOKEN_STORAGE_KEY);
			window.location.reload();
		} catch {
			status.textContent = 'ошибка сети';
			status.dataset.tone = 'warn';
		}
	});
};

export const initAdminApp = () => {
	initLogin();

	const root = document.querySelector<HTMLElement>('[data-admin-root]');
	const status = document.querySelector<HTMLElement>('[data-admin-status]');
	const saveButton = document.querySelector<HTMLButtonElement>('[data-admin-save]');
	const resetButton = document.querySelector<HTMLButtonElement>('[data-admin-reset]');
	const exportButton = document.querySelector<HTMLButtonElement>('[data-admin-export]');
	const importInput = document.querySelector<HTMLInputElement>('[data-admin-import]');
	const tokenInput = document.querySelector<HTMLInputElement>('[data-admin-token]');
	const logoutButton = document.querySelector<HTMLButtonElement>('[data-admin-logout]');

	if (!root || !status || !saveButton || !resetButton || !exportButton || !importInput || !tokenInput) {
		return;
	}

	let state = cloneContent(DEFAULT_SITE_CONTENT);
	let contactSubmissions: ContactSubmission[] = [];
	let reviews: CmsReview[] = [];
	let cmsStatus: CmsStatus | null = null;
	let backups: BackupSummary[] = [];
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

	const getActiveTab = () =>
		document.querySelector<HTMLButtonElement>('.admin-tab.is-active')?.dataset.tab ?? 'content';

	const rerender = () => {
		const activeTab = getActiveTab();
		render(root, state, contactSubmissions, reviews, cmsStatus, backups);
		root.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
			p.hidden = p.dataset.panel !== activeTab;
		});
	};

	const requireToken = () => {
		authToken = tokenInput.value.trim();
		if (authToken) {
			sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
		} else {
			sessionStorage.removeItem(TOKEN_STORAGE_KEY);
		}
		return true;
	};

	const load = async () => {
		setStatus('загрузка данных...');
		try {
			state = await fetchContent();
			rerender();
			isDirty = false;
			try {
				[contactSubmissions, reviews, cmsStatus, backups] = await Promise.all([
					fetchContactSubmissions(authToken),
					fetchReviews(authToken),
					fetchCmsStatus(authToken),
					fetchBackups(authToken),
				]);
				rerender();
				setStatus('данные загружены');
			} catch {
				setStatus('контент загружен, но системные данные не удалось получить', 'warn');
			}
		} catch {
			state = cloneContent(DEFAULT_SITE_CONTENT);
			rerender();
			setStatus('не удалось загрузить данные с сервера, показан дефолт', 'warn');
		}
	};

	const refreshInbox = async () => {
		if (!requireToken()) return;
		setStatus('обновление заявок и отзывов...');
		try {
			[contactSubmissions, reviews] = await Promise.all([
				fetchContactSubmissions(authToken),
				fetchReviews(authToken),
			]);
			rerender();
			setStatus('заявки и отзывы обновлены');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'inbox_refresh_failed';
			setStatus(`не удалось обновить заявки/отзывы (${message})`, 'warn');
		}
	};

	const refreshSystem = async () => {
		if (!requireToken()) return;
		setStatus('обновление статуса и backup...');
		try {
			[cmsStatus, backups] = await Promise.all([
				fetchCmsStatus(authToken),
				fetchBackups(authToken),
			]);
			rerender();
			setStatus('статус и backup обновлены');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'system_refresh_failed';
			setStatus(`не удалось обновить статус/backup (${message})`, 'warn');
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

		if (action === 'refresh-inbox') {
			await refreshInbox();
			return;
		}

		if (action === 'refresh-system') {
			await refreshSystem();
			return;
		}

		if (action === 'repair-media') {
			if (!requireToken()) return;
			if (!window.confirm('Починить media manifest? Перед правкой будет создан manifest.previous.json.')) return;

			setStatus('repair media...');
			try {
				await repairMediaStorage(authToken);
				cmsStatus = await fetchCmsStatus(authToken);
				rerender();
				setStatus('media manifest проверен и исправлен');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'media_repair_failed';
				setStatus(`не удалось починить media (${message})`, 'warn');
			}
			return;
		}

		if (action === 'create-backup') {
			if (!requireToken()) return;
			const note = window.prompt('Комментарий к backup', 'manual')?.trim() || 'manual';
			setStatus('создание backup...');
			try {
				const backup = await createCmsBackup(authToken, note);
				if (backup) backups = [backup, ...backups.filter((item) => item.id !== backup.id)];
				cmsStatus = await fetchCmsStatus(authToken).catch(() => cmsStatus);
				rerender();
				setStatus('backup создан');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'backup_create_failed';
				setStatus(`не удалось создать backup (${message})`, 'warn');
			}
			return;
		}

		if (action === 'restore-backup') {
			if (!requireToken()) return;
			const id = button.dataset.backupId ?? '';
			if (!id || !window.confirm('Восстановить backup? Текущее состояние будет сохранено в pre-restore backup.')) return;

			setStatus('восстановление backup...');
			try {
				await restoreCmsBackup(authToken, id);
				state = await fetchContent();
				[contactSubmissions, reviews, cmsStatus, backups] = await Promise.all([
					fetchContactSubmissions(authToken),
					fetchReviews(authToken),
					fetchCmsStatus(authToken),
					fetchBackups(authToken),
				]);
				isDirty = false;
				rerender();
				setStatus('backup восстановлен');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'backup_restore_failed';
				setStatus(`не удалось восстановить backup (${message})`, 'warn');
			}
			return;
		}

		if (action === 'delete-backup') {
			if (!requireToken()) return;
			const id = button.dataset.backupId ?? '';
			if (!id || !window.confirm('Удалить backup без восстановления?')) return;

			setStatus('удаление backup...');
			try {
				await deleteCmsBackup(authToken, id);
				backups = backups.filter((backup) => backup.id !== id);
				cmsStatus = await fetchCmsStatus(authToken).catch(() => cmsStatus);
				rerender();
				setStatus('backup удалён');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'backup_delete_failed';
				setStatus(`не удалось удалить backup (${message})`, 'warn');
			}
			return;
		}

		if (action === 'contact-status') {
			if (!requireToken()) return;
			const id = button.dataset.contactId ?? '';
			const nextStatus = button.dataset.contactStatus as ContactSubmission['status'] | undefined;
			if (!id || !nextStatus) return;

			setStatus('обновление заявки...');
			try {
				const updated = await updateContactStatus(authToken, id, nextStatus);
				if (updated) {
					contactSubmissions = contactSubmissions.map((submission) =>
						submission.id === updated.id ? updated : submission,
					);
				}
				rerender();
				setStatus('заявка обновлена');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'contact_update_failed';
				setStatus(`не удалось обновить заявку (${message})`, 'warn');
			}
			return;
		}

		if (action === 'delete-contact') {
			if (!requireToken()) return;
			const id = button.dataset.contactId ?? '';
			if (!id || !window.confirm('Удалить заявку без восстановления?')) return;

			setStatus('удаление заявки...');
			try {
				await deleteContactSubmission(authToken, id);
				contactSubmissions = contactSubmissions.filter((submission) => submission.id !== id);
				rerender();
				setStatus('заявка удалена');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'contact_delete_failed';
				setStatus(`не удалось удалить заявку (${message})`, 'warn');
			}
			return;
		}

		if (action === 'review-approval') {
			if (!requireToken()) return;
			const id = button.dataset.reviewId ?? '';
			const approved = button.dataset.reviewApproved === 'true';
			if (!id) return;

			setStatus('обновление отзыва...');
			try {
				const updated = await updateReviewApproval(authToken, id, approved);
				if (updated) {
					reviews = reviews.map((review) => review.id === updated.id ? updated : review);
				}
				rerender();
				setStatus(approved ? 'отзыв опубликован' : 'отзыв скрыт');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'review_update_failed';
				setStatus(`не удалось обновить отзыв (${message})`, 'warn');
			}
			return;
		}

		if (action === 'delete-review') {
			if (!requireToken()) return;
			const id = button.dataset.reviewId ?? '';
			if (!id || !window.confirm('Удалить отзыв без восстановления?')) return;

			setStatus('удаление отзыва...');
			try {
				await deleteReview(authToken, id);
				reviews = reviews.filter((review) => review.id !== id);
				rerender();
				setStatus('отзыв удалён');
			} catch (error) {
				const message = error instanceof Error ? error.message : 'review_delete_failed';
				setStatus(`не удалось удалить отзыв (${message})`, 'warn');
			}
		}
	});

	tokenInput.addEventListener('change', () => {
		authToken = tokenInput.value.trim();
		if (authToken) {
			sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
		} else {
			sessionStorage.removeItem(TOKEN_STORAGE_KEY);
		}
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

	logoutButton?.addEventListener('click', async () => {
		setStatus('выход...');
		try {
			await fetch(SESSION_URL, { method: 'DELETE' });
		} finally {
			sessionStorage.removeItem(TOKEN_STORAGE_KEY);
			window.location.reload();
		}
	});

	window.addEventListener('beforeunload', (event) => {
		if (!isDirty) return;
		event.preventDefault();
		Reflect.set(event, 'returnValue', '');
	});
};
