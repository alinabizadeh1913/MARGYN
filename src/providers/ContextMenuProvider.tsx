"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  label?: string;
  icon?: React.ElementType;
  onClick?: () => void;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
};

interface ContextMenuContextType {
  openMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(
  undefined,
);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [menuKey, setMenuKey] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });

  const openMenu = (x: number, y: number, menuItems: ContextMenuItem[]) => {
    setPosition({ x, y });
    setAdjustedPos({ x, y }); // ✅ ریست کردن موقعیت اولیه برای جلوگیری از پرش
    setItems(menuItems);
    setMenuKey((prev) => prev + 1);
    setIsOpen(true);
  };

  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleScroll = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("resize", closeMenu);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = position.x;
      let newY = position.y;

      // جلوگیری از خارج شدن منو از لبه‌های صفحه
      if (newX + rect.width > window.innerWidth) newX -= rect.width;
      if (newY + rect.height > window.innerHeight) newY -= rect.height;

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [isOpen, position, items]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}
      {isOpen &&
        createPortal(
          <div
            key={menuKey}
            ref={menuRef}
            // ✅ حذف تمام کلاس‌های انیمیشن برای نمایش آنی (بدون تاخیر و پرش)
            className="fixed z-[99999] min-w-[220px] bg-[#121214]/95 backdrop-blur-xl border border-[#27272a] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1.5"
            style={{ top: adjustedPos.y, left: adjustedPos.x }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {items.map((item, index) => {
              if (item.separator) {
                return (
                  <div key={index} className="h-px bg-[#27272a] my-1 mx-2" />
                );
              }

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (!item.disabled && item.onClick) {
                      item.onClick();
                      closeMenu();
                    }
                  }}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors group
                    ${item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    ${
                      item.danger
                        ? "text-rose-500 hover:bg-rose-500/10"
                        : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {item.icon && (
                      <item.icon
                        size={16}
                        className={
                          item.danger
                            ? "text-rose-500"
                            : "text-[#71717a] group-hover:text-[#fafafa]"
                        }
                      />
                    )}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span className="text-[10px] font-mono tracking-wider text-[#52525b] uppercase ml-4">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context)
    throw new Error("useContextMenu must be used within ContextMenuProvider");
  return context;
}
