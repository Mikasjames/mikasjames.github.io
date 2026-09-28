<script lang="ts">
	/**
	 * GitHub-style contribution grid for a single habit. Columns are weeks,
	 * rows are weekdays (Sunday first), so the shape of a habit's consistency
	 * is readable at a glance. Weeks before the habit existed, and days after
	 * the range ends, are not tracked and render as empty placeholders.
	 */
	import { addDays, weekdayOf } from "$lib/utils/habitStats";

	let {
		doneDates,
		start,
		end,
		weekdayLabels = false,
	}: {
		doneDates: string[];
		start: string;
		end: string;
		weekdayLabels?: boolean;
	} = $props();

	const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	const done = $derived(new Set(doneDates));

	const weeks = $derived.by(() => {
		if (!start || !end || end < start) return [];
		// Pad the first column so every row lines up with its weekday.
		const leading = weekdayOf(start);
		const columns: Array<Array<{ date: string; active: boolean } | null>> = [];
		let cursor = addDays(start, -leading);
		while (cursor <= end) {
			const column: Array<{ date: string; active: boolean } | null> = [];
			for (let row = 0; row < 7; row += 1) {
				if (cursor >= start && cursor <= end) {
					column.push({ date: cursor, active: done.has(cursor) });
				} else {
					column.push(null);
				}
				cursor = addDays(cursor, 1);
			}
			columns.push(column);
		}
		return columns;
	});
</script>

<div class="flex gap-1.5">
	{#if weekdayLabels}
		<div class="grid shrink-0 grid-rows-7 gap-0.5 pr-0.5 text-[9px] leading-none text-zinc-600">
			{#each WEEKDAY_LABELS as label, index}
				<span class="flex h-2.5 items-center">{index % 2 === 1 ? label : ""}</span>
			{/each}
		</div>
	{/if}
	<div class="flex gap-0.5 overflow-x-auto pb-1">
		{#each weeks as week, weekIndex (weekIndex)}
			<div class="grid shrink-0 grid-rows-7 gap-0.5">
				{#each week as cell}
					{#if cell}
						<span
							title={cell.active ? `${cell.date} · done` : `${cell.date} · not done`}
							class="h-2.5 w-2.5 rounded-[2px] border {cell.active
								? 'border-accent-400 bg-accent-500'
								: 'border-zinc-800 bg-zinc-900/60'}"
						></span>
					{:else}
						<span class="h-2.5 w-2.5 rounded-[2px]"></span>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
