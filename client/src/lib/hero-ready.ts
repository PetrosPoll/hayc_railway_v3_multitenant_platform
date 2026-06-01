type Listener = () => void;
const listeners = new Set<Listener>();
let resolved = false;

export const heroReady = {
  signal() {
    resolved = true;
    listeners.forEach((l) => l());
    listeners.clear();
  },
  onReady(cb: Listener) {
    if (resolved) {
      cb();
      return;
    }
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  isResolved() {
    return resolved;
  },
};
