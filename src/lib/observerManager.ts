export type ObserverCallback = () => void;

class ObserverManager {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, ObserverCallback>();

  private getObserver() {
    if (typeof window === 'undefined') return null;

    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.unobserve(entry.target);
            }
          }
        });
      }, { threshold: 0.1 });
    }
    return this.observer;
  }

  observe(element: Element, callback: ObserverCallback) {
    const obs = this.getObserver();
    if (obs) {
      this.callbacks.set(element, callback);
      obs.observe(element);
    }
  }

  unobserve(element: Element) {
    this.callbacks.delete(element);
    this.observer?.unobserve(element);
  }
}

export const vidAngelObserver = new ObserverManager();
