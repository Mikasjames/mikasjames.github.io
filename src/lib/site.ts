import { env } from "$env/dynamic/public";

export const SITE_URL: string = (
	env.PUBLIC_SITE_URL ?? "https://mikasjames.com"
).replace(/\/$/, "");
