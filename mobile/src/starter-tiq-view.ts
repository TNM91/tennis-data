import websiteUi from '../generated/website-ui.json'
import { html } from './match-details'
import { readStarterAnswers, starterQuestions, starterResult, starterStorage } from './starter-tiq'

export async function mountStarterTiq(
  host: HTMLElement, owner: string, current: () => boolean,
  openDrill: (id: string, trigger: HTMLButtonElement) => void,
) {
  const storage = starterStorage(owner)
  const active = () => current() && host.isConnected
  const saved = await storage.read().catch(() => null)
  if (!active()) return
  let answers = saved
  let busy = false

  function render(editing = false) {
    const result = answers && starterResult(answers)
    host.innerHTML = `
      <section class="lab-starter-tiq" aria-labelledby="starter-tiq-title">
        <div class="starter-tiq-heading">
          <span class="starter-tiq-icon" aria-hidden="true">${websiteUi.icons.progress}</span>
          <div><h2 id="starter-tiq-title" tabindex="-1">Starter TiQ</h2>
          ${result
            ? `<strong class="starter-tiq-level" tabindex="-1" aria-describedby="starter-tiq-context">${result.level}</strong>
              <p id="starter-tiq-context">Self-assessed · Private on this device</p>`
            : '<p>Answer three questions to find your starting level and a drill to try.</p>'}</div>
        </div>
        ${editing ? `
          <form class="starter-tiq-form">
            ${starterQuestions.map((question, index) => `<label>${question.prompt}
              <select name="skill-${index}" required>
                <option value="">Choose an answer</option>
                ${question.answers.map((label, value) => `<option value="${value}"${answers?.[index] === value ? ' selected' : ''}>${html(label)}</option>`).join('')}
              </select></label>`).join('')}
            ${result ? '' : '<p>Your answers are saved privately on this device.</p>'}
            <div class="starter-tiq-actions">
              <button type="submit">Save my level</button>
              <button type="button" class="secondary" data-starter-cancel>Cancel</button>
            </div>
            ${result ? '<button type="button" class="secondary" data-starter-clear>Clear saved assessment</button>' : ''}
            <p role="status"></p>
          </form>`
          : `<div class="starter-tiq-actions">
            ${result ? `<button type="button" data-starter-drill>Try ${result.drill.title}</button>` : ''}
            <button type="button" ${result ? 'class="secondary" ' : ''}data-starter-edit>${result ? 'Retake' : 'Find my level'}</button>
          </div>`}
      </section>`

    const focus = (selector: string) => host.querySelector<HTMLElement>(selector)?.focus()
    host.querySelector<HTMLButtonElement>('[data-starter-edit]')?.addEventListener('click', () => {
      if (!active()) return
      render(true)
      focus('select')
    })
    host.querySelector<HTMLButtonElement>('[data-starter-drill]')?.addEventListener('click', event => {
      if (result && active()) openDrill(result.drill.id, event.currentTarget as HTMLButtonElement)
    })

    const form = host.querySelector<HTMLFormElement>('form')
    if (!form) return
    const status = form.querySelector<HTMLElement>('[role="status"]')!
    const controls = form.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select')

    async function changeAssessment(next: typeof answers) {
      if (busy || !active()) return
      busy = true
      controls.forEach(control => { control.disabled = true })
      status.textContent = next ? 'Saving your level…' : 'Clearing your assessment…'
      try {
        if (next) await storage.save(next)
        else await storage.clear()
        if (!active()) return
        answers = next
        render()
        focus(next ? '.starter-tiq-level' : '[data-starter-edit]')
      } catch {
        if (active()) status.textContent = 'Couldn’t update this device. Try again.'
      } finally {
        busy = false
        controls.forEach(control => { control.disabled = false })
      }
    }

    form.onsubmit = event => {
      event.preventDefault()
      const fields = new FormData(form)
      const next = readStarterAnswers(starterQuestions.map((_, index) => {
        const value = fields.get('skill-' + index)
        return value === null || value === '' ? NaN : Number(value)
      }))
      if (next) void changeAssessment(next)
    }
    form.querySelector<HTMLButtonElement>('[data-starter-clear]')?.addEventListener('click', () => {
      void changeAssessment(null)
    })
    form.querySelector<HTMLButtonElement>('[data-starter-cancel]')!.onclick = () => {
      if (!active()) return
      render()
      focus('[data-starter-edit]')
    }
  }

  render()
}
