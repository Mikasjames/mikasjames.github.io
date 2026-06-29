<script lang="ts">
	import { formatDate } from "$lib/utils/date";
	import type {
		BlogPost,
		JournalEntry,
	} from "$lib/firebase/firestore.svelte";

	type Entry = BlogPost | JournalEntry;

	interface Props {
		items: Entry[];
		loading: boolean;
		type: "blog" | "journal";
		onEdit: (entry: Entry) => void;
		onDelete: (entry: Entry) => void;
		error?: string;
		onLoadMore?: () => void;
		hasMore?: boolean;
		loadingMore?: boolean;
		onStatusFilterChange?: (status: string | undefined) => void;
	}

	let {
		items,
		loading,
		type,
		onEdit,
		onDelete,
		error,
		onLoadMore = undefined,
		hasMore = false,
		loadingMore = false,
		onStatusFilterChange = undefined,
	}: Props = $props();

	let search = $state("");
	let statusFilter = $state<"all" | "published" | "unlisted" | "draft">(
		"all",
	);
	let sort = $state<"newest" | "oldest">("newest");

	function handleStatusFilterChange() {
		onStatusFilterChange?.(
			statusFilter === "all" ? undefined : statusFilter,
		);
	}

	let filteredItems = $derived.by(() => {
		let result = items;
		if (search.trim()) {
			const q = search.toLowerCase();
			const primaryMatches = result.filter((item) => {
				const title = item.title.toLowerCase();
				const excerpt = (item.excerpt ?? "").toLowerCase();
				const slug = "slug" in item ? item.slug.toLowerCase() : "";
				return (
					title.includes(q) || slug.includes(q) || excerpt.includes(q)
				);
			});
			result =
				primaryMatches.length > 0
					? primaryMatches
					: result.filter((item) =>
							item.content.toLowerCase().includes(q),
						);
		}
		if (type === "blog") {
			result = result.filter(
				(item) => statusFilter === "all" || (item as BlogPost).status === statusFilter,
			);
		}
		return sort === "oldest"
			? [...result].sort((a, b) => {
					if (type === "journal") {
						return (
							entrySortDate(a as JournalEntry) -
							entrySortDate(b as JournalEntry)
						);
					}
					return (
						(a.createdAt?.getTime() ?? 0) -
						(b.createdAt?.getTime() ?? 0)
					);
				})
			: result;
	});

	function entrySortDate(entry: JournalEntry): number {
		return new Date(entry.entryDate + "T00:00:00").getTime();
	}

	let searchPlaceholder = $derived(
		type === "blog" ? "Search posts…" : "Search entries…",
	);
	let emptyMessage = $derived(
		type === "blog"
			? "No posts yet. Publish your first one above!"
			: "No journal entries found. Write your first entry above!",
	);
	let loadingMessage = $derived(
		type === "blog" ? "Loading posts…" : "Loading journal entries…",
	);
</script>

<section
	class="bg-surface-900/80 rounded-xl border border-zinc-800/60 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-5 md:p-8"
