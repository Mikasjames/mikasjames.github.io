<script lang="ts">
  import AppButton from "./AppButton.svelte";

  interface Habit {
    id: string;
    emoji: string;
    name: string;
  }

  interface HabitsStore {
    showHabitManager: boolean;
    habitsLoading: boolean;
    habits: Habit[];
    selectedHabitIds: Set<string>;
    habitForm: {
      emoji: string;
      name: string;
      submitting: boolean;
      error: string;
    };
    toggleHabit: (id: string) => void;
    moveHabit: (index: number, direction: number, userId: string) => void;
    handleDeleteHabit: (habit: Habit, userId: string) => void;
    handleAddHabit: (userId: string) => void;
  }

  let {
    habitsStore,
    userId,
    manageLabel = "Manage",
    doneLabel = "Done",
    onDeleteHabit,
    showAddOneInEmpty = true,
  }: {
    habitsStore: HabitsStore;
    userId: string;
    manageLabel?: string;
    doneLabel?: string;
    onDeleteHabit?: (habit: Habit, userId: string) => void;
    showAddOneInEmpty?: boolean;
  } = $props();
</script>

<div class="flex items-center justify-between">
  <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">
    Habits
  </p>
  <button
    type="button"
    onclick={() => (habitsStore.showHabitManager = !habitsStore.showHabitManager)}
    class="text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
  >
    {habitsStore.showHabitManager ? doneLabel : manageLabel}
  </button>
</div>

{#if habitsStore.habitsLoading}
  <div class="flex flex-wrap gap-2">
    <div class="h-9 w-24 animate-pulse rounded-lg bg-zinc-800/70"></div>
    <div class="h-9 w-28 animate-pulse rounded-lg bg-zinc-800/70"></div>
    <div class="h-9 w-20 animate-pulse rounded-lg bg-zinc-800/70"></div>
  </div>
{:else if habitsStore.habits.length === 0}
  <p class="text-sm text-zinc-550">
    No habits yet.
    {#if showAddOneInEmpty}
      <button
        type="button"
        onclick={() => (habitsStore.showHabitManager = true)}
        class="text-accent-400 hover:text-accent-300 underline"
      >Add one</button>.
    {/if}
  </p>
{:else}
  <div class="flex flex-wrap gap-2">
    {#each habitsStore.habits as habit (habit.id)}
      <button
        type="button"
        onclick={() => habitsStore.toggleHabit(habit.id)}
        class="rounded-lg border px-3 py-2 text-sm font-medium transition-all {habitsStore.selectedHabitIds.has(habit.id)
          ? 'border-accent-500/50 bg-accent-600/20 text-accent-200 shadow-lg shadow-accent-600/10'
          : 'border-zinc-700/60 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'}"
      >
        {habit.emoji} {habit.name}
      </button>
    {/each}
  </div>
{/if}

{#if habitsStore.showHabitManager}
  <div class="mt-4 space-y-3 border-t border-zinc-800/60 pt-4">
    {#each habitsStore.habits as habit, index (habit.id)}
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 px-3 py-2">
        <span class="min-w-0 flex-1 truncate text-sm text-zinc-300">
          {habit.emoji} {habit.name}
        </span>
        <AppButton
          variant="ghost" size="sm"
          onclick={() => habitsStore.moveHabit(index, -1, userId)}
          disabled={index === 0}
        >Up</AppButton>
        <AppButton
          variant="ghost" size="sm"
          onclick={() => habitsStore.moveHabit(index, 1, userId)}
          disabled={index === habitsStore.habits.length - 1}
        >Down</AppButton>
        <AppButton
          variant="danger" size="sm"
          onclick={() => (onDeleteHabit ?? habitsStore.handleDeleteHabit)(habit, userId)}
        >Delete</AppButton>
      </div>
    {/each}
    <div class="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
      <input
        type="text"
        bind:value={habitsStore.habitForm.emoji}
        placeholder="🙏"
        class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
      />
      <input
        type="text"
        bind:value={habitsStore.habitForm.name}
        placeholder="Habit name"
        class="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
      />
      <AppButton
        variant="primary" size="sm"
        onclick={() => habitsStore.handleAddHabit(userId)}
        disabled={habitsStore.habitForm.submitting}
        loading={habitsStore.habitForm.submitting}
      >Save</AppButton>
    </div>
    {#if habitsStore.habitForm.error}
      <p class="text-xs text-red-400">{habitsStore.habitForm.error}</p>
    {/if}
  </div>
{/if}
