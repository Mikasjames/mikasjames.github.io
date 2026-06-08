import { env } from "$env/dynamic/public";

/** @type {string} */
export const SITE_URL = (
  env.PUBLIC_SITE_URL ?? "https://mikasjames.com"
).replace(/\/$/, "");
