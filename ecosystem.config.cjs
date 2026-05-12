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
				CMS_TOKEN: process.env.CMS_TOKEN,
			},
			max_memory_restart: '400M',
			time: true,
			exp_backoff_restart_delay: 100,
		},
	],
};
