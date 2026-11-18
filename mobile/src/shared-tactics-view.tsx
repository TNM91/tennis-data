import {useCallback, useState, useSyncExternalStore, type CSSProperties} from 'react'
import {createRoot} from 'react-dom/client'
import TiqCourtBoard from '../../components/tactical/TiqCourtBoard'
import {courtDiagramSize} from '../../lib/tactical/courtProjection'
import type {TacticalScenario} from '../../lib/tactical/types'
import './coach-premium.css'

const orientation = '(orientation: landscape) and (max-height: 600px)'
const landscape = () => window.matchMedia(orientation).matches
function subscribe(callback: () => void) {
  const query = window.matchMedia(orientation)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const noEdit = () => {}

function SharedCourt({board}: {board: TacticalScenario}) {
  const horizontal = useSyncExternalStore(subscribe, landscape)
  const [step, setStep] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const currentPath = step === null ? undefined : board.paths[step]
  const advance = useCallback(() => setStep(current => current === null ? null : current + 1), [])
  const ratio = horizontal ? courtDiagramSize.length / courtDiagramSize.width : courtDiagramSize.width / courtDiagramSize.length
  return <>
    <div data-tiq-native-canvas style={{'--tactics-board-ratio': ratio} as CSSProperties}>
      <TiqCourtBoard view={horizontal ? 'overhead-landscape' : 'overhead'} scenario={board}
        readOnly showLabels showPaths showZones snapToGrid={false} tokenScale="medium" roleView="player"
        selected={{type: 'scenario', id: 'scenario'}} drawingKind={null} placementTokenType={null}
        playback={currentPath ? {pathId: currentPath.id, paused, onAdvance: advance} : undefined}
        onMoveToken={noEdit} onDeleteToken={noEdit} onMovePathPoint={noEdit} onMoveZone={noEdit}
        onCreatePath={noEdit} onPlaceToken={noEdit} onSelect={noEdit} onCancelTool={noEdit}
        onClearSelection={noEdit} onDeleteSelected={noEdit} onDuplicateSelected={noEdit} />
    </div>
    {board.paths.length > 0 && <div data-tiq-pattern-playback role="group" aria-label="Pattern playback">
      <p role="status">{currentPath && step !== null
        ? `${step + 1} of ${board.paths.length} · ${currentPath.label || currentPath.kind}`
        : step === null ? `${board.paths.length} ${board.paths.length === 1 ? 'step' : 'steps'}` : 'Pattern complete'}</p>
      <button type="button" data-tiq-playback-action onClick={() => {
        if (currentPath) setPaused(value => !value)
        else { setPaused(false); setStep(0) }
      }}>{currentPath ? paused ? 'Resume' : 'Pause' : step === null ? 'Play pattern' : 'Replay'}</button>
    </div>}
    {board.cues.length > 0 && <ul className="shared-tactics-cues">{board.cues.map(cue => <li key={cue.id}>{cue.text}</li>)}</ul>}
  </>
}

export function openSharedTactics(trigger: HTMLButtonElement, current: () => boolean, getBoard: () => Promise<TacticalScenario>) {
  const dialog = document.createElement('dialog')
  dialog.className = 'native-coach-screen native-tactics-screen shared-tactics-dialog'
  dialog.setAttribute('aria-label', 'Shared tactics board')
  dialog.innerHTML = '<header class="native-coach-header"><h1 tabindex="-1">Tactics board</h1><button class="secondary" type="button">Close</button></header><div class="native-tactics-content shared-tactics-content"></div>'
  const heading = dialog.querySelector('h1')!
  const host = dialog.querySelector<HTMLElement>('.shared-tactics-content')!
  const root = createRoot(host)
  let open = true
  const dispose = () => {
    if (!open) return
    open = false
    root.unmount()
    dialog.close()
    dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({preventScroll: true})
  }
  dialog.querySelector('button')!.onclick = dispose
  dialog.oncancel = event => { event.preventDefault(); dispose() }
  document.body.append(dialog)
  dialog.showModal()
  heading.focus({preventScroll: true})
  root.render(<p role="status">Opening board…</p>)
  void getBoard().then(board => {
    if (!open || !current()) return
    heading.textContent = board.name
    root.render(<SharedCourt board={board} />)
  }).catch(() => {
    if (open && current()) root.render(<p role="status">This board couldn’t open. Close and try again.</p>)
  })
  return {dispose, isOpen: () => open}
}
