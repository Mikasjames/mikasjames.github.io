import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import HabitsManager from './HabitsManager.svelte';

function createMockHabitsStore(overrides: Record<string, unknown> = {}) {
	return {
		habits: [],
		habitsLoading: false,
		habitsError: '',
		showHabitManager: false,
		selectedHabitIds: new Set<string>(),
		toggleHabit: vi.fn(),
		moveHabit: vi.fn(),
		handleAddHabit: vi.fn(),
		handleDeleteHabit: vi.fn(),
		habitForm: { name: '', emoji: '', submitting: false, error: '' },
		loadHabits: vi.fn(),
		loadSelectedHabitLogs: vi.fn(),
		saveSelectedHabitLogs: vi.fn(),
		loadHabitLogsForDate: vi.fn(),
		saveHabitLogsForDate: vi.fn(),
		...overrides,
	} as unknown as ReturnType<typeof import('$lib/firebase/habits.svelte').createHabitsStore>;
}

describe('HabitsManager', () => {
	it('renders loading state', () => {
		const store = createMockHabitsStore({ habitsLoading: true });
		const { container } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		expect(container).toHaveTextContent('Habits');
		expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
	});

	it('renders empty state with Add one link', () => {
		const store = createMockHabitsStore({ habits: [] });
		const { container, getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		const emptyText = Array.from(container.querySelectorAll('p')).find((p) =>
			p.textContent?.includes('No habits yet')
		);
		expect(emptyText).toBeDefined();
		expect(getByText('Add one')).toBeInTheDocument();
	});

	it('renders habits list', () => {
		const habits = [
			{ id: '1', name: 'Exercise', emoji: '💪', ownerUid: 'uid', createdAt: null, order: 0 },
			{ id: '2', name: 'Read', emoji: '📖', ownerUid: 'uid', createdAt: null, order: 1 },
		];
		const store = createMockHabitsStore({ habits });
		const { getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		expect(getByText('💪 Exercise')).toBeInTheDocument();
		expect(getByText('📖 Read')).toBeInTheDocument();
	});

	it('toggles habit on click', async () => {
		const toggleHabit = vi.fn();
		const habits = [
			{ id: '1', name: 'Exercise', emoji: '💪', ownerUid: 'uid', createdAt: null, order: 0 },
		];
		const store = createMockHabitsStore({ habits, toggleHabit });
		const { getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		await fireEvent.click(getByText('💪 Exercise'));
		expect(toggleHabit).toHaveBeenCalledWith('1');
	});

	it('shows habit manager when Manage is clicked', async () => {
		const store = createMockHabitsStore({ habits: [] });
		const { getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		await fireEvent.click(getByText('Manage'));
		expect(store.showHabitManager).toBe(true);
	});

	it('shows manager form when showHabitManager is true', () => {
		const habits = [
			{ id: '1', name: 'Exercise', emoji: '💪', ownerUid: 'uid', createdAt: null, order: 0 },
		];
		const store = createMockHabitsStore({ habits, showHabitManager: true });
		const { getByText, getByPlaceholderText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		expect(getByText('Up')).toBeInTheDocument();
		expect(getByText('Down')).toBeInTheDocument();
		expect(getByText('Delete')).toBeInTheDocument();
		expect(getByPlaceholderText('Habit name')).toBeInTheDocument();
	});

	it('disables Up button for first habit', () => {
		const habits = [
			{ id: '1', name: 'Exercise', emoji: '💪', ownerUid: 'uid', createdAt: null, order: 0 },
		];
		const store = createMockHabitsStore({ habits, showHabitManager: true });
		const { getAllByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		const upButtons = getAllByText('Up');
		expect(upButtons[0]).toBeDisabled();
	});

	it('disables Down button for last habit', () => {
		const habits = [
			{ id: '1', name: 'Exercise', emoji: '💪', ownerUid: 'uid', createdAt: null, order: 0 },
		];
		const store = createMockHabitsStore({ habits, showHabitManager: true });
		const { getAllByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		const downButtons = getAllByText('Down');
		expect(downButtons[0]).toBeDisabled();
	});

	it('calls handleAddHabit when Save is clicked', async () => {
		const handleAddHabit = vi.fn();
		const store = createMockHabitsStore({
			habits: [],
			showHabitManager: true,
			handleAddHabit,
		});
		const { getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid' },
		});
		await fireEvent.click(getByText('Save'));
		expect(handleAddHabit).toHaveBeenCalledWith('test-uid');
	});

	it('hides empty state Add one when showAddOneInEmpty is false', () => {
		const store = createMockHabitsStore({ habits: [] });
		const { queryByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid', showAddOneInEmpty: false },
		});
		expect(queryByText('Add one')).toBeNull();
	});

	it('uses custom labels', () => {
		const store = createMockHabitsStore({ habits: [] });
		const { getByText } = render(HabitsManager, {
			props: { habitsStore: store, userId: 'test-uid', manageLabel: 'Configure', doneLabel: 'Done' },
		});
		expect(getByText('Configure')).toBeInTheDocument();
	});
});
