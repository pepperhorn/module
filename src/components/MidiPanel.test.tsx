import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MidiPanel } from './MidiPanel'
import { MidiStatus } from './MidiStatus'
import { useStore } from '../state/useStore'
import { classifyMidiError } from '../input/midiAccess'
import { presetProfile } from '../input/midiProfile'

afterEach(cleanup)

beforeEach(() => {
  useStore.setState({
    midiPanelOpen: true,
    midiStatus: 'idle',
    midiDevices: [],
    midiLearning: false,
    midiProfile: presetProfile('travel-sax-2'),
  })
})

const state = () => document.querySelector('[data-midi-state]')?.getAttribute('data-midi-state')

describe('MidiPanel permission states', () => {
  it('renders nothing when closed', () => {
    useStore.setState({ midiPanelOpen: false })
    const { container } = render(<MidiPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('is an accessible modal dialog with focus on close', () => {
    render(<MidiPanel />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close midi settings/i }))
  })

  it('idle: offers Enable MIDI', () => {
    render(<MidiPanel />)
    expect(state()).toBe('idle')
    expect(screen.getByRole('button', { name: /enable midi/i })).toBeTruthy()
  })

  it('unsupported: explains, no enable button', () => {
    useStore.setState({ midiStatus: 'unsupported' })
    render(<MidiPanel />)
    expect(state()).toBe('unsupported')
    expect(screen.queryByRole('button', { name: /enable midi|try again/i })).toBeNull()
  })

  it('denied: shows the site-settings recovery path', () => {
    useStore.setState({ midiStatus: 'denied' })
    render(<MidiPanel />)
    expect(state()).toBe('denied')
    expect(screen.getByText(/MIDI devices/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('granted without devices: plug-something-in state plus controls', () => {
    useStore.setState({ midiStatus: 'granted' })
    render(<MidiPanel />)
    expect(state()).toBe('no-devices')
    expect(screen.getByRole('switch', { name: /breath on/i })).toBeTruthy()
  })

  it('granted with a device: lists it and applies presets in one tap', () => {
    useStore.setState({
      midiStatus: 'granted',
      midiDevices: [{ id: '1', name: 'Travel Sax 2', manufacturer: 'Odisei' }],
    })
    render(<MidiPanel getLatency={() => ({ baseLatencyMs: 5, outputLatencyMs: 20 })} />)
    expect(screen.getByText('Odisei')).toBeTruthy()
    expect(screen.getByText('LAT 5+20MS')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /keyboard/i, pressed: false }))
    expect(useStore.getState().midiProfile.preset).toBe('keyboard')
    expect(useStore.getState().midiProfile.enabled).toBe(false)
    fireEvent.click(screen.getByRole('radio', { name: /cc11/i }))
    expect(useStore.getState().midiProfile.breath.cc).toBe(11)
  })

  it('Escape closes and cancels learn', () => {
    useStore.setState({ midiStatus: 'granted', midiLearning: true })
    render(<MidiPanel />)
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(useStore.getState().midiPanelOpen).toBe(false)
    expect(useStore.getState().midiLearning).toBe(false)
  })
})

describe('MidiStatus pill', () => {
  it('opens the panel and reflects a blocked permission', () => {
    useStore.setState({ midiPanelOpen: false, midiStatus: 'denied', midiConnected: false })
    render(<MidiStatus />)
    const pill = screen.getByRole('button', { name: /midi blocked/i })
    fireEvent.click(pill)
    expect(useStore.getState().midiPanelOpen).toBe(true)
  })
})

describe('classifyMidiError', () => {
  it('maps SecurityError / NotAllowedError to denied, anything else to error', () => {
    expect(classifyMidiError(new DOMException('no', 'SecurityError'))).toBe('denied')
    expect(classifyMidiError({ name: 'NotAllowedError' })).toBe('denied')
    expect(classifyMidiError(new Error('x'))).toBe('error')
    expect(classifyMidiError(null)).toBe('error')
  })
})

describe('keyboard-mode access', () => {
  it('TouchControls in keyboard mode exposes the MIDI pill', async () => {
    const { TouchControls } = await import('./TouchControls')
    useStore.setState({ midiPanelOpen: false, midiStatus: 'idle', midiConnected: false })
    render(<TouchControls onPanic={() => {}} onToggleKeyboardMode={() => {}} keyboardMode />)
    fireEvent.click(screen.getByRole('button', { name: /midi off/i }))
    expect(useStore.getState().midiPanelOpen).toBe(true)
  })
})
