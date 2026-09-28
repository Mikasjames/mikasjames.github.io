import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import HabitContributionGrid from './HabitContributionGrid.svelte';

function cells(container: HTMLElement) {
	return Array.from(container.querySelectorAll('[title]')) as HTMLElement[];
}

describe('HabitContributionGrid', () => {
	it('renders one cell per day in the range', () => {
		const { container } = render(HabitContributionGrid, {
			props: { doneDates: [], start: '2026-07-01', end: '2026-07-10' },
		});
		expect(cells(container)).toHaveLength(10);
	});

	it('marks completed days distinctly from missed ones', () => {
		const { container } = render(HabitContributionGrid, {
			props: {
				doneDates: ['2026-07-02', '2026-07-05'],
				start: '2026-07-01',
				end: '2026-07-07',
			},
		});
		const done = cells(container).filter((c) => c.getAttribute('title')?.endsWith('· done'));
		const missed = cells(container).filter((c) =>
			c.getAttribute('title')?.endsWith('· not done'),
		);
		expect(done).toHaveLength(2);
		expect(missed).toHaveLength(5);
		expect(done[0].className).toContain('bg-accent-500');
		expect(missed[0].className).toContain('bg-zinc-900/60');
	});

	it('titles every cell with its date for hover detail', () => {
		const { container } = render(HabitContributionGrid, {
			props: { doneDates: ['2026-07-01'], start: '2026-07-01', end: '2026-07-03' },
		});
		expect(cells(container).map((c) => c.getAttribute('title'))).toEqual([
			'2026-07-01 · done',
			'2026-07-02 · not done',
			'2026-07-03 · not done',
		]);
	});

	it('pads the first column so weekdays line up with their rows', () => {
		// 2026-07-01 is a Wednesday, so the first three rows must be empty.
		const { container } = render(HabitContributionGrid, {
			props: { doneDates: [], start: '2026-07-01', end: '2026-07-10' },
		});
		const firstColumn = container.querySelector('[title]')?.parentElement;
		const children = Array.from(firstColumn?.children ?? []);
		expect(children).toHaveLength(7);
		expect(children.slice(0, 3).every((c) => c.getAttribute('title') === null)).toBe(true);
		expect(children[3].getAttribute('title')).toContain('2026-07-01');
	});

	it('renders nothing for an inverted or empty range', () => {
		const inverted = render(HabitContributionGrid, {
			props: { doneDates: ['2026-07-01'], start: '2026-07-10', end: '2026-07-01' },
		});
		expect(cells(inverted.container)).toHaveLength(0);

		const empty = render(HabitContributionGrid, {
			props: { doneDates: [], start: '', end: '' },
		});
		expect(cells(empty.container)).toHaveLength(0);
	});

	it('spans a year without dropping days across a leap day', () => {
		const { container } = render(HabitContributionGrid, {
			props: { doneDates: ['2028-02-29'], start: '2028-01-01', end: '2028-12-31' },
		});
		expect(cells(container)).toHaveLength(366);
		const leap = cells(container).find((c) => c.getAttribute('title')?.startsWith('2028-02-29'));
		expect(leap?.getAttribute('title')).toBe('2028-02-29 · done');
	});

	it('optionally renders the weekday axis labels', () => {
		const withLabels = render(HabitContributionGrid, {
			props: { doneDates: [], start: '2026-07-01', end: '2026-07-07', weekdayLabels: true },
		});
		expect(withLabels.container.textContent).toContain('Mon');

		const without = render(HabitContributionGrid, {
			props: { doneDates: [], start: '2026-07-01', end: '2026-07-07' },
		});
		expect(without.container.textContent).not.toContain('Wed');
	});
});
