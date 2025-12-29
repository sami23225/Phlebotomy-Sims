
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Droplets, 
  Syringe, 
  RefreshCcw, 
  Clock,
  ShieldCheck,
  Stethoscope,
  Info,
  Send,
  MessageSquare,
  CreditCard,
  UserCheck,
  GraduationCap
} from 'lucide-react';
import { GameState, Stats, Feedback, ChatMessage, Step } from './types';
import * as geminiService from './services/geminiService';

const STEPS: Step[] = [
  { id: 'identify', label: 'Identify Patient', icon: <User size={18} /> },
  { id: 'tourniquet', label: 'Apply Tourniquet', icon: <ShieldCheck size={18} /> },
  { id: 'clean', label: 'Clean Site', icon: <Droplets size={18} /> },
  { id: 'puncture', label: 'Venipuncture', icon: <Syringe size={18} /> },
  { id: 'collect', label: 'Collect Sample', icon: <Droplets size={18} /> },
  { id: 'finish', label: 'Post-Care', icon: <CheckCircle2 size={18} /> },
];

const MAX_BLOOD = 100;
const IDEAL_ANGLE = 25;
const IDEAL_DEPTH = 75;

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [stepIndex, setStepIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>({ type: 'info', message: 'Welcome to the clinical simulation.' });
  const [stats, setStats] = useState<Stats>({
    patientSafety: 100,
    technique: 100,
    painLevel: 10,
    bloodVolume: 0,
  });
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Procedure State
  const [isTourniquetOn, setIsTourniquetOn] = useState(false);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [isSiteCleaned, setIsSiteCleaned] = useState(false);
  const [needleAngle, setNeedleAngle] = useState(0);
  const [needleDepth, setNeedleDepth] = useState(0);
  const [isFlashbackVisible, setIsFlashbackVisible] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shakiness, setShakiness] = useState(0);

  // Interaction States
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'patient', text: "Hello... I'm a bit nervous about needles." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [performanceReview, setPerformanceReview] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
        if (isTourniquetOn && stepIndex >= 2) {
          setStats(s => ({ ...s, painLevel: Math.min(100, s.painLevel + 0.1) }));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, isTourniquetOn, stepIndex]);

  useEffect(() => {
    if (isDrawing || (stepIndex === 3 && needleDepth > 10)) {
      const baseShakiness = stats.painLevel / 20;
      const interval = setInterval(() => {
        setShakiness((Math.random() * baseShakiness) - (baseShakiness / 2));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setShakiness(0);
    }
  }, [isDrawing, stepIndex, needleDepth, stats.painLevel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- Core Simulation Actions ---
  const nextStep = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      finishSimulation();
    }
  }, [stepIndex]);

  const finishSimulation = () => {
    setIsTimerRunning(false);
    setGameState('results');
  };

  const startProcedure = () => {
    setGameState('procedure');
    setIsTimerRunning(true);
    setStepIndex(0);
    setFeedback({ type: 'info', message: 'First, check the patient ID card and confirm identity.' });
  };

  const handleIdentify = () => {
    setFeedback({ type: 'success', message: 'Identity confirmed with MRN matches. Proceeding.' });
    setTimeout(nextStep, 1000);
  };

  const toggleTourniquet = () => {
    setIsTourniquetOn(!isTourniquetOn);
    setFeedback({ 
      type: 'info', 
      message: !isTourniquetOn ? 'Tourniquet applied 3-4 inches above site.' : 'Tourniquet released.' 
    });
    if (!isTourniquetOn && stepIndex === 1) nextStep();
  };

  const handleScrubbing = () => {
    if (stepIndex !== 2 || isSiteCleaned) return;
    setCleaningProgress(prev => {
      const next = prev + 2;
      if (next >= 100) {
        setIsSiteCleaned(true);
        setFeedback({ type: 'success', message: 'Site is sterile. Ready for venipuncture.' });
        setTimeout(nextStep, 1000);
        return 100;
      }
      return next;
    });
  };

  const handleNeedleMove = (depth: number, angle: number) => {
    setNeedleDepth(depth);
    setNeedleAngle(angle);

    if (depth > 65 && depth < 85 && Math.abs(angle - IDEAL_ANGLE) < 10) {
      setIsFlashbackVisible(true);
      if (stepIndex === 3) {
        setFeedback({ type: 'success', message: 'Flashback observed! Maintain position and prepare to collect.' });
      }
    } else {
      setIsFlashbackVisible(false);
    }

    if (depth > 10 && (Math.abs(angle - IDEAL_ANGLE) > 15 || depth > 90)) {
      setStats(s => ({ ...s, painLevel: Math.min(100, s.painLevel + 0.5), technique: Math.max(0, s.technique - 0.2) }));
    }
  };

  const handleCollection = () => {
    if (!isFlashbackVisible) {
      setFeedback({ type: 'error', message: 'No blood flow. Adjust needle position.' });
      return;
    }
    setIsDrawing(true);
    const drawInterval = setInterval(() => {
      setStats(s => {
        if (s.bloodVolume >= MAX_BLOOD) {
          clearInterval(drawInterval);
          setIsDrawing(false);
          setFeedback({ type: 'success', message: 'Collection complete. Release tourniquet before removing needle.' });
          return s;
        }
        return { ...s, bloodVolume: s.bloodVolume + 2 };
      });
    }, 100);
  };

  const handleRemoval = () => {
    if (isTourniquetOn) {
      setFeedback({ type: 'error', message: 'WARNING: Hematoma risk! Release tourniquet before needle removal.' });
      setStats(s => ({ ...s, technique: Math.max(0, s.technique - 10) }));
      return;
    }
    setNeedleDepth(0);
    setFeedback({ type: 'success', message: 'Needle removed safely. Pressure applied to site.' });
    nextStep();
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'trainee', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await geminiService.getPatientResponse(userMsg, STEPS[stepIndex], stats);
      setChatHistory(prev => [...prev, { role: 'patient', text: response.response }]);
      setStats(s => ({ 
        ...s, 
        painLevel: Math.max(0, Math.min(100, s.painLevel + response.anxietyChange)) 
      }));
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'patient', text: "Just... be careful, please." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const requestAdvice = async () => {
    setIsLoading(true);
    try {
      const advice = await geminiService.getInstructorAdvice(
        STEPS[stepIndex], needleAngle, needleDepth, stats, isTourniquetOn, isFlashbackVisible
      );
      setFeedback({ type: 'info', message: `Instructor: ${advice}` });
    } catch (err) {
      setFeedback({ type: 'error', message: "Instructor is currently unavailable." });
    } finally {
      setIsLoading(false);
    }
  };

  const generateReview = async () => {
    setIsLoading(true);
    try {
      const review = await geminiService.generateFinalReview(stats, timer);
      setPerformanceReview(review);
    } catch (err) {
      setPerformanceReview("Detailed review generation failed. Please consult your training manual.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI Components ---
  const ProgressBar = ({ value, label, color }: { value: number, label: string, color: string }) => (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1 font-medium text-[#2b2b2b]">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-[#f1ecff] rounded-full h-2 overflow-hidden border border-[#d492ff]">
        <div 
          className={`h-full transition-all duration-300 ${color}`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f5fb] p-4 md:p-8 font-sans text-[#2b2b2b]">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-[#d492ff]">
        
        {/* Header */}
        <header className="bg-[#0c0a18] text-white p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b-4 border-[#af4bef]">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-lg">
              <img 
                src="https://cdn.prod.website-files.com/64d0ccc1558d601cbfb09021/64e9d2f719b1e5258e5d57f5_IMG_1512-p-500.png" 
                alt="Brand Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="h-10 w-px bg-slate-700 mx-2" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#d492ff]">PHLEBOSIM</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Clinical Training Module</p>
            </div>
          </div>
          
          <div className="flex gap-6 items-center bg-[#1a1730] px-6 py-2 rounded-full border border-slate-700">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#fdcb6e]" />
              <span className="font-mono text-lg">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-[#af4bef]" />
              <span className="text-sm font-semibold uppercase tracking-tighter">Certified Training</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex flex-col md:flex-row h-[700px]">
          
          {/* Left Panel: Simulation View */}
          <div className="flex-1 bg-[#f7f5fb] p-6 flex flex-col relative overflow-hidden">
            {gameState === 'welcome' && (
              <div className="m-auto text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-6 inline-flex p-4 bg-white rounded-3xl shadow-sm border border-[#d492ff]">
                  <GraduationCap size={48} className="text-[#af4bef]" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-[#0c0a18]">Clinical Readiness</h2>
                <p className="text-[#6c6880] mb-8 leading-relaxed">
                  Welcome to the Phlebotomy Proficiency Module. Practice your technical skills and patient interaction in a controlled clinical environment.
                </p>
                <button 
                  onClick={startProcedure}
                  className="w-full bg-[#af4bef] hover:bg-[#8380f0] text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  Start Assessment
                </button>
              </div>
            )}

            {gameState === 'procedure' && (
              <div className="w-full h-full flex flex-col gap-4">
                {/* Visualizer */}
                <div className="flex-1 bg-white rounded-2xl shadow-inner border border-[#d492ff] relative p-4 flex flex-col overflow-hidden">
                  
                  {/* Feedback Overlay */}
                  <div className={`absolute top-4 left-4 right-4 p-3 rounded-xl border flex items-center justify-between gap-3 transition-all z-20 ${
                    feedback.type === 'success' ? 'bg-[#00b894]/10 border-[#00b894] text-[#00b894]' : 
                    feedback.type === 'error' ? 'bg-[#e17055]/10 border-[#e17055] text-[#e17055] animate-pulse' : 
                    'bg-[#8380f0]/10 border-[#8380f0] text-[#8380f0]'
                  }`}>
                    <div className="flex items-center gap-3">
                      {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
                      <span className="text-sm font-bold uppercase tracking-tighter">{feedback.message}</span>
                    </div>
                    <button 
                      onClick={requestAdvice}
                      disabled={isLoading}
                      className="bg-white/90 hover:bg-white text-[10px] font-black px-3 py-1.5 rounded-lg border border-[#af4bef] text-[#af4bef] flex items-center gap-1.5 shadow-sm transition-all uppercase"
                    >
                      <UserCheck size={12} /> Instructor Guidance
                    </button>
                  </div>

                  {/* ID Card Step */}
                  {stepIndex === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0c0a18]/20 backdrop-blur-[2px]">
                      <div className="w-80 bg-white rounded-2xl shadow-2xl border-t-8 border-[#af4bef] overflow-hidden transform animate-in slide-in-from-bottom-10">
                        <div className="p-4 bg-[#f7f5fb] border-b border-[#d492ff] flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-[#d492ff]">
                            <User className="text-[#af4bef]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-[#af4bef] uppercase tracking-tighter">Clinical Identification</p>
                            <p className="text-sm font-black text-[#0c0a18]">FACILITY ADMISSION</p>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <p className="text-[9px] font-bold text-[#6c6880] uppercase">Patient Name</p>
                            <p className="text-sm font-bold text-[#2b2b2b]">JOHN DOE</p>
                          </div>
                          <div className="flex justify-between">
                            <div>
                              <p className="text-[9px] font-bold text-[#6c6880] uppercase">DOB</p>
                              <p className="text-xs font-bold text-[#2b2b2b]">04/12/1988</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-[#6c6880] uppercase">MRN</p>
                              <p className="text-xs font-bold text-[#af4bef]">MRN-99824-A</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={handleIdentify}
                          className="w-full bg-[#af4bef] text-white py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#0c0a18] transition-colors"
                        >
                          <CheckCircle2 size={18} /> Confirm Identity
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Arm Visuals */}
                  <div className="flex-1 flex items-center justify-center relative">
                    <div className="w-3/4 h-32 bg-[#E8C1A0] rounded-full relative shadow-md border-b-4 border-slate-300">
                      <div className={`absolute top-1/2 left-0 right-0 h-4 -translate-y-1/2 transition-all ${isTourniquetOn ? 'bg-[#5576C7] opacity-60 scale-y-125' : 'bg-[#5576C7] opacity-20'}`} 
                           style={{ filter: 'blur(2px)' }} />
                      
                      {stepIndex === 2 && !isSiteCleaned && (
                        <div 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-dashed border-[#8380f0] rounded-full bg-[#8380f0]/5 cursor-crosshair flex items-center justify-center"
                          onMouseMove={handleScrubbing}
                        >
                           <div className="text-[10px] font-black text-[#8380f0] text-center animate-pulse">
                              SCRUB SITE<br/>{cleaningProgress}%
                           </div>
                        </div>
                      )}

                      {isSiteCleaned && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-[#00b894]/30 rounded-full animate-pulse bg-[#00b894]/5" />
                      )}

                      {isTourniquetOn && (
                        <div className="absolute top-0 bottom-0 left-10 w-8 bg-[#8380f0] rounded-sm z-10 shadow-lg" />
                      )}

                      <div 
                        className="absolute z-30 transition-all pointer-events-none"
                        style={{ 
                          left: '45%', 
                          top: '50%', 
                          transformOrigin: 'left center',
                          transform: `rotate(${-needleAngle}deg) translateX(${needleDepth * 0.5}px) translateY(${shakiness}px)` 
                        }}
                      >
                        <div className="w-40 h-1 bg-slate-300 rounded-full relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-400 rounded-sm" />
                          {isFlashbackVisible && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#e17055] rounded-full shadow-[0_0_8px_rgba(225,112,85,0.8)]" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interaction Controls */}
                  <div className="mt-auto pt-4 flex flex-wrap justify-center gap-3 bg-[#f7f5fb] p-4 rounded-xl border-t border-[#d492ff]">
                    {stepIndex === 0 && (
                      <p className="text-xs font-bold text-[#6c6880] flex items-center gap-2">
                        <CreditCard size={14} /> Review identity documents to proceed.
                      </p>
                    )}
                    
                    {stepIndex === 1 && (
                      <button 
                        onClick={toggleTourniquet} 
                        className={`${isTourniquetOn ? 'bg-[#e17055]' : 'bg-[#af4bef]'} text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md`}
                      >
                        {isTourniquetOn ? 'Release Tourniquet' : 'Apply Tourniquet'}
                      </button>
                    )}

                    {stepIndex === 2 && !isSiteCleaned && (
                      <div className="w-full flex flex-col items-center gap-2">
                         <div className="text-[10px] font-bold text-[#6c6880] uppercase">Disinfection Progress</div>
                         <div className="w-full max-w-xs bg-white h-2 rounded-full overflow-hidden border border-[#d492ff]">
                            <div className="h-full bg-[#af4bef] transition-all" style={{ width: `${cleaningProgress}%` }} />
                         </div>
                         <p className="text-[10px] font-bold text-[#af4bef] uppercase tracking-tighter">Use circular motion on the insertion site</p>
                      </div>
                    )}

                    {stepIndex === 3 && (
                      <div className="w-full flex flex-col items-center gap-4">
                        <div className="flex gap-8 w-full max-w-md">
                          <div className="flex-1">
                            <div className="flex justify-between items-end mb-2">
                               <label className="block text-[10px] font-bold text-[#6c6880] uppercase">Insert Depth</label>
                               <span className="text-[10px] font-bold text-[#af4bef]">{needleDepth}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" value={needleDepth} 
                              onChange={(e) => handleNeedleMove(parseInt(e.target.value), needleAngle)}
                              className="w-full accent-[#af4bef]"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-end mb-2">
                               <label className="block text-[10px] font-bold text-[#6c6880] uppercase">Entry Angle</label>
                               <span className="text-[10px] font-black text-white bg-[#af4bef] px-1.5 py-0.5 rounded">{needleAngle}°</span>
                            </div>
                            <input 
                              type="range" min="0" max="45" value={needleAngle} 
                              onChange={(e) => handleNeedleMove(needleDepth, parseInt(e.target.value))}
                              className="w-full accent-[#8380f0]"
                            />
                          </div>
                        </div>
                        {isFlashbackVisible && (
                          <button onClick={nextStep} className="bg-[#00b894] text-white px-8 py-3 rounded-xl font-bold animate-pulse shadow-lg">
                            Secure Needle & Collect
                          </button>
                        )}
                      </div>
                    )}

                    {stepIndex === 4 && (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div className="w-full max-w-sm flex items-center gap-4">
                          <div className="flex-1 bg-white h-6 rounded-full overflow-hidden border border-[#d492ff]">
                            <div className="h-full bg-[#af4bef] transition-all duration-300" style={{ width: `${stats.bloodVolume}%` }} />
                          </div>
                          <span className="text-sm font-bold w-12 text-[#af4bef]">{stats.bloodVolume}%</span>
                        </div>
                        <div className="flex gap-2">
                          {!isDrawing && stats.bloodVolume < MAX_BLOOD && (
                            <button onClick={handleCollection} className="bg-[#af4bef] text-white px-6 py-3 rounded-xl font-bold">Initiate Collection</button>
                          )}
                          {isTourniquetOn && (
                             <button onClick={toggleTourniquet} className="bg-[#8380f0] text-white px-6 py-3 rounded-xl font-bold">Release Tourniquet</button>
                          )}
                          {stats.bloodVolume >= MAX_BLOOD && (
                            <button onClick={handleRemoval} className="bg-[#0c0a18] text-white px-6 py-3 rounded-xl font-bold">Withdraw Needle</button>
                          )}
                        </div>
                      </div>
                    )}

                    {stepIndex === 5 && (
                      <button onClick={finishSimulation} className="bg-[#00b894] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-[#00b894]/80">Complete Session</button>
                    )}
                  </div>
                </div>

                {/* Patient Communication */}
                <div className="h-48 bg-white rounded-2xl border border-[#d492ff] flex flex-col overflow-hidden shadow-sm">
                  <div className="p-3 border-b border-[#f1ecff] flex items-center justify-between bg-[#f7f5fb]">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#6c6880] uppercase tracking-tighter">
                      <MessageSquare size={14} className="text-[#af4bef]" />
                      Patient Communication
                    </div>
                    {isLoading && <div className="text-[10px] text-[#af4bef] font-bold animate-pulse uppercase">Patient response in progress...</div>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatHistory.map((chat, i) => (
                      <div key={i} className={`flex ${chat.role === 'trainee' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs font-medium shadow-sm ${
                          chat.role === 'trainee' ? 'bg-[#af4bef] text-white rounded-tr-none' : 'bg-[#f7f5fb] text-[#2b2b2b] border border-[#d492ff] rounded-tl-none'
                        }`}>
                          {chat.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleChatSubmit} className="p-2 border-t border-[#f1ecff] flex gap-2 bg-[#f7f5fb]">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Explain the procedure to comfort the patient..."
                      className="flex-1 bg-white border border-[#d492ff] focus:ring-2 focus:ring-[#af4bef] rounded-xl px-4 py-2 text-xs outline-none"
                    />
                    <button type="submit" disabled={isLoading} className="p-2 bg-[#af4bef] text-white rounded-xl hover:bg-[#8380f0] transition-colors">
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {gameState === 'results' && (
              <div className="m-auto w-full max-w-2xl animate-in zoom-in-95 duration-500">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-[#d492ff] overflow-y-auto max-h-[600px]">
                  <h2 className="text-3xl font-black mb-1 text-[#0c0a18]">PROFICIENCY REVIEW</h2>
                  <p className="text-[#6c6880] mb-8 font-medium">Session Evaluation Results</p>
                  
                  <div className="space-y-6 mb-8">
                    <div className="flex justify-between items-center p-4 bg-[#f7f5fb] rounded-2xl border border-[#d492ff]">
                      <div className="text-left">
                        <p className="text-xs font-bold text-[#6c6880] uppercase tracking-tighter">Clinical Technique</p>
                        <p className="text-xl font-black text-[#af4bef]">{Math.max(0, Math.round(stats.technique))}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#6c6880] uppercase tracking-tighter">Patient Comfort</p>
                        <p className="text-xl font-black text-[#e17055]">{100 - Math.round(stats.painLevel)}%</p>
                      </div>
                    </div>

                    <div className="bg-[#f1ecff] rounded-2xl p-6 border border-[#d492ff]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-[#af4bef] uppercase tracking-widest flex items-center gap-2">
                          <Stethoscope size={16} /> Clinical Performance Review
                        </h3>
                        {!performanceReview && !isLoading && (
                          <button 
                            onClick={generateReview}
                            className="text-[10px] font-bold bg-white px-3 py-1 rounded-lg border border-[#af4bef] text-[#af4bef] shadow-sm hover:bg-[#af4bef] hover:text-white transition-all uppercase"
                          >
                            Generate Review
                          </button>
                        )}
                      </div>
                      
                      {isLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3 bg-[#d492ff] rounded w-full" />
                          <div className="h-3 bg-[#d492ff] rounded w-5/6" />
                        </div>
                      ) : performanceReview ? (
                        <p className="text-xs leading-relaxed text-[#2b2b2b] font-medium whitespace-pre-wrap">
                          {performanceReview}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#6c6880] italic">Final instructor review will be available after generation.</p>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-[#0c0a18] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#af4bef] transition-all"
                  >
                    <RefreshCcw size={18} /> Restart Simulation
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Metrics */}
          <aside className="w-full md:w-72 bg-white border-l border-[#d492ff] p-6 flex flex-col gap-8">
            <div>
              <h3 className="text-[10px] font-black text-[#6c6880] uppercase tracking-widest mb-4">Live Metrics</h3>
              <ProgressBar value={100 - stats.painLevel} label="Patient Comfort" color={stats.painLevel > 50 ? "bg-[#e17055]" : "bg-[#00b894]"} />
              <ProgressBar value={stats.technique} label="Accuracy" color="bg-[#af4bef]" />
              
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#6c6880]">
                <AlertCircle size={14} className={isTourniquetOn ? "text-[#fdcb6e]" : "text-slate-300"} />
                <span className="uppercase tracking-tighter">Tourniquet: {isTourniquetOn ? <span className="text-[#fdcb6e]">Active</span> : "Inactive"}</span>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-[10px] font-black text-[#6c6880] uppercase tracking-widest mb-4">Procedure Map</h3>
              <div className="space-y-4">
                {STEPS.map((s, idx) => (
                  <div key={s.id} className={`flex items-center gap-3 transition-opacity ${stepIndex < idx ? 'opacity-30' : 'opacity-100'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      stepIndex > idx ? 'bg-[#00b894] border-[#00b894] text-white' : 
                      stepIndex === idx ? 'border-[#af4bef] text-[#af4bef]' : 'border-slate-200 text-slate-400'
                    }`}>
                      {stepIndex > idx ? <CheckCircle2 size={16} /> : s.icon}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${stepIndex === idx ? 'text-[#0c0a18]' : 'text-[#6c6880]'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#f7f5fb] rounded-2xl border border-[#d492ff]">
              <h4 className="text-[10px] font-black text-[#af4bef] uppercase mb-2">Mentor Note</h4>
              <p className="text-[11px] leading-relaxed text-[#6c6880] italic">
                {stepIndex === 0 ? "Carefully cross-reference the MRN with the patient's verbal confirmation." : 
                 stepIndex === 2 ? "Maintain hygiene by scrubbing the site from center to periphery." :
                 stepIndex === 3 ? "Target an insertion angle between 15° and 30° for venous access." :
                 "Effective bedside communication reduces patient anxiety and physiological tremors."}
              </p>
            </div>
          </aside>
        </main>
        
        {/* Footer */}
        <footer className="bg-[#f7f5fb] px-8 py-3 border-t border-[#d492ff] flex justify-between items-center text-[10px] text-[#6c6880] font-bold uppercase tracking-widest">
           <span>Med-Ed Simulation Framework</span>
           <div className="flex gap-4">
             <span className="text-[#af4bef]">Proficiency Mode</span>
             <span className="text-[#00b894]">Systems Active</span>
           </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
