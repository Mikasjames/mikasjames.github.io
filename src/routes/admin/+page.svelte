<script lang="ts">
	import { onMount, tick } from "svelte";
	import { goto } from "$app/navigation";
	import CoverImage from "$lib/components/CoverImage.svelte";
	import { subscribeToAuth, logout } from "$lib/firebase/auth";
	import {
		createPost,
		getPosts,
		updatePost,
		deletePost,
		getMediaItems,
		addMediaItem,
		deleteMediaItem,
		type BlogPost,
		type ImageMeta,
		type MediaItem,
		getJournalEntries,
		createJournalEntry,
		updateJournalEntry,
		deleteJournalEntry,
		type JournalEntry,
		getRecentMediaItems,
		getHabits,
		addHabit,
		deleteHabit,
		updateHabitOrder,
		getHabitLogsForJournalEntry,
		deleteHabitLogsForJournalEntry,
		upsertHabitLog,
		getLatestMonthlyInsight,
		getMonthlyInsightByPeriod,
		type Habit,
		type MonthlyInsight,
		type InsightScope,
	} from "$lib/firebase/firestore.svelte";
	import {
		extractImageUrlsFromMarkdown,
		sanitizeImageMetaFromMarkdown,
		removeImageReferencesFromMarkdown,
		compressAndGetMeta,
		resolveMissingImageMeta,
	} from "$lib/utils/imageMeta";
	import { uploadImage, deleteImage } from "$lib/firebase/storage";
	import type { User } from "firebase/auth";
	import MediaGalleryDialog from "$lib/components/MediaGalleryDialog.svelte";
	import ContentImagesHelper from "$lib/components/ContentImagesHelper.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";

	let user = $state<User | null>(null);
	let authReady = $state(false);

	$effect(() => {
		const unsub = subscribeToAuth((u) => {
			user = u;
			authReady = true;
			if (!u) goto("/admin/login/");
		});
		return unsub;
	});

	let posts = $state<BlogPost[]>([]);
	let postsLoading = $state(false);

	let blogForm = $state({
		id: null as string | null,
		title: "",
		slug: "",
		excerpt: "",
		content: "",
		status: "published" as "draft" | "published" | "unlisted",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		slugManuallyEdited: false,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let journalForm = $state({
		id: null as string | null,
		title: "",
		excerpt: "",
		content: "",
		coverImage: null as string | null,
		imageMeta: {} as Record<string, ImageMeta>,
		happinessRating: 3,
		submitting: false,
		successMsg: "",
		error: "",
		coverUploading: false,
		coverError: "",
	});

	let contentUploading = $state(false);
	let contentUploadError = $state("");

	let activeTab = $state<"write" | "preview">("write");
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	let showMediaGallery = $state(false);
	let mediaLoaded = $state(false);
	let mediaItems = $state<MediaItem[]>([]);
	let recentMediaItems = $state<MediaItem[]>([]);
	let mediaLoading = $state(false);
	let mediaUploading = $state(false);
	let mediaUploadError = $state("");
	let mediaLoadError = $state("");
	let deletingMediaIds = $state<Set<string>>(new Set());

	let currentSection = $state<"blogs" | "journal" | "insights">("blogs");
	let journalEntries = $state<JournalEntry[]>([]);
	let journalEntriesLoading = $state(false);
	let journalEntriesLoadError = $state("");
	let habits = $state<Habit[]>([]);
	let selectedHabitIds = $state<Set<string>>(new Set());
	let selectedJournalEntryDate = $state<string | null>(null);
	let habitsLoading = $state(false);
	let habitsError = $state("");
	let showHabitManager = $state(false);
	let habitForm = $state({
		name: "",
		emoji: "",
		submitting: false,
		error: "",
	});
	let insight = $state<MonthlyInsight | null>(null);
	let insightsLoading = $state(false);
	let insightsError = $state("");
	let insightsTab = $state<"monthly" | "yearToDate">("monthly");
	let selectedInsightPeriod = $state("");

	let blogSearch = $state("");
	let blogStatusFilter = $state<"all" | "published" | "unlisted" | "draft">(
		"all",
	);
	let blogSort = $state<"newest" | "oldest">("newest");

	let journalSearch = $state("");
	let journalSort = $state<"newest" | "oldest">("newest");

	let selectedInsightScope = $derived<InsightScope | null>(
		insight
			? insightsTab === "monthly"
				? (insight.monthly ?? null)
				: (insight.yearToDate ?? null)
			: null,
	);

	let selectedInsightResult = $derived<any>(
		selectedInsightScope?.textAnalysis?.source === "groq-api"
			? selectedInsightScope.textAnalysis.result
			: null,
	);

	let selectedLocalAnalysis = $derived<any>(
		selectedInsightScope?.textAnalysis?.source === "local-fallback"
			? selectedInsightScope.textAnalysis
			: selectedInsightScope?.textAnalysis?.fallback,
	);

	let filteredPosts = $derived.by(() => {
		let result = posts;
		if (blogSearch.trim()) {
			const q = blogSearch.toLowerCase();
			const primaryMatches = result.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.slug.toLowerCase().includes(q) ||
					p.excerpt.toLowerCase().includes(q),
			);
			result =
				primaryMatches.length > 0
					? primaryMatches
					: result.filter((p) => p.content.toLowerCase().includes(q));
		}
		if (blogStatusFilter !== "all") {
			result = result.filter((p) => p.status === blogStatusFilter);
		}
		return blogSort === "oldest"
			? [...result].sort(
					(a, b) =>
						(a.createdAt?.getTime() ?? 0) -
						(b.createdAt?.getTime() ?? 0),
				)
			: result;
	});

	let filteredJournals = $derived.by(() => {
		let result = journalEntries;
		if (journalSearch.trim()) {
			const q = journalSearch.toLowerCase();
			const primaryMatches = result.filter(
				(e) =>
					e.title.toLowerCase().includes(q) ||
					(e.excerpt ?? "").toLowerCase().includes(q),
			);
			result =
				primaryMatches.length > 0
					? primaryMatches
					: result.filter((e) => e.content.toLowerCase().includes(q));
		}
		return journalSort === "oldest"
			? [...result].sort(
					(a, b) =>
						(a.createdAt?.getTime() ?? 0) -
						(b.createdAt?.getTime() ?? 0),
				)
			: result;
	});

	function getEditorContent(): string {
		return currentSection === "journal"
			? journalForm.content
			: blogForm.content;
	}

	function setEditorContent(value: string) {
		if (currentSection === "journal") {
			journalForm.content = value;
		} else {
			blogForm.content = value;
		}
	}

	function getHappinessLabel(rating: number) {
		if (rating <= 1) return "Very low";
		if (rating === 2) return "Low";
		if (rating === 3) return "Steady";
		if (rating === 4) return "Good";
		return "Great";
	}

	function getEditorImageMeta(): Record<string, ImageMeta> {
		return currentSection === "journal"
			? journalForm.imageMeta
			: blogForm.imageMeta;
	}

	function setEditorImageMeta(meta: Record<string, ImageMeta>) {
		if (currentSection === "journal") {
			journalForm.imageMeta = meta;
		} else {
			blogForm.imageMeta = meta;
		}
	}

	function mergeEditorImageMeta(url: string, dims: ImageMeta) {
		const meta = getEditorImageMeta();
		setEditorImageMeta({ ...meta, [url]: dims });
	}

	function setEditorCoverImage(url: string | null) {
		if (currentSection === "journal") {
			journalForm.coverImage = url;
		} else {
			blogForm.coverImage = url;
		}
	}

	$effect(() => {
		if (!blogForm.slugManuallyEdited && !blogForm.id) {
			blogForm.slug = blogForm.title
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-");
		}
	});

	function onSlugInput(e: Event) {
		blogForm.slug = (e.target as HTMLInputElement).value;
		blogForm.slugManuallyEdited = true;
	}

	async function loadPosts() {
		postsLoading = true;
		try {
			posts = await getPosts();
		} finally {
			postsLoading = false;
		}
	}

	async function loadJournalEntries() {
		journalEntriesLoading = true;
		journalEntriesLoadError = "";
		try {
			journalEntries = await getJournalEntries();
		} catch (err: unknown) {
			console.error("Failed to load journal entries:", err);
			journalEntriesLoadError =
				err instanceof Error
					? err.message
					: "Failed to load journal entries. Check Firestore rules.";
		} finally {
			journalEntriesLoading = false;
		}
	}

	function todayDateKey() {
		return new Date().toLocaleDateString("en-CA");
	}

	function dateKeyFromDate(date: Date | null | undefined) {
		return date ? date.toLocaleDateString("en-CA") : todayDateKey();
	}

	async function loadHabits() {
		if (!user) return;
		habitsLoading = true;
		habitsError = "";
		try {
			habits = await getHabits(user.uid);
		} catch (err: unknown) {
			console.error("Failed to load habits:", err);
			habitsError =
				err instanceof Error ? err.message : "Failed to load habits.";
		} finally {
			habitsLoading = false;
		}
	}

	function toggleHabit(habitId: string) {
		const next = new Set(selectedHabitIds);
		if (next.has(habitId)) {
			next.delete(habitId);
		} else {
			next.add(habitId);
		}
		selectedHabitIds = next;
	}

	async function handleAddHabit() {
		if (!user) return;
		if (!habitForm.name.trim()) {
			habitForm.error = "Habit name is required.";
			return;
		}
		habitForm.submitting = true;
		habitForm.error = "";
		try {
			await addHabit({
				name: habitForm.name.trim(),
				emoji: habitForm.emoji.trim() || "•",
				ownerUid: user.uid,
				order: habits.length,
			});
			habitForm.name = "";
			habitForm.emoji = "";
			await loadHabits();
		} catch (err: unknown) {
			habitForm.error =
				err instanceof Error ? err.message : "Failed to add habit.";
		} finally {
			habitForm.submitting = false;
		}
	}

	async function handleDeleteHabit(habit: Habit) {
		if (!confirm(`Delete "${habit.name}" from habits?`)) return;
		habitsError = "";
		try {
			await deleteHabit(habit.id);
			await loadHabits();
		} catch (err: unknown) {
			habitsError =
				err instanceof Error ? err.message : "Failed to delete habit.";
		}
	}

	async function moveHabit(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= habits.length) return;
		const reordered = [...habits];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(targetIndex, 0, moved);
		habits = reordered.map((habit, order) => ({ ...habit, order }));
		try {
			await Promise.all(
				habits.map((habit, order) => updateHabitOrder(habit.id, order)),
			);
			await loadHabits();
		} catch (err: unknown) {
			habitsError =
				err instanceof Error
					? err.message
					: "Failed to reorder habits.";
			await loadHabits(); // reload to restore server state
		}
	}

	async function loadSelectedHabitLogs(journalEntryId: string) {
		if (!user) return;
		try {
			const logs = await getHabitLogsForJournalEntry(
				user.uid,
				journalEntryId,
			);
			if (journalForm.id === journalEntryId) {
				selectedHabitIds = new Set(logs.map((log) => log.habitId));
			}
		} catch (err: unknown) {
			console.error("Failed to load habit logs for journal entry:", err);
			habitsError =
				err instanceof Error
					? err.message
					: "Failed to load habit logs for this entry.";
			selectedHabitIds = new Set();
		}
	}

	async function saveSelectedHabitLogs(journalEntryId: string, date: string) {
		if (!user) return;
		await deleteHabitLogsForJournalEntry(user.uid, journalEntryId);
		const selectedHabits = habits.filter((habit) =>
			selectedHabitIds.has(habit.id),
		);
		await Promise.all(
			selectedHabits.map((habit) =>
				upsertHabitLog({
					habit,
					ownerUid: user!.uid,
					date,
					journalEntryId,
				}),
			),
		);
	}

	async function loadLatestInsight() {
		if (!user) return;
		insightsLoading = true;
		insightsError = "";
		try {
			insight = await getLatestMonthlyInsight(user.uid);
			selectedInsightPeriod = insight?.period ?? currentPeriodKey();
		} catch (err: unknown) {
			console.error("Failed to load insights:", err);
			insightsError =
				err instanceof Error ? err.message : "Failed to load insights.";
		} finally {
			insightsLoading = false;
		}
	}

	async function loadInsightPeriod(period: string) {
		if (!user) return;
		insightsLoading = true;
		insightsError = "";
		try {
			selectedInsightPeriod = period;
			insight = await getMonthlyInsightByPeriod(user.uid, period);
		} catch (err: unknown) {
			console.error("Failed to load insight period:", err);
			insightsError =
				err instanceof Error ? err.message : "Failed to load insight.";
		} finally {
			insightsLoading = false;
		}
	}

	function shiftPeriod(period: string, delta: number) {
		const [year, month] = period.split("-").map(Number);
		const next = new Date(Date.UTC(year, month - 1 + delta, 1));
		return `${next.getUTCFullYear()}-${String(
			next.getUTCMonth() + 1,
		).padStart(2, "0")}`;
	}

	function currentPeriodKey() {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
			2,
			"0",
		)}`;
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
						: pad +
							((point.time - minTime) / (maxTime - minTime)) *
								(width - pad * 2);
				const y = pad + ((5 - point.rating) / 4) * (height - pad * 2);
				return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(
					1,
				)}`;
			})
			.join(" ");
	}

	function habitCompletedOnDate(dates: string[], day: number) {
		const date = `${selectedInsightPeriod}-${String(day).padStart(2, "0")}`;
		return dates.includes(date);
	}
	async function loadRecentMedia() {
		try {
			recentMediaItems = await getRecentMediaItems(4);
		} catch (err) {
			console.error("Failed to load recent media:", err);
		}
	}

	onMount(async () => {
		await new Promise<void>((res) => {
			const check = setInterval(() => {
				if (authReady) {
					clearInterval(check);
					res();
				}
			}, 50);
		});
		if (user) {
			await loadPosts();
			await loadRecentMedia();
			await loadJournalEntries();
			await loadHabits();
			await loadLatestInsight();
		}
	});

	async function handlePublish(e: Event) {
		e.preventDefault();
		if (
			!blogForm.title ||
			!blogForm.slug ||
			!blogForm.excerpt ||
			!blogForm.content
		) {
			blogForm.error = "All fields are required.";
			return;
		}

		blogForm.submitting = true;
		blogForm.error = "";
		blogForm.successMsg = "";

		try {
			const resolvedImageMeta = await resolveMissingImageMeta(
				blogForm.content,
				blogForm.imageMeta,
			);
			const sanitizedImageMeta = sanitizeImageMetaFromMarkdown(
				blogForm.content,
				resolvedImageMeta,
			);
			blogForm.imageMeta = sanitizedImageMeta;

			const postPayload = {
				title: blogForm.title,
				slug: blogForm.slug,
				excerpt: blogForm.excerpt,
				content: blogForm.content,
				coverImage: blogForm.coverImage,
				status: blogForm.status,
				imageMeta: sanitizedImageMeta,
			};

			if (blogForm.id) {
				await updatePost(blogForm.id, postPayload);
				blogForm.successMsg = `"${blogForm.title}" updated successfully!`;
			} else {
				await createPost(postPayload);
				blogForm.successMsg = `"${blogForm.title}" published successfully!`;
			}
			resetForm();
			await loadPosts();
		} catch (err: unknown) {
			blogForm.error =
				err instanceof Error ? err.message : "Failed to save post.";
		} finally {
			blogForm.submitting = false;
		}
	}

	async function handleJournalCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		journalForm.coverUploading = true;
		journalForm.coverError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(
				compressedFile,
				"journal-cover-images",
			);
			journalForm.coverImage = url;
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			if (showMediaGallery) {
				await loadMediaItems();
			} else {
				await loadRecentMedia();
				mediaLoaded = false;
			}
		} catch (err: unknown) {
			journalForm.coverError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			journalForm.coverUploading = false;
			target.value = "";
		}
	}

	async function handleJournalSubmit(e: Event) {
		e.preventDefault();
		if (!journalForm.content) {
			journalForm.error = "Content is required.";
			return;
		}

		journalForm.submitting = true;
		journalForm.error = "";
		journalForm.successMsg = "";
		try {
			const resolvedImageMeta = await resolveMissingImageMeta(
				journalForm.content,
				journalForm.imageMeta,
			);
			const sanitizedImageMeta = sanitizeImageMetaFromMarkdown(
				journalForm.content,
				resolvedImageMeta,
			);
			journalForm.imageMeta = sanitizedImageMeta;

			const payload = {
				title: journalForm.title || "Untitled Entry",
				excerpt: journalForm.excerpt,
				content: journalForm.content,
				coverImage: journalForm.coverImage,
				imageMeta: sanitizedImageMeta,
				happinessRating: journalForm.happinessRating,
				ownerUid: user?.uid,
			};

			if (journalForm.id) {
				await updateJournalEntry(journalForm.id, payload);
				await saveSelectedHabitLogs(
					journalForm.id,
					selectedJournalEntryDate ?? todayDateKey(),
				);
				journalForm.successMsg = "Journal entry updated successfully!";
			} else {
				const entryId = await createJournalEntry(payload);
				await saveSelectedHabitLogs(entryId, todayDateKey());
				journalForm.successMsg = "Journal entry added successfully!";
			}
			resetJournalForm();
			await loadJournalEntries();
			await loadHabits();
		} catch (err: unknown) {
			journalForm.error =
				err instanceof Error
					? err.message
					: "Failed to save journal entry.";
		} finally {
			journalForm.submitting = false;
		}
	}

	async function startEditJournal(entry: JournalEntry) {
		journalForm.id = entry.id;
		journalForm.title = entry.title;
		journalForm.excerpt = entry.excerpt || "";
		journalForm.content = entry.content;
		journalForm.coverImage = entry.coverImage || null;
		journalForm.happinessRating = entry.happinessRating ?? 3;
		selectedJournalEntryDate = dateKeyFromDate(entry.createdAt);
		selectedHabitIds = new Set();
		journalForm.imageMeta = sanitizeImageMetaFromMarkdown(
			entry.content,
			enrichImageMetaFromGallery(entry.content, entry.imageMeta ?? {}),
		);
		journalForm.successMsg = "";
		journalForm.error = "";
		await loadSelectedHabitLogs(entry.id);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetJournalForm() {
		journalForm.id = null;
		journalForm.title = "";
		journalForm.excerpt = "";
		journalForm.content = "";
		journalForm.coverImage = null;
		journalForm.imageMeta = {};
		journalForm.happinessRating = 3;
		journalForm.successMsg = "";
		journalForm.error = "";
		selectedJournalEntryDate = null;
		selectedHabitIds = new Set();
	}

	async function handleDeleteJournal(entry: JournalEntry) {
		if (!confirm(`Are you sure you want to delete this journal entry?`)) {
			return;
		}
		try {
			await deleteJournalEntry(entry.id);
			if (journalForm.id === entry.id) {
				resetJournalForm();
			}
			await loadJournalEntries();
		} catch (err: unknown) {
			alert(
				err instanceof Error
					? err.message
					: "Failed to delete journal entry.",
			);
		}
	}

	function enrichImageMetaFromGallery(
		markdown: string,
		currentImageMeta: Record<string, ImageMeta>,
	): Record<string, ImageMeta> {
		const urls = extractImageUrlsFromMarkdown(markdown);
		return urls.reduce(
			(acc, url) => {
				if (currentImageMeta[url]) {
					acc[url] = currentImageMeta[url];
					return acc;
				}

				const media = mediaItems.find((item) => item.url === url);
				if (media?.width && media?.height) {
					acc[url] = {
						width: media.width,
						height: media.height,
					};
				}
				return acc;
			},
			{} as Record<string, ImageMeta>,
		);
	}

	function startEdit(post: BlogPost) {
		blogForm.id = post.id;
		blogForm.title = post.title;
		blogForm.slug = post.slug;
		blogForm.excerpt = post.excerpt;
		blogForm.content = post.content;
		blogForm.coverImage = post.coverImage;
		blogForm.status = post.status ?? "published";
		blogForm.imageMeta = sanitizeImageMetaFromMarkdown(
			post.content,
			enrichImageMetaFromGallery(post.content, post.imageMeta ?? {}),
		);
		blogForm.slugManuallyEdited = true;
		blogForm.successMsg = "";
		blogForm.error = "";
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	function resetForm() {
		blogForm.id = null;
		blogForm.title = "";
		blogForm.slug = "";
		blogForm.excerpt = "";
		blogForm.content = "";
		blogForm.coverImage = null;
		blogForm.status = "published";
		blogForm.imageMeta = {};
		blogForm.slugManuallyEdited = false;
		blogForm.successMsg = "";
		blogForm.error = "";
	}

	async function handleDelete(post: BlogPost) {
		if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
			return;
		}
		try {
			await deletePost(post.id);
			if (blogForm.id === post.id) {
				resetForm();
			}
			await loadPosts();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete post.",
			);
		}
	}

	async function handleCoverUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		blogForm.coverUploading = true;
		blogForm.coverError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "cover-images");
			blogForm.coverImage = url;
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			if (showMediaGallery) {
				await loadMediaItems();
			} else {
				await loadRecentMedia();
				mediaLoaded = false;
			}
		} catch (err: unknown) {
			blogForm.coverError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			blogForm.coverUploading = false;
			target.value = "";
		}
	}

	async function handleContentUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		contentUploading = true;
		contentUploadError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			mergeEditorImageMeta(url, { width, height });
			await loadRecentMedia();
			mediaLoaded = false;
			await insertMarkdownAtCursor(url, file.name.split(".")[0], {
				width,
				height,
			});
		} catch (err: unknown) {
			contentUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			contentUploading = false;
			target.value = "";
		}
	}

	async function insertMarkdownAtCursor(
		url: string,
		altText: string,
		dims?: { width?: number; height?: number },
	) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		if (dims?.width && dims?.height) {
			mergeEditorImageMeta(url, {
				width: dims.width,
				height: dims.height,
			});
		}

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = getEditorContent();

		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const tag = `![${altText}](${url})`;
		const newValue = before + tag + after;

		textareaRef.value = newValue;
		setEditorContent(newValue);

		textareaRef.focus();
		textareaRef.selectionStart = textareaRef.selectionEnd =
			start + tag.length;

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + tag.length;
		}
	}

	async function insertTextAtCursor(textToInsert: string) {
		activeTab = "write";
		await tick();
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const text = getEditorContent();
		const before = text.substring(0, start);
		const after = text.substring(end, text.length);
		const newValue = before + textToInsert + after;

		textareaRef.value = newValue;
		setEditorContent(newValue);

		await tick();

		if (textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.selectionEnd =
				start + textToInsert.length;
		}
	}

	async function insertCurrentJournalTimestamp() {
		const now = new Date();
		const stamp = now.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
		await insertTextAtCursor(`\n\n### ${stamp}\n\n`);
	}

	async function loadMediaItems() {
		mediaLoading = true;
		mediaLoadError = "";
		try {
			mediaItems = await getMediaItems();
			mediaLoaded = true;
		} catch (err) {
			console.error("Failed to load media items:", err);
			mediaLoadError =
				err instanceof Error
					? err.message
					: "Failed to load gallery items.";
		} finally {
			mediaLoading = false;
		}
	}

	async function openMediaGallery() {
		showMediaGallery = true;
		if (!mediaLoaded) {
			await loadMediaItems();
		}
	}

	async function handleGalleryUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (!target.files || target.files.length === 0) return;
		const file = target.files[0];
		mediaUploading = true;
		mediaUploadError = "";
		try {
			const { compressedFile, width, height } =
				await compressAndGetMeta(file);
			const url = await uploadImage(compressedFile, "blog-content");
			await addMediaItem({
				url,
				name: compressedFile.name,
				width,
				height,
			});
			await loadMediaItems();
		} catch (err: unknown) {
			mediaUploadError =
				err instanceof Error ? err.message : "Upload failed.";
		} finally {
			mediaUploading = false;
			target.value = "";
		}
	}

	async function handleDeleteMedia(item: MediaItem) {
		if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
			return;
		}
		deletingMediaIds.add(item.id);
		deletingMediaIds = new Set(deletingMediaIds);
		try {
			await deleteImage(item.url);
			await deleteMediaItem(item.id);
			blogForm.imageMeta = { ...blogForm.imageMeta };
			delete blogForm.imageMeta[item.url];
			journalForm.imageMeta = { ...journalForm.imageMeta };
			delete journalForm.imageMeta[item.url];
			blogForm.content = removeImageReferencesFromMarkdown(
				blogForm.content,
				item.url,
			);
			journalForm.content = removeImageReferencesFromMarkdown(
				journalForm.content,
				item.url,
			);
			await loadMediaItems();
			await loadRecentMedia();
		} catch (err: unknown) {
			alert(
				err instanceof Error ? err.message : "Failed to delete image.",
			);
		} finally {
			deletingMediaIds.delete(item.id);
			deletingMediaIds = new Set(deletingMediaIds);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			alert("Copied markdown image tag to clipboard!");
		});
	}

	async function handleLogout() {
		await logout();
		goto("/admin/login/");
	}

	function formatDate(d: Date | null) {
		if (!d) return "—";
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
</script>

<svelte:head>
	<title>Admin Dashboard · Mikas James</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !authReady}
	<div class="min-h-screen bg-[#09090b] flex items-center justify-center">
		<div
			class="w-6 h-6 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin"
		></div>
	</div>
{:else if user}
	<div
		class="min-h-screen bg-[#09090b] px-3 pt-16 pb-12 sm:px-4 sm:pt-20 sm:pb-16 lg:px-6"
	>
		<div
			class="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"
		></div>

		<div class="relative mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
			<div
				class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="min-w-0">
					<p
						class="font-mono text-xs text-accent-400 tracking-widest uppercase mb-1"
					>
						&gt;_ admin
					</p>
					<h1 class="text-2xl font-bold text-zinc-100">Dashboard</h1>
					<p class="mt-0.5 break-words text-sm text-zinc-500">
						Signed in as <span class="text-zinc-300"
							>{user.email}</span
						>
					</p>
				</div>
				<div
					class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3 sm:self-auto"
				>
					<a
						href={currentSection === "blogs"
							? "/blogs/"
							: "/journal/"}
						class="rounded-lg border border-zinc-700/60 px-3 py-2 text-center text-sm font-medium text-zinc-400 transition-all duration-200 hover:border-zinc-600 hover:text-zinc-200 sm:px-4"
					>
						View {currentSection === "blogs" ? "Blog" : "Journal"}
					</a>
					<button
						id="admin-logout-btn"
						onclick={handleLogout}
						class="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-zinc-700 sm:px-4"
					>
						Sign Out
					</button>
				</div>
			</div>

			<div
				class="flex gap-5 overflow-x-auto border-b border-zinc-800/40 sm:gap-6"
			>
				<button
					type="button"
					onclick={() => (currentSection = "blogs")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'blogs'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Blog Posts
					{#if currentSection === "blogs"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "journal")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'journal'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Personal Journal
					{#if currentSection === "journal"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (currentSection = "insights")}
					class="relative shrink-0 pb-3 text-sm font-semibold tracking-wide transition-all duration-200 {currentSection ===
					'insights'
						? 'text-accent-400'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					Insights
					{#if currentSection === "insights"}
						<span
							class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500 rounded-t-full"
						></span>
					{/if}
				</button>
			</div>

			{#if currentSection === "blogs"}
				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<h2
						class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
					>
						{#if blogForm.id}
							<svg
								class="w-4 h-4 text-accent-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
							Edit Post
						{:else}
							<svg
								class="w-4 h-4 text-accent-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New Post
						{/if}
					</h2>

					<form
						id="publish-form"
						onsubmit={handlePublish}
						class="space-y-5"
					>
						<div class="space-y-1.5">
							<label
								for="post-title"
								class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
								>Title</label
							>
							<input
								id="post-title"
								type="text"
								bind:value={blogForm.title}
								required
								placeholder="My Awesome Post"
								class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
							/>
						</div>

						<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div class="space-y-1.5">
								<label
									for="post-slug"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
								>
									Slug
									<span
										class="ml-1 text-zinc-600 normal-case font-normal"
										>(auto-generated)</span
									>
								</label>
								<input
									id="post-slug"
									type="text"
									value={blogForm.slug}
									oninput={onSlugInput}
									required
									placeholder="my-awesome-post"
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 font-mono focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>
							</div>

							<div class="space-y-1.5">
								<label
									for="post-status"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
									>Status</label
								>
								<select
									id="post-status"
									bind:value={blogForm.status}
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								>
									<option value="published">Published</option>
									<option value="unlisted">Unlisted</option>
									<option value="draft">Draft</option>
								</select>
							</div>
						</div>

						<CoverImage
							bind:coverImage={blogForm.coverImage}
							onCoverUpload={handleCoverUpload}
							coverUploading={blogForm.coverUploading}
							coverError={blogForm.coverError}
						/>

						<div class="space-y-1.5">
							<label
								for="post-excerpt"
								class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
								>Excerpt</label
							>
							<textarea
								id="post-excerpt"
								bind:value={blogForm.excerpt}
								required
								rows="2"
								placeholder="A short summary shown in the blog listing…"
								class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 resize-none focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
							></textarea>
						</div>

						<div class="space-y-2">
							<MarkdownEditor
								id="post-content"
								bind:content={blogForm.content}
								bind:imageMeta={blogForm.imageMeta}
								bind:textareaRef
								bind:activeTab
								onOpenMediaGallery={openMediaGallery}
								placeholderText="Write your post content here…&#10;&#10;## Heading&#10;&#10;Markdown is supported."
							/>
						</div>

						<ContentImagesHelper
							onOpenMediaGallery={openMediaGallery}
							{handleContentUpload}
							{contentUploading}
							{contentUploadError}
							{recentMediaItems}
							{mediaLoadError}
							{insertMarkdownAtCursor}
							{setEditorCoverImage}
						/>

						{#if blogForm.error}
							<div
								class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
							>
								<svg
									class="w-4 h-4 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{blogForm.error}
							</div>
						{/if}

						{#if blogForm.successMsg}
							<div
								class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
							>
								<svg
									class="w-4 h-4 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
								{blogForm.successMsg}
							</div>
						{/if}

						<div
							class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
						>
							{#if blogForm.id}
								<button
									type="button"
									onclick={resetForm}
									class="w-full rounded-lg border border-zinc-700/60 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-zinc-100 sm:w-auto"
								>
									Cancel Edit
								</button>
							{/if}

							<button
								id="publish-btn"
								type="submit"
								disabled={blogForm.submitting}
								class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/20 transition-all duration-200 hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
							>
								{#if blogForm.submitting}
									<div
										class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
									></div>
									{#if blogForm.id}Saving…{:else}Publishing…{/if}
								{:else}
									<svg
										class="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{#if blogForm.id}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
											/>
										{:else}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
											/>
										{/if}
									</svg>
									{#if blogForm.id}Save Changes{:else}Publish
										Post{/if}
								{/if}
							</button>
						</div>
					</form>
				</section>

				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<div
						class="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
					>
						<div class="relative w-full sm:flex-1 sm:min-w-[180px]">
							<svg
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								bind:value={blogSearch}
								placeholder="Search posts…"
								class="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
							/>
						</div>
						<div
							class="grid w-full grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:w-auto"
						>
							<select
								bind:value={blogStatusFilter}
								class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none md:w-auto"
							>
								<option value="all">All statuses</option>
								<option value="published">Published</option>
								<option value="unlisted">Unlisted</option>
								<option value="draft">Draft</option>
							</select>
							<select
								bind:value={blogSort}
								class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none md:w-auto"
							>
								<option value="newest">Newest first</option>
								<option value="oldest">Oldest first</option>
							</select>
						</div>
					</div>

					{#if blogSearch || blogStatusFilter !== "all"}
						<p class="text-xs text-zinc-500 mb-3">
							{filteredPosts.length} of {posts.length} posts
						</p>
					{/if}

					{#if postsLoading}
						<div
							class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
						>
							<div
								class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
							></div>
							Loading posts…
						</div>
					{:else if filteredPosts.length === 0}
						<p class="text-center py-10 text-zinc-600 text-sm">
							No posts yet. Publish your first one above!
						</p>
					{:else}
						<div class="space-y-2">
							{#each filteredPosts as post (post.id)}
								<div
									class="flex flex-col gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-3 transition-all duration-200 hover:border-zinc-700/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
								>
									<div
										class="flex min-w-0 flex-1 items-center gap-3"
									>
										{#if post.coverImage}
											<img
												src={post.coverImage}
												alt=""
												class="w-10 h-7 object-cover rounded bg-zinc-950 border border-zinc-800 shrink-0"
											/>
										{:else}
											<div
												class="w-10 h-7 rounded bg-zinc-850 border border-zinc-800 flex items-center justify-center shrink-0"
											>
												<svg
													class="w-3.5 h-3.5 text-zinc-600"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
										{/if}

										<div class="flex-1 min-w-0">
											<div
												class="flex items-center gap-2 flex-wrap"
											>
												<p
													class="text-sm font-medium text-zinc-200 truncate"
												>
													{post.title}
												</p>
												{#if post.status === "draft"}
													<span
														class="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-medium text-zinc-450 border border-zinc-700/50 uppercase tracking-wider font-mono shrink-0"
														>Draft</span
													>
												{:else if post.status === "unlisted"}
													<span
														class="px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] font-medium text-amber-400 border border-amber-500/20 uppercase tracking-wider font-mono shrink-0"
														>Unlisted</span
													>
												{:else}
													<span
														class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono shrink-0"
														>Published</span
													>
												{/if}
											</div>
											<p
												class="text-xs text-zinc-650 font-mono mt-0.5 truncate"
											>
												/blogs/{post.slug}
											</p>
										</div>
									</div>

									<div
										class="flex flex-wrap items-center justify-between gap-2 pl-[3.25rem] sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1 sm:pl-0"
									>
										<span
											class="text-xs text-zinc-600 whitespace-nowrap"
											>{formatDate(post.createdAt)}</span
										>
										<div
											class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:shrink-0"
										>
											<a
												href="/blogs/{post.slug}/"
												target="_blank"
												class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
											>
												View
											</a>
											<button
												type="button"
												onclick={() => startEdit(post)}
												class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() =>
													handleDelete(post)}
												class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if currentSection === "journal"}
				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<h2
						class="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2"
					>
						{#if journalForm.id}
							<svg
								class="w-4 h-4 text-accent-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
							Edit Journal Entry
						{:else}
							<svg
								class="w-4 h-4 text-accent-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New Journal Entry
						{/if}
					</h2>

					<form onsubmit={handleJournalSubmit} class="space-y-5">
						<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div class="space-y-1.5">
								<label
									for="journal-title"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
									>Title (Optional)</label
								>
								<input
									id="journal-title"
									type="text"
									bind:value={journalForm.title}
									placeholder="Untitled Entry"
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>
							</div>
							<div class="space-y-1.5">
								<label
									for="journal-excerpt"
									class="block text-xs font-medium text-zinc-400 tracking-wide uppercase"
									>Excerpt <span
										class="normal-case font-normal text-zinc-600"
										>(Optional)</span
									></label
								>
								<input
									id="journal-excerpt"
									type="text"
									bind:value={journalForm.excerpt}
									placeholder="A short summary or mood for this entry…"
									class="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all duration-200"
								/>
							</div>
						</div>

						<div
							class="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
						>
							<div
								class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<label
										for="journal-happiness"
										class="block text-xs font-semibold text-zinc-400 tracking-wide uppercase"
										>Overall Happiness</label
									>
									<p class="mt-1 text-xs text-zinc-550">
										Daily rating for monthly and yearly
										insights.
									</p>
								</div>
								<div
									class="flex items-center gap-2 rounded-lg border border-accent-500/20 bg-accent-500/10 px-3 py-2"
								>
									<span
										class="text-2xl font-bold text-accent-300"
										>{journalForm.happinessRating}</span
									>
									<span
										class="text-xs font-medium text-accent-200"
										>{getHappinessLabel(
											journalForm.happinessRating,
										)}</span
									>
								</div>
							</div>
							<div class="mt-4">
								<input
									id="journal-happiness"
									type="range"
									min="1"
									max="5"
									step="1"
									bind:value={journalForm.happinessRating}
									class="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 accent-accent-500"
								/>
								<div
									class="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-600"
								>
									<span>1 Low</span>
									<span>3 Steady</span>
									<span>5 High</span>
								</div>
							</div>
						</div>

						<CoverImage
							bind:coverImage={journalForm.coverImage}
							onCoverUpload={handleJournalCoverUpload}
							coverUploading={journalForm.coverUploading}
							coverError={journalForm.coverError}
						/>

						<div
							class="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
						>
							<div
								class="flex flex-wrap items-center justify-between gap-3"
							>
								<div>
									<p
										class="text-xs font-semibold uppercase tracking-wide text-zinc-400"
									>
										{journalForm.id
											? "Habits for Entry"
											: "Habits Today"}
									</p>
									{#if habitsError}
										<p class="mt-1 text-xs text-red-400">
											{habitsError}
										</p>
									{/if}
								</div>
								<button
									type="button"
									onclick={() =>
										(showHabitManager = !showHabitManager)}
									class="text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
								>
									Manage Habits
								</button>
							</div>

							{#if habitsLoading}
								<div class="flex flex-wrap gap-2">
									<div
										class="h-9 w-24 animate-pulse rounded-lg bg-zinc-800/70"
									></div>
									<div
										class="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/70"
									></div>
									<div
										class="h-9 w-20 animate-pulse rounded-lg bg-zinc-800/70"
									></div>
								</div>
							{:else if habits.length === 0}
								<p class="text-xs text-zinc-550">
									No habits yet.
								</p>
							{:else}
								<div class="flex flex-wrap gap-2">
									{#each habits as habit (habit.id)}
										<button
											type="button"
											onclick={() =>
												toggleHabit(habit.id)}
											class="rounded-lg border px-3 py-2 text-sm font-medium transition-all {selectedHabitIds.has(
												habit.id,
											)
												? 'border-accent-500/50 bg-accent-600/20 text-accent-200 shadow-lg shadow-accent-600/10'
												: 'border-zinc-700/60 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'}"
										>
											{habit.emoji}
											{habit.name}
										</button>
									{/each}
								</div>
							{/if}

							{#if showHabitManager}
								<div
									class="space-y-3 border-t border-zinc-800/60 pt-4"
								>
									<div class="space-y-2">
										{#each habits as habit, index (habit.id)}
											<div
												class="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 px-3 py-2"
											>
												<span
													class="min-w-0 flex-1 truncate text-sm text-zinc-300"
												>
													{habit.emoji}
													{habit.name}
												</span>
												<button
													type="button"
													onclick={() =>
														moveHabit(index, -1)}
													disabled={index === 0}
													class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
												>
													Up
												</button>
												<button
													type="button"
													onclick={() =>
														moveHabit(index, 1)}
													disabled={index ===
														habits.length - 1}
													class="rounded border border-zinc-700/60 px-2 py-1 text-xs text-zinc-400 transition hover:border-accent-500/50 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
												>
													Down
												</button>
												<button
													type="button"
													onclick={() =>
														handleDeleteHabit(
															habit,
														)}
													class="rounded border border-red-500/20 px-2 py-1 text-xs text-red-400 transition hover:border-red-500/40 hover:text-red-300"
												>
													Delete
												</button>
											</div>
										{/each}
									</div>

									<div
										class="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
									>
										<input
											type="text"
											bind:value={habitForm.emoji}
											placeholder="🙏"
											class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
										/>
										<input
											type="text"
											bind:value={habitForm.name}
											placeholder="Habit name"
											class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
										/>
										<button
											type="button"
											onclick={handleAddHabit}
											disabled={habitForm.submitting}
											class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
										>
											Save
										</button>
									</div>
									{#if habitForm.error}
										<p class="text-xs text-red-400">
											{habitForm.error}
										</p>
									{/if}
								</div>
							{/if}
						</div>

						<div class="space-y-2">
							<div class="flex justify-end">
								<button
									type="button"
									onclick={insertCurrentJournalTimestamp}
									class="inline-flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-all duration-200 hover:border-accent-500/50 hover:text-accent-300"
								>
									<svg
										class="h-3.5 w-3.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									Insert Date & Time
								</button>
							</div>
							<MarkdownEditor
								id="journal-content"
								bind:content={journalForm.content}
								bind:imageMeta={journalForm.imageMeta}
								bind:textareaRef
								bind:activeTab
								onOpenMediaGallery={openMediaGallery}
								placeholderText="What's on your mind today? Markdown is supported."
							/>
						</div>

						<ContentImagesHelper
							onOpenMediaGallery={openMediaGallery}
							{handleContentUpload}
							{contentUploading}
							{contentUploadError}
							{recentMediaItems}
							{mediaLoadError}
							{insertMarkdownAtCursor}
							{setEditorCoverImage}
						/>

						{#if journalForm.error}
							<div
								class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
							>
								<svg
									class="w-4 h-4 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{journalForm.error}
							</div>
						{/if}

						{#if journalForm.successMsg}
							<div
								class="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
							>
								<svg
									class="w-4 h-4 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
								{journalForm.successMsg}
							</div>
						{/if}

						<div
							class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
						>
							{#if journalForm.id}
								<button
									type="button"
									onclick={resetJournalForm}
									class="w-full rounded-lg border border-zinc-700/60 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition-all duration-200 hover:border-zinc-500 hover:text-zinc-100 sm:w-auto"
								>
									Cancel Edit
								</button>
							{/if}

							<button
								type="submit"
								disabled={journalForm.submitting}
								class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-600/20 transition-all duration-200 hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
							>
								{#if journalForm.submitting}
									<div
										class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
									></div>
									Saving…
								{:else}
									<svg
										class="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										{#if journalForm.id}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
											/>
										{:else}
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
											/>
										{/if}
									</svg>
									{#if journalForm.id}Save Changes{:else}Save
										Entry{/if}
								{/if}
							</button>
						</div>
					</form>
				</section>

				<section
					class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
				>
					<div
						class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
					>
						<div class="relative w-full sm:flex-1 sm:min-w-[180px]">
							<svg
								class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								bind:value={journalSearch}
								placeholder="Search entries…"
								class="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
							/>
						</div>
						<select
							bind:value={journalSort}
							class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none sm:w-auto"
						>
							<option value="newest">Newest first</option>
							<option value="oldest">Oldest first</option>
						</select>
					</div>

					{#if journalSearch}
						<p class="text-xs text-zinc-500 mb-3">
							{filteredJournals.length} of {journalEntries.length}
							entries
						</p>
					{/if}

					{#if journalEntriesLoading}
						<div
							class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
						>
							<div
								class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
							></div>
							Loading journal entries…
						</div>
					{:else if journalEntriesLoadError}
						<div
							class="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
						>
							<p class="font-semibold">Journal Load Failed:</p>
							<p class="text-zinc-405 leading-normal">
								{journalEntriesLoadError}
							</p>
							<p
								class="text-[10px] text-zinc-500 leading-normal pt-1"
							>
								Please ensure your Firestore Security Rules
								permit authenticated read access to the <code
									class="bg-zinc-900 px-1 py-0.5 rounded text-red-300"
									>journal</code
								>
								collection for your Owner UID.
							</p>
						</div>
					{:else if filteredJournals.length === 0}
						<p class="text-center py-10 text-zinc-650 text-sm">
							No journal entries found. Write your first entry
							above!
						</p>
					{:else}
						<div class="space-y-2">
							{#each filteredJournals as entry (entry.id)}
								<div
									class="flex flex-col gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-3 transition-all duration-200 hover:border-zinc-700/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
								>
									<div class="flex-1 min-w-0">
										<p
											class="text-sm font-medium text-zinc-200 truncate"
										>
											{entry.title || "Untitled Entry"}
										</p>
										<p
											class="text-xs text-zinc-500 font-mono mt-0.5 truncate"
										>
											{entry.excerpt ||
												entry.content.substring(
													0,
													80,
												)}{!entry.excerpt &&
											entry.content.length > 80
												? "..."
												: ""}
										</p>
									</div>

									<div
										class="flex flex-wrap items-center justify-between gap-2 sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1"
									>
										<span
											class="text-xs text-zinc-600 whitespace-nowrap"
											>{formatDate(entry.createdAt)}</span
										>
										<div
											class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:shrink-0"
										>
											<button
												type="button"
												onclick={() =>
													startEditJournal(entry)}
												class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
											>
												Edit
											</button>
											<button
												type="button"
												onclick={() =>
													handleDeleteJournal(entry)}
												class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{:else if currentSection === "insights"}
				<section class="space-y-5">
					<div
						class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
					>
						<div
							class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div
								class="flex items-center justify-center gap-3 sm:justify-start"
							>
								<button
									type="button"
									onclick={() =>
										loadInsightPeriod(
											shiftPeriod(
												selectedInsightPeriod ||
													currentPeriodKey(),
												-1,
											),
										)}
									class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
								>
									←
								</button>
								<p
									class="min-w-40 text-center text-sm font-semibold text-zinc-100"
								>
									{formatInsightPeriod(
										selectedInsightPeriod ||
											currentPeriodKey(),
									)}
								</p>
								<button
									type="button"
									onclick={() =>
										loadInsightPeriod(
											shiftPeriod(
												selectedInsightPeriod ||
													currentPeriodKey(),
												1,
											),
										)}
									class="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
								>
									→
								</button>
							</div>
							<div
								class="grid grid-cols-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-1"
							>
								<button
									type="button"
									onclick={() => (insightsTab = "monthly")}
									class="rounded-md px-3 py-1.5 text-xs font-semibold transition {insightsTab ===
									'monthly'
										? 'bg-accent-600 text-white'
										: 'text-zinc-400 hover:text-zinc-200'}"
								>
									This Month
								</button>
								<button
									type="button"
									onclick={() => (insightsTab = "yearToDate")}
									class="rounded-md px-3 py-1.5 text-xs font-semibold transition {insightsTab ===
									'yearToDate'
										? 'bg-accent-600 text-white'
										: 'text-zinc-400 hover:text-zinc-200'}"
								>
									Year to Date
								</button>
							</div>
						</div>

						{#if selectedInsightPeriod === currentPeriodKey()}
							<div
								class="mt-4 rounded-lg border border-accent-500/20 bg-accent-500/10 px-4 py-3 text-sm text-accent-200"
							>
								This month's insights will be ready on {nextMonthReadyLabel()}.
							</div>
						{/if}

						{#if insightsLoading}
							<div
								class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
							>
								{#each Array(4) as _}
									<div
										class="h-24 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/60"
									></div>
								{/each}
							</div>
						{:else if insightsError}
							<p
								class="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
							>
								{insightsError}
							</p>
						{:else}
							<div
								class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
							>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{typeof selectedInsightScope?.averageRating ===
										"number"
											? `${selectedInsightScope.averageRating.toFixed(1)} / 5`
											: "—"}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Avg Happiness
									</p>
									<p class="mt-2 text-xs text-accent-300">
										{trendLabel(
											selectedInsightScope?.trendSlopePerDay,
										)}
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{selectedInsightScope?.entryCount ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Total Entries
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{selectedInsightScope?.streaks
											?.longestHighDays ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Longest High Streak
									</p>
								</div>
								<div
									class="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4"
								>
									<p class="text-2xl font-bold text-zinc-100">
										{selectedInsightScope?.streaks
											?.longestLowDays ?? 0}
									</p>
									<p
										class="mt-1 text-xs uppercase tracking-wide text-zinc-500"
									>
										Longest Low Streak
									</p>
								</div>
							</div>

							<div
								class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
							>
								<p
									class="mb-3 text-sm font-semibold text-zinc-200"
								>
									Daily Ratings
								</p>
								{#if selectedInsightScope?.dailyRatings?.length}
									<svg
										viewBox="0 0 640 220"
										class="h-56 w-full overflow-visible"
									>
										<line
											x1="24"
											x2="616"
											y1="122"
											y2="122"
											stroke="currentColor"
											class="text-zinc-700"
											stroke-dasharray="4 6"
										/>
										<path
											d={chartPoints(
												selectedInsightScope.dailyRatings,
											)}
											fill="none"
											stroke="currentColor"
											class="text-accent-500"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										{#each selectedInsightScope.dailyRatings as point}
											<circle
												cx={selectedInsightScope
													.dailyRatings.length === 1
													? 320
													: 24 +
														((point.time -
															selectedInsightScope
																.dailyRatings[0]
																.time) /
															(selectedInsightScope
																.dailyRatings[
																selectedInsightScope
																	.dailyRatings
																	.length - 1
															].time -
																selectedInsightScope
																	.dailyRatings[0]
																	.time)) *
															592}
												cy={24 +
													((5 - point.rating) / 4) *
														172}
												r="3"
												fill="currentColor"
												class="text-accent-300"
											/>
										{/each}
									</svg>
								{:else}
									<p
										class="py-8 text-center text-sm text-zinc-550"
									>
										No daily ratings for this scope.
									</p>
								{/if}
							</div>

							<div
								class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
							>
								<p
									class="mb-3 text-sm font-semibold text-zinc-200"
								>
									Groq Insights
								</p>
								{#if selectedInsightScope?.textAnalysis?.source === "groq-api" && selectedInsightResult}
									{#if selectedInsightResult.briefSummary}
										<blockquote
											class="rounded-lg border-l-2 border-accent-500 bg-accent-500/10 px-4 py-3 text-sm text-accent-100"
										>
											"{selectedInsightResult.briefSummary}"
										</blockquote>
									{/if}
									<div class="mt-4 flex flex-wrap gap-2">
										{#if selectedInsightResult.overallSentiment}
											<span
												class="rounded-full border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-1 text-xs text-zinc-300"
												>{selectedInsightResult.overallSentiment}</span
											>
										{/if}
										{#if selectedInsightResult.primaryEmotion}
											<span
												class="rounded-full border border-accent-500/20 bg-accent-500/10 px-2.5 py-1 text-xs text-accent-300"
												>{selectedInsightResult.primaryEmotion}</span
											>
										{/if}
									</div>
									{#if selectedInsightResult.keyThemes?.length}
										<div class="mt-4 flex flex-wrap gap-2">
											{#each selectedInsightResult.keyThemes as theme}
												<span
													class="rounded bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300"
													>{theme}</span
												>
											{/each}
										</div>
									{/if}
									{#if selectedInsightResult.patterns?.length}
										<ul
											class="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-350"
										>
											{#each selectedInsightResult.patterns as pattern}
												<li>{pattern}</li>
											{/each}
										</ul>
									{/if}
									{#if selectedInsightResult.ratingCorrelations?.length}
										<div class="mt-4 overflow-x-auto">
											<table
												class="w-full text-left text-xs"
											>
												<thead class="text-zinc-500">
													<tr
														><th class="py-2"
															>Factor</th
														><th class="py-2"
															>Impact</th
														><th class="py-2"
															>Avg Rating</th
														></tr
													>
												</thead>
												<tbody
													class="divide-y divide-zinc-800/70 text-zinc-300"
												>
													{#each selectedInsightResult.ratingCorrelations as row}
														<tr
															><td class="py-2"
																>{row.factor}</td
															><td class="py-2"
																>{row.impact}</td
															><td class="py-2"
																>{row.averageRating}</td
															></tr
														>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								{:else if selectedLocalAnalysis}
									<p
										class="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500"
									>
										AI analysis unavailable for this period
										— showing keyword data only
									</p>
									<div class="mt-4 grid gap-4 md:grid-cols-2">
										<div>
											<p
												class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												High-rated keywords
											</p>
											<div class="flex flex-wrap gap-2">
												{#each Object.entries(selectedLocalAnalysis.keywordFrequencyByRating?.highRated ?? {}) as [word, count]}
													<span
														class="rounded bg-accent-500/10 px-2 py-1 text-xs text-accent-300"
														>{word} {count}</span
													>
												{/each}
											</div>
										</div>
										<div>
											<p
												class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
											>
												Low-rated keywords
											</p>
											<div class="flex flex-wrap gap-2">
												{#each Object.entries(selectedLocalAnalysis.keywordFrequencyByRating?.lowRated ?? {}) as [word, count]}
													<span
														class="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
														>{word} {count}</span
													>
												{/each}
											</div>
										</div>
									</div>
									<div class="mt-4">
										<p class="mb-2 text-xs text-zinc-550">
											Lexical sentiment
										</p>
										<div
											class="h-2 rounded-full bg-zinc-800"
										>
											<div
												class="h-2 rounded-full bg-accent-500"
												style={`width: ${Math.min(100, Math.max(0, 50 + (selectedLocalAnalysis.sentimentVsRating?.lexicalSentimentScore ?? 0) * 5))}%`}
											></div>
										</div>
									</div>
								{/if}
							</div>

							{#if selectedInsightScope?.habitCorrelations?.length}
								<div
									class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
								>
									<p
										class="mb-3 text-sm font-semibold text-zinc-200"
									>
										Habit Correlations
									</p>
									<div class="grid gap-3 md:grid-cols-2">
										{#each selectedInsightScope.habitCorrelations as correlation}
											<div
												class="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-4"
											>
												<div
													class="flex items-center justify-between gap-2"
												>
													<p
														class="font-semibold text-zinc-100"
													>
														{correlation.habitName}
													</p>
													<span
														class="text-[10px] font-mono text-zinc-500"
													>
														({correlation.completedDaysCount}
														vs {correlation.missedDaysCount}
														d)
													</span>
												</div>
												<div
													class="mt-3 space-y-2 text-xs text-zinc-400"
												>
													<div
														class="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-2"
													>
														<span
															>Completed days avg:</span
														>
														<div
															class="h-2 rounded-full bg-zinc-800"
														>
															<div
																class="h-2 rounded-full bg-accent-500"
																style={`width: ${ratingBarWidth(correlation.averageRatingOnCompletedDays)}`}
															></div>
														</div>
														<span
															class="text-zinc-300"
															>{correlation.averageRatingOnCompletedDays?.toFixed?.(
																1,
															) ?? "—"}</span
														>
													</div>
													<div
														class="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-2"
													>
														<span
															>Missed days avg:</span
														>
														<div
															class="h-2 rounded-full bg-zinc-800"
														>
															<div
																class="h-2 rounded-full bg-zinc-500"
																style={`width: ${ratingBarWidth(correlation.averageRatingOnMissedDays)}`}
															></div>
														</div>
														<span
															class="text-zinc-300"
															>{correlation.averageRatingOnMissedDays?.toFixed?.(
																1,
															) ?? "—"}</span
														>
													</div>
												</div>
												{#if correlation.insight}
													<p
														class="mt-3 text-sm text-zinc-350 italic"
													>
														"{correlation.insight}"
													</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}

							{#if selectedInsightScope?.habitSummary?.byHabit}
								<div
									class="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4"
								>
									<p
										class="mb-3 text-sm font-semibold text-zinc-200"
									>
										Habit Overview
									</p>
									<div class="space-y-4">
										{#each Object.entries(selectedInsightScope.habitSummary.byHabit) as [habitId, habit]}
											<div>
												<div
													class="mb-2 flex items-center justify-between gap-3"
												>
													<p
														class="text-sm text-zinc-300"
													>
														{habit.name}
													</p>
													<p
														class="text-xs font-mono text-zinc-500"
													>
														{habit.count} / {daysInPeriod(
															selectedInsightPeriod,
														)} days
													</p>
												</div>
												<div
													class="flex flex-wrap gap-1"
												>
													{#each Array(daysInPeriod(selectedInsightPeriod)) as _, index}
														<span
															title={`${selectedInsightPeriod}-${String(index + 1).padStart(2, "0")}`}
															class="h-2.5 w-2.5 rounded-full border {habitCompletedOnDate(
																habit.dates,
																index + 1,
															)
																? 'border-accent-500 bg-accent-500'
																: 'border-zinc-700 bg-transparent'}"
														></span>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</section>
			{/if}
		</div>
	</div>

	<MediaGalleryDialog
		bind:showMediaGallery
		{mediaItems}
		{mediaUploading}
		{mediaUploadError}
		{handleGalleryUpload}
		{handleDeleteMedia}
		{copyToClipboard}
		{insertMarkdownAtCursor}
		{setEditorCoverImage}
		{mediaLoading}
		{deletingMediaIds}
	/>
{/if}
