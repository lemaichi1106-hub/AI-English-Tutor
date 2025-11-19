import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AppState, 
  Topic, 
  LessonContent, 
  ChatMessage, 
  AssessmentResult 
} from './types';
import { generateLessonContent, generateChatResponse, generateAssessment } from './services/gemini';
import { TopicCard } from './components/TopicCard';
import { 
  Mic, 
  MicOff, 
  Send, 
  ArrowLeft, 
  MessageSquare, 
  Award, 
  RefreshCw, 
  Volume2, 
  ChevronRight,
  Activity,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Ear,
  Sparkles
} from 'lucide-react';

// --- Constants ---
const INITIAL_TOPICS: Topic[] = [
  { id: '1', title: 'Ordering Coffee', description: 'Practice ordering drinks and snacks at a cafe.', icon: 'coffee', difficulty: 'Beginner' },
  { id: '2', title: 'Airport Check-in', description: 'Handling luggage, tickets, and security checks.', icon: 'travel', difficulty: 'Intermediate' },
  { id: '3', title: 'Job Interview', description: 'Answering common questions about yourself and experience.', icon: 'work', difficulty: 'Advanced' },
  { id: '4', title: 'Shopping for Clothes', description: 'Asking for sizes, colors, and trying things on.', icon: 'shopping', difficulty: 'Beginner' },
];

// --- Helper: Text to Speech ---
const speakText = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; 
    window.speechSynthesis.speak(utterance);
  }
};

