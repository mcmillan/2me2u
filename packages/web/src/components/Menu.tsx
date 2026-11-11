/**
 * A popup menu: a trigger button, and a `popover="auto"` right after it in the
 * top layer, anchored to the trigger. The browser opens and closes it (invoker
 * commands, light dismiss) and moves between items (`focusgroup`); this file
 * adds the rest of the keyboard model, focus restoration, and fallbacks for
 * browsers without focusgroup, invoker commands or anchor positioning.
 */

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { type TamaguiElement, YStack, type YStackProps } from 'tamagui';

const NATIVE_FOCUSGROUP = 'focusGroup' in HTMLElement.prototype;
const NATIVE_INVOKERS = 'commandForElement' in HTMLButtonElement.prototype;
const NATIVE_ANCHORS = CSS.supports('position-area: block-end');

/** Where native focusgroup is missing, the roles it would infer are set explicitly. */
const ITEM_ROLE = NATIVE_FOCUSGROUP ? undefined : ('menuitem' as const);

const MENU = '[popover]:has(> [focusgroup~="menu"])';
const CSS_TEXT = `
${MENU} { border: 0; padding: 0; background: transparent; color: inherit; overflow: visible; }
@supports (position-area: block-end) {
  ${MENU} {
    inset: auto;
    margin: 6px 0;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
}
@supports not (position-area: block-end) {
  ${MENU} { position: fixed; inset: auto; margin: 0; }
}
`;

const GAP = 6;
const EDGE = 8;

/** Without anchor positioning: below the trigger, flipped and clamped to the viewport. */
const placeByScript = (menu: HTMLElement, trigger: HTMLElement) => {
  const t = trigger.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  let left = t.left + m.width <= vw - EDGE ? t.left : t.right - m.width;
  let top = t.bottom + GAP + m.height <= vh - EDGE ? t.bottom + GAP : t.top - GAP - m.height;
  left = Math.max(EDGE, Math.min(left, vw - EDGE - m.width));
  top = Math.max(EDGE, Math.min(top, vh - EDGE - m.height));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
};

/** Focus without the keyboard ring, for focus that follows the pointer. */
const quietFocus = (el: HTMLElement) => el.focus({ focusVisible: false, preventScroll: true });

const enabledItems = (group: HTMLElement) =>
  [...group.querySelectorAll<HTMLElement>('button')].filter(
    (item) =>
      item.closest('[focusgroup]') === group &&
      !(item as HTMLButtonElement).disabled &&
      item.getAttribute('aria-disabled') !== 'true',
  );

interface MenuContextValue {
  /** Close the menu and return focus to its trigger, without a ring after a pointer. */
  readonly close: (fromPointer: boolean) => void;
}

const MenuContext = createContext<MenuContextValue>({ close: () => {} });

/** What the trigger must spread onto its button (an `Action`). */
export interface MenuTriggerProps {
  readonly ref: RefObject<TamaguiElement | null>;
  readonly id: string;
  readonly 'aria-haspopup': 'menu';
  readonly 'aria-expanded': boolean;
}

interface MenuProps {
  /** Renders the trigger button; spread `props` onto it and style it as active when `open`. */
  readonly trigger: (props: MenuTriggerProps, open: boolean) => ReactNode;
  /** Props for the panel holding the items (size, padding, gaps, scrolling). */
  readonly panel?: YStackProps;
  readonly children: ReactNode;
}

