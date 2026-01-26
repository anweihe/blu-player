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
   * Whether to listen to window scroll or element scroll
   */
  @Input() scrollWindow = true;

  /**
   * Disable scroll listener
   */
  @Input() scrollDisabled = false;

  /**
   * Emitted when user scrolls near the bottom
   */
  @Output() scrolled = new EventEmitter<void>();

  private scrollListener?: () => void;

  ngOnInit(): void {
    this.scrollListener = this.onScroll.bind(this);

    if (this.scrollWindow) {
      window.addEventListener('scroll', this.scrollListener, { passive: true });
    } else {
      this.elementRef.nativeElement.addEventListener('scroll', this.scrollListener, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      if (this.scrollWindow) {
        window.removeEventListener('scroll', this.scrollListener);
      } else {
        this.elementRef.nativeElement.removeEventListener('scroll', this.scrollListener);
      }
    }
  }

  private onScroll(): void {
    if (this.scrollDisabled) return;

    let shouldEmit = false;

    if (this.scrollWindow) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      shouldEmit = (scrollTop + windowHeight) >= (documentHeight - this.scrollThreshold);
    } else {
      const element = this.elementRef.nativeElement;
      shouldEmit = (element.scrollTop + element.clientHeight) >= (element.scrollHeight - this.scrollThreshold);
    }

    if (shouldEmit) {
      this.scrolled.emit();
    }
  }
}