// --- Helper: Blob to Base64 ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Main Component ---
export default function App() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Effects ---

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Initialize Speech Recognition (for text preview only)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening while recording
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            // We can handle interim results if we want a dynamic UI
            setInputText(event.results[i][0].transcript);
          }
        }
        if (finalTranscript) {
          setInputText(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        // Don't stop isListening here, as we might still be recording audio
      };
    }
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- Handlers ---

  const handleTopicSelect = async (topic: Topic) => {
    setSelectedTopic(topic);
    setIsLoading(true);
    try {
      const content = await generateLessonContent(topic.title);
      setLessonContent(content);
      setAppState(AppState.LESSON_PREVIEW);
    } catch (error) {
      alert("Failed to generate lesson content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startPractice = () => {
    setChatHistory([
      {
        id: 'init',
        role: 'model',
        text: `Hi there! I'm ready to practice "${selectedTopic?.title}". You can start whenever you're ready!`,
        timestamp: Date.now()
      }
    ]);
    setAppState(AppState.PRACTICE_CHAT);
    speakText(`Hi there! I'm ready to practice ${selectedTopic?.title}.`);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // 1. Start MediaRecorder for Audio Analysis
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setInputText(''); // Clear input for new speech

      // 2. Start SpeechRecognition for Live Text Preview (if available)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore if already started or error
          console.log("Speech recognition start failed, falling back to just recording", e);
        }
      }

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = async () => {
    setIsListening(false);

    // Stop Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop Media Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Wait for data available
      await new Promise<void>((resolve) => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => resolve();
        } else {
          resolve();
        }
      });

      const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType }); // often 'audio/webm'
      
      // If we have text from recognition, send it. 
      // Even if recognition failed, we can send audio to Gemini, but we need some placeholder text in UI.
      const textToSend = inputText.trim() || "(Voice Message)";
      handleSendMessage(textToSend, audioBlob);

      // Stop tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendMessage = async (text: string = inputText, audioBlob?: Blob) => {
    if (!text.trim()) return;

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepare Audio Data if exists
      let audioData = undefined;
      if (audioBlob) {
        const base64 = await blobToBase64(audioBlob);
        audioData = {
          base64,
          mimeType: audioBlob.type || 'audio/webm'
        };
      }

      // Create a temp history including the new message for context
      const context = [...chatHistory, newUserMsg];
      const result = await generateChatResponse(context, selectedTopic?.title || 'General', audioData);
      
      // If Gemini returned a response
      const newAiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: result.text,
        timestamp: Date.now(),
        pronunciationFeedback: result.pronunciationFeedback
      };

      setChatHistory(prev => [...prev, newAiMsg]);
      speakText(result.text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const endPractice = async () => {
    setIsLoading(true);
    try {
      const result = await generateAssessment(chatHistory, selectedTopic?.title || 'General');
      setAssessment(result);
      setAppState(AppState.ASSESSMENT);
    } catch (error) {
      alert("Could not generate assessment.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = () => {
    setAppState(AppState.HOME);
    setSelectedTopic(null);
    setLessonContent(null);
    setChatHistory([]);
    setAssessment(null);
    setInputText('');
  };

  // --- Renderers ---

  if (appState === AppState.HOME) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              Lingua<span className="text-indigo-600">Flow</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Master English conversation through AI-powered roleplay. 
              Select a topic, learn the patterns, and start speaking.
            </p>
          </header>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-500">Generating your personalized lesson...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {INITIAL_TOPICS.map(topic => (
                <TopicCard key={topic.id} topic={topic} onSelect={handleTopicSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appState === AppState.LESSON_PREVIEW && lessonContent) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="max-w-3xl mx-auto w-full p-6 flex-grow">
          <button onClick={resetApp} className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors">
            <ArrowLeft size={20} className="mr-2" /> Back to Topics
          </button>

          <h2 className="text-3xl font-bold text-slate-900 mb-2">{lessonContent.topic}</h2>
          <p className="text-indigo-600 font-medium mb-8">Lesson Overview</p>

          <div className="space-y-8">
            {/* Vocabulary Section */}
            <section>
              <h3 className="flex items-center text-xl font-semibold text-slate-800 mb-4">
                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
                  <BookOpen size={20} />
                </span>
                Key Vocabulary
              </h3>
              <div className="grid gap-4">
                {lessonContent.vocabulary.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-lg text-slate-900">{item.word}</span>
                      <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded border shadow-sm">{item.translation}</span>
                    </div>
                    <p className="text-slate-600 text-sm italic">"{item.context}"</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Patterns Section */}
            <section>
              <h3 className="flex items-center text-xl font-semibold text-slate-800 mb-4">
                <span className="bg-emerald-100 text-emerald-600 p-2 rounded-lg mr-3">
                  <Activity size={20} />
                </span>
                Sentence Patterns
              </h3>
              <div className="space-y-4">
                {lessonContent.patterns.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border-l-4 border-emerald-400">
                    <p className="font-bold text-slate-800 text-lg mb-1">{item.pattern}</p>
                    <p className="text-slate-500 text-sm mb-2">{item.translation}</p>
                    <div className="bg-white p-3 rounded-lg text-slate-700 text-sm border border-slate-200">
                      Example: {item.example}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 shadow-lg">
          <div className="max-w-3xl mx-auto">
            <button 
              onClick={startPractice}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center transition-all transform hover:-translate-y-1"
            >
              Start Practice Conversation <ChevronRight className="ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === AppState.PRACTICE_CHAT) {
    return (
      <div className="fixed inset-0 bg-slate-100 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{selectedTopic?.title}</h3>
              <p className="text-xs text-slate-500">AI Tutor</p>
            </div>
          </div>
          <button 
            onClick={endPractice}
            className="text-sm font-medium text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            End & Evaluate
          </button>
        </header>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
          {chatHistory.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
              }`}>
                <div className="text-md leading-relaxed">{msg.text}</div>
                {msg.role === 'model' && (
                  <button 
                    onClick={() => speakText(msg.text)}
                    className="mt-2 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-500 transition-colors"
                    aria-label="Speak text"
                  >
                    <Volume2 size={16} />
                  </button>
                )}
              </div>

              {/* Pronunciation Feedback Bubble */}
              {msg.role === 'model' && msg.pronunciationFeedback && (
                <div className="mt-2 max-w-[80%] md:max-w-[60%] bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start animate-pulse-ring">
                  <Ear className="text-amber-500 flex-shrink-0 mt-0.5 mr-2" size={16} />
                  <div>
                    <span className="text-xs font-bold text-amber-600 uppercase block mb-1">Pronunciation Tip</span>
                    <p className="text-sm text-amber-800 leading-snug">{msg.pronunciationFeedback}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
               <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-100">
                 <div className="flex space-x-2">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                 </div>
               </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center space-x-3">
            <button
              onClick={toggleListening}
              className={`p-4 rounded-full transition-all duration-300 flex-shrink-0 ${
                isListening 
                  ? 'bg-red-50 text-red-500 animate-pulse-ring ring-2 ring-red-500' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={isListening ? "Listening... (Speak clearly)" : "Type your message..."}
              className="flex-grow bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={isLoading}
            />
            
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-slate-400 flex items-center justify-center">
            <Sparkles size={12} className="mr-1 text-amber-400" />
            Use the microphone for instant pronunciation feedback
          </div>
        </div>
      </div>
    );
  }

  if (appState === AppState.ASSESSMENT && assessment) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Performance Review</h1>
            <button onClick={resetApp} className="bg-white text-indigo-600 px-4 py-2 rounded-lg shadow-sm font-medium border border-slate-200 hover:bg-indigo-50 transition-colors">
              Return Home
            </button>
          </header>

          {/* Scores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard title="Grammar" score={assessment.scores.grammar} color="indigo" icon={CheckCircle2} />
            <ScoreCard title="Vocabulary" score={assessment.scores.vocabulary} color="emerald" icon={BookOpen} />
            <ScoreCard title="Fluency" score={assessment.scores.fluency} color="amber" icon={Activity} />
          </div>

          {/* Main Feedback */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
              <Award className="text-indigo-500 mr-2" /> Tutor's Feedback
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              {assessment.overallComment}
            </p>
            <div className="bg-indigo-50 p-4 rounded-lg text-indigo-800 text-sm">
              <strong>Tip:</strong> {assessment.feedback}
            </div>
          </div>

          {/* Corrections */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <AlertCircle className="text-orange-500 mr-2" /> Detailed Corrections
            </h3>
            
            {assessment.corrections.length > 0 ? (
              <div className="space-y-6">
                {assessment.corrections.map((item, idx) => (
                  <div key={idx} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start">
                          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded mr-2 mt-0.5">YOU</span>
                          <p className="text-slate-500 line-through">{item.original}</p>
                        </div>
                        <div className="flex items-start">
                          <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded mr-2 mt-0.5">BETTER</span>
                          <p className="text-slate-800 font-medium">{item.correction}</p>
                        </div>
                      </div>
                      <div className="md:w-1/3 bg-slate-50 p-3 rounded-lg text-sm text-slate-600">
                        <span className="block font-semibold text-slate-400 text-xs uppercase mb-1">Reason</span>
                        {item.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle2 size={48} className="mx-auto text-green-500 mb-2" />
                <p>Great job! No major errors detected in this session.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center pt-8">
            <button 
              onClick={() => handleTopicSelect(selectedTopic!)} 
              className="flex items-center bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 shadow-lg transition-transform hover:scale-105"
            >
              <RefreshCw className="mr-2" size={20} /> Practice Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// --- Subcomponents ---

const ScoreCard = ({ title, score, color, icon: Icon }: any) => {
  const getColor = (c: string) => {
    switch(c) {
      case 'indigo': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'emerald': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'amber': return 'text-amber-600 bg-amber-50 border-amber-100';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between ${getColor(color)}`}>
      <div>
        <p className="text-sm font-semibold opacity-80 mb-1">{title}</p>
        <p className="text-4xl font-bold tracking-tighter">{score}</p>
      </div>
      <Icon size={40} className="opacity-20" />
    </div>
  );
};