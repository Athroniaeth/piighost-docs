/**
 * A table wider than the column scrolls inside its region (tree.ts), and a
 * reader must see that it does: the region's frame shows a shade on each side
 * it can still scroll to, through `data-scroll-start` and `data-scroll-end`
 * (app.css). A region that does not overflow leaves the tab order: there is
 * nothing to scroll with the keyboard.
 */
export function markScroller(scroller: Element) {
	const frame = scroller.parentElement;
	if (!frame) return;
	const max = scroller.scrollWidth - scroller.clientWidth;
	const overflows = max > 1;
	frame.toggleAttribute('data-scroll-start', overflows && scroller.scrollLeft > 1);
	frame.toggleAttribute('data-scroll-end', overflows && scroller.scrollLeft < max - 1);
	if (overflows) scroller.setAttribute('tabindex', '0');
	else scroller.removeAttribute('tabindex');
}

/** Watch every scrolling table of the document; returns what to call on each new page, and the cleanup. */
export function watchScrollers(): { refresh: () => void; stop: () => void } {
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) markScroller(entry.target);
	});
	const onScroll = (event: Event) => {
		if (event.target instanceof Element && event.target.matches('.table-scroll'))
			markScroller(event.target);
	};
	document.addEventListener('scroll', onScroll, { capture: true, passive: true });
	return {
		refresh() {
			observer.disconnect();
			for (const scroller of document.querySelectorAll('.table-scroll')) observer.observe(scroller);
		},
		stop() {
			observer.disconnect();
			document.removeEventListener('scroll', onScroll, { capture: true });
		}
	};
}
