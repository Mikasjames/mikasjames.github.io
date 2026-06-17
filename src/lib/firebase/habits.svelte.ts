import {
	getHabits,
	addHabit,
	deleteHabit,
	updateHabitOrder,
	getHabitLogsForJournalEntry,
	deleteHabitLogsForJournalEntry,
	upsertHabitLog,
	type Habit,
} from "./firestore.svelte";

export function createHabitsStore() {
	let habits = $state<Habit[]>([]);
	let selectedHabitIds = $state<Set<string>>(new Set());
	let habitsLoading = $state(false);
	let habitsError = $state("");
	let showHabitManager = $state(false);
	let habitForm = $state({
		name: "",
		emoji: "",
		submitting: false,
		error: "",
	});

	async function loadHabits(userUid: string) {
		habitsLoading = true;
		habitsError = "";
		try {
			habits = await getHabits(userUid);
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

	async function handleAddHabit(userUid: string) {
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
				ownerUid: userUid,
				order: habits.length,
			});
			habitForm.name = "";
			habitForm.emoji = "";
			await loadHabits(userUid);
		} catch (err: unknown) {
			habitForm.error =
				err instanceof Error ? err.message : "Failed to add habit.";
		} finally {
			habitForm.submitting = false;
		}
	}

	async function handleDeleteHabit(habit: Habit, userUid: string) {
		if (!confirm(`Delete "${habit.name}" from habits?`)) return;
		habitsError = "";
		try {
			await deleteHabit(habit.id);
			await loadHabits(userUid);
		} catch (err: unknown) {
			habitsError =
				err instanceof Error ? err.message : "Failed to delete habit.";
		}
	}

	async function moveHabit(index: number, direction: -1 | 1, userUid: string) {
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
			await loadHabits(userUid);
		} catch (err: unknown) {
			habitsError =
				err instanceof Error
					? err.message
					: "Failed to reorder habits.";
			await loadHabits(userUid); // reload to restore server state
		}
	}

	async function loadSelectedHabitLogs(
		userUid: string,
		journalEntryId: string,
		currentJournalFormId: string | null,
	) {
		try {
			const logs = await getHabitLogsForJournalEntry(
				userUid,
				journalEntryId,
			);
			if (currentJournalFormId === journalEntryId) {
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

	async function saveSelectedHabitLogs(
		userUid: string,
		journalEntryId: string,
		date: string,
	) {
		await deleteHabitLogsForJournalEntry(userUid, journalEntryId);
		const selectedHabits = habits.filter((habit) =>
			selectedHabitIds.has(habit.id),
		);
		await Promise.all(
			selectedHabits.map((habit) =>
				upsertHabitLog({
					habit,
					ownerUid: userUid,
					date,
					journalEntryId,
				}),
			),
		);
	}

	return {
		get habits() { return habits; },
		get selectedHabitIds() { return selectedHabitIds; },
		set selectedHabitIds(v) { selectedHabitIds = v; },
		get habitsLoading() { return habitsLoading; },
		get habitsError() { return habitsError; },
		set habitsError(v) { habitsError = v; },
		get showHabitManager() { return showHabitManager; },
		set showHabitManager(v) { showHabitManager = v; },
		get habitForm() { return habitForm; },
		loadHabits,
		toggleHabit,
		handleAddHabit,
		handleDeleteHabit,
		moveHabit,
		loadSelectedHabitLogs,
		saveSelectedHabitLogs,
	};
}
