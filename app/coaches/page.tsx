import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import ProductEventTracker from '@/app/components/product-event-tracker'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  TwoColumnStory,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqActionCard, TiqCoachAssignmentCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import TrackedProductLink from '@/app/components/tracked-product-link'
import { PRODUCT_MOTTO } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Coaches',
  description:
    'Find tennis coaching support and see how Coach Hub helps players and coaches keep development moving between lessons.',
  path: '/coaches',
})

export default function CoachesPage() {
  return (
    <PublicPageShell active="coaches">
      <main style={pageWrapStyle}>
        <ProductEventTracker
          event={{
            eventName: 'coach_page_viewed',
            surface: 'coach',
            metadata: {
              page: '/coaches',
            },
          }}
        />
        <JsonLd id="coaches-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Coaches', '/coaches')} />
        <CommandHero
          eyebrow="Coaches"
          title="Help every player leave with a next step."
          body={`${PRODUCT_MOTTO} for coaching means goals, drills, lesson notes, progress, and follow-through stay connected so development does not disappear between sessions.`}
          primary={{ href: '/resources?q=find%20a%20coach', label: 'Find a Coach' }}
          secondary={{ href: '/coach', label: 'Open Coach Hub' }}
          searchPlaceholder="Search coaches, player goals, serve practice, lesson notes, or development paths"
        />
        <section style={coachQuickPathStyle} aria-labelledby="coach-quick-path-title">
          <div style={coachQuickPathHeaderStyle}>
            <p style={coachQuickPathEyebrowStyle}>Coach quick path</p>
            <h2 id="coach-quick-path-title" style={coachQuickPathTitleStyle}>
              What coaching need needs attention?
            </h2>
            <p style={coachQuickPathTextStyle}>
              Start with the player need, then open the smallest action that keeps development moving.
            </p>
          </div>
          <div style={coachQuickPathGridStyle}>
            {coachQuickPaths.map((path) => (
              <TrackedProductLink
                key={path.job}
                href={path.href}
                style={coachQuickPathCardStyle}
                ariaLabel={`${path.cta}: ${path.question}`}
                event={path.event}
              >
                <span style={coachQuickPathQuestionStyle}>{path.question}</span>
                <span style={coachQuickPathCtaStyle}>{path.cta}</span>
              </TrackedProductLink>
            ))}
          </div>
        </section>
        <TwoColumnStory
          leftTitle="For players"
          leftBody="Bring your goals, match questions, progress, and practice proof into every lesson."
          rightTitle="For coaches"
          rightBody="Assign drills, track player development, recommend resources, and support players between sessions."
        />
        <section style={developmentLoopSectionStyle} aria-labelledby="coach-development-loop-title">
          <SectionHeader
            eyebrow="Coach development loop"
            title="Assess, assign, track, and follow up without losing the thread."
            body="Coach Hub should make the next coaching move obvious before the player leaves the court, then keep that move visible between sessions."
            titleId="coach-development-loop-title"
          />
          <div style={developmentLoopGridStyle}>
            {coachDevelopmentLoop.map((step) => (
              <TiqActionCard
                key={step.title}
                eyebrow={step.eyebrow}
                title={step.title}
                body={step.body}
                metrics={[...step.metrics]}
                href={step.href}
                cta={step.cta}
                event={step.event}
                trust={[...step.trust]}
              >
                <p style={coachLoopQuestionStyle}>{step.question}</p>
              </TiqActionCard>
            ))}
          </div>
        </section>
        <section style={lessonLoopSectionStyle} aria-labelledby="coach-lesson-loop-title">
          <SectionHeader
            eyebrow="Lesson loop"
            title="Give every lesson a before, during, and after."
            body="Keep the loop simple: know what the player needs, coach the court work, assign the proof, and review what came back."
            titleId="coach-lesson-loop-title"
          />
          <div style={lessonLoopGridStyle}>
            {coachLessonLoop.map((step) => (
              <article key={step.title} style={lessonLoopCardStyle}>
                <div style={lessonLoopStepStyle}>{step.step}</div>
                <h2 style={lessonLoopTitleStyle}>{step.title}</h2>
                <p style={lessonLoopBodyStyle}>{step.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section style={nextActionSectionStyle} aria-labelledby="coach-next-actions-title">
          <SectionHeader
            eyebrow="Coach path"
            title="Assign, track, recommend, follow up."
            body="Coach Hub keeps the post-lesson handoff simple: give the player clear work, watch development, point them to the right resource, and keep support visible between sessions."
            titleId="coach-next-actions-title"
          />
          <div style={nextActionGridStyle}>
            {coachNextActions.map((action) => (
              <TiqActionCard
                key={action.title}
                eyebrow={action.eyebrow}
                title={action.title}
                body={action.body}
                metrics={[...action.metrics]}
                href={action.href}
                cta={action.cta}
                event={action.event}
                trust={[...action.trust]}
              />
            ))}
          </div>
        </section>
        <section style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Coach Hub preview"
            title="Goal to lesson to proof to next step."
            body="Coach Hub keeps assignments, player proof, reviews, and the next lesson close enough to act on."
          />
          <div style={previewGridStyle}>
            <TiqWorkspacePreview
              eyebrow="Coach Hub"
              title="Students"
              body="See linked players, lesson focus, due assignments, proof to review, and the next useful touch."
              metrics={[
                { label: 'Players', value: '12' },
                { label: 'Due', value: '4' },
                { label: 'Review', value: '2' },
              ]}
              href="/coach"
              cta="Open Coach Hub"
              event={{
                eventName: 'coach_hub_clicked',
                surface: 'coach',
                metadata: {
                  location: 'coaches_preview',
                  job: 'review_students',
                },
              }}
            />
            <TiqCoachAssignmentCard
              title="Serve target routine"
              body="Assign a drill, name the proof, and give the player something useful to bring back."
              metrics={[
                { label: 'Due', value: 'Friday' },
                { label: 'Evidence', value: '3 points' },
                { label: 'Status', value: 'Active' },
              ]}
              href="/player-development"
              cta="Open Paths"
              event={{
                eventName: 'coach_assignment_preview_clicked',
                surface: 'coach',
                metadata: {
                  location: 'coaches_preview',
                  job: 'assign_drills',
                },
              }}
            />
          </div>
        </section>
        <section style={{ display: 'grid', gap: 10 }}>
          <SectionHeader
            eyebrow="Trust and safety"
            title="Coach profiles should be clear about verification."
            body="Future coach profiles can show coaching location, player fit, availability, provided credentials, and clear verification labels."
          />
          <TrustStrip
            context="Coaches trust strip"
            signals={[
              { label: 'Source', value: 'Coach profile', tone: 'info' },
              { label: 'Freshness', value: 'Owner updated', tone: 'info' },
              { label: 'Confidence', value: 'Provided fields', tone: 'warn' },
              { label: 'Status', value: 'Not verified by TenAceIQ', tone: 'warn' },
            ]}
          />
        </section>
      </main>
    </PublicPageShell>
  )
}

const coachQuickPaths = [
  {
    question: 'How can I assign drills?',
    cta: 'Assign Drills',
    href: '/coach',
    job: 'assign_drills',
    event: {
      eventName: 'coach_assignment_preview_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_quick_path',
        job: 'assign_drills',
      },
    },
  },
  {
    question: 'How can I track player development?',
    cta: 'Track Development',
    href: '/coach',
    job: 'track_development',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_quick_path',
        job: 'track_development',
      },
    },
  },
  {
    question: 'How can I recommend resources?',
    cta: 'Recommend Resources',
    href: '/resources?q=coach%20tools',
    job: 'recommend_resources',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'coaches_quick_path',
        job: 'recommend_resources',
      },
    },
  },
  {
    question: 'How can I support players between sessions?',
    cta: 'Support Between Sessions',
    href: '/coach',
    job: 'support_between_sessions',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_quick_path',
        job: 'support_between_sessions',
      },
    },
  },
  {
    question: 'How can I find coaching support?',
    cta: 'Find a Coach',
    href: '/resources?q=find%20a%20coach',
    job: 'find_coaching_support',
    event: {
      eventName: 'find_coach_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_quick_path',
        job: 'find_coaching_support',
      },
    },
  },
] as const

