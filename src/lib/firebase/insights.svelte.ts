import {
	getLatestMonthlyInsight,
	getMonthlyInsightByPeriod,
	type MonthlyInsight,
	type InsightScope,
	type AiAnalysisResult,
	type LocalAnalysis,
} from "./firestore.svelte";

export function createInsightsStore() {
	let insight = $state<MonthlyInsight | null>(null);
	let loading = $state(false);
	let error = $state("");
	let tab = $state<"monthly" | "yearToDate">("monthly");
	let selectedPeriod = $state("");

	const selectedScope = $derived<InsightScope | null>(
		insight
			? tab === "monthly"
				? (insight.monthly ?? null)
				: (insight.yearToDate ?? null)
			: null,
	);

	const selectedResult = $derived<AiAnalysisResult | null>(
		(selectedScope?.textAnalysis?.source === "groq-api" || selectedScope?.textAnalysis?.source === "gemini-api")
			? (selectedScope.textAnalysis.result ?? null)
			: null,
	);

	const selectedLocalAnalysis = $derived<LocalAnalysis | null | undefined>(
		selectedScope?.textAnalysis?.source === "local-fallback"
			? selectedScope.textAnalysis
			: selectedScope?.textAnalysis?.fallback,
	);

	async function loadLatest(userUid: string) {
		loading = true;
		error = "";
		try {
			insight = await getLatestMonthlyInsight(userUid);
			selectedPeriod = insight?.period ?? currentPeriodKey();
		} catch (err: unknown) {
			console.error("Failed to load insights:", err);
			error = err instanceof Error ? err.message : "Failed to load insights.";
		} finally {
			loading = false;
		}
	}

	async function loadPeriod(userUid: string, period: string) {
		loading = true;
		error = "";
		try {
			selectedPeriod = period;
			insight = await getMonthlyInsightByPeriod(userUid, period);
		} catch (err: unknown) {
			console.error("Failed to load insight period:", err);
			error = err instanceof Error ? err.message : "Failed to load insight.";
		} finally {
			loading = false;
		}
	}

	function shiftPeriod(period: string, delta: number) {
		const [year, month] = period.split("-").map(Number);
		const next = new Date(Date.UTC(year, month - 1 + delta, 1));
		return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
	}

	function currentPeriodKey() {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	}

	function nextMonthReadyLabel() {
		const now = new Date();
		const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		return next.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	}

	function formatInsightPeriod(period: string) {
		const [year, month] = period.split("-").map(Number);
		if (!year || !month) return period;
		return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
			month: "long",
			year: "numeric",
		});
	}

	function daysInPeriod(period: string) {
		const [year, month] = period.split("-").map(Number);
		if (!year || !month) return 31;
		return new Date(year, month, 0).getDate();
	}

	function ratingBarWidth(value: number | null | undefined) {
		if (typeof value !== "number") return "0%";
		return `${Math.max(0, Math.min(100, (value / 5) * 100))}%`;
	}

	function trendLabel(value: number | null | undefined) {
		if (typeof value !== "number" || Math.abs(value) < 0.01) {
			return "→ steady";
		}
		return value > 0 ? "↑ improving" : "↓ declining";
	}

	function chartPoints(points: InsightScope["dailyRatings"]) {
		if (!points?.length) return "";
		const width = 640;
		const height = 220;
		const pad = 24;
		const sorted = [...points].sort((a, b) => a.time - b.time);
		const minTime = sorted[0].time;
		const maxTime = sorted[sorted.length - 1].time;
		return sorted
			.map((point, index) => {
				const x =
					maxTime === minTime
						? width / 2
						: pad + ((point.time - minTime) / (maxTime - minTime)) * (width - pad * 2);
				const y = pad + ((5 - point.rating) / 4) * (height - pad * 2);
				return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(" ");
	}

	function habitCompletedOnDate(dates: string[], day: number) {
		const date = `${selectedPeriod}-${String(day).padStart(2, "0")}`;
		return dates.includes(date);
	}

	return {
		get insight() { return insight; },
		get loading() { return loading; },
		get error() { return error; },
		get tab() { return tab; },
		set tab(v) { tab = v; },
		get selectedPeriod() { return selectedPeriod; },
		get selectedScope() { return selectedScope; },
		get selectedResult() { return selectedResult; },
		get selectedLocalAnalysis() { return selectedLocalAnalysis; },
		loadLatest,
		loadPeriod,
		shiftPeriod,
		currentPeriodKey,
		nextMonthReadyLabel,
		formatInsightPeriod,
		daysInPeriod,
		ratingBarWidth,
		trendLabel,
		chartPoints,
		habitCompletedOnDate,
	};
}
