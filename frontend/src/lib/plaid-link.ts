const PLAID_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

type PlaidHandler = {
  open: () => void;
  destroy?: () => void;
};

type PlaidCreateConfig = {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit?: () => void;
};

declare global {
  interface Window {
    Plaid?: {
      create: (config: PlaidCreateConfig) => PlaidHandler;
    };
  }
}

function loadPlaidScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Plaid Link requires a browser'));
  }
  if (window.Plaid) {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src="${PLAID_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Plaid Link')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PLAID_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Plaid Link'));
    document.head.appendChild(script);
  });
}

export async function openPlaidLink(linkToken: string): Promise<string> {
  await loadPlaidScript();
  const plaid = window.Plaid;
  if (!plaid) {
    throw new Error('Plaid Link is unavailable');
  }

  return new Promise((resolve, reject) => {
    const handler = plaid.create({
      token: linkToken,
      onSuccess: (publicToken) => {
        handler.destroy?.();
        resolve(publicToken);
      },
      onExit: () => {
        handler.destroy?.();
        reject(new Error('Bank connection was cancelled'));
      },
    });
    handler.open();
  });
}
