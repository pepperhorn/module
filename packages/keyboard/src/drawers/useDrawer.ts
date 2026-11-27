import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type DrawerName = 'sounds' | 'effects' | 'settings'

export function useDrawer() {
  const [active, show] = useState<DrawerName | null>(null)
  const sounds = useRef<HTMLButtonElement>(null)
  const gear = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  const panelId = useId()

  const close = useCallback(() => {
    show(null)
    const trigger = active === 'sounds' ? sounds : gear
    trigger.current?.focus({ preventScroll: true })
  }, [active])

  function toggle(name: 'sounds' | 'effects') {
    const isOpen = name === 'sounds' ? active === 'sounds' : active !== null && active !== 'sounds'
    if (isOpen) close()
    else {
      moveFocus.current = true
      show(name)
    }
  }

  useEffect(() => {
    if (!active) return
    if (moveFocus.current) {
      panel.current?.focus({ preventScroll: true })
      moveFocus.current = false
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if ([panel.current, sounds.current, gear.current].some(el => el?.contains(target))) return
      show(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!(event.target instanceof Element) || !event.target.closest('.keyboard-module')) {
        show(null)
        return
      }
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [active, close])

  return { active, show, toggle, close, sounds, gear, panel, panelId }
}
