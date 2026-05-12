import { execSync } from 'node:child_process';

const resolveDeployTime = (): string => {
	try {
		const out = execSync('git log -1 --format=%cI', {
			stdio: ['ignore', 'pipe', 'ignore'],
		})
			.toString()
			.trim();
		if (out) return out;
	} catch {
		// fall through
	}
	return new Date().toISOString();
};

export const DEPLOY_TIME_ISO = resolveDeployTime();
