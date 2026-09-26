'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BrandLogo } from '@/app/components/Brand';
import { ArrowRight, Sparkles, BrainCircuit, Loader2, History, X, Trash2, Calendar, LogOut, Check, Compass, ListChecks } from 'lucide-react';
import { generateQuestions } from '@/actions/ai';
import { MandalartData, Question, AppStep, GoalSafetyCategory, InterviewAnswer, HistoryItem, User } from '@/types';
import { MandalartView } from '@/app/components/MandalartView';
import { Auth } from '@/app/components/Auth';
import { SafetyNotice } from '@/app/components/SafetyNotice';
import { getCurrentUser, logout } from '@/actions/auth';
import { authClient } from '@/lib/auth/client';
import { getHistory, updateMandalart, deleteMandalart } from '@/actions/mandalarts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { generateDream, getDreamGeneration, getDreamWallet } from '@/actions/dreams';
import { DRAFT_STORAGE_KEY, restoreDraft, answersSchema, getAnswerContext } from '@/lib/onboarding';
import { getJourneyProgress } from '@/lib/journey';
import './home.css';

const GENERATION_MESSAGES = [
  {
    title: 'Entendendo seu objetivo',
    description: 'Conectando suas respostas ao resultado que você quer alcançar.'
  },
  {
    title: 'Organizando suas prioridades',
    description: 'Separando o que mais importa para manter o plano focado.'
  },
  {
    title: 'Definindo os 8 pilares',
    description: 'Criando as áreas que vão sustentar seu objetivo principal.'
  },
  {
    title: 'Criando ações práticas',
    description: 'Transformando cada pilar em tarefas claras e possíveis.'
  },
  {
    title: 'Revisando seu plano',
    description: 'Conferindo se as ações fazem sentido juntas.'
  },
  {
    title: 'Preparando seu Mandalart',
    description: 'Organizando tudo na matriz para você começar.'
  }
] as const;

