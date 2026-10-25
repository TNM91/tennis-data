'use client'
import type {CSSProperties} from 'react'
import type {LabGoal} from '../../lib/my-lab-goal-sync'
export const inputWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

export const labelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: 14,
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
}

export const textAreaStyle: CSSProperties = {
  ...inputStyle,
  height: 112,
  padding: '12px 14px',
  resize: 'vertical',
  lineHeight: 1.45,
}

export const shortTextAreaStyle: CSSProperties = {
  ...textAreaStyle,
  height: 84,
}

export const goalFieldGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
})

export default function MyLabGoalFields({goal,compact,onChange,maxLength}:{goal:LabGoal;compact:boolean;onChange:(patch:Partial<LabGoal>)=>void;maxLength?:number}){return <>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-goal-${goal.id}`}>Goal</label>
                      <input
                        name="goal" maxLength={maxLength} id={`my-lab-goal-${goal.id}`}
                        value={goal.goal}
                        onChange={(event) => onChange( { goal: event.target.value })}
                        placeholder="Example: attack second serves this month"
                        style={inputStyle}
                      />
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-progress-${goal.id}`}>Status</label>
                      <select
                        name="progressStatus" id={`my-lab-progress-${goal.id}`}
                        value={goal.progressStatus}
                        onChange={(event) => {
                          const nextStatus = event.target.value
                          if (!['not-started','in-progress','improving','completed'].includes(nextStatus)) return
                          onChange( { progressStatus: nextStatus as LabGoal['progressStatus'] })
                        }}
                        style={inputStyle}
                      >
                        <option value="not-started">Not started</option>
                        <option value="in-progress">In progress</option>
                        <option value="improving">Improving</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-progress-update-${goal.id}`}>Progress update</label>
                      <textarea
                        name="progressUpdate" maxLength={maxLength} id={`my-lab-progress-update-${goal.id}`}
                        value={goal.progressUpdate}
                        onChange={(event) => onChange( { progressUpdate: event.target.value })}
                        placeholder="What changed since the last match or practice?"
                        style={shortTextAreaStyle}
                      />
                    </div>
                    <div style={goalFieldGridStyle(compact)}>
                      <div style={inputWrapStyle}>
                        <label style={labelStyle} htmlFor={`my-lab-doing-well-${goal.id}`}>What am I doing well?</label>
                        <textarea
                          name="doingWell" maxLength={maxLength} id={`my-lab-doing-well-${goal.id}`}
                          value={goal.doingWell}
                          onChange={(event) => onChange( { doingWell: event.target.value })}
                          placeholder="Example: holding serve under pressure"
                          style={shortTextAreaStyle}
                        />
                      </div>
                      <div style={inputWrapStyle}>
                        <label style={labelStyle} htmlFor={`my-lab-improve-next-${goal.id}`}>Where can I improve?</label>
                        <textarea
                          name="improveNext" maxLength={maxLength} id={`my-lab-improve-next-${goal.id}`}
                          value={goal.improveNext}
                          onChange={(event) => onChange( { improveNext: event.target.value })}
                          placeholder="Example: return depth on second serves"
                          style={shortTextAreaStyle}
                        />
                      </div>
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-notebook-${goal.id}`}>Notes</label>
                      <textarea
                        name="notes" maxLength={maxLength} id={`my-lab-notebook-${goal.id}`}
                        value={goal.notes}
                        onChange={(event) => onChange( { notes: event.target.value })}
                        placeholder="What felt good? What broke down? What should I test next?"
                        style={textAreaStyle}
                      />
                    </div>

</>}
