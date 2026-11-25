import { env } from '$env/dynamic/public';

export const SITE_URL: string = (env.PUBLIC_SITE_URL ?? 'https://mikasjames.com').replace(
	/\/$/,
	'',
);

export const RESUME_URL = '/resume.pdf';
export const RESUME_DOWNLOAD_NAME = 'Mikas-James-Arayata-Resume.pdf';