>
	<div
		class="mb-5 grid gap-3 {type === 'blog'
			? 'md:grid-cols-[minmax(0,1fr)_auto]'
			: 'sm:grid-cols-[minmax(0,1fr)_auto]'}"
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
				bind:value={search}
				placeholder={searchPlaceholder}
				class="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-100 text-sm placeholder-zinc-600 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 transition-all"
			/>
		</div>
		<div
			class="grid w-full grid-cols-1 gap-3 {type === 'blog'
				? 'min-[420px]:grid-cols-2 md:w-auto'
				: 'sm:w-auto'}"
		>
			{#if type === "blog"}
				<select
					bind:value={statusFilter}
					onchange={handleStatusFilterChange}
					class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none md:w-auto"
				>
					<option value="all">All statuses</option>
					<option value="published">Published</option>
					<option value="unlisted">Unlisted</option>
					<option value="draft">Draft</option>
				</select>
			{/if}
			<select
				bind:value={sort}
				class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-all focus:border-accent-500 focus:outline-none {type ===
				'blog'
					? 'md:w-auto'
					: 'sm:w-auto'}"
			>
				<option value="newest">Newest first</option>
				<option value="oldest">Oldest first</option>
			</select>
		</div>
	</div>

	{#if search || (type === "blog" && statusFilter !== "all")}
		<p class="text-xs text-zinc-550 mb-3">
			{filteredItems.length} of {items.length}
			{type === "blog" ? "posts" : "entries"} loaded
		</p>
	{/if}

	{#if loading}
		<div
			class="flex items-center justify-center py-10 gap-3 text-zinc-500 text-sm"
		>
			<div
				class="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"
			></div>
			{loadingMessage}
		</div>
	{:else if error}
		<div
			class="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs space-y-1"
		>
			<p class="font-semibold">
				{type === "blog" ? "Blog" : "Journal"} Load Failed:
			</p>
			<p class="text-zinc-405 leading-normal">
				{error}
			</p>
			{#if type === "journal"}
				<p class="text-[10px] text-zinc-550 leading-normal pt-1">
					Please ensure your Firestore Security Rules permit
					authenticated read access to the <code
						class="bg-zinc-900 px-1 py-0.5 rounded text-red-300"
						>journal</code
					>
					collection for your Owner UID.
				</p>
			{/if}
		</div>
	{:else if filteredItems.length === 0}
		<p class="text-center py-10 text-zinc-650 text-sm">
			{emptyMessage}
		</p>
	{:else}
		<div id="entry-list" class="space-y-2">
			{#each filteredItems as item (item.id)}
				<div
					class="flex flex-col gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-3 transition-all duration-200 hover:border-zinc-700/60 sm:flex-row sm:items-center sm:gap-4 sm:px-4"
				>
					<div class="flex min-w-0 flex-1 items-center gap-3">
						{#if type === "blog"}
							{@const post = item as BlogPost}
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
						{/if}

						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<p
									class="text-sm font-medium text-zinc-200 truncate"
								>
									{item.title ||
										(type === "journal"
											? "Untitled Entry"
											: "")}
								</p>
								{#if type === "blog"}
									{@const post = item as BlogPost}
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
								{/if}
							</div>
							{#if type === "blog"}
								{@const post = item as BlogPost}
								<p
									class="text-xs text-zinc-650 font-mono mt-0.5 truncate"
								>
									{#if post.status === "draft"}
										/blogs/drafts/{post.slug}/
									{:else}
										/blogs/{post.slug}/
									{/if}
								</p>
							{:else}
								{@const entry = item as JournalEntry}
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
							{/if}
						</div>
					</div>

					<div
						class="flex flex-wrap items-center justify-between gap-2 {type ===
						'blog'
							? 'pl-[3.25rem] sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1 sm:pl-0'
							: 'sm:ml-auto sm:flex-col sm:items-end sm:justify-center sm:gap-1'}"
					>
						<span class="text-xs text-zinc-600 whitespace-nowrap">
							{type === "journal"
								? (item as JournalEntry).entryDate
								: formatDate(item.createdAt)}
						</span>
						<div
							class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:shrink-0"
						>
							{#if type === "blog"}
								{@const post = item as BlogPost}
								<a
									href={post.status === "draft"
										? `/blogs/drafts/${post.slug}/`
										: `/blogs/${post.slug}/`}
									target="_blank"
									class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium"
								>
									View
								</a>
							{/if}
							<button
								type="button"
								onclick={() => onEdit(item)}
								class="text-xs text-accent-400 hover:text-accent-300 transition-colors font-medium cursor-pointer"
							>
								Edit
							</button>
							<button
								type="button"
								onclick={() => onDelete(item)}
								class="text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if hasMore}
			<div class="mt-4 flex justify-center">
				<button
					type="button"
					onclick={onLoadMore}
					disabled={loadingMore}
					class="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-200 hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
				>
					{#if loadingMore}
						<div
							class="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin"
						></div>
						Loading…
					{:else}
						Show more
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</section>