/** A menu button and its popup menu. Fill it with `MenuItem`s. */
export const Menu = ({ trigger, panel, children }: MenuProps) => {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const menuId = `${id}-menu`;
  const triggerRef = useRef<TamaguiElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<TamaguiElement>(null);
  const [open, setOpen] = useState(false);

  // On the web a Tamagui view is its DOM element.
  const triggerEl = () => triggerRef.current as unknown as HTMLButtonElement | null;
  const groupEl = () => groupRef.current as unknown as HTMLElement | null;

  const close = (fromPointer: boolean) => {
    const button = triggerEl();
    if (button) {
      if (fromPointer) quietFocus(button);
      else button.focus();
    }
    if (menuRef.current?.matches(':popover-open')) menuRef.current.hidePopover();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the elements live as long as the component
  useEffect(() => {
    const button = triggerEl();
    const menu = menuRef.current;
    const group = groupEl();
    if (!button || !menu || !group) return;
    /** Set by a keyboard open, so the toggle handler moves focus into the menu. */
    let enterOnOpen = false;
    let pointerPressed = false;
    const isOpen = () => menu.matches(':popover-open');
    const enter = () => {
      const items = enabledItems(group);
      (items[0] ?? group.querySelector<HTMLElement>('button'))?.focus();
    };

    const onTriggerPointerDown = (e: PointerEvent) => {
      // A pointer click toggles the menu but doesn't move focus.
      e.preventDefault();
      pointerPressed = true;
    };
    const onTriggerClick = (e: globalThis.MouseEvent) => {
      const fromPointer = pointerPressed || e.detail !== 0;
      pointerPressed = false;
      if (!fromPointer) enterOnOpen = true;
      if (NATIVE_INVOKERS) return;
      e.preventDefault();
      if (isOpen()) close(fromPointer);
      else menu.showPopover({ source: button });
    };
    const onTriggerKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      if (isOpen()) enter();
      else {
        enterOnOpen = true;
        button.click();
      }
    };

    const onToggle = (e: Event) => {
      const opening = (e as ToggleEvent).newState === 'open';
      setOpen(opening);
      if (!opening) {
        enterOnOpen = false;
        return;
      }
      if (!NATIVE_ANCHORS) placeByScript(menu, button);
      if (enterOnOpen) enter();
      else quietFocus(button);
      enterOnOpen = false;
    };

    const onMenuKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
        return;
      }
      const keys = NATIVE_FOCUSGROUP ? ['Home', 'End'] : ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const items = enabledItems(group);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : (current + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      e.preventDefault();
      e.stopPropagation();
      items[next]?.focus({ preventScroll: false });
    };

    // Hover follows focus: the item under the pointer is the focused one.
    const onMenuPointerMove = (e: PointerEvent) => {
      const item = (e.target as Element).closest<HTMLElement>('button');
      if (item && item !== document.activeElement && group.contains(item)) quietFocus(item);
    };

    // Close when focus lands outside the trigger and menu (e.g. Tab out).
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      if (isOpen() && !menu.contains(target) && !button.contains(target)) menu.hidePopover();
    };

    button.addEventListener('pointerdown', onTriggerPointerDown);
    button.addEventListener('click', onTriggerClick);
    button.addEventListener('keydown', onTriggerKeyDown);
    menu.addEventListener('toggle', onToggle);
    menu.addEventListener('keydown', onMenuKeyDown);
    menu.addEventListener('pointermove', onMenuPointerMove);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      button.removeEventListener('pointerdown', onTriggerPointerDown);
      button.removeEventListener('click', onTriggerClick);
      button.removeEventListener('keydown', onTriggerKeyDown);
      menu.removeEventListener('toggle', onToggle);
      menu.removeEventListener('keydown', onMenuKeyDown);
      menu.removeEventListener('pointermove', onMenuPointerMove);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  const invoker = { commandfor: menuId, command: 'toggle-popover' } as Record<string, string>;
  const triggerProps = {
    ref: triggerRef,
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    ...invoker,
  } as MenuTriggerProps;

  const panelStack = (
    // The focusgroup is nested, not on the popover: Chromium drops its keys otherwise.
    <YStack
      ref={groupRef}
      {...({ focusgroup: 'menu nomemory' } as Record<string, string>)}
      {...(NATIVE_FOCUSGROUP ? {} : { role: 'menu' as const })}
      aria-labelledby={triggerId}
      w={340}
      maxW="calc(100vw - 32px)"
      p="1.5"
      gap="1"
      rounded="lg"
      bg="background"
      borderWidth={1}
      borderColor="border-color"
      shadowColor="rgba(0,0,0,0.18)"
      shadowRadius={16}
      shadowOffset={{ width: 0, height: 6 }}
      {...panel}
    >
      {children}
    </YStack>
  );
  return (
    <MenuContext.Provider value={{ close }}>
      {trigger(triggerProps, open)}
      {/* Right after its trigger (Tamagui's display: contents theme span around the
          button doesn't count), so browsers add no implicit aria-details. */}
      <div ref={menuRef} id={menuId} {...({ popover: 'auto' } as Record<string, string>)}>
        {panelStack}
      </div>
      <style>{CSS_TEXT}</style>
    </MenuContext.Provider>
  );
};

type MenuItemProps = Omit<YStackProps, 'onPress' | 'role'> & {
  /** Shown but not usable; it stays focusable so its reason can be read. */
  readonly disabled?: boolean;
  /** Runs after the menu closes and focus is back on the trigger. */
  readonly onSelect: () => void;
};

/** A command in a `Menu`: a button that closes the menu and runs `onSelect`. */
export const MenuItem = ({ disabled = false, onSelect, children, ...props }: MenuItemProps) => {
  const { close } = useContext(MenuContext);
  return (
    <YStack
      render="button"
      {...({ type: 'button' } as Record<string, string>)}
      {...(ITEM_ROLE ? { role: ITEM_ROLE } : {})}
      aria-disabled={disabled || undefined}
      items="stretch"
      text="left"
      borderWidth={0}
      rounded="md"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      bg={disabled ? 'transparent' : { default: 'transparent', hover: 'color-2', focus: 'color-2' }}
      outlineColor="color-8"
      outlineStyle={{ default: 'none', 'focus-visible': 'solid' }}
      outlineWidth={2}
      outlineOffset={-2}
      onClick={(e: MouseEvent) => {
        if (disabled) return;
        close(e.detail !== 0);
        onSelect();
      }}
      {...props}
    >
      {children}
    </YStack>
  );
};
