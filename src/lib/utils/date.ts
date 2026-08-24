export function formatDate(d: Date | null): string {
	if (!d) return "—";
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatDateLong(d: Date | null): string {
	if (!d) return "";
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function readingTime(content: string): string {
	const words = content.trim().split(/\s+/).length;
	const mins = Math.max(1, Math.round(words / 200));
	return `${mins} min read`;
}

export function todayDateKey(): string {
	return new Date().toLocaleDateString("en-CA");
}

export function dateKeyFromDate(date: Date | null | undefined): string {
	return date ? date.toLocaleDateString("en-CA") : todayDateKey();
}

export function getHappinessLabel(rating: number): string {
	if (rating <= 1) return "Very low";
	if (rating === 2) return "Low";
	if (rating === 3) return "Steady";
	if (rating === 4) return "Good";
	return "Great";
}
