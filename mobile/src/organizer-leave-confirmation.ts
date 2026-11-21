export function createOrganizerLeaveConfirmation(parent: HTMLDialogElement, subject: 'league' | 'tournament', current: () => boolean) {
  let dialog: HTMLDialogElement | null = null
  let returnFocus: HTMLElement | null = null

  function close(restoreFocus = false) {
    dialog?.close()
    dialog?.remove()
    dialog = null
    if (restoreFocus && current() && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    returnFocus = null
  }

  function open(form: HTMLFormElement, discard: () => void) {
    if (dialog || !current() || !parent.isConnected) return
    const focused = document.activeElement
    returnFocus = focused instanceof HTMLElement && form.contains(focused) ? focused : form.querySelector<HTMLElement>('input,select')
    dialog = document.createElement('dialog')
    dialog.className = parent.className
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-labelledby', `${subject}-discard-title`)
    dialog.setAttribute('aria-describedby', `${subject}-discard-detail`)
    dialog.innerHTML = `<h2 id="${subject}-discard-title">Discard ${subject} changes?</h2>
      <p id="${subject}-discard-detail">These ${subject} details haven’t been saved.</p>
      <div class="lineup-actions"><button type="button" data-organizer-stay autofocus>Keep editing</button>
        <button type="button" class="secondary" data-organizer-discard>Discard changes</button></div>`
    dialog.querySelector('[data-organizer-stay]')?.addEventListener('click', () => close(true))
    dialog.querySelector('[data-organizer-discard]')?.addEventListener('click', () => {
      const valid = current()
      close()
      if (valid) discard()
    })
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(true) })
    document.body.append(dialog)
    dialog.showModal()
  }

  return { open, isOpen: () => dialog !== null, back: () => close(true), dispose: () => close() }
}
