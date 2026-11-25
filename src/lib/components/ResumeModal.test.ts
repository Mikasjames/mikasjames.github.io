import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ResumeModal from './ResumeModal.svelte';

describe('ResumeModal', () => {
	it('renders nothing when closed', () => {
		const { container } = render(ResumeModal, { props: { open: false } });
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});

	it('renders the dialog and embeds the PDF when open', () => {
		const { container } = render(ResumeModal, { props: { open: true } });
		const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog).not.toBeNull();
		expect(dialog).toHaveAccessibleName('Résumé');

		const iframe = container.querySelector<HTMLIFrameElement>('iframe');
		expect(iframe).not.toBeNull();
		expect(iframe?.getAttribute('src')).toBe('/resume.pdf#view=FitH');
		expect(iframe?.getAttribute('title')).toBe('Mikas James Arayata résumé');
	});

	it('exposes a download link with the expected filename', () => {
		const { container } = render(ResumeModal, { props: { open: true } });
		const link = container.querySelector<HTMLAnchorElement>('a[download]');
		expect(link).not.toBeNull();
		expect(link?.getAttribute('href')).toBe('/resume.pdf');
		expect(link?.getAttribute('download')).toBe('Mikas-James-Arayata-Resume.pdf');
		expect(link).toHaveTextContent('Download PDF');
	});

	it('closes on Escape and reports onclose', async () => {
		const onclose = vi.fn();
		render(ResumeModal, { props: { open: true, onclose } });

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('closes when clicking the backdrop', async () => {
		const onclose = vi.fn();
		const { container } = render(ResumeModal, { props: { open: true, onclose } });
		const backdrop = container.querySelector<HTMLElement>('[role="dialog"]')!;

		await fireEvent.click(backdrop);
		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
