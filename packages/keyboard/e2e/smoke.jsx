import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Keyboard } from '../dist/index.js'

const defaultPatch = new URLSearchParams(location.search).get('patch') ?? 'piano'
createRoot(document.getElementById('app')).render(createElement(Keyboard, {
  defaultPatch, defaultMode: 'chord', showNoteNames: true,
}))
