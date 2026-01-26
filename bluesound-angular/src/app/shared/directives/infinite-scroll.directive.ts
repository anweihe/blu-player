import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);

  /**
   * Distance from bottom (in pixels) to trigger loading
   */
  @Input() scrollThreshold = 200;

  /**
   * Selector for the scroll container (default: 'main' element)
   * Use 'window' to listen to window scroll, 'self' for the directive element
   */
  @Input() scrollContainer: string = 'main';

  /**
   * Disable scroll listener
   */
  @Input() scrollDisabled = false;

  /**
   * Emitted when user scrolls near the bottom
   */
  @Output() scrolled = new EventEmitter<void>();

  private scrollListener?: () => void;
  private scrollElement?: Element | Window;

  ngOnInit(): void {
    this.scrollListener = this.onScroll.bind(this);
    this.scrollElement = this.resolveScrollElement();

    if (this.scrollElement) {
      this.scrollElement.addEventListener('scroll', this.scrollListener, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.scrollListener && this.scrollElement) {
      this.scrollElement.removeEventListener('scroll', this.scrollListener);
    }
  }

  private resolveScrollElement(): Element | Window | undefined {
    if (this.scrollContainer === 'window') {
      return window;
    }
    if (this.scrollContainer === 'self') {
      return this.elementRef.nativeElement;
    }
    // Query selector - find the closest matching ancestor or document element
    return document.querySelector(this.scrollContainer) || undefined;
  }

  private onScroll(): void {
    if (this.scrollDisabled) return;

    let shouldEmit = false;

    if (this.scrollElement === window) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      shouldEmit = (scrollTop + windowHeight) >= (documentHeight - this.scrollThreshold);
    } else if (this.scrollElement instanceof Element) {
      const el = this.scrollElement;
      shouldEmit = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - this.scrollThreshold);
    }

    if (shouldEmit) {
      this.scrolled.emit();
    }
  }
}
