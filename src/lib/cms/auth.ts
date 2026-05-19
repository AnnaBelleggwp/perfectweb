import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { STORAGE_DIR } from './storage-utils';

const CMS_SESSION_COOKIE = 'perfectweb_cms_session';
const CMS_SESSION_TTL_SECONDS = 60 * 60 * 8;
const CMS_SESSIONS_FILE = path.join(STORAGE_DIR, 'cms-sessions.json');
const CMS_SESSION_ID_RE = /^[A-Za-z0-9_-]{16,}$/;

type CmsSessionRecord = {
	issuedAt: number;
	expiresAt: number;
};

type CmsSessionStore = {
	version: 1;
	sessions: Record<string, CmsSessionRecord>;
};

const getEnvValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isTruthyEnv = (value: unknown) => ['1', 'true', 'yes', 'on'].includes(getEnvValue(value).toLowerCase());

export const getCmsToken = () => {
	const token = import.meta.env.CMS_TOKEN ?? process.env.CMS_TOKEN;
	return getEnvValue(token);
};

const getCmsUsername = () => {
	const username = import.meta.env.CMS_USERNAME ?? process.env.CMS_USERNAME;
	return getEnvValue(username);
};

const getCmsPassword = () => {
	const password = import.meta.env.CMS_PASSWORD ?? process.env.CMS_PASSWORD;
	return getEnvValue(password);
};

const getCmsSessionSecret = () => {
	const secret = import.meta.env.CMS_SESSION_SECRET ?? process.env.CMS_SESSION_SECRET;
	return getEnvValue(secret) || getCmsToken() || getCmsPassword();
};

const isProduction = () => {
	const mode = getEnvValue(import.meta.env.MODE) || getEnvValue(process.env.NODE_ENV);
	return mode === 'production';
};

export const isCmsTokenLoginAllowed = () => {
	const explicit = import.meta.env.CMS_ALLOW_TOKEN_LOGIN ?? process.env.CMS_ALLOW_TOKEN_LOGIN;
	return !isProduction() || isTruthyEnv(explicit);
};

