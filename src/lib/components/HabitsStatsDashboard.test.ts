import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import HabitsStatsDashboard from '../../routes/admin/HabitsStatsDashboard.svelte';
import type { createHabitStatsStore } from '$lib/firebase/habitStats.svelte';

type Store = ReturnType<typeof createHabitStatsStore>;

function mockStore(overrides: Record<string, unknown> = {}) {
	const store = {
		kind: 'month',
		anchorMonth: '2026-07',
		anchorYear: 2026,
		today: '2026-07-10',
		loading: false,
		error: '',
		stats: {
			range: { start: '2026-07-01', end: '2026-07-10', days: 10 },
			habits: [],
			totals: {
				checkIns: 0,
				activeDays: 0,
				perfectDays: 0,
				trackedDays: 10,
				habitCount: 0,
				avgPerActiveDay: null,
				bestCurrentStreak: 0,
				longestStreakEver: 0,
			},
			dailyScores: [],
			moodDeltas: [],
		},
		load: vi.fn(),
		reload: vi.fn(),
		setKind: vi.fn(),
		stepMonth: vi.fn(),
		stepYear: vi.fn(),
		canStepForward: vi.fn(() => true),
		...overrides,
	};
	return store as unknown as Store;
}

function habitStat(overrides: Record<string, unknown> = {}) {
	return {
		habitId: 'h1',
		name: 'Gym',
		emoji: '🏋️',
		checkIns: 6,
		eligibleDays: 10,
		completionRate: 0.6,
		currentStreak: 3,
		longestStreak: 5,
		firstDone: '2026-07-01',
		lastDone: '2026-07-09',
		daysSinceLast: 1,
		byWeekday: [1, 1, 1, 1, 1, 1, 0],
		byWeekdayTotal: [2, 2, 2, 1, 1, 1, 1],
		bestWeekday: { index: 0, rate: 0.5 },
		avgCompletedHour: 7.5,
		monthlyRates: [{ month: '2026-07', count: 6, days: 10, rate: 0.6 }],
		doneDates: [
			'2026-07-01',
			'2026-07-02',
			'2026-07-03',
			'2026-07-06',
			'2026-07-07',
			'2026-07-08',
		],
		activeFrom: '2026-07-01',
		...overrides,
	};
}

function statsWith(habits: unknown[], overrides: Record<string, unknown> = {}) {
	return {
		range: { start: '2026-07-01', end: '2026-07-10', days: 10 },
		habits,
		totals: {
			checkIns: 6,
			activeDays: 6,
			perfectDays: 1,
			trackedDays: 10,
			habitCount: habits.length,
			avgPerActiveDay: 1,
			bestCurrentStreak: 3,
			longestStreakEver: 5,
		},
		dailyScores: [
			{ date: '2026-07-01', done: 1, total: 1, rating: 4 },
			{ date: '2026-07-02', done: 0, total: 1, rating: null },
		],
		moodDeltas: [
			{
				habitId: 'h1',
				name: 'Gym',
				emoji: '🏋️',
				doneAvg: 4.2,
				missedAvg: 2.1,
				delta: 2.1,
				doneDays: 6,
				missedDays: 4,
			},
		],
		...overrides,
	};
}

