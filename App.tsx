import React, { useState, useEffect } from 'react';
import { Target, ArrowRight, Sparkles, BrainCircuit, Loader2, History, X, Trash2, Calendar } from 'lucide-react';
import { generateQuestions, generateMandalartData } from './services/geminiService';
import { MandalartData, Question, AppStep, InterviewAnswer, HistoryItem } from './types';
import { MandalartView } from './components/MandalartView';

export default function App() {
  const [step, setStep] = useState<AppStep>('input');
  const [mainGoal, setMainGoal] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [mandalartData, setMandalartData] = useState<MandalartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('mandalart_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history helper
  const saveToHistory = (data: MandalartData) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      data: data
    };
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('mandalart_history', JSON.stringify(updatedHistory));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('mandalart_history', JSON.stringify(updatedHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setMandalartData(item.data);
    setMainGoal(item.data.mainGoal);
    setStep('result');
    setIsHistoryOpen(false);
  };

  // Handlers
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
      setError("Erro ao gerar perguntas. Tente novamente.");
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
    // Basic validation
    if (answers.some(a => !a.answer.trim())) {
      setError("Por favor, responda todas as perguntas para obter o melhor resultado.");
      return;
    }

    setStep('generating');
    setLoading(true);
    setError(null);

    try {
      const data = await generateMandalartData(mainGoal, answers);
      setMandalartData(data);
      saveToHistory(data); // Auto-save
      setStep('result');
    } catch (err) {
      setError("Erro ao criar o Mandalart. Tente novamente mais tarde.");
      setStep('interview'); // Go back so they don't lose answers
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMainGoal('');
    setQuestions([]);
    setAnswers([]);
    setMandalartData(null);
    setStep('input');
    setError(null);
  };

  // Render Helpers
  const renderInputStep = () => (
    <div className="w-full max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <div className="bg-indigo-100 p-4 rounded-full inline-block">
            <Target className="w-12 h-12 text-indigo-600" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          Defina seu Objetivo
        </h1>
        <p className="text-lg text-gray-600">
          Vamos construir um mapa detalhado (Mandalart) para te ajudar a alcançar suas metas.
          Comece nos dizendo qual é o seu objetivo principal.
        </p>
      </div>

      <form onSubmit={handleStart} className="space-y-4">
        <div className="relative">
            <input
              type="text"
              value={mainGoal}
              onChange={(e) => setMainGoal(e.target.value)}
              placeholder="Ex: Correr uma maratona em 2025"
              className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm placeholder:text-gray-400 bg-white text-gray-900"
              autoFocus
            />
        </div>
        <button
          type="submit"
          disabled={loading || !mainGoal.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-lg"
        >
          {loading ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight /></>}
        </button>
      </form>
      {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
    </div>
  );

  const renderInterviewStep = () => (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center space-y-2">
         <div className="bg-purple-100 p-3 rounded-full inline-block">
            <BrainCircuit className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Entendendo Melhor</h2>
        <p className="text-gray-500">Responda a essas perguntas rápidas para personalizar seu plano.</p>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Pergunta {idx + 1} de {questions.length}
            </label>
            <p className="text-lg font-medium text-gray-900 mb-4">{q.text}</p>
            <textarea
              value={answers[idx]?.answer || ''}
              onChange={(e) => handleAnswerChange(idx, e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none h-24 bg-white text-gray-900"
              placeholder="Sua resposta..."
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-center">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-4 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 text-lg"
      >
        {loading ? <Loader2 className="animate-spin" /> : <>Gerar Plano Mandalart <Sparkles /></>}
      </button>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 animate-in zoom-in duration-500">
        <div className="relative">
            <div className="absolute inset-0 bg-indigo-200 rounded-full animate-ping opacity-75"></div>
            <div className="bg-white p-4 rounded-full shadow-xl relative z-10">
                <Sparkles className="w-12 h-12 text-indigo-600 animate-pulse" />
            </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-800">A IA está pensando...</h3>
        <p className="text-gray-500 max-w-md">Estamos estruturando seu objetivo "{mainGoal}" em 64 micro-tarefas acionáveis.</p>
    </div>
  );

  const renderHistorySidebar = () => (
    <>
      {/* Backdrop */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-gray-800">Histórico</h2>
            </div>
            <button 
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 hover:bg-gray-200 rounded-full transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>Nenhum objetivo salvo ainda.</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="group bg-white border border-gray-100 hover:border-indigo-300 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer relative"
                >
                  <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 pr-6">
                    {item.data.mainGoal}
                  </h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(item.timestamp).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="w-10"></div> {/* Spacer for centering */}
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
          Mandalart.AI
        </span>
        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition relative group"
          title="Histórico"
        >
          <History className="w-5 h-5" />
          {history.length > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </header>

      {renderHistorySidebar()}

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
        {step === 'input' && renderInputStep()}
        {step === 'interview' && renderInterviewStep()}
        {step === 'generating' && renderGeneratingStep()}
        {step === 'result' && mandalartData && (
          <MandalartView data={mandalartData} onReset={handleReset} />
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 text-sm">
        <p>Desenvolvido com Google Gemini</p>
      </footer>
    </div>
  );
}