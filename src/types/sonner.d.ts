declare module "sonner" {
  import type { ComponentType, ReactNode } from "react";

  type ToastOptions = Record<string, unknown>;
  type ToastFn = (message?: ReactNode, options?: ToastOptions) => string | number;

  type ToastApi = ToastFn & {
    success: ToastFn;
    error: ToastFn;
    info: ToastFn;
    warning: ToastFn;
    message: ToastFn;
    custom: (jsx: ReactNode, options?: ToastOptions) => string | number;
    dismiss: (id?: string | number) => void;
    promise: <T>(
      promise: Promise<T>,
      data?: {
        loading?: ReactNode;
        success?: ReactNode | ((value: T) => ReactNode);
        error?: ReactNode | ((error: unknown) => ReactNode);
      },
      options?: ToastOptions,
    ) => Promise<T>;
  };

  export const toast: ToastApi;
  export const Toaster: ComponentType<Record<string, unknown>>;
}