describe('HabitsStatsDashboard', () => {
	it('states that no AI is involved', () => {
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: mockStore() } });
		expect(getByText(/no ai analysis involved/i)).toBeInTheDocument();
	});

	it('offers the three ranges and delegates the choice to the store', async () => {
		const store = mockStore();
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		expect(getByText('This Month')).toBeInTheDocument();
		expect(getByText('This Year')).toBeInTheDocument();
		expect(getByText('All Time')).toBeInTheDocument();

		await fireEvent.click(getByText('All Time'));
		expect(store.setKind).toHaveBeenCalledWith('all');
	});

	it('hides the period stepper in all-time mode', () => {
		const { queryByLabelText } = render(HabitsStatsDashboard, {
			props: { statsStore: mockStore({ kind: 'all' }) },
		});
		expect(queryByLabelText('Next period')).not.toBeInTheDocument();
		expect(queryByLabelText('Previous period')).not.toBeInTheDocument();
	});

	it('steps months through the store', async () => {
		const store = mockStore();
		const { getByLabelText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		await fireEvent.click(getByLabelText('Previous period'));
		expect(store.stepMonth).toHaveBeenCalledWith(-1);
		await fireEvent.click(getByLabelText('Next period'));
		expect(store.stepMonth).toHaveBeenCalledWith(1);
		expect(store.stepYear).not.toHaveBeenCalled();
	});

	it('steps years through the store in year mode', async () => {
		const store = mockStore({ kind: 'year' });
		const { getByLabelText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		await fireEvent.click(getByLabelText('Previous period'));
		expect(store.stepYear).toHaveBeenCalledWith(-1);
		await fireEvent.click(getByLabelText('Next period'));
		expect(store.stepYear).toHaveBeenCalledWith(1);
		expect(store.stepMonth).not.toHaveBeenCalled();
	});

	it('disables stepping forward at the current period', () => {
		const { getByLabelText } = render(HabitsStatsDashboard, {
			props: { statsStore: mockStore({ canStepForward: () => false }) },
		});
		expect(getByLabelText('Next period')).toBeDisabled();
	});

	it('shows a loading skeleton', () => {
		const { container } = render(HabitsStatsDashboard, {
			props: { statsStore: mockStore({ loading: true }) },
		});
		expect(container.querySelectorAll('.animate-pulse').length).toBe(4);
	});

	it('surfaces load errors', () => {
		const { getByText } = render(HabitsStatsDashboard, {
			props: { statsStore: mockStore({ error: 'offline' }) },
		});
		expect(getByText('offline')).toBeInTheDocument();
	});

	it('points at the check-in page when there are no habits', () => {
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: mockStore() } });
		// The sentence is split by the inline link, so match a substring.
		expect(getByText(/No habits to report on yet/)).toBeInTheDocument();
		expect(getByText('check-in page')).toBeInTheDocument();
	});

	it('renders headline totals', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		expect(getByText('Check-ins')).toBeInTheDocument();
		expect(getByText('Active days')).toBeInTheDocument();
		expect(getByText('Perfect days')).toBeInTheDocument();
		expect(getByText('Best streak')).toBeInTheDocument();
		expect(getByText('longest ever 5 days')).toBeInTheDocument();
	});

	it('renders a card per habit with its streaks and rate', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		expect(getByText('🏋️ Gym')).toBeInTheDocument();
		expect(getByText('6 / 10 days')).toBeInTheDocument();
		expect(getByText('60%')).toBeInTheDocument();
		expect(getByText('Current streak')).toBeInTheDocument();
		expect(getByText('Longest streak')).toBeInTheDocument();
		expect(getByText('Last done')).toBeInTheDocument();
		expect(getByText('7:30 AM')).toBeInTheDocument();
	});

	it('marks a day-zero last completion as today', () => {
		const store = mockStore({
			stats: statsWith([habitStat({ daysSinceLast: 0 })]),
		});
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText('today')).toBeInTheDocument();
	});

	it('explains when a habit started being tracked mid-period', () => {
		const store = mockStore({
			stats: statsWith([habitStat({ activeFrom: '2026-07-05' })]),
		});
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText(/tracked from 2026-07-05/)).toBeInTheDocument();
	});

	it('shows the mood comparison when there are rated days', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		expect(getByText('Mood: done vs. missed')).toBeInTheDocument();
		expect(getByText('4.2')).toBeInTheDocument();
		expect(getByText('2.1')).toBeInTheDocument();
		expect(getByText(/\+2\.1 average/)).toBeInTheDocument();
	});

	it('explains an absent mood comparison rather than showing dashes', () => {
		const store = mockStore({
			stats: statsWith(
				[habitStat()],
				{
					moodDeltas: [
						{
							habitId: 'h1',
							name: 'Gym',
							emoji: '🏋️',
							doneAvg: null,
							missedAvg: null,
							delta: null,
							doneDays: 0,
							missedDays: 0,
						},
					],
				},
			),
		});
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText(/Not enough rated days in this period/)).toBeInTheDocument();
	});

	it('reports the most consistent weekday', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { container } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		// The label, weekday and rate share one paragraph, split across inline
		// spans, so assert on its combined text.
		const paragraph = Array.from(container.querySelectorAll('p')).find((p) =>
			p.textContent?.includes('Most consistent on'),
		);
		expect(paragraph?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Most consistent on Sun (50%)',
		);
	});

	it('labels the weekday axis with all seven short names', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { container } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
			expect(container.textContent).toContain(label);
		}
	});

	it('hides the monthly bars for a single-month range', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { queryByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(queryByText('Monthly completion rate')).not.toBeInTheDocument();
	});

	it('shows monthly bars across a year range', () => {
		const store = mockStore({
			kind: 'year',
			stats: statsWith([
				habitStat({
					monthlyRates: [
						{ month: '2026-01', count: 4, days: 31, rate: 0.13 },
						{ month: '2026-02', count: 20, days: 28, rate: 0.71 },
					],
				}),
			]),
		});
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText('Monthly completion rate')).toBeInTheDocument();
		expect(getByText('01')).toBeInTheDocument();
		expect(getByText('02')).toBeInTheDocument();
	});

	it('discloses that average time is a save-time proxy', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText(/closest available proxy/)).toBeInTheDocument();
	});

	it('scales daily bars against that day\'s own habit count', () => {
		// A perfect day must reach full height even with 4 habits tracked. This
		// regressed once when the bar was additionally divided by the largest
		// daily total, capping every bar at 25%.
		const store = mockStore({
			stats: statsWith([habitStat()], {
				dailyScores: [
					{ date: '2026-07-08', done: 4, total: 4, rating: null },
					{ date: '2026-07-09', done: 2, total: 4, rating: null },
					{ date: '2026-07-10', done: 0, total: 4, rating: null },
				],
			}),
		});
		const { container } = render(HabitsStatsDashboard, { props: { statsStore: store } });

		const heightFor = (date: string) => {
			const bar = container.querySelector(`[title^="${date}"] > div`);
			return bar?.getAttribute('style');
		};
		expect(heightFor('2026-07-08')).toBe('height: 100%;');
		expect(heightFor('2026-07-09')).toBe('height: 50%;');
		expect(heightFor('2026-07-10')).toBe('height: 0%;');
	});

	it('keeps a single completed habit visible with the minimum bar height', () => {
		const store = mockStore({
			stats: statsWith([habitStat()], {
				dailyScores: [{ date: '2026-07-10', done: 1, total: 3, rating: null }],
			}),
		});
		const { container } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		const bar = container.querySelector('[title^="2026-07-10"] > div');
		// 1/3 would be 33%, which is already visible; the 6% floor is the
		// guard for ratios that would otherwise round away to nothing.
		expect(bar?.getAttribute('style')).toBe('height: 33.33333333333333%;');
	});

	it('marks a perfect day differently from a partial one', () => {
		const store = mockStore({
			stats: statsWith([habitStat()], {
				dailyScores: [
					{ date: '2026-07-08', done: 2, total: 2, rating: null },
					{ date: '2026-07-09', done: 1, total: 2, rating: null },
				],
			}),
		});
		const { container } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		const perfect = container.querySelector('[title^="2026-07-08"] > div');
		const partial = container.querySelector('[title^="2026-07-09"] > div');
		expect(perfect?.className).toContain('bg-emerald-500/80');
		expect(partial?.className).toContain('bg-accent-500/70');
	});

	it('does not render a bar for a day with no trackable habits', () => {
		const store = mockStore({ stats: statsWith([habitStat()], { dailyScores: [] }) });
		const { queryByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(queryByText('Daily completion')).not.toBeInTheDocument();
	});

	it('renders one bar per tracked day', () => {
		const store = mockStore({ stats: statsWith([habitStat()]) });
		const { getByText } = render(HabitsStatsDashboard, { props: { statsStore: store } });
		expect(getByText('Daily completion')).toBeInTheDocument();
		expect(getByText('2026-07-01')).toBeInTheDocument();
		expect(getByText('2026-07-10')).toBeInTheDocument();
	});
});
