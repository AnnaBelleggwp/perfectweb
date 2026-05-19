import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
	STORAGE_DIR,
	StorageError,
	backupExistingFile,
	ensureStorageDir,
	pathExists,
	writeTextAtomic,
} from '../cms/storage-utils';

const STORAGE_FILE = path.join(STORAGE_DIR, 'reviews.jsonl');
const STORAGE_PREVIOUS_FILE = 'reviews.previous.jsonl';

export type Review = {
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

export class ReviewValidationError extends Error {
	field: 'name' | 'message' | 'stars';

	constructor(field: 'name' | 'message' | 'stars', message: string) {
		super(message);
		this.field = field;
	}
}

const sanitize = (value: unknown, max: number) => {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, max);
};

const clampStars = (value: unknown) => {
	const stars = Number(value) || 5;
	return Math.min(5, Math.max(1, Math.round(stars)));
};

const ensureStorage = async () => {
	await ensureStorageDir();
	if (!(await pathExists(STORAGE_FILE))) {
		await writeTextAtomic(STORAGE_FILE, '');
	}
};

const normalizeReview = (value: unknown): Review | null => {
	if (typeof value !== 'object' || value === null) return null;
	const source = value as Partial<Review>;
	const id = typeof source.id === 'string' ? source.id.trim() : '';
	const name = typeof source.name === 'string' ? source.name : '';
	const message = typeof source.message === 'string' ? source.message : '';
	const createdAt = typeof source.createdAt === 'string' ? source.createdAt : '';
	if (!id || !name || !message || !createdAt) return null;

	return {
		id,
		name,
		role: typeof source.role === 'string' ? source.role : '',
		message,
		project: typeof source.project === 'string' ? source.project : '',
		stars: clampStars(source.stars),
		approved: Boolean(source.approved),
		createdAt,
		updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
		ip: typeof source.ip === 'string' ? source.ip : null,
	};
};

const serializeLines = (reviews: Review[]) =>
	reviews.map((review) => JSON.stringify(review)).join('\n') + (reviews.length ? '\n' : '');

const writeReviews = async (reviews: Review[]) => {
	await ensureStorageDir();
	await backupExistingFile(STORAGE_FILE, STORAGE_PREVIOUS_FILE);
	await writeTextAtomic(STORAGE_FILE, serializeLines(reviews));
};

export const validateReview = (payload: Record<string, unknown>) => {
	const name = sanitize(payload.name, 80);
	const role = sanitize(payload.role, 100);
	const message = sanitize(payload.message, 1200);
	const project = sanitize(payload.project, 120);
	const stars = clampStars(payload.stars);

	if (!name) {
		throw new ReviewValidationError('name', 'Имя обязательно');
	}
	if (!message) {
		throw new ReviewValidationError('message', 'Отзыв обязателен');
	}

	return { name, role, message, project, stars };
};

export const listReviews = async (): Promise<Review[]> => {
	await ensureStorage();
	try {
		const raw = await fs.readFile(STORAGE_FILE, 'utf-8');
		return raw
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				try {
					return normalizeReview(JSON.parse(line) as unknown);
				} catch {
					return null;
				}
			})
			.filter((review): review is Review => Boolean(review))
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	} catch (error) {
		throw new StorageError('reviews_read_failed', 'Failed to read storage/reviews.jsonl', error);
	}
};

export const listApprovedReviews = async () =>
	(await listReviews()).filter((review) => review.approved);

export const createReview = async (
	payload: Record<string, unknown>,
	ip?: string | null,
): Promise<Review> => {
	const normalized = validateReview(payload);
	await ensureStorage();

	const review: Review = {
		id: randomUUID(),
		...normalized,
		approved: false,
		createdAt: new Date().toISOString(),
		ip: ip ?? null,
	};

	await fs.appendFile(STORAGE_FILE, `${JSON.stringify(review)}\n`, 'utf-8');
	return review;
};

export const updateReviewApproval = async (id: string, approved: boolean): Promise<Review | null> => {
	if (!id) return null;
	const reviews = await listReviews();
	const target = reviews.find((review) => review.id === id);
	if (!target) return null;
	target.approved = approved;
	target.updatedAt = new Date().toISOString();
	await writeReviews(reviews);
	return target;
};

export const deleteReview = async (id: string) => {
	if (!id) return false;
	const reviews = await listReviews();
	const next = reviews.filter((review) => review.id !== id);
	if (next.length === reviews.length) return false;
	await writeReviews(next);
	return true;
};