const coachNextActions = [
  {
    eyebrow: 'Assign',
    title: 'How can I assign drills?',
    body: 'Turn the lesson focus into a small court task with a due date and proof the player can bring back.',
    metrics: [
      { label: 'Assign', value: 'Drills' },
      { label: 'Due', value: 'Set' },
      { label: 'Proof', value: 'Named' },
    ],
    href: '/coach',
    cta: 'Assign Drills',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_next_actions',
        job: 'assign_drills',
      },
    },
    trust: [
      { label: 'Status', value: 'Coach action', tone: 'good' },
      { label: 'Freshness', value: 'Coach updated', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Progress',
    title: 'How can I track player development?',
    body: 'Review active assignments, returned proof, due work, and the next focus before the next session.',
    metrics: [
      { label: 'Track', value: 'Progress' },
      { label: 'Review', value: 'Proof' },
      { label: 'Next', value: 'Focus' },
    ],
    href: '/coach',
    cta: 'Track Development',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_next_actions',
        job: 'track_development',
      },
    },
    trust: [
      { label: 'Status', value: 'Coach Hub', tone: 'good' },
      { label: 'Signal', value: 'Assignment proof', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Resources',
    title: 'How can I recommend resources?',
    body: 'Point the player to drills, development paths, match prep, or workbook resources that match the lesson focus.',
    metrics: [
      { label: 'Find', value: 'Resources' },
      { label: 'Match', value: 'Lesson' },
      { label: 'Use', value: 'Between sessions' },
    ],
    href: '/resources?q=coach%20tools',
    cta: 'Recommend Resources',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'coaches_next_actions',
        job: 'recommend_resources',
      },
    },
    trust: [
      { label: 'Source', value: 'Resource hub', tone: 'info' },
      { label: 'Status', value: 'Browse ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Follow up',
    title: 'How can I support players between sessions?',
    body: 'Keep the assignment, next focus, proof review, and player touchpoint connected after the lesson ends.',
    metrics: [
      { label: 'Support', value: 'Between' },
      { label: 'Touch', value: 'Player' },
      { label: 'Next', value: 'Lesson' },
    ],
    href: '/coach',
    cta: 'Support Between Sessions',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coaches_next_actions',
        job: 'support_between_sessions',
      },
    },
    trust: [
      { label: 'Status', value: 'Coach Hub', tone: 'good' },
      { label: 'Freshness', value: 'Coach updated', tone: 'info' },
    ],
  },
] as const

