/** Full-page navigation for external URLs (OAuth, Stripe, and similar). */
export function hardNavigate(url: string) {
  window.location.assign(url);
}
