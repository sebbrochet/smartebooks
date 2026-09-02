/**
 * Scrolls a container just enough to bring one of its children into view.
 *
 * Deliberately **not** `Element.scrollIntoView`, which scrolls *every*
 * scrollable ancestor including the document. Inside a sticky rail or a fixed
 * dialog that is a bug rather than a nicety: moving the highlight in a list
 * silently moves the page behind it, and the reader loses the place they were
 * promised they could come back to.
 *
 * Measured with rects so it works regardless of which ancestor is positioned.
 */
export function keepInView(container: HTMLElement, item: HTMLElement): void {
  const containerBox = container.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();

  const above = itemBox.top - containerBox.top;
  const below = itemBox.bottom - containerBox.bottom;

  if (above < 0) container.scrollTop += above;
  else if (below > 0) container.scrollTop += below;
}