const GUEST_GOAL_KEY = 'mandalart.guest.goal';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [step, setStep] = useState<AppStep>('input');
  const [mainGoal, setMainGoal] = useState('');
  const [previewId, setPreviewId] = useState<string | undefined>(undefined);
  const [safetyCategory, setSafetyCategory] = useState<GoalSafetyCategory | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [mandalartData, setMandalartData] = useState<MandalartData | null>(null);
  const [currentMandalartId, setCurrentMandalartId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressSaveError, setProgressSaveError] = useState<string | null>(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);

  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof getDreamWallet>> | null>(null);
  const needsDreams = wallet !== null && wallet.balance < 1;
  const [recoverGeneration, setRecoverGeneration] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const generationRecoveryRef = useRef<{ id: string; goal: string; answers: InterviewAnswer[]; previewId?: string } | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyDrawerRef = useRef<HTMLDivElement>(null);
  const historyCloseButtonRef = useRef<HTMLButtonElement>(null);
  const goalInputRef = useRef<HTMLInputElement>(null);
  const pendingMandalartUpdateRef = useRef<{
    id: string;
    data: MandalartData;
  } | null>(null);
  const mandalartUpdateInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (new URLSearchParams(window.location.search).has('neon_auth_session_verifier')) {
          await authClient.getSession();
        }
        const currentUser = await getCurrentUser();
        try {
          const guestGoal = sessionStorage.getItem(GUEST_GOAL_KEY);
          if (active && guestGoal) setMainGoal(guestGoal.slice(0, 300));
        } catch { /* O formulário continua funcionando sem armazenamento no navegador. */ }
        if (!active || !currentUser) return;
        activeUserIdRef.current = currentUser.id;
        setUser(currentUser);
        const userHistory = await getHistory();
        if (active) setHistory(userHistory);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const key = `mandalart.generation.${user.id}`;
    const refreshWallet = () => { void getDreamWallet().then(value => { if (active) setWallet(value); }).catch(() => {}); };
    refreshWallet();
    window.addEventListener('focus', refreshWallet);
    async function recover(id: string) {
      try {
        const result = await getDreamGeneration(id);
        if (!active) return;
        if (result.status === 'generating') {
          setStep('generating');
          timer = setTimeout(() => void recover(id), 3000);
        } else {
          generationRecoveryRef.current = null;
          try { sessionStorage.removeItem(key); } catch {}
          if (result.status === 'completed') {
            setMandalartData(result.item.data); setCurrentMandalartId(result.item.id); setStep('result'); setError(null);
            try { sessionStorage.removeItem(`mandalart.interview.${result.item.userId}`); } catch {}
          } else {
            setStep('interview'); setError(result.message);
          }
          setProcessing(false);
          void getDreamWallet().then(value => { if (active) setWallet(value); }).catch(() => {});
          void getHistory().then(value => { if (active) setHistory(value); }).catch(() => {});
        }
      } catch {
        if (active) { setError('A conexão caiu. Estamos conferindo sua geração para evitar usar outro sonho.'); timer = setTimeout(() => void recover(id), 5000); }
      }
    }
    async function restore() {
      await Promise.resolve();
      if (!active) return;
      try {
        let pending: string | null = null;
        try { pending = sessionStorage.getItem(key); } catch {}
        const guestGoal = sessionStorage.getItem(GUEST_GOAL_KEY);
        if (guestGoal) sessionStorage.removeItem(GUEST_GOAL_KEY);
        pending ||= generationRecoveryRef.current ? JSON.stringify(generationRecoveryRef.current) : null;
        if (pending) {
          const saved = JSON.parse(pending);
          if (typeof saved.id === 'string' && typeof saved.goal === 'string' && Array.isArray(saved.answers)) {
            setMainGoal(saved.goal); setAnswers(saved.answers); setPreviewId(saved.previewId);
            setQuestions(saved.answers.map((a: InterviewAnswer) => ({ id: a.questionId, text: a.questionText })));
            setStep('generating'); setProcessing(true); void recover(saved.id);
          }
        } else if (new URLSearchParams(window.location.search).get('continuar') === 'sonho') {
          const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
          const draft = raw ? restoreDraft(JSON.parse(raw)) : null;
          const parsed = answersSchema.safeParse(draft?.answers);
          if (parsed.success) {
            const context = getAnswerContext(parsed.data);
            const restoredAnswers = [
              { questionId: 'context', questionText: 'Onde você está hoje?', answer: `${context.category}. ${context.stage}` },
              { questionId: 'obstacle', questionText: 'O que mais precisa de atenção?', answer: context.obstacle },
              { questionId: 'rhythm', questionText: 'Qual ritmo faz sentido para você?', answer: `${context.time}. ${context.horizon}` }
            ];
            setMainGoal(context.dream); setAnswers(restoredAnswers); setPreviewId(draft?.result?.id);
            setQuestions(restoredAnswers.map(a => ({ id: a.questionId, text: a.questionText })));
            setStep('interview');
          }
        } else if (guestGoal) {
          setMainGoal(guestGoal.slice(0, 300));
        } else {
          const saved = sessionStorage.getItem(`mandalart.interview.${user.id}`);
          if (saved) {
            const interview = JSON.parse(saved);
            if (typeof interview.goal === 'string' && Array.isArray(interview.answers)) {
              setMainGoal(interview.goal); setAnswers(interview.answers); setPreviewId(interview.previewId);
              setQuestions(interview.answers.map((a: InterviewAnswer) => ({ id: a.questionId, text: a.questionText })));
              setStep(interview.answers.length === 3 ? 'interview' : 'input');
            }
          }
        }
      } catch { /* O planner pode continuar sem armazenamento no navegador. */ }
    }
    void restore();
    return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', refreshWallet); };
  }, [user, recoverGeneration]);

  useEffect(() => {
    if (!user || !mainGoal.trim() || !['input', 'interview'].includes(step)) return;
    try { sessionStorage.setItem(`mandalart.interview.${user.id}`, JSON.stringify({ goal: mainGoal, answers, previewId })); } catch {}
  }, [user, mainGoal, answers, step, previewId]);

  useEffect(() => {
    if (step !== 'generating') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const interval = window.setInterval(() => {
      setGenerationMessageIndex(current =>
        (current + 1) % GENERATION_MESSAGES.length
      );
    }, 2200);

    return () => window.clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeUserMenu = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const closeUserMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeUserMenu);
    document.addEventListener('keydown', closeUserMenuOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeUserMenu);
      document.removeEventListener('keydown', closeUserMenuOnEscape);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isHistoryOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const fallbackTrigger = historyButtonRef.current;
    const focusFrame = window.requestAnimationFrame(() => historyCloseButtonRef.current?.focus());
    const handleHistoryKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHistoryOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !historyDrawerRef.current) return;

      const focusable = Array.from(
        historyDrawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleHistoryKeys);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleHistoryKeys);
      (previouslyFocused ?? fallbackTrigger)?.focus();
    };
  }, [isHistoryOpen]);

  const refreshHistory = async () => {
    const userHistory = await getHistory();
    setHistory(userHistory);
  };

  const handleLogin = async (newUser: User) => {
    activeUserIdRef.current = newUser.id;
    setWallet(null);
    setUser(newUser);
    setShowAuth(false);
    await refreshHistory();
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    activeUserIdRef.current = null;
    generationRecoveryRef.current = null;
    setWallet(null);
    setUser(null);
    setMainGoal('');
    setAnswers([]);
    setQuestions([]);
    setPreviewId(undefined);
    setHistory([]);
    setStep('input');
    setShowAuth(false);
    try { sessionStorage.removeItem(GUEST_GOAL_KEY); } catch {}
  };

  const openAuth = () => {
    try {
      if (mainGoal.trim()) sessionStorage.setItem(GUEST_GOAL_KEY, mainGoal.trim());
      else sessionStorage.removeItem(GUEST_GOAL_KEY);
    } catch {}
    setShowAuth(true);
  };

  const flushMandalartUpdates = async () => {
    if (mandalartUpdateInFlightRef.current || !pendingMandalartUpdateRef.current) return;

    mandalartUpdateInFlightRef.current = true;
    setIsSavingProgress(true);
    setProgressSaveError(null);
    let failed = false;

    try {
      while (pendingMandalartUpdateRef.current) {
        const update = pendingMandalartUpdateRef.current;
        pendingMandalartUpdateRef.current = null;

        try {
          await updateMandalart(update.id, update.data);
        } catch {
          pendingMandalartUpdateRef.current ??= update;
          throw new Error('save-failed');
        }
      }
    } catch {
      failed = true;
      setProgressSaveError('Seu progresso ainda não foi salvo. Verifique a conexão e tente novamente.');
    } finally {
      mandalartUpdateInFlightRef.current = false;
      setIsSavingProgress(false);
    }

    if (!failed) {
      try {
        await refreshHistory();
      } catch {
        // O progresso já foi salvo; o histórico será sincronizado na próxima atualização.
      }

      if (pendingMandalartUpdateRef.current) void flushMandalartUpdates();
    }
  };

  const handleDataUpdate = (newData: MandalartData) => {
    setMandalartData(newData);
    if (currentMandalartId) {
      pendingMandalartUpdateRef.current = { id: currentMandalartId, data: newData };
      setProgressSaveError(null);
      void flushMandalartUpdates();
    }
  };

  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMandalart(id);
      await refreshHistory();
    } catch {
      setError('Não foi possível excluir esse plano.');
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    pendingMandalartUpdateRef.current = null;
    setProgressSaveError(null);
    setMandalartData(item.data);
    setCurrentMandalartId(item.id);
    setMainGoal(item.data.mainGoal);
    setStep('result');
    setIsHistoryOpen(false);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainGoal.trim() || processing) return;
    if (!user) {
      openAuth();
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const currentWallet = wallet ?? await getDreamWallet();
      setWallet(currentWallet);
      if (currentWallet.balance < 1) {
        try {
          sessionStorage.setItem(`mandalart.interview.${user.id}`, JSON.stringify({ goal: mainGoal, answers: [] }));
        } catch {
          setError('Não conseguimos guardar seu objetivo neste navegador. Permita o armazenamento para continuar de onde parou após a compra.');
          return;
        }
        router.push('/sonhos?origem=account');
        return;
      }
      setPreviewId(undefined);
      const result = await generateQuestions(mainGoal);
      if (result.status === 'blocked') {
        setSafetyCategory(result.category);
        setStep('safety');
        return;
      }

      const q = result.questions;
      setQuestions(q);
      setAnswers(q.map(item => ({ questionId: item.id, questionText: item.text, answer: '' })));
      setStep('interview');
    } catch {
      setError('Não foi possível gerar as perguntas. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    setAnswers(current => current.map((answer, answerIndex) =>
      answerIndex === index ? { ...answer, answer: value } : answer
    ));
  };

  const handleGenerate = async () => {
    if (processing || !user) return;
    if (answers.some(a => !a.answer.trim())) { setError('Responda todas as perguntas.'); return; }
    try { sessionStorage.setItem(`mandalart.interview.${user.id}`, JSON.stringify({ goal: mainGoal, answers, previewId })); } catch {}
    if (!wallet || wallet.balance < 1) { router.push('/sonhos'); return; }
    const id = crypto.randomUUID();
    const key = `mandalart.generation.${user.id}`;
    generationRecoveryRef.current = { id, goal: mainGoal, answers, previewId };
    try { sessionStorage.setItem(key, JSON.stringify({ id, goal: mainGoal, answers, previewId })); } catch {}
    setGenerationMessageIndex(0); setStep('generating'); setProcessing(true); setError(null);
    try {
      const result = await generateDream(id, mainGoal, answers, previewId);
      if (activeUserIdRef.current !== user.id) return;
      if (result.status === 'completed') {
        setMandalartData(result.item.data); setCurrentMandalartId(result.item.id); setStep('result');
        try { sessionStorage.removeItem(key); sessionStorage.removeItem(`mandalart.interview.${user.id}`); } catch {}
        void refreshHistory().catch(() => {});
      } else if (result.status === 'generating') {
        setRecoverGeneration(value => value + 1); return;
      } else {
        try { sessionStorage.removeItem(key); } catch {}
        setError(result.message); setStep('interview');
      }
      generationRecoveryRef.current = null;
      setProcessing(false);
      void getDreamWallet().then(setWallet).catch(() => {});
    } catch {
      if (activeUserIdRef.current !== user.id) return;
      setError('Estamos conferindo se seu planner ficou pronto. Você não precisa gerar novamente.');
      setRecoverGeneration(value => value + 1);
    }
  };

  const handleReset = () => {
    if (user) { try { sessionStorage.removeItem(`mandalart.interview.${user.id}`); } catch {} }
    window.history.replaceState({}, '', '/');
    pendingMandalartUpdateRef.current = null;
    setMainGoal('');
    setPreviewId(undefined);
    setSafetyCategory(null);
    setQuestions([]);
    setAnswers([]);
    setMandalartData(null);
    setCurrentMandalartId(null);
    setError(null);
    setProgressSaveError(null);
    setStep('input');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!user && showAuth) {
    return <Auth onLogin={handleLogin} onBack={() => setShowAuth(false)} goal={mainGoal.trim()} />;
  }

  return (
    <div className={`min-h-screen relative flex flex-col text-gray-900 overflow-x-hidden ${step === 'input' ? 'home-screen' : ''}`}>
      <header className="home-header">
        <div className="home-header-inner">
          {step === 'input' ? (
            <div className="home-header-brand" aria-label="Mandalart.AI"><BrandLogo iconSize={28} /></div>
          ) : (
            <button onClick={handleReset} aria-label="Voltar ao início" className="home-header-brand home-header-brand-button">
              <BrandLogo iconSize={28} />
            </button>
          )}

          <nav className="home-header-actions" aria-label={user ? 'Sua conta' : 'Acesso'}>
            {user ? <>
            <Link href="/sonhos" className={`home-wallet-link ${needsDreams ? 'home-wallet-empty' : ''}`} aria-label={needsDreams ? 'Comprar sonhos' : 'Ver saldo e comprar sonhos'}>
              <Sparkles size={16} aria-hidden="true" />
              <span>{needsDreams ? 'Comprar sonhos' : wallet ? `${wallet.balance} ${wallet.balance === 1 ? 'sonho disponível' : 'sonhos disponíveis'}` : 'Meus sonhos'}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          <button
            ref={historyButtonRef}
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsHistoryOpen(true);
            }}
            className="home-icon-button relative"
            aria-label="Abrir histórico"
          >
            <History size={20} />
            {history.length > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white transform translate-x-1 -translate-y-1"></span>
            )}
          </button>

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(current => !current)}
              aria-label="Abrir menu da conta"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              className="home-icon-button home-avatar"
            >
              {user.name.trim().charAt(0) || user.email.charAt(0)}
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {user.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 break-all">
                    {user.email}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="mt-1 w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </div>
          </> : (
            <button type="button" className="home-login-button" onClick={openAuth}>Entrar <ArrowRight size={16} aria-hidden="true" /></button>
          )}
          </nav>
        </div>
      </header>

      {user && isHistoryOpen && (
        <div className="history-backdrop" onClick={() => setIsHistoryOpen(false)} />
      )}
      {user && <div
        ref={historyDrawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Histórico de planos"
        aria-hidden={!isHistoryOpen}
        inert={!isHistoryOpen}
        className={`history-drawer ${isHistoryOpen ? 'history-drawer-open' : ''}`}
      >
        <div className="history-drawer-layout">
          <div className="history-drawer-header">
            <div className="history-drawer-heading">
              <span className="history-drawer-icon"><History size={23} aria-hidden="true" /></span>
              <div>
                <span className="history-drawer-eyebrow">SEU ESPAÇO DE CONQUISTAS</span>
                <h2>Seus planos<span className="brand-text">.</span></h2>
              </div>
            </div>
            <button ref={historyCloseButtonRef} type="button" aria-label="Fechar histórico" onClick={() => setIsHistoryOpen(false)} className="history-drawer-close"><X size={20}/></button>
            <p className="history-drawer-subtitle">{user.name}, cada passo seu merece um lugar para continuar.</p>
          </div>
          <div className="history-drawer-scroll">
            <div className="history-drawer-summary">
              <div><span className="history-drawer-summary-icon"><Sparkles size={18} aria-hidden="true" /></span><span>Um sonho de cada vez</span></div>
              <strong>{history.length} {history.length === 1 ? 'plano' : 'planos'}</strong>
            </div>
            {history.length === 0 ? (
              <div className="history-empty">
                <span><Compass size={25} aria-hidden="true" /></span>
                <h3>Seu primeiro plano começa aqui.</h3>
                <p>Quando você criar um Mandalart, ele aparecerá neste espaço para continuar no seu ritmo.</p>
              </div>
            ) : (
              <div className="history-list">{history.map((item, index) => {
                const progress = getJourneyProgress(item.data)
                return (
                  <article key={item.id} className="history-card">
                    <button
                      type="button"
                      onClick={() => loadHistoryItem(item)}
                      className="history-card-open"
                    >
                      <span className="history-card-kicker">SONHO {String(index + 1).padStart(2, '0')}</span>
                      <h3>{item.data.mainGoal}</h3>
                      <span className="history-card-date"><Calendar size={14} aria-hidden="true" /> {new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                      <span className="history-card-progress-row">
                        <strong className={progress.percentage === 100 ? 'history-progress-done' : ''}>
                          {progress.percentage === 100 ? 'Jornada concluída' : `${progress.percentage}% da jornada`}
                        </strong><span>{progress.completedTasks}/64 etapas</span>
                      </span>
                      <span className="history-progress-track" role="progressbar" aria-label={`Progresso de ${item.data.mainGoal}`} aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}>
                        <span className={progress.percentage === 100 ? 'history-progress-fill history-progress-fill-done' : 'history-progress-fill'} style={{ width: `${progress.percentage}%` }} />
                      </span>
                      <span className="history-card-action">Continuar meu plano <ArrowRight size={16} aria-hidden="true" /></span>
                    </button>
                    <button type="button" aria-label={`Excluir ${item.data.mainGoal}`} title="Excluir plano" onClick={(e) => deleteHistoryItem(item.id, e)} className="history-card-delete"><Trash2 size={17}/></button>
                  </article>
                )
              })}</div>
            )}
          </div>
        </div>
      </div>}

      <main className={step === 'input' ? 'home-main' : 'flex-grow flex flex-col items-center justify-center px-4 pb-8 pt-8 sm:p-8 w-full'}>
        {step === 'input' && (
          <div className="home-content">
            <section className="home-hero" aria-labelledby="home-title">
              <div className="home-hero-copy">
                <span className="home-eyebrow"><Sparkles size={16} /> SEU ESPAÇO PARA COMEÇAR</span>
                <h1 id="home-title">Seu sonho pode virar <span className="brand-text">um plano possível.</span></h1>
                <p className="home-lead">Dê nome ao que você quer viver. A gente ajuda a organizar o caminho em passos claros, no seu ritmo.</p>

                <div className="home-form-card">
                  <form onSubmit={handleStart}>
                    <label htmlFor="main-goal">Qual sonho você quer tirar do papel?</label>
                    <input
                      ref={goalInputRef}
                      id="main-goal"
                      type="text"
                      value={mainGoal}
                      onChange={(e) => {
                        setMainGoal(e.target.value);
                        if (!e.target.value.trim()) {
                          try { sessionStorage.removeItem(GUEST_GOAL_KEY); } catch {}
                          if (user) {
                            try { sessionStorage.removeItem(`mandalart.interview.${user.id}`); } catch {}
                          }
                        }
                      }}
                      maxLength={300}
                      placeholder="Ex.: correr uma maratona"
                      aria-describedby="home-goal-hint"
                    />
                    <button type="submit" disabled={processing || !mainGoal.trim()} className="home-submit brand-button">
                      {processing ? <Loader2 className="animate-spin" size={20} /> : <>{needsDreams ? 'Continuar meu sonho' : 'Criar meu plano'} <ArrowRight size={19} /></>}
                    </button>
                  </form>
                  <p id="home-goal-hint" className="home-form-hint">
                    <Check size={15} aria-hidden="true" />
                    {user && needsDreams ? 'Seu objetivo fica salvo para continuar depois de escolher seus sonhos.' : 'São só 3 perguntas para personalizar seu plano.'}
                  </p>
                </div>
                {error && <p role="alert" className="home-error">{error}</p>}
                <div className="home-examples">
                  <span>Precisa de inspiração?</span>
                  <div className="home-example-list">
                    {['Correr uma maratona', 'Virar Tech Lead', 'Morar no exterior'].map(example => (
                      <button key={example} type="button" onClick={() => { setMainGoal(example); goalInputRef.current?.focus(); }}>
                        {example}<ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="home-art" aria-hidden="true">
                <div className="home-art-note"><span className="home-art-note-icon"><Compass size={18} /></span> Um caminho de cada vez</div>
                <div className="home-plan-card">
                  <div className="home-plan-top"><span>SEU MANDALART</span><Sparkles size={18} /></div>
                  <div className="home-plan-grid">
                    {['Aprender', 'Preparar', 'Explorar', 'Praticar', 'Seu sonho', 'Cuidar', 'Organizar', 'Conectar', 'Avançar'].map((item, index) => (
                      <span key={item} className={index === 4 ? 'home-plan-center' : ''}>{item}</span>
                    ))}
                  </div>
                  <p>Uma visão mais clara do que importa agora.</p>
                </div>
                <div className="home-art-progress"><span className="home-art-progress-icon"><Check size={18} /></span><span><strong>Pequenos passos</strong><br />Grandes possibilidades.</span></div>
              </div>
            </section>

            <section className="home-how" aria-labelledby="home-how-title">
              <div className="home-how-heading">
                <span className="home-eyebrow">DO SONHO AO PLANO</span>
                <h2 id="home-how-title">Um começo simples, feito com você.</h2>
              </div>
              <ol>
                <li><span className="home-how-icon"><Compass size={21} /></span><div><span className="home-how-number">01</span><h3>Conte seu objetivo</h3><p>Escreva do seu jeito, mesmo que a ideia ainda esteja tomando forma.</p></div></li>
                <li><span className="home-how-icon"><BrainCircuit size={21} /></span><div><span className="home-how-number">02</span><h3>Responda 3 perguntas</h3><p>Ajudam a entender seu momento e deixar o plano mais pessoal.</p></div></li>
                <li><span className="home-how-icon"><ListChecks size={21} /></span><div><span className="home-how-number">03</span><h3>Avance no seu ritmo</h3><p>Veja seus próximos passos e acompanhe cada conquista.</p></div></li>
              </ol>
              <p className="home-how-note">O planner completo usa 1 sonho. Você pode escolher um pacote antes de criá-lo, sem assinatura.</p>
            </section>
          </div>
        )}

        {step === 'safety' && safetyCategory && (
          <SafetyNotice category={safetyCategory} onBack={handleReset} />
        )}
        
        {step === 'interview' && (
          <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center space-y-2">
               <div className="bg-purple-100 p-3 rounded-full inline-block"><BrainCircuit className="w-8 h-8 text-purple-600" /></div>
               <h2 className="brand-text text-2xl font-bold">{previewId ? 'Seu próximo capítulo' : 'Entendendo Melhor'}</h2>
               <p className="text-gray-500">{previewId ? 'Suas respostas já estão aqui. Confira e dê o próximo passo.' : 'Responda a essas perguntas rápidas para personalizar seu plano.'}</p>
               {previewId && <p className="text-sm font-semibold text-indigo-700">{mainGoal}</p>}
            </div>
            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-200/60">
                  <label htmlFor={`answer-${q.id}`} className="block text-lg font-medium text-gray-900 mb-4">{q.text}</label>
                  <textarea
                    id={`answer-${q.id}`}
                    value={answers[idx]?.answer || ''}
                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                    maxLength={1000}
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-indigo-500 transition-all h-24 bg-white text-gray-900"
                    placeholder="Sua resposta..."
                  />
                </div>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={processing} className="w-full py-4 brand-button text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg">
              {processing ? <Loader2 className="animate-spin" /> : <>{wallet && wallet.balance > 0 ? 'Gerar meu planner · 1 sonho' : 'Escolher meus sonhos'} <Sparkles /></>}
            </button>
            {error && <p role="alert" className="text-center text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 animate-in zoom-in duration-500">
              <div className="bg-white p-4 rounded-full shadow-xl relative animate-bounce"><Sparkles className="w-12 h-12 text-indigo-600" /></div>
              <div
                key={generationMessageIndex}
                role="status"
                aria-live="polite"
                className="min-h-20 max-w-md space-y-2 animate-in fade-in slide-in-from-bottom-8 duration-500"
              >
                <h3 className="text-2xl font-bold text-gray-800">
                  {GENERATION_MESSAGES[generationMessageIndex].title}
                </h3>
                <p className="text-gray-500">
                  {GENERATION_MESSAGES[generationMessageIndex].description}
                </p>
                {error && <p role="status" className="text-sm text-indigo-700">{error}</p>}
              </div>
          </div>
        )}

        {step === 'result' && mandalartData && (
          <div className="w-full flex flex-col items-center gap-3">
            {progressSaveError && (
              <div role="alert" className="mx-4 flex max-w-2xl items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                <span className="flex-1">{progressSaveError}</span>
                <button
                  type="button"
                  onClick={() => void flushMandalartUpdates()}
                  disabled={isSavingProgress}
                  className="shrink-0 rounded-xl bg-amber-900 px-3 py-2 font-bold text-white transition hover:bg-amber-950 disabled:opacity-60"
                >
                  {isSavingProgress ? 'Salvando…' : 'Tentar novamente'}
                </button>
              </div>
            )}
            <MandalartView 
              data={mandalartData} 
              onReset={handleReset} 
              onDataUpdate={handleDataUpdate}
            />
          </div>
        )}
      </main>

    </div>
  );
}
