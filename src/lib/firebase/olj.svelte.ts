import { callOljLoginNow, getLatestOljLoginLog } from './olj';
import type { OljLoginLog } from './olj';

export type { OljLoginLog };

export function createOljStore() {
	let log = $state<OljLoginLog | null>(null);
	let loading = $state(false);
	let error = $state('');
	let running = $state(false);

	async function loadLog() {
		loading = true;
		error = '';
		try {
			log = await getLatestOljLoginLog();
		} catch (err: unknown) {
			console.error('Failed to load OLJ login log:', err);
			error = err instanceof Error ? err.message : 'Failed to load OLJ login log.';
		} finally {
			loading = false;
		}
	}

	async function runLoginNow() {
		running = true;
		error = '';
		try {
			await callOljLoginNow();
			log = await getLatestOljLoginLog();
			return true;
		} catch (err: unknown) {
			console.error('Failed to run OLJ login:', err);
			error = err instanceof Error ? err.message : 'Failed to run OLJ login.';
			try {
				log = await getLatestOljLoginLog();
			} catch {
				/* keep existing log */
			}
			return false;
		} finally {
			running = false;
		}
	}

	return {
		get log() {
			return log;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get running() {
			return running;
		},
		loadLog,
		runLoginNow,
	};
}
