import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Copy, Info, Trash2, CheckCircle2 } from 'lucide-react';
import Button from './ui/Button';
import { rewriteMessage } from '../services/measuredWordsService';

const PRESETS = [
  { id: 'diplomatic', label: { en: 'Diplomatic', no: 'Diplomatisk' }, tip: { en: 'Frame disagreement as shared concern. Never disagree — instead "note certain complexities."', no: 'Ram inn uenighet som felles bekymring. Si aldri nei — bemerk heller "visse kompleksiteter."' } },
  { id: 'bureaucratic', label: { en: 'Bureaucratic', no: 'Byråkratisk' }, tip: { en: 'Root everything in process, policy, precedent. Passive voice. Institutional actors, not individuals.', no: 'Forankre alt i prosess, retningslinjer og presedens. Passiv form. Institusjonelle aktører, ikke enkeltpersoner.' } },
  { id: 'deferential', label: { en: 'Deferential', no: 'Underdanig' }, tip: { en: 'Express enormous respect for the recipient\'s wisdom while gently steering toward a different conclusion.', no: 'Uttrykk enorm respekt for mottakerens visdom mens du forsiktig styrer mot en annen konklusjon.' } },
  { id: 'corrective', label: { en: 'Corrective', no: 'Korrigerende' }, tip: { en: 'Correct the other party without appearing to correct them. Suggest they may have "overlooked" something.', no: 'Korriger den andre parten uten å virke belærende. Antyd at de kan ha "oversått" noe.' } },
  { id: 'evasive', label: { en: 'Evasive', no: 'Unnvikende' }, tip: { en: 'Acknowledge concern while committing to nothing. Promise "further consideration" and "appropriate channels."', no: 'Anerkjenn bekymringen uten å forplikte deg til noe. Lov "videre overveielse" og "relevante kanaler."' } },
  { id: 'urquhart', label: { en: 'Urquhart', no: 'Urquhart' }, tip: { en: 'Never state anything directly. Plant the idea through implication and rhetorical questions. Complete plausible deniability.', no: 'Si aldri noe direkte. Plant ideen gjennom antydninger og retoriske spørsmål. Fullstendig plausibel benektelse.' } },
];

const LEN_LABELS = {
  en: ['Terse', 'Concise', 'Medium', 'Expansive', 'Exhaustive'],
  no: ['Kortfattet', 'Konsis', 'Middels', 'Utdypende', 'Uttømmende']
};

