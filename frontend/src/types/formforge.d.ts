export {};

declare global {
  interface Window {
    FormForge?: {
      embed: (opts: {
        formId?: string;
        slug?: string;
        container: string | HTMLElement;
        theme?: string;
        width?: string | number;
        height?: string | number;
        onSubmit?: (payload: Record<string, unknown>) => void;
      }) => { iframe: HTMLIFrameElement; destroy: () => void };
      popup: (opts: {
        formId?: string;
        slug?: string;
        width?: number;
        height?: number;
        theme?: string;
      }) => { iframe: HTMLIFrameElement; destroy: () => void };
      open: (opts: { formId?: string; slug?: string; width?: number; height?: number }) => void;
    };
  }
}
