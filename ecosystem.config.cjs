const fs = require('node:fs');
const path = require('node:path');

const loadEnvFile = (filePath) => {
	if (!fs.existsSync(filePath)) return;
	const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/g);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const separatorIndex = trimmed.indexOf('=');
		if (separatorIndex <= 0) continue;
		const key = trimmed.slice(0, separatorIndex).trim();
		let value = trimmed.slice(separatorIndex + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (!process.env[key]) {
			process.env[key] = value;
		}
	}
};

loadEnvFile(path.join(__dirname, '.env.production'));

module.exports = {
	apps: [
		{
			name: 'perfectweb',
			script: './dist/server/entry.mjs',
			interpreter: 'node',
			env: {
				NODE_ENV: 'production',
				HOST: '0.0.0.0',
				PORT: 3000,
				CMS_USERNAME: process.env.CMS_USERNAME,
				CMS_PASSWORD: process.env.CMS_PASSWORD,
				CMS_SESSION_SECRET: process.env.CMS_SESSION_SECRET,
				CMS_ALLOW_TOKEN_LOGIN: process.env.CMS_ALLOW_TOKEN_LOGIN,
				CMS_TOKEN: process.env.CMS_TOKEN,
			},
			max_memory_restart: '400M',
			time: true,
			exp_backoff_restart_delay: 100,
		},
	],
};
