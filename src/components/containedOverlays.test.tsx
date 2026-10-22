// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useStore } from '../state/useStore'
import { PatchPicker } from './PatchPicker'
import { MidiPanel } from './MidiPanel'
import { LoadingOverlay } from './LoadingOverlay'
import { PowerOnOverlay } from './PowerOnOverlay'

const noop = () => {}

const cases: [string, (contained: boolean) => JSX.Element, string][] = [
  [
    'PatchPicker',
    (c) => {
      useStore.setState({ pickerOpen: true })
      return <PatchPicker contained={c} onSelect={noop} onPreview={noop} />
    },
    '.patch-picker',
  ],
  [
    'MidiPanel',
    (c) => {
      useStore.setState({ midiPanelOpen: true })
      return <MidiPanel contained={c} />
    },
    '.midi-panel-scrim',
  ],
  [
    'LoadingOverlay',
    (c) => {
      useStore.setState({ loadingPatchId: 'ep/wurlitzerep200' })
      return <LoadingOverlay contained={c} />
    },
    '.loading-overlay',
  ],
  ['PowerOnOverlay', (c) => <PowerOnOverlay contained={c} onPowerOn={noop} />, '.gesture-overlay'],
]

describe('contained overlays', () => {
  afterEach(() => {
    cleanup()
    useStore.setState({ pickerOpen: false, midiPanelOpen: false, loadingPatchId: null, online: true })
  })

  it.each(cases)('%s contained renders absolute, not fixed', (_n, el, sel) => {
    const cls = render(el(true)).container.querySelector(sel)!.className
    expect(cls).toMatch(/\babsolute\b/)
    expect(cls).not.toMatch(/\bfixed\b/)
  })

  it.each(cases)('%s stays fixed by default (app unchanged)', (_n, el, sel) => {
    const cls = render(el(false)).container.querySelector(sel)!.className
    expect(cls).toMatch(/\bfixed\b/)
    expect(cls).not.toMatch(/\babsolute\b/)
  })

  it('picker without offline features shows no download buttons or offline pill', () => {
    useStore.setState({ pickerOpen: true, online: false })
    const { container } = render(<PatchPicker offlineFeatures={false} onSelect={noop} onPreview={noop} />)
    expect(container.querySelector('.patch-card')).not.toBeNull()
    expect(container.querySelector('.patch-card-dl')).toBeNull()
    expect(container.querySelector('.patch-picker-offline-pill')).toBeNull()
    expect(container.querySelector('.patch-card-offline')).toBeNull()
  })
})
