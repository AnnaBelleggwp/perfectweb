export const getCmsToken = () => {
	const token = import.meta.env.CMS_TOKEN ?? process.env.CMS_TOKEN;
	if (typeof token !== 'string') return '';
	return token.trim();
};

export const isCmsAuthorized = (request: Request) => {
	const token = getCmsToken();
	if (!token) return false;

	const auth = request.headers.get('authorization') ?? '';
	if (!auth.startsWith('Bearer ')) return false;
	const incoming = auth.slice('Bearer '.length).trim();
	return incoming.length > 0 && incoming === token;
};
