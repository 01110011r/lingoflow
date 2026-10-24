'use client';

import { useCallback, useEffect, useState } from 'react';
import { Effect } from 'effect';
import { api, PracticeCard, run, SearchResponse, Stats, VocabularyItem } from '../lib/api';

const gradeLabels = ['Again', 'Hard', 'Almost', 'Good', 'Great', 'Mastered'];
type AgentMode = 'paragraph' | 'audio' | 'video';
type AgentMessage = { mode: AgentMode; words: string[]; content: string; createdAt: string };

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [practice, setPractice] = useState<PracticeCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeCard, setActiveCard] = useState<PracticeCard | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [agentWords, setAgentWords] = useState('');
  const [agentMode, setAgentMode] = useState<AgentMode>('paragraph');
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [searchResult, practiceResult] = await Promise.all([
        run(api.search('')),
        run(api.practice()),
      ]);
      setSearch(searchResult);
      setPractice(practiceResult);
      setActiveCard(practiceResult[0] ?? null);
      setStats(await run(api.stats()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The API is unavailable.');
    } finally {
      setLoading(false);
    }

  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function searchVocabulary(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      setSearch(await run(api.search(query)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
    }

  }

  async function reviewCard(grade: number) {
    if (!activeCard) return;
    try {
      await run(api.review(1, activeCard.senseId, grade));
      const remaining = practice.filter((card) => card.senseId !== activeCard.senseId);
      setPractice(remaining);
      setActiveCard(remaining[0] ?? null);
      setRevealed(false);
      setStats(await run(api.stats()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review could not be saved.');
    }

  }

  async function generateAgentContent() {
    const words = agentWords.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean).slice(0, 6);
    if (!words.length) {
      setMessage('Add at least one target word for the agent.');
      return;
    }
    setAgentBusy(true);
    setMessage('');
    try {
      const content = await run(Effect.tryPromise({
        try: async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (agentMode === 'paragraph') return `On a quiet morning, I decided to ${words[0]} with more intention. Each small choice helped me ${words[1] ?? 'notice'} the world around me, turning an ordinary moment into a deliberate step forward.`;
          if (agentMode === 'audio') return `Today we will practice: ${words.join(', ')}. Listen once for meaning, then repeat the sentence with your own voice.`;
          return `A short story about ${words.slice(0, 3).join(', ')}.`;
        },
        catch: () => new Error('The agent could not create this yet.'),
      }));
      setAgentMessages((messages) => [{ mode: agentMode, words, content, createdAt: new Date().toISOString() }, ...messages].slice(0, 4));
      if (agentMode === 'audio') speak(content, setSpeaking);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The agent could not create this yet.');
    } finally {
      setAgentBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">L</span>
          <span>LingoFlow</span>
        </a>
        <nav>
          <a className="nav-active" href="#today">Today</a>
          <a href="#agent">Agent</a>
          <a href="#vocabulary">Vocabulary</a>
          <a href="#progress">Progress</a>
        </nav>
        <div className="profile">
          <span className="avatar">A</span>
          <span>Alex</span>
        </div>
      </header>

      <section className="hero" id="today">
        <div>
          <p className="eyebrow">Thursday, October 23</p>
          <h1>Make a little progress<br /><em>every day.</em></h1>
          <p className="hero-copy">A focused session is waiting for you. Keep the streak alive.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit-core">✦</span>
        </div>
      </section>

      <section className="stats-grid" id="progress">
        <Stat label="Due today" value={stats?.dueCount ?? 0} detail="cards to review" accent="gold" />
        <Stat label="In practice" value={stats?.activePracticeWords ?? 0} detail="words in rotation" accent="blue" />
        <Stat label="Mastered" value={stats?.masteredWords ?? 0} detail="words you own" accent="green" />
        <Stat label="Total reviews" value={stats?.totalReviews ?? 0} detail="all time" accent="rose" />
      </section>

      {message && <div className="notice">{message} <button onClick={() => void loadDashboard()}>Retry</button></div>}

      <section className="workspace">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your session</p>
            <h2>Practice a word</h2>
          </div>
          <span className="session-count">{practice.length} cards left</span>
        </div>
        <div className="practice-layout">
          <div className="practice-card">
            {loading ? <div className="skeleton large" /> : activeCard ? (
              <>
                <div className="card-topline">
                  <span className="level-pill">{activeCard.level}</span>
                  <span>{activeCard.topic ?? 'Everyday English'}</span>
                </div>
                <p className="word">{activeCard.lemma}</p>
                {activeCard.guideword && <p className="guideword">{activeCard.guideword}</p>}
                <div className="definition">
                  <span className="definition-label">Meaning</span>
                  <p>{activeCard.definition}</p>
                </div>
                {revealed && activeCard.examples[0] && (
                  <div className="example"><span>Example</span>{activeCard.examples[0]}</div>
                )}
                <button className="reveal-button" onClick={() => setRevealed(!revealed)}>
                  {revealed ? 'Hide example' : 'Reveal example'} <span>↗</span>
                </button>
                <div className="grade-row">
                  {gradeLabels.map((label, index) => (
                    <button key={label} className={index > 3 ? 'grade positive' : 'grade'} onClick={() => void reviewCard(index)}>
                      <strong>{index}</strong><span>{label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : <EmptyState text="Your practice queue is clear." />}
          </div>
          <aside className="session-aside">
            <div className="aside-icon">◒</div>
            <h3>Small steps,<br />lasting fluency.</h3>
            <p>Reviewing in short, regular sessions helps vocabulary move from recognition to recall.</p>
            <div className="progress-line"><span style={{ width: `${Math.min(100, (stats?.totalReviews ?? 0) * 4)}%` }} /></div>
            <small>{stats?.totalReviews ?? 0} reviews completed</small>
          </aside>
        </div>
      </section>

      <section className="agent-section" id="agent">
        <div className="agent-heading">
          <div>
            <p className="eyebrow">Your language studio</p>
            <h2>Ask the agent to make it real.</h2>
            <p className="agent-subtitle">Turn a handful of target words into something you can read, hear, or watch.</p>
          </div>
          <span className="agent-badge"><span className="agent-pulse" /> AI study partner</span>
        </div>
        <div className="agent-layout">
          <div className="agent-chat">
            <div className="chat-topline"><span className="agent-avatar">✦</span><div><strong>Flow Agent</strong><small>Curriculum-aware creation</small></div><span className="online-dot" /></div>
            <div className="chat-history">
              <div className="chat-bubble agent-bubble">Give me a few words and I&apos;ll build a focused learning moment around them.</div>
              {agentMessages.map((item, index) => <div className="chat-turn" key={`${item.createdAt}-${index}`}>
                <div className="chat-bubble user-bubble">{item.words.join(' · ')} <span className="mode-mini">{item.mode}</span></div>
                <div className={`result-card result-${item.mode}`}>
                  <div className="result-label">{item.mode === 'paragraph' ? 'Generated paragraph' : item.mode === 'audio' ? 'Listening practice' : 'Video storyboard'}</div>
                  {item.mode === 'paragraph' && <p>{item.content}</p>}
                  {item.mode === 'audio' && <div className="audio-result"><button onClick={() => speak(item.content, setSpeaking)}>{speaking ? '❚❚' : '▶'}</button><div><strong>Target-word narration</strong><small>Browser voice preview · 0:32</small></div></div>}
                  {item.mode === 'video' && <div className="video-result"><span className="play-orb">▶</span><div><strong>{item.content}</strong><small>3 scenes · vocabulary captions included</small></div></div>}
                </div>
              </div>)}
            </div>
            <form className="agent-composer" onSubmit={(event) => { event.preventDefault(); void generateAgentContent(); }}>
              <div className="target-input"><span>⌘</span><input value={agentWords} onChange={(event) => setAgentWords(event.target.value)} placeholder="target, explore, deliberate..." aria-label="Target words" /><button type="button" className="add-current" onClick={() => activeCard && setAgentWords((words) => words ? `${words}, ${activeCard.lemma}` : activeCard.lemma)}>+ current word</button></div>
              <div className="composer-bottom"><div className="mode-picker">{(['paragraph', 'audio', 'video'] as AgentMode[]).map((mode) => <button type="button" key={mode} className={agentMode === mode ? 'mode-active' : ''} onClick={() => setAgentMode(mode)}>{mode === 'paragraph' ? '▤' : mode === 'audio' ? '◖' : '▣'} {mode}</button>)}</div><button className="generate-button" disabled={agentBusy}>{agentBusy ? 'Creating…' : 'Create'} <span>↗</span></button></div>
            </form>
          </div>
          <aside className="agent-aside">
            <p className="eyebrow">How it works</p>
            <div className="agent-step"><span>01</span><div><strong>Choose words</strong><p>Use the word you are practicing or add your own targets.</p></div></div>
            <div className="agent-step"><span>02</span><div><strong>Pick a format</strong><p>Read a paragraph, listen to it, or plan a short visual story.</p></div></div>
            <div className="agent-step"><span>03</span><div><strong>Keep learning</strong><p>Every output stays grounded in your selected vocabulary.</p></div></div>
          </aside>
        </div>
      </section>

      <section className="vocabulary-section" id="vocabulary">
        <div className="section-heading">
          <div><p className="eyebrow">Explore the curriculum</p><h2>Vocabulary library</h2></div>
          <form className="search" onSubmit={searchVocabulary}>
            <span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search words, meanings..." /><button type="submit">Search</button>
          </form>
        </div>
        <div className="word-grid">
          {search?.items.map((item) => <WordTile key={item.id} item={item} />)}
          {!loading && !search?.items.length && <EmptyState text="No vocabulary found." />}
        </div>
      </section>

      <footer><span>LINGOFLOW / BETA</span><span>Built for consistent progress.</span></footer>
    </main>
  );
}

function speak(text: string, setSpeaking: (value: boolean) => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setSpeaking(true);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .9;
  utterance.onend = () => setSpeaking(false);
  window.speechSynthesis.speak(utterance);
}

function Stat({ label, value, detail, accent }: { label: string; value: number; detail: string; accent: string }) {
  return <div className={`stat-card ${accent}`}><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function WordTile({ item }: { item: VocabularyItem }) {
  const sense = item.senses[0];
  return <article className="word-tile"><div className="tile-head"><span className="level-pill">{sense?.level ?? '—'}</span><span>{sense?.partOfSpeech ?? 'word'}</span></div><h3>{item.lemma}</h3><p>{sense?.definition ?? 'No definition available.'}</p>{sense?.topic && <span className="topic">{sense.topic}</span>}</article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span>✦</span><p>{text}</p></div>;
}
