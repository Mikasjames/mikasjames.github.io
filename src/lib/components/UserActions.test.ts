import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import UserActions from './UserActions.svelte';

describe('UserActions', () => {
	it('renders Sign Out button', () => {
		const { getByText } = render(UserActions, {
			props: { onSignOut: vi.fn() },
		});
		expect(getByText('Sign Out')).toBeInTheDocument();
	});

	it('calls onSignOut when Sign Out is clicked', async () => {
		const onSignOut = vi.fn();
		const { getByText } = render(UserActions, {
			props: { onSignOut },
		});
		await fireEvent.click(getByText('Sign Out'));
		expect(onSignOut).toHaveBeenCalledTimes(1);
	});

	it('renders Today link when todayHref is provided', () => {
		const { getByText } = render(UserActions, {
			props: { onSignOut: vi.fn(), todayHref: '/habits/' },
		});
		const todayBtn = getByText('Today');
		expect(todayBtn).toBeInTheDocument();
		expect(todayBtn.closest('a')).toHaveAttribute('href', '/habits/');
	});

	it('renders Today button when onTodayClick is provided', async () => {
		const onTodayClick = vi.fn();
		const { getByText } = render(UserActions, {
			props: { onSignOut: vi.fn(), onTodayClick },
		});
		const todayBtn = getByText('Today');
		expect(todayBtn).toBeInTheDocument();
		await fireEvent.click(todayBtn);
		expect(onTodayClick).toHaveBeenCalledTimes(1);
	});

	it('does not render Today when neither todayHref nor onTodayClick provided', () => {
		const { queryByText } = render(UserActions, {
			props: { onSignOut: vi.fn() },
		});
		expect(queryByText('Today')).toBeNull();
	});

	it('renders with both todayHref and onTodayClick (href takes precedence)', () => {
		const onTodayClick = vi.fn();
		const { getByText } = render(UserActions, {
			props: { onSignOut: vi.fn(), todayHref: '/habits/', onTodayClick },
		});
		const todayBtn = getByText('Today');
		expect(todayBtn.closest('a')).toHaveAttribute('href', '/habits/');
	});
});