const coachDevelopmentLoop = [
  {
    eyebrow: 'Assess',
    title: 'Know what the player needs',
    question: 'What should this player work on next?',
    body: 'Start with goals, recent match notes, player proof, and the one skill that should improve next.',
    metrics: [
      { label: 'Input', value: 'Goals' },
      { label: 'Signal', value: 'Proof' },
      { label: 'Next', value: 'Focus' },
    ],
    href: '/player-development/coach-planner',
    cta: 'Open Coach Planner',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coach_development_loop',
        job: 'assess_player_need',
      },
    },
    trust: [
      { label: 'Source', value: 'Player path', tone: 'info' },
      { label: 'Status', value: 'Planner ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Assign',
    title: 'Assign the next drill',
    question: 'What drill should leave the lesson?',
    body: 'Turn the lesson into a small court task with a due date and proof the player can bring back.',
    metrics: [
      { label: 'Assign', value: 'Drill' },
      { label: 'Due', value: 'Date' },
      { label: 'Proof', value: 'Named' },
    ],
    href: '/coach',
    cta: 'Assign Drills',
    event: {
      eventName: 'coach_assignment_preview_clicked',
      surface: 'coach',
      metadata: {
        location: 'coach_development_loop',
        job: 'assign_drills',
      },
    },
    trust: [
      { label: 'Status', value: 'Coach action', tone: 'good' },
      { label: 'Use', value: 'Between sessions', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Track',
    title: 'Track player development',
    question: 'Is the player improving between sessions?',
    body: 'Watch assignment status, proof quality, and next focus so progress is easier to discuss.',
    metrics: [
      { label: 'Track', value: 'Status' },
      { label: 'Review', value: 'Proof' },
      { label: 'Plan', value: 'Next' },
    ],
    href: '/coach',
    cta: 'Track Development',
    event: {
      eventName: 'coach_hub_clicked',
      surface: 'coach',
      metadata: {
        location: 'coach_development_loop',
        job: 'track_development',
      },
    },
    trust: [
      { label: 'Signal', value: 'Assignment proof', tone: 'info' },
      { label: 'Status', value: 'Coach reviewed', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Follow up',
    title: 'Support between sessions',
    question: 'What resource or note keeps support moving?',
    body: 'Recommend the right resource, send the next note, and keep the player connected to the plan.',
    metrics: [
      { label: 'Recommend', value: 'Resources' },
      { label: 'Touch', value: 'Player' },
      { label: 'Loop', value: 'Closed' },
    ],
    href: '/resources?q=coach%20tools',
    cta: 'Recommend Resources',
    event: {
      eventName: 'search_result_clicked',
      surface: 'public_site',
      metadata: {
        location: 'coach_development_loop',
        job: 'recommend_resources',
      },
    },
    trust: [
      { label: 'Source', value: 'Resource hub', tone: 'info' },
      { label: 'Status', value: 'Player-ready', tone: 'good' },
    ],
  },
] as const

const coachLessonLoop = [
  {
    step: 'Before',
    title: 'Bring the right context',
    body: 'Player goals, match notes, matchup questions, and recent proof give the coach a sharper starting point.',
  },
  {
    step: 'During',
    title: 'Plan the court work',
    body: 'Lesson focus turns into drills, tactical notes, and simple cues the player can use under pressure.',
  },
  {
    step: 'After',
    title: 'Assign the next proof',
    body: 'Coach Hub keeps follow-through visible with due work, proof requests, resources, and the next review.',
  },
] as const

const lessonLoopSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const coachQuickPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
  gap: 14,
  alignItems: 'stretch',
  minWidth: 0,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  borderRadius: 8,
  padding: 'clamp(14px, 3vw, 20px)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg) 90%), color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-panel-bg) 92%))',
}

const coachQuickPathHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'center',
  minWidth: 0,
}

const coachQuickPathEyebrowStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const coachQuickPathTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(21px, 3vw, 30px)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const coachQuickPathTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const coachQuickPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const coachQuickPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 104,
  minWidth: 0,
  alignContent: 'space-between',
  padding: 13,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 78%, var(--brand-blue-2) 22%)',
  color: 'inherit',
  textDecoration: 'none',
}

const coachQuickPathQuestionStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const coachQuickPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const developmentLoopSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const developmentLoopGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const lessonLoopGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const lessonLoopCardStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 16,
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const lessonLoopStepStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1,
  textTransform: 'uppercase',
}

const lessonLoopTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 950,
}

const lessonLoopBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 720,
}

const nextActionSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const nextActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const coachLoopQuestionStyle: CSSProperties = {
  margin: 0,
  borderTop: '1px solid var(--shell-panel-border)',
  paddingTop: 10,
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}
