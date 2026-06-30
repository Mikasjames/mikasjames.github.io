export type ToastVariant = "success" | "error" | "info";

interface Toast {
	id: string;
	message: string;
	variant: ToastVariant;
}

let toasts = $state<Toast[]>([]);

export function toast(message: string, variant: ToastVariant = "info") {
	const id = crypto.randomUUID();
	toasts = [...toasts, { id, message, variant }];
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 3000);
}

export function dismissToast(id: string) {
	toasts = toasts.filter((t) => t.id !== id);
}

export function getToasts() {
	return toasts;
}
