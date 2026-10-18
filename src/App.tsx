import { useEffect, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import { createInitialState, displayNumber, reducer } from './calculatorState.ts';
import type { Action, CalcState, Theme } from './calculatorState.ts';
import { KEYMAP, ins } from './keys.ts';
import type { FnTab } from './keys.ts';
import CalcScreen from './CalcScreen.tsx';
import FormulaView from './FormulaView.tsx';
import GraphPanel from './GraphPanel.tsx';
import HistoryView from './HistoryView.tsx';
import SettingsView from './SettingsView.tsx';
import { IconBack, IconCalc, IconFormula, IconGraph, IconHistory, IconSettings } from './Icons.tsx';
import { loadPersisted, savePersisted } from './storage.ts';
import type { KV } from './storage.ts';
import { copyText } from './util.ts';

type Tab = 'calc' | 'formulas' | 'graph' | 'history';
const TABS: { id: Tab; label: string; title: string; icon: ReactNode }[] = [
  { id: 'calc', label: 'Máy tính', title: 'Máy tính khoa học', icon: <IconCalc /> },
  { id: 'formulas', label: 'Công thức', title: 'Công thức', icon: <IconFormula /> },
  { id: 'graph', label: 'Đồ thị', title: 'Đồ thị hàm số', icon: <IconGraph /> },
  { id: 'history', label: 'Lịch sử', title: 'Lịch sử tính toán', icon: <IconHistory /> },
];
const INTRO_KEY = 'sci-calc:intro-v2';

function getStorage(): KV | null {
  try { return window.localStorage; } catch { return null; }
}
function initState(): CalcState {
  const p = loadPersisted(getStorage());
  if (p.settings.theme === null) { // đọc khóa 'theme' cũ của giai đoạn trước
    try {
      const old = localStorage.getItem('theme');
      if (old === 'light' || old === 'dark') p.settings.theme = old;
    } catch { /* bỏ qua */ }
  }
  return createInitialState(p);
}
function systemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
function introSeen(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [tab, setTab] = useState<Tab>('calc');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['calc']));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fnTab, setFnTab] = useState<FnTab>('basic');
  const [fnOpen, setFnOpen] = useState(true);
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  const [notice, setNotice] = useState('');
  const [saveOk, setSaveOk] = useState(true);
  const sep = state.settings.decimalSep;
  const theme: Theme = state.settings.theme ?? systemTheme();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { setSaveOk(savePersisted(getStorage(), state)); },
    [state.memory, state.history, state.settings, state.angle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const go = (t: Tab) => { setTab(t); setSettingsOpen(false); setVisited((v) => (v.has(t) ? v : new Set(v).add(t))); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (settingsOpen || tab !== 'calc') {
        // Esc quay về máy tính (trừ khi đang gõ, hoặc đang ở đồ thị)
        if (e.key === 'Escape' && tag !== 'CANVAS' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') go('calc');
        return;
      }
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const onButton = tag === 'BUTTON';
      let action: Action | undefined;
      if (/^[0-9]$/.test(e.key)) action = ins(e.key);
      else if (/^[a-zA-Z]$/.test(e.key)) action = ins(e.key);
      else if (e.key === 'Enter') { if (onButton) return; action = { type: 'equals' }; }
      else if (e.key === ',' && sep === ',') action = ins('.'); // dấu phẩy thập phân
      else action = KEYMAP[e.key];
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, settingsOpen, sep]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissIntro = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* bỏ qua */ } setShowIntro(false); };
  const reopenIntro = () => { try { localStorage.removeItem(INTRO_KEY); } catch { /* bỏ qua */ } setShowIntro(true); go('calc'); };
  const copyResult = async () => {
    if (state.result === null) return;
    setNotice((await copyText(displayNumber(state.showFraction && state.fraction ? state.fraction : state.result, sep))) ? 'Đã sao chép kết quả.' : 'Không sao chép được.');
  };
  const sendToCalc = (text: string) => { dispatch({ type: 'setExpression', text }); go('calc'); setNotice('Đã đưa vào máy tính. Bấm = để tính.'); };
  const useFromHistory = (a: Action) => { dispatch(a); go('calc'); };

  const title = settingsOpen ? 'Cài đặt' : TABS.find((t) => t.id === tab)!.title;
  const show = (t: Tab) => !settingsOpen && tab === t;

  return (
    <div className="shell">
      <header className="topbar">
        {settingsOpen && (
          <button type="button" className="icon-btn" aria-label="Quay lại" onClick={() => setSettingsOpen(false)}><IconBack /></button>
        )}
        <h1>{title}</h1>
        {!settingsOpen && (
          <button type="button" className="icon-btn" aria-label="Cài đặt" onClick={() => setSettingsOpen(true)}><IconSettings /></button>
        )}
      </header>

      <main className="screen" aria-label={title}>
        <div className="pane" hidden={!show('calc')}>
          <CalcScreen state={state} dispatch={dispatch} sep={sep} fnTab={fnTab} setFnTab={setFnTab} fnOpen={fnOpen} setFnOpen={setFnOpen}
            onCopy={() => void copyResult()} onGoFormulas={() => go('formulas')} showIntro={showIntro} onDismissIntro={dismissIntro} />
        </div>
        {visited.has('formulas') && (
          <div className="pane" hidden={!show('formulas')}>
            <FormulaView sep={sep} angle={state.angle} onSetAngle={(angle) => dispatch({ type: 'setAngle', angle })} onSend={sendToCalc} />
          </div>
        )}
        {visited.has('graph') && <div className="pane" hidden={!show('graph')}><GraphPanel theme={theme} sep={sep} /></div>}
        {visited.has('history') && (
          <div className="pane" hidden={!show('history')}>
            <HistoryView state={state} dispatch={dispatch} onUse={useFromHistory} onNotice={setNotice} />
          </div>
        )}
        {settingsOpen && <SettingsView state={state} dispatch={dispatch} saveOk={saveOk} onShowIntro={reopenIntro} />}
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}

      {!settingsOpen && (
        <nav className="nav" aria-label="Chuyển màn hình">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
