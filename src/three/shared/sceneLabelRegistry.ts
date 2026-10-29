const labelElements = new Set<HTMLDivElement>();
const EDGE_INSET = 10;
const COLLISION_GAP = 2;

interface LabelBox {
  element: HTMLDivElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
  priority: number;
  area: number;
}

export function registerLabelElement(element: HTMLDivElement): () => void {
  labelElements.add(element);
  return () => {
    labelElements.delete(element);
  };
}

export function clampLabelElements(container: HTMLElement | null): void {
  if (!container) return;
  const bounds = container.getBoundingClientRect();
  const visible: LabelBox[] = [];

  for (const element of labelElements) {
    element.style.visibility = "";
    const previousX = Number(element.dataset.clampX ?? 0);
    const previousY = Number(element.dataset.clampY ?? 0);
    const rect = element.getBoundingClientRect();
    const left = rect.left - previousX;
    const right = rect.right - previousX;
    const top = rect.top - previousY;
    const bottom = rect.bottom - previousY;
    const intersects =
      right > bounds.left &&
      left < bounds.right &&
      bottom > bounds.top &&
      top < bounds.bottom;

    let x = 0;
    let y = 0;
    if (intersects) {
      if (left < bounds.left + EDGE_INSET) x = bounds.left + EDGE_INSET - left;
      else if (right > bounds.right - EDGE_INSET) x = bounds.right - EDGE_INSET - right;
      if (top < bounds.top + EDGE_INSET) y = bounds.top + EDGE_INSET - top;
      else if (bottom > bounds.bottom - EDGE_INSET) y = bounds.bottom - EDGE_INSET - bottom;
    }

    if (x !== previousX || y !== previousY) {
      element.style.translate = `${x}px ${y}px`;
      element.dataset.clampX = String(x);
      element.dataset.clampY = String(y);
    }

    if (!intersects) continue;
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) continue;
    visible.push({
      element,
      left: left + x,
      right: right + x,
      top: top + y,
      bottom: bottom + y,
      priority: Number(element.dataset.labelPriority ?? 0),
      area: width * height,
    });
  }

  visible.sort(
    (a, b) => b.priority - a.priority || b.area - a.area || a.top - b.top,
  );

  const kept: LabelBox[] = [];
  for (const label of visible) {
    const overlaps = kept.some(
      (other) =>
        label.left < other.right - COLLISION_GAP &&
        label.right > other.left + COLLISION_GAP &&
        label.top < other.bottom - COLLISION_GAP &&
        label.bottom > other.top + COLLISION_GAP,
    );
    if (overlaps) {
      label.element.style.visibility = "hidden";
    } else {
      kept.push(label);
    }
  }
}
