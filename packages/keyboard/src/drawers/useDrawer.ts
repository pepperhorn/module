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
    const handleOutside = (event: MouseEvent) => {
      // Keyboard and assistive clicks do not have a preceding pointerdown.
      if (event.type === 'click' && event.detail !== 0) return
      const target = event.target
      if (!(target instanceof Element) || target.closest('.keyboard-module .kb-surface')) return
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
    document.addEventListener('pointerdown', handleOutside, true)
    document.addEventListener('click', handleOutside, true)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutside, true)
      document.removeEventListener('click', handleOutside, true)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [active, close])

  return { active, show, toggle, close, sounds, gear, panel, panelId }
}
