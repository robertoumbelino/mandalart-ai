import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, BrainCircuit, Loader2, History, X, Trash2, Calendar, LayoutGrid, LogOut, User as UserIcon } from 'lucide-react';
import { generateQuestions, generateMandalartData } from './services/openRouterService';
import { MandalartData, Question, AppStep, InterviewAnswer, HistoryItem, User } from './types';
import { MandalartView } from './components/MandalartView';
import { Auth } from './components/Auth';
import { authService } from './services/authService';
import { db } from './services/databaseService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<AppStep>('input');
  const [mainGoal, setMainGoal] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [mandalartData, setMandalartData] = useState<MandalartData | null>(null);
  const [currentMandalartId, setCurrentMandalartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Load user session and history on mount
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const userHistory = db.getHistory(currentUser.id);
      setHistory(userHistory);
    }
  }, []);

  const refreshHistory = (userId: string) => {
    setHistory(db.getHistory(userId));
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    refreshHistory(newUser.id);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setHistory([]);
    setStep('input');
  };

  const handleDataUpdate = (newData: MandalartData) => {
    setMandalartData(newData);
    // Auto-update the current item in DB if we are viewing one
    if (currentMandalartId) {
      db.updateMandalart(currentMandalartId, newData);
      if (user) refreshHistory(user.id);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.deleteMandalart(id);
    if (user) refreshHistory(user.id);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setMandalartData(item.data);
    setCurrentMandalartId(item.id);
    setMainGoal(item.data.mainGoal);
    setStep('result');
    setIsHistoryOpen(false);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainGoal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const q = await generateQuestions(mainGoal);
      setQuestions(q);
      setAnswers(q.map(item => ({ questionId: item.id, questionText: item.text, answer: '' })));
      setStep('interview');
    } catch (err) {
      setError("Erro ao gerar perguntas.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index].answer = value;
    setAnswers(newAnswers);
  };

  const handleGenerate = async () => {
    if (answers.some(a => !a.answer.trim())) {
      setError("Responda todas as perguntas.");
      return;
    }
    setStep('generating');
    setLoading(true);
    try {
      const data = await generateMandalartData(mainGoal, answers);
      setMandalartData(data);
      if (user) {
        const newItem = db.saveMandalart(user.id, data);
        setCurrentMandalartId(newItem.id);
        refreshHistory(user.id);
      }
      setStep('result');
    } catch (err) {
      setError("Erro ao criar o Mandalart.");
      setStep('interview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMainGoal('');
    setQuestions([]);
    setAnswers([]);
    setMandalartData(null);
    setCurrentMandalartId(null);
    setStep('input');
  };

  // Se não estiver logado, mostramos a tela de Auth
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col font-sans text-gray-900 overflow-x-hidden">
      
      {/* Header com Faixa de Usuário */}
      <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-start z-40">
        <div className="flex flex-col gap-3">
          {step !== 'input' && (
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 bg-white/80 backdrop-blur shadow-sm px-4 py-2 rounded-full border border-gray-100 hover:bg-white transition group"
            >
              <LayoutGrid size={18} className="text-indigo-600 group-hover:rotate-90 transition-transform" />
              <span className="font-bold text-gray-800 text-sm">Mandalart.AI</span>
            </button>
          )}

          {/* Faixa de Usuário Logado */}
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-100 p-1.5 rounded-2xl pr-4 shadow-md animate-in slide-in-from-left duration-500">
             <img 
               src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} 
               className="w-8 h-8 rounded-xl bg-indigo-50" 
               alt="User" 
             />
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-0.5">Logado como</span>
                <span className="text-xs font-bold text-gray-800 leading-none">{user.name}</span>
             </div>
             <button 
                onClick={handleLogout}
                className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Sair"
             >
                <LogOut size={16} />
             </button>
          </div>
        </div>

        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="bg-white hover:bg-gray-50 text-gray-600 hover:text-indigo-600 shadow-md border border-gray-100 p-3 rounded-full transition-all relative group"
        >
          <History className="w-6 h-6" />
          {history.length > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white transform translate-x-1 -translate-y-1"></span>
          )}
        </button>
      </div>

      {/* History Sidebar */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity" onClick={() => setIsHistoryOpen(false)} />
      )}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><History className="text-indigo-600"/> Histórico de {user.name}</h2>
            <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-20 text-gray-400">Nenhum plano salvo ainda.</div>
            ) : (
              history.map(item => (
                <div key={item.id} onClick={() => loadHistoryItem(item)} className="p-4 rounded-xl border border-gray-100 hover:border-indigo-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group relative">
                  <h3 className="font-bold text-gray-800 line-clamp-2 pr-6">{item.data.mainGoal}</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400"><Calendar size={12}/> {new Date(item.timestamp).toLocaleDateString()}</div>
                  <button onClick={(e) => deleteHistoryItem(item.id, e)} className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 w-full">
        {step === 'input' && (
          /* MANTIDA A INTERFACE ORIGINAL EXATAMENTE COMO SOLICITADO */
          <div className="w-full max-w-3xl mx-auto text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider shadow-sm mb-4">
                <Sparkles size={14} />
                <span>Powered by AI</span>
              </div>
              <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-gray-900 leading-[1.1]">
                Mandalart<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">.AI</span>
              </h1>
              <p className="text-xl sm:text-2xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
                Transforme sonhos vagos em planos de ação concretos. Nossa IA cria uma <span className="text-gray-900 font-medium">matriz 9x9</span> estratégica para guiar seu sucesso.
              </p>
            </div>
            <div className="max-w-xl mx-auto bg-white p-2 rounded-3xl shadow-xl border border-gray-100/50">
              <form onSubmit={handleStart} className="flex flex-col sm:flex-row gap-2 items-center mb-0">
                <input
                  type="text"
                  value={mainGoal}
                  onChange={(e) => setMainGoal(e.target.value)}
                  placeholder="Qual é o seu objetivo principal?"
                  className="w-full sm:flex-grow px-6 py-4 text-lg bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !mainGoal.trim()}
                  className="w-full sm:w-auto px-8 py-4 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 text-lg whitespace-nowrap"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <>Iniciar <ArrowRight size={20} /></>}
                </button>
              </form>
            </div>
            {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg inline-block">{error}</p>}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto w-full px-4">
               <div onClick={() => setMainGoal("Correr uma maratona")} className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <span className="bg-orange-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">🏃</span>
                  <span className="font-medium text-gray-700">"Correr uma maratona"</span>
               </div>
               <div onClick={() => setMainGoal("Virar Tech Lead")} className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <span className="bg-blue-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">💼</span>
                  <span className="font-medium text-gray-700">"Virar Tech Lead"</span>
               </div>
               <div onClick={() => setMainGoal("Morar no exterior")} className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <span className="bg-purple-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">✈️</span>
                  <span className="font-medium text-gray-700">"Morar no exterior"</span>
               </div>
            </div>
          </div>
        )}
        
        {step === 'interview' && (
          <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 pt-24">
            <div className="text-center space-y-2">
               <div className="bg-purple-100 p-3 rounded-full inline-block"><BrainCircuit className="w-8 h-8 text-purple-600" /></div>
               <h2 className="text-2xl font-bold text-gray-800">Entendendo Melhor</h2>
               <p className="text-gray-500">Responda a essas perguntas rápidas para personalizar seu plano.</p>
            </div>
            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-200/60">
                  <p className="text-lg font-medium text-gray-900 mb-4">{q.text}</p>
                  <textarea
                    value={answers[idx]?.answer || ''}
                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 ring-indigo-500 transition-all h-24 bg-white text-gray-900"
                    placeholder="Sua resposta..."
                  />
                </div>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={loading} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg">
              {loading ? <Loader2 className="animate-spin" /> : <>Gerar Plano Mandalart <Sparkles /></>}
            </button>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 animate-in zoom-in duration-500">
              <div className="bg-white p-4 rounded-full shadow-xl relative animate-bounce"><Sparkles className="w-12 h-12 text-indigo-600" /></div>
              <h3 className="text-2xl font-bold text-gray-800">A IA está pensando...</h3>
          </div>
        )}

        {step === 'result' && mandalartData && (
          <div className="pt-24 w-full flex justify-center">
            <MandalartView 
              data={mandalartData} 
              onReset={handleReset} 
              onDataUpdate={handleDataUpdate}
            />
          </div>
        )}
      </main>

      {step === 'input' && (
        <footer className="py-6 text-center text-gray-400 text-sm">
          <p>Experimente o poder do planejamento estruturado.</p>
        </footer>
      )}
    </div>
  );
}