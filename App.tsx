import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, BrainCircuit, Loader2, History, X, Trash2, Calendar, LayoutGrid } from 'lucide-react';
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
        localStorage.removeItem('mandalart_history');
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
    
    setHistory(prevHistory => {
      const updatedHistory = [newItem, ...prevHistory];
      localStorage.setItem('mandalart_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  };

  // Update Data Handler (for checklist toggles)
  const handleDataUpdate = (newData: MandalartData) => {
    setMandalartData(newData);
    
    // Also update this specific item in history if it exists
    // Note: In a real app we might track the "current history ID" to update the correct one
    // For now we just update state. If the user wants to "save" progress they can re-generate or we could auto-update the latest history item.
    // Let's simple update the most recent history item if it matches the main goal to emulate "autosave"
    setHistory(prev => {
        const copy = [...prev];
        if (copy.length > 0 && copy[0].data.mainGoal === newData.mainGoal) {
            copy[0].data = newData;
            localStorage.setItem('mandalart_history', JSON.stringify(copy));
        }
        return copy;
    });
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prevHistory => {
      const updatedHistory = prevHistory.filter(item => item.id !== id);
      localStorage.setItem('mandalart_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  };

  const clearAllHistory = () => {
    if (window.confirm("Tem certeza que deseja apagar todo o histórico?")) {
      setHistory([]);
      localStorage.removeItem('mandalart_history');
    }
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
      saveToHistory(data); 
      setStep('result');
    } catch (err) {
      setError("Erro ao criar o Mandalart. Tente novamente mais tarde.");
      setStep('interview'); 
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

  const goToHome = () => {
    if (window.confirm("Voltar para o início? O progresso atual será perdido.")) {
      handleReset();
    }
  };

  // Render Helpers
  const renderInputStep = () => (
    <div className="w-full max-w-3xl mx-auto text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* Hero Section */}
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider shadow-sm mb-4">
          <Sparkles size={14} />
          <span>Powered by Gemini 2.5</span>
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-gray-900 leading-[1.1]">
          Mandalart<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">.AI</span>
        </h1>
        
        <p className="text-xl sm:text-2xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
          Transforme sonhos vagos em planos de ação concretos. Nossa IA cria uma <span className="text-gray-900 font-medium">matriz 9x9</span> estratégica para guiar seu sucesso.
        </p>
      </div>

      {/* Input Section */}
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

      {/* Social Proof / Examples */}
      <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto w-full px-4">
         <div 
           onClick={() => setMainGoal("Correr uma maratona")}
           className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
         >
            <span className="bg-orange-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">🏃</span>
            <span className="font-medium text-gray-700">"Correr uma maratona"</span>
         </div>
         <div 
           onClick={() => setMainGoal("Virar Tech Lead")}
           className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
         >
            <span className="bg-blue-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">💼</span>
            <span className="font-medium text-gray-700">"Virar Tech Lead"</span>
         </div>
         <div 
           onClick={() => setMainGoal("Morar no exterior")}
           className="flex flex-col items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
         >
            <span className="bg-purple-50 p-3 rounded-xl text-2xl group-hover:scale-110 transition-transform">✈️</span>
            <span className="font-medium text-gray-700">"Morar no exterior"</span>
         </div>
      </div>
    </div>
  );

  const renderInterviewStep = () => (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 relative z-10">
      <div className="text-center space-y-2">
         <div className="bg-purple-100 p-3 rounded-full inline-block">
            <BrainCircuit className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Entendendo Melhor</h2>
        <p className="text-gray-500">Responda a essas perguntas rápidas para personalizar seu plano.</p>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-gray-200/60">
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
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 text-lg"
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
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      <div className={`fixed inset-y-0 right-0 w-80 bg-white/95 backdrop-blur-md shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-gray-800">Histórico</h2>
            </div>
            <div className="flex gap-1">
              {history.length > 0 && (
                <button 
                  onClick={clearAllHistory}
                  className="p-1 hover:bg-red-50 hover:text-red-600 rounded-full transition text-gray-400"
                  title="Apagar tudo"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
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
    <div className="min-h-screen relative flex flex-col font-sans text-gray-900 overflow-x-hidden">
      
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-40">
        
        {step !== 'input' ? (
          <button 
            onClick={goToHome}
            className="pointer-events-auto flex items-center gap-2 bg-white/80 backdrop-blur shadow-sm px-4 py-2 rounded-full border border-gray-100 hover:bg-white transition group"
          >
            <LayoutGrid size={18} className="text-indigo-600 group-hover:rotate-90 transition-transform" />
            <span className="font-bold text-gray-800 text-sm">Mandalart.AI</span>
          </button>
        ) : <div></div>}

        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="pointer-events-auto bg-white hover:bg-gray-50 text-gray-600 hover:text-indigo-600 shadow-md border border-gray-100 p-3 rounded-full transition-all duration-300 relative group"
          title="Histórico"
        >
          <History className="w-6 h-6" />
          {history.length > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white transform translate-x-1 -translate-y-1"></span>
          )}
        </button>
      </div>

      {renderHistorySidebar()}

      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 w-full">
        {step === 'input' && renderInputStep()}
        {step === 'interview' && renderInterviewStep()}
        {step === 'generating' && renderGeneratingStep()}
        {step === 'result' && mandalartData && (
          <MandalartView 
            data={mandalartData} 
            onReset={handleReset} 
            onDataUpdate={handleDataUpdate}
          />
        )}
      </main>

      {step === 'input' && (
        <footer className="py-6 text-center text-gray-400 text-sm animate-fade-in">
          <p>Experimente o poder do planejamento estruturado.</p>
        </footer>
      )}
    </div>
  );
}