import Link from "next/link";
import {
  ArrowRight,
  BracketsCurly,
  CheckCircle,
  ChatCircleDots,
  CursorClick,
  GameController,
  LockKey,
  Play,
  Selection,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

export default function HomePage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="/">
          <span><Selection size={19} weight="bold" /></span>
          <strong>Vibe Web Game</strong>
        </Link>
        <div className="landing-nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#schema">Schema</a>
          <a href="https://github.com/Superkimi/Vibe-Web-Game" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link className="nav-cta" href="/studio">Open Studio <ArrowRight size={14} /></Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-content">
          <span className="hero-eyebrow"><Sparkle size={13} weight="fill" /> AI-native Phaser studio</span>
          <h1>Build the game.<br /><em>Shape every detail.</em></h1>
          <p>A browser game studio where AI proposals and precise manual editing share one validated Phaser scene.</p>
          <div className="hero-actions">
            <Link className="landing-primary" href="/studio"><Play size={16} weight="fill" /> Start building</Link>
            <a className="landing-secondary" href="#workflow">See the workflow</a>
          </div>
        </div>
        <div className="live-preview" aria-label="Live product preview">
          <div className="preview-bar">
            <span>Orbit Runner</span>
            <strong>LIVE STUDIO</strong>
          </div>
          <div className="preview-viewport">
            <iframe src="/studio" title="Interactive Vibe Web Game Studio preview" tabIndex={-1} />
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Product foundations">
        <div><GameController size={17} /><span>Phaser 4 runtime</span></div>
        <div><BracketsCurly size={17} /><span>Validated Schema</span></div>
        <div><CursorClick size={17} /><span>Direct manipulation</span></div>
        <div><LockKey size={17} /><span>Local-first projects</span></div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="section-copy">
          <h2>AI changes you can trust.</h2>
          <p>The model proposes a small operation set. You inspect it, apply it, run the scene, and keep a snapshot.</p>
        </div>
        <div className="workflow-grid">
          <article className="workflow-main">
            <ChatCircleDots size={27} />
            <h3>Ask in game language</h3>
            <p>Request a mechanic, balance change, layout adjustment, or visual direction without translating it into engine code.</p>
            <div className="prompt-sample">Add a moving platform above the player and keep the jump reachable.</div>
          </article>
          <article>
            <BracketsCurly size={22} />
            <h3>Review operations</h3>
            <p>Every proposal is constrained to named, typed actions.</p>
          </article>
          <article>
            <CheckCircle size={22} />
            <h3>Run and recover</h3>
            <p>Play instantly, inspect output, then undo any snapshot.</p>
          </article>
        </div>
      </section>

      <section className="schema-section" id="schema">
        <div className="schema-copy">
          <span>ONE PROJECT MODEL</span>
          <h2>Manual edits and AI edits never drift apart.</h2>
          <p>The canvas, inspector, runtime, export, and agent all read the same versioned document.</p>
          <ul>
            <li><CheckCircle size={16} weight="fill" /> Stable scene and entity IDs</li>
            <li><CheckCircle size={16} weight="fill" /> Typed physics and behavior components</li>
            <li><CheckCircle size={16} weight="fill" /> Atomic operations with validation</li>
            <li><CheckCircle size={16} weight="fill" /> Portable project JSON</li>
          </ul>
        </div>
        <pre className="schema-code" aria-label="Example game schema"><code>{`{
  "schemaVersion": "1.0.0",
  "activeSceneId": "scene-main",
  "scenes": [{
    "id": "scene-main",
    "entities": [{
      "id": "player",
      "type": "rectangle",
      "physics": { "enabled": true },
      "behaviors": [{
        "type": "playerController",
        "speed": 280
      }]
    }]
  }]
}`}</code></pre>
      </section>

      <section className="control-section">
        <div className="control-stage">
          <span className="control-ring ring-one" />
          <span className="control-ring ring-two" />
          <div className="control-center"><Selection size={31} /></div>
          <div className="control-node node-canvas">Canvas</div>
          <div className="control-node node-inspector">Inspector</div>
          <div className="control-node node-agent">Vibe agent</div>
          <div className="control-node node-runtime">Runtime</div>
        </div>
        <div className="control-copy">
          <h2>A real editor, not a prompt box with a preview.</h2>
          <p>Drag objects, tune transforms, add behaviors, inspect JSON, configure your model, and test the game without leaving the workspace.</p>
          <Link href="/studio">Explore the editor <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <h2>Your next game starts as a sentence.</h2>
        </div>
        <Link className="landing-primary" href="/studio">Open Studio <ArrowRight size={16} /></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/">
          <span><Selection size={17} weight="bold" /></span>
          <strong>Vibe Web Game</strong>
        </Link>
        <p>Open source browser game creation with Phaser 4.</p>
        <a href="https://github.com/Superkimi/Vibe-Web-Game" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </main>
  );
}