const safeEqual = (left: string, right: string) => {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const isCmsTokenValid = (incoming: string) => {
	const token = getCmsToken();
	if (!token) return false;
	return incoming.length > 0 && safeEqual(incoming, token);
};

export const isCmsCredentialsValid = (username: string, password: string) => {
	const configuredUsername = getCmsUsername();
	const configuredPassword = getCmsPassword();
	if (configuredUsername && configuredPassword) {
		return (
			username.length > 0 &&
			password.length > 0 &&
			safeEqual(username, configuredUsername) &&
			safeEqual(password, configuredPassword)
		);
	}

	const token = getCmsToken();
	return (
		isCmsTokenLoginAllowed() &&
		token.length > 0 &&
		safeEqual(username, 'admin') &&
		safeEqual(password, token)
	);
};

const parseCookies = (request: Request) => {
	const header = request.headers.get('cookie') ?? '';
	const cookies = new Map<string, string>();
	for (const part of header.split(';')) {
		const [name, ...valueParts] = part.trim().split('=');
		if (!name || !valueParts.length) continue;
		try {
			cookies.set(name, decodeURIComponent(valueParts.join('=')));
		} catch {
			continue;
		}
	}
	return cookies;
};

const emptySessionStore = (): CmsSessionStore => ({
	version: 1,
	sessions: {},
});

const readSessionStore = () => {
	try {
		if (!fs.existsSync(CMS_SESSIONS_FILE)) return emptySessionStore();
		const parsed = JSON.parse(fs.readFileSync(CMS_SESSIONS_FILE, 'utf-8')) as Partial<CmsSessionStore>;
		if (parsed.version !== 1 || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
			return emptySessionStore();
		}

		const store = emptySessionStore();
		for (const [id, session] of Object.entries(parsed.sessions)) {
			if (
				CMS_SESSION_ID_RE.test(id) &&
				session &&
				typeof session === 'object' &&
				Number.isFinite(session.issuedAt) &&
				Number.isFinite(session.expiresAt)
			) {
				store.sessions[id] = {
					issuedAt: session.issuedAt,
					expiresAt: session.expiresAt,
				};
			}
		}
		return store;
	} catch {
		return emptySessionStore();
	}
};

const writeSessionStore = (store: CmsSessionStore) => {
	fs.mkdirSync(path.dirname(CMS_SESSIONS_FILE), { recursive: true });
	const tmpPath = path.join(
		path.dirname(CMS_SESSIONS_FILE),
		`.${path.basename(CMS_SESSIONS_FILE)}.${process.pid}.${Date.now()}.tmp`,
	);
	fs.writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
	fs.renameSync(tmpPath, CMS_SESSIONS_FILE);
};

const pruneExpiredSessions = (store: CmsSessionStore, now = Date.now()) => {
	let changed = false;
	for (const [id, session] of Object.entries(store.sessions)) {
		if (!CMS_SESSION_ID_RE.test(id) || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
			delete store.sessions[id];
			changed = true;
		}
	}
	return changed;
};

const sessionSignature = (payload: string) => {
	const secret = getCmsSessionSecret();
	if (!secret) return '';
	return createHmac('sha256', secret).update(payload).digest('base64url');
};

const isSecureRequest = (request: Request) => {
	const forwardedProto = request.headers.get('x-forwarded-proto');
	if (forwardedProto) return forwardedProto.split(',')[0]?.trim() === 'https';
	return new URL(request.url).protocol === 'https:';
};

const isBearerAuthorized = (request: Request) => {
	const auth = request.headers.get('authorization') ?? '';
	if (!auth.startsWith('Bearer ')) return false;
	const incoming = auth.slice('Bearer '.length).trim();
	return isCmsTokenValid(incoming);
};

const parseCmsSessionCookie = (request: Request) => {
	const cookie = parseCookies(request).get(CMS_SESSION_COOKIE);
	if (!cookie) return null;

	const [issuedAtRaw, sessionId, signature] = cookie.split('.');
	if (!issuedAtRaw || !sessionId || !signature || !CMS_SESSION_ID_RE.test(sessionId)) return null;

	const issuedAt = Number(issuedAtRaw);
	if (!Number.isFinite(issuedAt)) return null;

	return {
		issuedAt,
		issuedAtRaw,
		payload: `${issuedAtRaw}.${sessionId}`,
		sessionId,
		signature,
	};
};

export const isCmsSessionAuthorized = (request: Request) => {
	const secret = getCmsSessionSecret();
	if (!secret) return false;

	const session = parseCmsSessionCookie(request);
	if (!session) return false;

	const now = Date.now();
	if (now - session.issuedAt > CMS_SESSION_TTL_SECONDS * 1000) return false;
	if (!safeEqual(session.signature, sessionSignature(session.payload))) return false;

	const store = readSessionStore();
	const changed = pruneExpiredSessions(store, now);
	const activeSession = store.sessions[session.sessionId];
	if (changed) {
		try {
			writeSessionStore(store);
		} catch {
			return false;
		}
	}

	return Boolean(
		activeSession &&
		activeSession.issuedAt === session.issuedAt &&
		activeSession.expiresAt > now,
	);
};

export const isCmsAuthorized = (request: Request) =>
	isBearerAuthorized(request) || isCmsSessionAuthorized(request);

export const createCmsSessionSetCookie = (request: Request) => {
	const secret = getCmsSessionSecret();
	if (!secret) return '';

	const issuedAt = Date.now();
	const sessionId = randomBytes(18).toString('base64url');
	const payload = `${issuedAt}.${sessionId}`;
	const value = `${payload}.${sessionSignature(payload)}`;
	const store = readSessionStore();
	pruneExpiredSessions(store, issuedAt);
	store.sessions[sessionId] = {
		issuedAt,
		expiresAt: issuedAt + CMS_SESSION_TTL_SECONDS * 1000,
	};
	try {
		writeSessionStore(store);
	} catch {
		return '';
	}

	const secure = isSecureRequest(request) ? '; Secure' : '';
	return [
		`${CMS_SESSION_COOKIE}=${encodeURIComponent(value)}`,
		'Path=/',
		`Max-Age=${CMS_SESSION_TTL_SECONDS}`,
		'HttpOnly',
		'SameSite=Lax',
		secure,
	].filter(Boolean).join('; ');
};

export const clearCmsSessionSetCookie = () => {
	return [
		`${CMS_SESSION_COOKIE}=`,
		'Path=/',
		'Max-Age=0',
		'HttpOnly',
		'SameSite=Lax',
	].join('; ');
};

export const revokeCmsSession = (request: Request) => {
	const session = parseCmsSessionCookie(request);
	if (!session) return;

	const store = readSessionStore();
	if (!store.sessions[session.sessionId]) return;
	delete store.sessions[session.sessionId];
	writeSessionStore(store);
};

export const getCmsSessionStoreStatus = () => {
	const store = readSessionStore();
	const changed = pruneExpiredSessions(store);
	if (changed) {
		try {
			writeSessionStore(store);
		} catch {
			return {
				exists: fs.existsSync(CMS_SESSIONS_FILE),
				activeCount: Object.keys(store.sessions).length,
				writable: false,
			};
		}
	}

	return {
		exists: fs.existsSync(CMS_SESSIONS_FILE),
		activeCount: Object.keys(store.sessions).length,
		writable: true,
	};
};