export default function MeasuredWords() {
  const [lang, setLang] = useState<'en' | 'no'>('en');
  const [preset, setPreset] = useState('diplomatic');
  const [humphreyLvl, setHumphreyLvl] = useState(3);
  const [lengthLvl, setLengthLvl] = useState(3);
  const [formalityLvl, setFormalityLvl] = useState(3);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [showLevelGuide, setShowLevelGuide] = useState(false);
  const [showLengthGuide, setShowLengthGuide] = useState(false);
  const [showFormalityGuide, setShowFormalityGuide] = useState(false);

  const handleRewrite = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const result = await rewriteMessage(inputText, preset, humphreyLvl, lengthLvl, formalityLvl, lang);
      setOutputText(result);
    } catch (error) {
      console.error('Rewrite failed:', error);
      setOutputText(lang === 'no' ? 'En uheldig teknisk omstendighet har oppstått.' : 'A regrettable technical circumstance has intervened.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 bg-paper rounded-[48px] border border-ink/5 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-2 border-ink rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-ink rounded-full" />
          </div>
          <h2 className="text-xl font-serif tracking-tight uppercase">Measured Words</h2>
        </div>
        <div className="flex bg-ink/5 p-1 rounded-xl">
          <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${lang === 'en' ? 'bg-white shadow-sm' : 'text-ink/40 hover:text-ink'}`}>EN</button>
          <button onClick={() => setLang('no')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${lang === 'no' ? 'bg-white shadow-sm' : 'text-ink/40 hover:text-ink'}`}>NO</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-4 block">
              {lang === 'no' ? 'Tonefall' : 'Tone'}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <div 
                  key={p.id} 
                  className="relative"
                  onMouseEnter={() => setHoveredPreset(p.id)}
                  onMouseLeave={() => setHoveredPreset(null)}
                >
                  <button
                    onClick={() => setPreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${preset === p.id ? 'bg-ink text-white border-ink' : 'bg-white border-ink/10 text-ink/60 hover:border-ink/30'}`}
                  >
                    {p.label[lang]}
                  </button>
                  <AnimatePresence>
                    {hoveredPreset === p.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute bottom-full left-0 z-[150] pb-2 pointer-events-none w-64"
                      >
                        <div className="bg-ink text-white text-[10px] p-4 rounded-2xl shadow-2xl border border-white/10">
                          <div className="font-bold mb-1 border-b border-white/10 pb-1 text-accent uppercase tracking-widest">{p.label[lang]}</div>
                          <p className="leading-relaxed opacity-90">{p.tip[lang]}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold flex items-center gap-2">
                {preset === 'urquhart' ? (lang === 'no' ? '🗡️ Mer Urquhart' : '🗡️ More Urquhart') : (lang === 'no' ? '🎩 Mer Humphrey' : '🎩 More Humphrey')}
                <div 
                  className="relative flex items-center"
                  onMouseEnter={() => setShowLevelGuide(true)}
                  onMouseLeave={() => setShowLevelGuide(false)}
                >
                  <div className="w-5 h-5 rounded-full bg-ink/10 flex items-center justify-center hover:bg-accent/20 transition-all cursor-pointer ring-2 ring-transparent hover:ring-accent/30 group">
                    <Info size={12} className="text-ink/60 group-hover:text-accent transition-colors" />
                  </div>
                  <AnimatePresence>
                    {showLevelGuide && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-3 w-72 pointer-events-none z-[150]"
                      >
                        <div className="bg-ink text-white text-[11px] p-5 rounded-2xl shadow-2xl border border-white/10 space-y-3 leading-relaxed">
                          {lang === 'no' ? (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Nivåguide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Mild: Knapt mer polert enn originalen</p>
                              <p><strong className="text-accent">2</strong> — Polert: Forsiktig og profesjonelt behersket</p>
                              <p><strong className="text-accent">3</strong> — Klassisk: Elegant omskriving og forbehold</p>
                              <p><strong className="text-accent">4</strong> — Utdypende: Ordrik med institusjonell tyngde</p>
                              <p><strong className="text-accent">5</strong> — Maksimum: Et mesterverk av byråkratisk omstendighet</p>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Level Guide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Mild: barely more polished than the original</p>
                              <p><strong className="text-accent">2</strong> — Polished: careful and professionally restrained</p>
                              <p><strong className="text-accent">3</strong> — Classic: graceful indirection and elegant qualification</p>
                              <p><strong className="text-accent">4</strong> — Elaborate: verbose, multi-clause, institutional gravitas</p>
                              <p><strong className="text-accent">5</strong> — Maximum: a tour de force of bureaucratic circumlocution</p>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </label>
              <span className="text-[12px] font-mono font-bold text-ink/40">{humphreyLvl}</span>
            </div>
            <input 
              type="range" min="1" max="5" value={humphreyLvl} 
              onChange={e => setHumphreyLvl(Number(e.target.value))}
              className="w-full h-1.5 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold flex items-center gap-2">
                {lang === 'no' ? '📏 Lengde' : '📏 Length'}
                <div 
                  className="relative flex items-center"
                  onMouseEnter={() => setShowLengthGuide(true)}
                  onMouseLeave={() => setShowLengthGuide(false)}
                >
                  <div className="w-5 h-5 rounded-full bg-ink/10 flex items-center justify-center hover:bg-accent/20 transition-all cursor-pointer ring-2 ring-transparent hover:ring-accent/30 group">
                    <Info size={12} className="text-ink/60 group-hover:text-accent transition-colors" />
                  </div>
                  <AnimatePresence>
                    {showLengthGuide && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-3 w-72 pointer-events-none z-[150]"
                      >
                        <div className="bg-ink text-white text-[11px] p-5 rounded-2xl shadow-2xl border border-white/10 space-y-3 leading-relaxed"
                        >
                          {lang === 'no' ? (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Lengdeguide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Kortfattet: Én til to setninger</p>
                              <p><strong className="text-accent">2</strong> — Konsis: Et kort avsnitt</p>
                              <p><strong className="text-accent">3</strong> — Middels: Omtrent samme lengde som originalen</p>
                              <p><strong className="text-accent">4</strong> — Utdypende: Mer utfyllende omskrivinger</p>
                              <p><strong className="text-accent">5</strong> — Uttømmende: Grundig behandling over flere avsnitt</p>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Length Guide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Terse: One or two sentences maximum</p>
                              <p><strong className="text-accent">2</strong> — Concise: A short paragraph</p>
                              <p><strong className="text-accent">3</strong> — Medium: Roughly matching original length</p>
                              <p><strong className="text-accent">4</strong> — Expansive: More elaborate circumlocution</p>
                              <p><strong className="text-accent">5</strong> — Exhaustive: Multi-paragraph treatment</p>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest text-accent font-bold">{LEN_LABELS[lang][lengthLvl-1]}</span>
                <span className="text-[12px] font-mono font-bold text-ink/40">{lengthLvl}</span>
              </div>
            </div>
            <input 
              type="range" min="1" max="5" value={lengthLvl} 
              onChange={e => setLengthLvl(Number(e.target.value))}
              className="w-full h-1.5 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest text-ink/40 font-bold flex items-center gap-2">
                {lang === 'no' ? '🎩 Formalitet' : '🎩 Formality'}
                <div 
                  className="relative flex items-center"
                  onMouseEnter={() => setShowFormalityGuide(true)}
                  onMouseLeave={() => setShowFormalityGuide(false)}
                >
                  <div className="w-5 h-5 rounded-full bg-ink/10 flex items-center justify-center hover:bg-accent/20 transition-all cursor-pointer ring-2 ring-transparent hover:ring-accent/30 group">
                    <Info size={12} className="text-ink/60 group-hover:text-accent transition-colors" />
                  </div>
                  <AnimatePresence>
                    {showFormalityGuide && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-3 w-72 pointer-events-none z-[150]"
                      >
                        <div className="bg-ink text-white text-[11px] p-5 rounded-2xl shadow-2xl border border-white/10 space-y-3 leading-relaxed">
                          {lang === 'no' ? (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Formalitetsguide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Avslappet profesjonell: Direkte og tydelig, men høflig.</p>
                              <p><strong className="text-accent">2</strong> — Standard forretning: Profesjonell og høflig.</p>
                              <p><strong className="text-accent">3</strong> — Formell: Elegant og respektfull.</p>
                              <p><strong className="text-accent">4</strong> — Svært formell: Sofistikert og veloverveid.</p>
                              <p><strong className="text-accent">5</strong> — Ekstremt formell: Et høydepunkt av institusjonell tyngde.</p>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-1">
                                <span className="font-bold uppercase tracking-widest text-accent">Formality Guide</span>
                                <span className="text-[10px] opacity-50">1-5</span>
                              </div>
                              <p><strong className="text-accent">1</strong> — Casual professional: Direct and clear but polite.</p>
                              <p><strong className="text-accent">2</strong> — Standard business: Professional and courteous.</p>
                              <p><strong className="text-accent">3</strong> — Formal: Elegant, structured, and respectful.</p>
                              <p><strong className="text-accent">4</strong> — Highly formal: Sophisticated and very deliberate.</p>
                              <p><strong className="text-accent">5</strong> — Extremely formal: A peak of institutional gravity.</p>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </label>
              <span className="text-[12px] font-mono font-bold text-ink/40">{formalityLvl}</span>
            </div>
            <input 
              type="range" min="1" max="5" value={formalityLvl} 
              onChange={e => setFormalityLvl(Number(e.target.value))}
              className="w-full h-1.5 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-ink/5 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink/5 pb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">
                {lang === 'no' ? 'Opprinnelig melding' : 'Original Message'}
              </h3>
              <span className="text-[10px] font-mono text-ink/20">{inputText.length} chars</span>
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="w-full bg-transparent outline-none text-sm leading-relaxed min-h-[140px] resize-none pb-4"
              placeholder={lang === 'no' ? 'Lim inn din ærlige kladd her...' : 'Paste your unfiltered draft here...'}
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleRewrite} 
                disabled={isLoading || inputText.length < 5} 
                className="flex-1 rounded-2xl"
                icon={isLoading ? undefined : RefreshCcw}
              >
                {isLoading ? (lang === 'no' ? 'Kalibrerer...' : 'Calibrating...') : (lang === 'no' ? 'Omskriv' : 'Rewrite')}
              </Button>
              <Button 
                onClick={() => setInputText('')} 
                variant="ghost" 
                className="rounded-2xl px-6"
                icon={Trash2}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-paper border border-ink/5 p-10 rounded-[32px] overflow-hidden relative">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-widest text-ink/40 font-bold">
            {lang === 'no' ? 'Bearbeidet resultat' : 'Refined Output'}
          </h3>
          {outputText && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleCopy}
              className={`rounded-xl transition-all ${copied ? 'text-emerald-500' : 'text-ink/40 hover:text-ink'}`}
              icon={copied ? CheckCircle2 : Copy}
            >
              {copied ? (lang === 'no' ? 'Kopiert' : 'Copied') : (lang === 'no' ? 'Kopier' : 'Copy')}
            </Button>
          )}
        </div>
        
        <div className="min-h-[120px] relative text-lg font-serif italic text-ink leading-relaxed">
          <AnimatePresence mode="wait">
            {!outputText && !isLoading && (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center opacity-10 uppercase tracking-[0.2em] pointer-events-none"
              >
                {lang === 'no' ? 'Venter på kladd' : 'Awaiting draft'}
              </motion.div>
            )}
            {isLoading && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-6"
              >
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-accent rounded-full"
                    />
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-ink/40 font-bold italic">
                  {lang === 'no' ? 'Formulerer med institusjonell forsiktighet...' : 'Drafting with circumspection...'}
                </span>
              </motion.div>
            )}
            {outputText && !isLoading && (
              <motion.p 
                key="output"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="whitespace-pre-wrap"
              >
                {outputText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
