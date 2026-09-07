export const pwaPromptRoutes = ['/habits', '/journal', '/admin'];

export function shouldShowPwaPrompt(pathname: string): boolean {
	return pwaPromptRoutes.some((route) => pathname.startsWith(route));
}