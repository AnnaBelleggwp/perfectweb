import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

import {
	STORAGE_DIR,
	StorageError,
	backupExistingFile,
	ensureStorageDir,
	pathExists,
	writeTextAtomic,
} from '../cms/storage-utils';

const STORAGE_FILE = path.join(STORAGE_DIR, 'contact-submissions.jsonl');
const STORAGE_PREVIOUS_FILE = 'contact-submissions.previous.jsonl';

export type ContactSubmission = {
	id: string;
	createdAt: string;
	updatedAt?: string;
	email: string;
	question: string;
	ip: string | null;
	userAgent: string | null;
	status: 'new' | 'read' | 'archived';
};

export type ContactPayload = {
	email: string;
	question: string;
	ip?: string | null;
	userAgent?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL = 160;
const MAX_QUESTION = 2000;

export class ContactValidationError extends Error {
	field: 'email' | 'question';

	constructor(field: 'email' | 'question', message: string) {
		super(message);
		this.field = field;
	}
}

const ensureStorage = async () => {
	await ensureStorageDir();
	if (!(await pathExists(STORAGE_FILE))) {
		await writeTextAtomic(STORAGE_FILE, '');
	}
};

const normalizeSubmission = (value: unknown): ContactSubmission | null => {
	if (typeof value !== 'object' || value === null) return null;
	const source = value as Partial<ContactSubmission>;
	const id = typeof source.id === 'string' ? source.id.trim() : '';
	const createdAt = typeof source.createdAt === 'string' ? source.createdAt : '';
	const email = typeof source.email === 'string' ? source.email : '';
	const question = typeof source.question === 'string' ? source.question : '';
	if (!id || !createdAt || !email || !question) return null;

	const status = source.status === 'read' || source.status === 'archived' ? source.status : 'new';

	return {
		id,
		createdAt,
		updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
		email,
		question,
		ip: typeof source.ip === 'string' ? source.ip : null,
		userAgent: typeof source.userAgent === 'string' ? source.userAgent : null,
		status,
	};
};

const serializeLines = (submissions: ContactSubmission[]) =>
	submissions.map((submission) => JSON.stringify(submission)).join('\n') + (submissions.length ? '\n' : '');

const writeSubmissions = async (submissions: ContactSubmission[]) => {
	await ensureStorageDir();
	await backupExistingFile(STORAGE_FILE, STORAGE_PREVIOUS_FILE);
	await writeTextAtomic(STORAGE_FILE, serializeLines(submissions));
};

export const validateContact = (payload: ContactPayload): { email: string; question: string } => {
	const email = String(payload.email ?? '').trim();
	const question = String(payload.question ?? '').trim();

	if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
		throw new ContactValidationError('email', 'некорректный email.');
	}
	if (question.length < 3) {
		throw new ContactValidationError('question', 'опишите задачу в пару строк.');
	}
	if (question.length > MAX_QUESTION) {
		throw new ContactValidationError('question', 'слишком длинный текст.');
	}
	return { email, question };
};

export const saveContactSubmission = async (
	payload: ContactPayload,
): Promise<ContactSubmission> => {
	const { email, question } = validateContact(payload);
	await ensureStorage();

	const submission: ContactSubmission = {
		id: randomBytes(6).toString('hex'),
		createdAt: new Date().toISOString(),
		email,
		question,
		ip: payload.ip ?? null,
		userAgent: payload.userAgent ?? null,
		status: 'new',
	};

	await fs.appendFile(STORAGE_FILE, `${JSON.stringify(submission)}\n`, 'utf-8');
	return submission;
};

export const listContactSubmissions = async (): Promise<ContactSubmission[]> => {
	await ensureStorage();
	try {
		const raw = await fs.readFile(STORAGE_FILE, 'utf-8');
		return raw
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				try {
					return normalizeSubmission(JSON.parse(line) as unknown);
				} catch {
					return null;
				}
			})
			.filter((submission): submission is ContactSubmission => Boolean(submission))
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	} catch (error) {
		throw new StorageError(
			'contact_submissions_read_failed',
			'Failed to read storage/contact-submissions.jsonl',
			error,
		);
	}
};

export const updateContactSubmissionStatus = async (
	id: string,
	status: ContactSubmission['status'],
): Promise<ContactSubmission | null> => {
	if (!id) return null;
	const submissions = await listContactSubmissions();
	const target = submissions.find((submission) => submission.id === id);
	if (!target) return null;
	target.status = status;
	target.updatedAt = new Date().toISOString();
	await writeSubmissions(submissions);
	return target;
};

export const deleteContactSubmission = async (id: string) => {
	if (!id) return false;
	const submissions = await listContactSubmissions();
	const next = submissions.filter((submission) => submission.id !== id);
	if (next.length === submissions.length) return false;
	await writeSubmissions(next);
	return true;
};
