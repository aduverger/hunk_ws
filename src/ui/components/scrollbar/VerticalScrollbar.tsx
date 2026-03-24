import type { MouseEvent as TuiMouseEvent } from "@opentui/core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { AppTheme } from "../../themes";

const HIDE_DELAY_MS = 2000;
const SCROLLBAR_WIDTH = 1;

export interface VerticalScrollbarHandle {
  show: () => void;
}

interface VerticalScrollbarProps {
  scrollRef: RefObject<{
    scrollTop: number;
    scrollTo: (y: number) => void;
    viewport: { height: number };
  } | null>;
  contentHeight: number;
  theme: AppTheme;
  height: number;
  onActivity?: () => void;
}

export const VerticalScrollbar = forwardRef<VerticalScrollbarHandle, VerticalScrollbarProps>(
  function VerticalScrollbar({ scrollRef, contentHeight, theme, height, onActivity }, ref) {
    const [isVisible, setIsVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartY, setDragStartY] = useState(0);
    const [dragStartScroll, setDragStartScroll] = useState(0);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback(() => {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        if (!isDragging) {
          setIsVisible(false);
        }
      }, HIDE_DELAY_MS);
      onActivity?.();
    }, [isDragging, onActivity]);

    useImperativeHandle(ref, () => ({ show }), [show]);

    useEffect(() => {
      return () => {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      };
    }, []);

    // Don't show if content fits in viewport
    const viewportHeight = height;
    const shouldShow = contentHeight > viewportHeight && isVisible;

    // Calculate thumb metrics
    const trackHeight = viewportHeight;
    const scrollRatio = viewportHeight / contentHeight;
    const thumbHeight = Math.max(SCROLLBAR_WIDTH, Math.floor(trackHeight * scrollRatio));
    const maxThumbY = trackHeight - thumbHeight;

    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const maxScroll = contentHeight - viewportHeight;
    const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const thumbY = Math.floor(scrollPercent * maxThumbY);

    const handleMouseDown = (event: TuiMouseEvent) => {
      if (event.button !== 0) return;

      const currentScrollTop = scrollRef.current?.scrollTop ?? 0;
      setIsDragging(true);
      setDragStartY(event.y);
      setDragStartScroll(currentScrollTop);
      show();
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseDrag = (event: TuiMouseEvent) => {
      if (!isDragging) return;

      const deltaY = event.y - dragStartY;
      const pixelsPerRow = maxThumbY / maxScroll;
      const scrollDelta = deltaY / pixelsPerRow;
      const newScrollTop = Math.max(0, Math.min(maxScroll, dragStartScroll + scrollDelta));

      scrollRef.current?.scrollTo(newScrollTop);
      show();
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseUp = (event?: TuiMouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      // Restart hide timer
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, HIDE_DELAY_MS);
      event?.preventDefault();
      event?.stopPropagation();
    };

    if (!shouldShow) {
      return null;
    }

    return (
      <box
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: SCROLLBAR_WIDTH,
          height: trackHeight,
          backgroundColor: theme.panel,
          zIndex: 10,
        }}
      >
        {/* Track background */}
        <box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: SCROLLBAR_WIDTH,
            height: trackHeight,
            backgroundColor: theme.border,
          }}
        />
        {/* Thumb */}
        <box
          style={{
            position: "absolute",
            top: thumbY,
            left: 0,
            width: SCROLLBAR_WIDTH,
            height: thumbHeight,
            backgroundColor: isDragging ? theme.accent : theme.accentMuted,
          }}
          onMouseDown={handleMouseDown}
          onMouseDrag={handleMouseDrag}
          onMouseUp={handleMouseUp}
          onMouseDragEnd={handleMouseUp}
        />
      </box>
    );
  },
);
