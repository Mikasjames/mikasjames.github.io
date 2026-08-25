<script lang="ts">
	import AppButton from "$lib/components/AppButton.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { toast } from "$lib/stores/toast.svelte";
	import type { createOljStore } from "$lib/firebase/olj.svelte";

	type OljStore = ReturnType<typeof createOljStore>;

	let { oljStore }: { oljStore: OljStore } = $props();

	let showDebug = $state(false);

	const balanceDelta = $derived.by(() => {
		const log = oljStore.log;
		if (!log || log.pointsBalance === null || log.previousBalance === null) return null;
		return log.pointsBalance - log.previousBalance;
	});

	async function handleRunLogin() {
		const ok = await oljStore.runLoginNow();
		toast(
			ok
				? `OLJ login succeeded${oljStore.log?.pointsBalance !== null ? ` — ${oljStore.log?.pointsBalance} points` : ""}`
				: (oljStore.error || "OLJ login failed."),
			ok ? "success" : "error",
		);
	}

	function formatRanAt(ranAt: Date | null): string {
		if (!ranAt) return "Unknown";
		return ranAt.toLocaleString("en-PH", {
			timeZone: "Asia/Manila",
			dateStyle: "medium",
			timeStyle: "short",
		});
	}
</script>

<section class="space-y-5">
	<div
		class="rounded-xl border border-zinc-800/60 bg-surface-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:rounded-2xl sm:p-6 md:p-8"
	>
		<div
			class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h2 class="text-lg font-semibold text-zinc-100">OnlineJobs.ph Login</h2>
				<p class="mt-0.5 text-sm text-zinc-500">
					Daily automated login status and apply-points balance.
				</p>
			</div>
			<div class="flex gap-2">
				<AppButton variant="ghost" size="sm" onclick={() => oljStore.loadLog()}>
					Refresh
				</AppButton>
				<AppButton
					variant="primary"
					size="sm"
					loading={oljStore.running}
					onclick={handleRunLogin}
				>
					Run Login Now
				</AppButton>
			</div>
		</div>

		{#if oljStore.loading && !oljStore.log}
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{#each Array(4) as _}
					<div class="h-20 animate-pulse rounded-xl bg-zinc-900/60"></div>
				{/each}
			</div>
		{:else if oljStore.log}
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<div
					class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold {oljStore
						.log.status === 'success'
						? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
						: 'border-red-500/20 bg-red-500/10 text-red-400'}"
				>
					<span
						class="h-1.5 w-1.5 rounded-full {oljStore.log.status === 'success'
							? 'bg-emerald-400'
							: 'bg-red-400'}"
					></span>
					Last run: {oljStore.log.status === "success" ? "Success" : "Failed"}
				</div>
				{#if oljStore.log.atCap}
					<div
						class="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
						At cap — time to apply
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-zinc-500">
						Points Balance
					</p>
					<p class="mt-1 text-2xl font-bold text-zinc-100">
						{oljStore.log.pointsBalance ?? "—"}
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-zinc-500">
						Previous Balance
					</p>
					<p class="mt-1 text-2xl font-bold text-zinc-100">
						{oljStore.log.previousBalance ?? "—"}
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-zinc-500">
						Change
					</p>
					<p
						class="mt-1 text-2xl font-bold {balanceDelta === null
							? 'text-zinc-100'
							: balanceDelta > 0
								? 'text-emerald-400'
								: balanceDelta < 0
									? 'text-red-400'
									: 'text-zinc-100'}"
					>
						{#if balanceDelta === null}
							—
						{:else if balanceDelta > 0}
							+{balanceDelta}
						{:else}
							{balanceDelta}
						{/if}
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
					<p class="text-xs font-medium uppercase tracking-wide text-zinc-500">
						Date
					</p>
					<p class="mt-1 text-2xl font-bold text-zinc-100">{oljStore.log.date}</p>
				</div>
			</div>

			<p class="mt-4 text-xs text-zinc-500">
				Last run at: <span class="text-zinc-400">{formatRanAt(oljStore.log.ranAt)}</span> (Asia/Manila)
			</p>

			{#if oljStore.log.detail}
				<div
					class="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
				>
					<p class="font-semibold">Failure detail</p>
					<p class="mt-1 break-words">{oljStore.log.detail}</p>
				</div>
			{/if}

			{#if oljStore.log.debug}
				<button
					type="button"
					class="mt-3 text-xs font-medium text-accent-400 hover:text-accent-300"
					onclick={() => (showDebug = !showDebug)}
				>
					{showDebug ? "Hide" : "Show"} debug diagnostics
				</button>
				{#if showDebug}
					<pre
						class="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs text-zinc-400">{JSON.stringify(
							oljStore.log.debug,
							null,
							2,
						)}</pre>
				{/if}
			{/if}
		{:else if oljStore.error}
			<div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
				{oljStore.error}
			</div>
		{:else}
			<div class="py-8 text-center">
				<p class="text-sm text-zinc-500">
					No login recorded yet. Use “Run Login Now” or wait for the daily schedule.
				</p>
			</div>
		{/if}
	</div>
</section>
