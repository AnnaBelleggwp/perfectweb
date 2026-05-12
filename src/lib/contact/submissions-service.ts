import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'contact-submissions.jsonl');

export type ContactSubmission = {
	id: string;
	createdAt: string;
	email: string;
	question: string;
	ip: string | null;
	userAgent: string | null;
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
	await fs.mkdir(STORAGE_DIR, { recursive: true });
	try {
		await fs.access(STORAGE_FILE);
	} catch {
		await fs.writeFile(STORAGE_FILE, '', 'utf-8');
	}
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
	};

	await fs.appendFile(STORAGE_FILE, `${JSON.stringify(submission)}\n`, 'utf-8');
	return submission;
};
