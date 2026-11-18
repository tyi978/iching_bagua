/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  ScrollText, 
  RefreshCw, 
  Cpu, 
  Hand, 
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { BINARY_TO_NAME, ICHING_DATA, HexagramData } from './lib/iching';
import { GuaTableDetailView } from './components/GuaTableDetailView';
import { ZhouyiFullCommentary } from './components/ZhouyiFullCommentary';

type DivinationMode = 'auto' | 'manual';
type ManualStep = 'init' | 'divide' | 'man' | 'count_left' | 'count_right' | 'collect';

interface GuaDetails {
  name: string;
  guaCi: string;
  tuanZhuan: string;
  daXiang: string;
  yaoDetails: { yaoCi: string; xiaoXiang: string }[];
}

interface DivinationState {
  mode: DivinationMode;
  results: number[]; // 6, 7, 8, 9 for each line (bottom to top)
  question: string;
  interpretationJson: {
    benGuaDetails: GuaDetails;
    zhiGuaDetails: GuaDetails;
    interpretation: string;
    aphorism: string;
  } | null;
  interpretation: string;
  isInterpreting: boolean;
}

interface StalkState {
  total: number;
  left: number;
  right: number;
  man: number;
  remainders: number[]; // from 3 changes
  changeCount: number; // 0, 1, 2
  currentStep: ManualStep;
  removedThisLine: number;
  lineResult: number | null;
}

const INITIAL_STALKS = 49;

// --- Visual Stalk Logic ---
interface StalkData {
  id: number;
  x: number;
  y: number;
  rotation: number;
  status: 'center' | 'left' | 'right' | 'man' | 'remainder_left' | 'remainder_right' | 'removed' | 'counted_left' | 'counted_right';
}

const StalkVisualizer = ({ 
  stalks, 
  onNextStep 
}: { 
  stalks: StalkState; 
  onNextStep: (x?: number) => void 
}) => {
  const [stalkData, setStalkData] = useState<StalkData[]>([]);
  
  const dimensions = { width: 800, height: 500 };

  useEffect(() => {
    if (stalks.changeCount === 0 && (stalks.currentStep === 'divide' || stalks.currentStep === 'init')) {
      const lineStart = 100;
      const lineEnd = 700;
      const lineStep = (lineEnd - lineStart) / (INITIAL_STALKS - 1);
      
      const newStalks: StalkData[] = Array.from({ length: INITIAL_STALKS }, (_, i) => ({
        id: i,
        x: lineStart + i * lineStep,
        y: 350 + (i % 2 * 15),
        rotation: 0,
        status: 'center'
      }));
      setStalkData(newStalks);
    }
  }, [stalks.changeCount, stalks.currentStep === 'init']);

  useEffect(() => {
    setStalkData(prev => {
      if (prev.length === 0) return prev;
      const { width, height } = dimensions;
      
      // Pre-calculate active list for the 'divide' and 'man' steps
      const activeStalks = prev.filter(s => s.status !== 'removed').sort((a,b) => a.id - b.id);
      
      // Pre-calculate line info for 'divide' step
      const lineStart = 100;
      const lineEnd = 700;
      const n = activeStalks.length;
      const lineStep = n > 1 ? (lineEnd - lineStart) / (n - 1) : 0;

      return prev.map(s => {
        if (s.status === 'removed') return s;

        if (stalks.currentStep === 'divide') {
           // Arrange counted ones back into a line for the next division
           const activeIdx = activeStalks.findIndex(idx => idx.id === s.id);
           if (activeIdx !== -1) {
              return {
                 ...s,
                 status: 'center',
                 x: lineStart + activeIdx * lineStep,
                 y: 350 + (activeIdx % 2 * 15),
                 rotation: 0
              };
           }
        }

        if (stalks.currentStep === 'man' && s.status === 'center') {
          const activeIdx = activeStalks.findIndex(idx => idx.id === s.id);
          if (activeIdx === -1) return s;

          const isLeft = activeIdx < stalks.left;
          return { 
            ...s, 
            status: isLeft ? 'left' : 'right',
            x: isLeft ? 100 + Math.random() * 200 : 500 + Math.random() * 200,
            y: 320 + Math.random() * 80,
            rotation: isLeft ? -15 + Math.random() * 30 : 15 + Math.random() * 30
          };
        }
        
        if (stalks.currentStep === 'count_left' && s.status === 'right') {
           const currentRightStalks = prev.filter(x => x.status === 'right').sort((a,b) => a.id - b.id);
           if (currentRightStalks.length > 0 && s.id === currentRightStalks[0].id) {
             return { ...s, status: 'man', x: 400, y: 245, rotation: 90 };
           }
        }

        if (stalks.currentStep === 'count_right') {
          if (s.status === 'left') {
            const remLeft = stalks.left % 4 || 4;
            const leftStalks = prev.filter(x => x.status === 'left').sort((a,b) => a.id - b.id);
            const indexInLeft = leftStalks.findIndex(x => x.id === s.id);
            
            if (indexInLeft !== -1) {
              if (indexInLeft < stalks.left - remLeft) {
                const groupIdx = Math.floor(indexInLeft / 4);
                const idxInGroup = indexInLeft % 4;
                return { 
                   ...s, 
                  status: 'counted_left', 
                  x: 120 + groupIdx * 35 + idxInGroup * 4, 
                  y: 350 + idxInGroup * 2,
                  rotation: -10 + idxInGroup * 5
                };
              } else {
                 // Left remainder moves to "Ren" area temporarily
                 return { ...s, status: 'remainder_left', x: 340 + (indexInLeft - (stalks.left - remLeft)) * 12, y: 245, rotation: 10 };
              }
            }
          }
          if (s.status === 'right') {
            const remRight = stalks.right % 4 || 4;
            const rightStalks = prev.filter(x => x.status === 'right').sort((a,b) => a.id - b.id);
            const indexInRight = rightStalks.findIndex(x => x.id === s.id);
 
            if (indexInRight !== -1) {
              if (indexInRight < stalks.right - remRight) {
                 const groupIdx = Math.floor(indexInRight / 4);
                 const idxInGroup = indexInRight % 4;
                 return { 
                   ...s, 
                   status: 'counted_right', 
                   x: 480 + groupIdx * 35 + idxInGroup * 4, 
                   y: 350 + idxInGroup * 2,
                   rotation: -10 + idxInGroup * 5
                 };
              } else {
                 // Right remainder moves to "Ren" area temporarily
                 return { ...s, status: 'remainder_right', x: 440 + (indexInRight - (stalks.right - remRight)) * 12, y: 245, rotation: -10 };
              }
            }
          }
        }

        if (stalks.currentStep === 'collect') {
          const movingToBox = prev.filter(x => 
            x.status === 'man' || 
            x.status === 'remainder_left' ||
            x.status === 'remainder_right'
          ).sort((a, b) => a.id - b.id);

          const indexInMoving = movingToBox.findIndex(m => m.id === s.id);

          if (indexInMoving !== -1) {
            const boxIdx = prev.filter(x => x.status === 'removed').length + indexInMoving;
            const COLUMNS = 10;
            const SPACING_X = 18;
            const SPACING_Y = 20; 
            return { 
              ...s, 
              status: 'removed', 
              x: 320 + (boxIdx % COLUMNS) * SPACING_X, 
              y: 80 + Math.floor(boxIdx / COLUMNS) * SPACING_Y, 
              rotation: 15
            };
          }
        }

        // Handling of count_left, count_right, collect etc. remains same...
        // Just need to remove the duplicate 'divide' block below if it exists
        return s;
      });
    });
  }, [stalks.currentStep, stalks.left, stalks.right]);



  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [previewX, setPreviewX] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stalks.currentStep !== 'divide') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // We allow clicks in the general area during division
    setDragStart({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stalks.currentStep !== 'divide') {
      if (previewX !== null) setPreviewX(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Show preview if reasonably within the active area
    // Let's use the actual container width for reference
    if (x >= 0 && x <= rect.width && y >= 50 && y <= rect.height - 20) {
      setPreviewX(x);
    } else {
      setPreviewX(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Normalize X based on the actual rendered width
    const relativePos = Math.max(0, Math.min(1, x / rect.width));
    
    onNextStep(relativePos);
    setDragStart(null);
    setPreviewX(null);
  };

  return (
    <div 
      className="stalk-bundle shadow-inner cursor-pointer touch-none max-w-[800px] mx-auto overflow-hidden" 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { setPreviewX(null); }}
    >
      {/* Taiji Container */}
      <div className="taiji-frame absolute top-2.5 sm:top-4 left-1/2 -translate-x-1/2 w-[42%] sm:w-[30%] h-[9%] sm:h-[8%] border border-dashed border-crimson/25 rounded-full flex items-center justify-center gap-2 sm:gap-4 z-30 pointer-events-none">
        <div className="stalk-fixed-inner" title="大衍之数五十，其用四十有九" />
        <div className="text-[10px] font-bold text-crimson tracking-widest whitespace-nowrap">太极</div>
      </div>
      
      {/* The Working Frame (Tian, Ren, Di) */}
      <div className="working-frame">
          <div className="frame-label top-1.5 sm:top-2 left-2.5 sm:left-3">天</div>
          <div className="frame-label top-1.5 sm:top-2 right-2.5 sm:right-3">地</div>
          <div className="frame-label top-1.5 sm:top-2 left-1/2 -translate-x-1/2">人</div>
      </div>

      {previewX !== null && stalks.currentStep === 'divide' && (
        <div 
          className="absolute top-[42%] bottom-[5%] border-l-2 border-emerald-500/50 border-dashed z-30 pointer-events-none"
          style={{ left: previewX }}
        />
      )}

      {/* Used Stalks Zone (The Storage Box) - "Le" box below Taiji */}
      <div className="absolute top-[13%] sm:top-[12%] left-1/2 -translate-x-1/2 w-[72%] sm:w-[60%] h-[24%] bg-stone-100/40 rounded-2xl sm:rounded-[2rem] border border-dashed border-stone-300 pointer-events-none z-0">
        <div className="absolute top-1.5 sm:top-2 left-0 right-0 text-center">
          <div className="text-[9px] font-bold text-stone-400 tracking-[0.15em] sm:tracking-[0.2em]">「扐」置物盒</div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-15">
           <div className="text-3xl sm:text-6xl font-serif text-stone-400 tabular-nums">{stalks.removedThisLine || ""}</div>
        </div>
      </div>

      <AnimatePresence>
        {stalkData.map(s => (
          <motion.div
            key={s.id}
            className="stalk"
            initial={false}
            animate={{ 
              left: `${(s.x / 800) * 100}%`, 
              top: `${(s.y / 500) * 100}%`, 
              rotate: s.rotation,
              opacity: s.status === 'removed' ? 0.6 : 1,
              scale: s.status === 'removed' ? 0.65 : 1
            }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// --- Zhu Xi Interpretation Rules ---
interface ZhuXiFocus {
  rule: string;
  highlights: {
    ben: (number | string)[];
    zhi: (number | string)[];
  };
  primary?: number;
}

const getZhuXiFocus = (results: number[], guaName: string): ZhuXiFocus => {
  const movingIndices = results.map((r, i) => (r === 6 || r === 9 ? i : -1)).filter(i => i !== -1);
  const staticIndices = results.map((r, i) => (r === 7 || r === 8 ? i : -1)).filter(i => i !== -1);
  const count = movingIndices.length;

  switch (count) {
    case 0:
      return { 
        rule: "凡卦六爻皆不变，则占本卦彖辞。",
        highlights: { ben: ['tuan'], zhi: [] }
      };
    case 1:
      return { 
        rule: "一爻变，则占本卦变爻之辞。",
        highlights: { ben: [movingIndices[0]], zhi: [] }
      };
    case 2:
      return { 
        rule: "二爻变，则占本卦二变之爻，而以下爻为主。",
        highlights: { ben: [movingIndices[0], movingIndices[1]], zhi: [] },
        primary: movingIndices[0]
      };
    case 3:
      return { 
        rule: "三爻变，则占本卦及之卦之彖辞，而以本卦为贞，之卦为悔。",
        highlights: { ben: ['tuan'], zhi: ['tuan'] }
      };
    case 4:
      return { 
        rule: "四爻变，则占之卦二静爻，而以上爻为主。",
        highlights: { ben: [], zhi: [staticIndices[0], staticIndices[1]] },
        primary: staticIndices[1]
      };
    case 5:
      return { 
        rule: "五爻变，则占之卦一静爻之辞。",
        highlights: { ben: [], zhi: [staticIndices[0]] }
      };
    case 6:
      if (guaName === "干" || guaName === "坤") {
        return { 
          rule: "六爻皆变，干、坤占二用。",
          highlights: { ben: [6], zhi: [] }
        };
      }
      return { 
        rule: "六爻皆变，占之卦彖辞。",
        highlights: { ben: [], zhi: ['tuan'] }
      };
    default:
      return { rule: "", highlights: { ben: [], zhi: [] } };
  }
};

const InterpretationGuide = ({ count }: { count: number }) => {
  const [expandedMobile, setExpandedMobile] = useState(false);

  const rules = [
    { n: 0, text: "凡卦六爻皆不变，则占本卦彖辞，而以内卦为贞，外卦为悔。" },
    { n: 1, text: "一爻变，则占本卦变爻之辞。" },
    { n: 2, text: "二爻变，则占本卦二变之爻，而以下爻为主。" },
    { n: 3, text: "三爻变，则占本卦及之卦之彖辞，而以本卦为贞，之卦为悔。前十卦主贞，后十卦主悔。" },
    { n: 4, text: "四爻变，则占之卦二静爻，而以上爻为主。" },
    { n: 5, text: "五爻变，则占之卦一静爻之辞。" },
    { n: 6, text: "六爻皆变，则乾、坤占二用，余卦占之卦彖辞。" },
  ];

  const activeRule = rules.find(r => r.n === count);

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-5">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 shrink-0" />
          <h4 className="text-xs sm:text-sm font-bold text-stone-700 tracking-wider">朱熹《易学启蒙》占断规则</h4>
        </div>
        <button
          type="button"
          onClick={() => setExpandedMobile(v => !v)}
          className="md:hidden inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-ink min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-stone-200 whitespace-nowrap shrink-0"
        >
          <span>{expandedMobile ? '收起规则' : '全部规则'}</span>
          {expandedMobile ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Mobile: concise active rule unless expanded */}
      {!expandedMobile && activeRule && (
        <div className="md:hidden flex items-start gap-2.5 text-sm leading-relaxed text-ink font-medium bg-white p-3.5 rounded-xl border border-stone-200/80">
          <span className="inline-flex w-6 h-6 shrink-0 rounded-full border border-crimson text-crimson text-xs items-center justify-center tabular-nums mt-0.5">
            {activeRule.n}
          </span>
          <div>
            <span>{activeRule.text}</span>
            <span className="ml-2 text-xs text-crimson font-semibold whitespace-nowrap">当前符合</span>
          </div>
        </div>
      )}

      {/* Desktop always visible, Mobile when expanded */}
      <div className={`${expandedMobile ? 'block' : 'hidden'} md:block space-y-2.5 sm:space-y-3`}>
        {rules.map((r) => (
          <div
            key={r.n}
            className={`flex items-start gap-3 text-xs sm:text-sm leading-relaxed transition-opacity ${
              count === r.n ? 'text-ink font-medium' : 'text-stone-400'
            }`}
          >
            <span className="inline-flex w-6 h-6 shrink-0 rounded-full border border-current text-[11px] items-center justify-center tabular-nums mt-0.5">
              {r.n}
            </span>
            <div className="flex-1">
              <span>{r.text}</span>
              {count === r.n && (
                <span className="ml-2 text-xs text-crimson font-semibold whitespace-nowrap">◀ 当前符合</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<DivinationState>({
    mode: 'auto',
    results: [],
    question: '',
    interpretationJson: null,
    interpretation: '',
    isInterpreting: false,
  });

  const [stalks, setStalks] = useState<StalkState>({
    total: INITIAL_STALKS,
    left: 0,
    right: 0,
    man: 0,
    remainders: [],
    changeCount: 0,
    currentStep: 'init',
    removedThisLine: 0,
    lineResult: null
  });

  const currentLineIndex = state.results.length;
  // Use changeCount to determine if we are showing a completed line's summary
  const isShowingFinishedLine = stalks.currentStep === 'init' && stalks.changeCount === 2 && currentLineIndex > 0;
  
  const displayLineIndex = isShowingFinishedLine ? currentLineIndex - 1 : currentLineIndex;
  const displayChangeCount = isShowingFinishedLine ? 3 : stalks.changeCount + 1;

  // Record a finished line
  const recordLineResult = useCallback((result: number) => {
    setState(prev => {
      if (prev.results.length >= 6) return prev;
      return {
        ...prev,
        results: [...prev.results, result]
      };
    });
    // Reset stalks for next line after a delay if user hasn't clicked already
    setTimeout(() => {
      setStalks(prev => {
        if (prev.currentStep !== 'init' || prev.changeCount !== 2) return prev;
        return {
          total: INITIAL_STALKS,
          left: 0,
          right: 0,
          man: 0,
          remainders: [],
          changeCount: 0,
          currentStep: 'divide',
          removedThisLine: 0,
          lineResult: null
        };
      });
    }, 2000);
  }, []);

  // Use useEffect to handle line completion side effects safely
  useEffect(() => {
    if (stalks.lineResult !== null) {
      recordLineResult(stalks.lineResult);
      // Clear lineResult in stalk state so we don't trigger again
      setStalks(prev => ({ ...prev, lineResult: null }));
    }
  }, [stalks.lineResult, recordLineResult]);

  const resetManualLine = useCallback(() => {
    setStalks({
      total: INITIAL_STALKS,
      left: 0,
      right: 0,
      man: 0,
      remainders: [],
      changeCount: 0,
      currentStep: 'divide',
      removedThisLine: 0,
      lineResult: null
    });
  }, []);

  const handleManualStep = useCallback((relativePos?: number) => {
    setStalks(prev => {
      // If we already have a result being processed, ignore clicks
      if (prev.lineResult !== null) return prev;

      switch (prev.currentStep) {
        case 'init':
          return { 
            total: INITIAL_STALKS,
            left: 0,
            right: 0,
            man: 0,
            remainders: [],
            changeCount: 0,
            currentStep: 'divide',
            removedThisLine: 0,
            lineResult: null
          };
        case 'divide':
          let left;
          if (relativePos !== undefined) {
            // relativePos is 0..1 across 800px
            const x = relativePos * 800;
            
            // Layout range was 100 to 700
            const lineStart = 100;
            const lineEnd = 700;
            
            if (x <= lineStart + 20) {
               // Far left click
               left = 1;
            } else if (x >= lineEnd - 20) {
               // Far right click
               left = prev.total - 1;
            } else {
               // Proportional mapping in the middle
               const range = lineEnd - lineStart;
               const pos = (x - lineStart) / range;
               // Map 0..1 to 1..total-1 using floor to make it intuitive
               left = Math.floor(pos * (prev.total - 1)) + 1;
            }
            
            // Final safety clamp to [1, total - 1]
            if (left >= prev.total) left = prev.total - 1;
            if (left < 1) left = 1;
          } else {
            left = Math.floor(Math.random() * (prev.total - 2)) + 1;
          }
          return { ...prev, left, right: prev.total - left, currentStep: 'man' };
        case 'man':
          return { ...prev, man: 1, right: prev.right - 1, currentStep: 'count_left' };
        case 'count_left':
          const remLeft = prev.left % 4 || 4;
          return { ...prev, currentStep: 'count_right', remainders: [...prev.remainders, remLeft] };
        case 'count_right':
          const remRight = prev.right % 4 || 4;
          return { ...prev, currentStep: 'collect', remainders: [...prev.remainders, remRight] };
        case 'collect':
          const changeRemainder = prev.man + prev.remainders[prev.remainders.length - 2] + prev.remainders[prev.remainders.length - 1];
          const newRemoved = prev.removedThisLine + changeRemainder;
          
          if (prev.changeCount < 2) {
            // Not final change, move to next change
            return {
              ...prev,
              total: prev.total - changeRemainder,
              left: 0,
              right: 0,
              man: 0,
              remainders: [],
              changeCount: prev.changeCount + 1,
              currentStep: 'divide',
              removedThisLine: newRemoved
            };
          } else {
            // Final change: Calculate result
            const finalTotal = prev.total - changeRemainder;
            const lineResult = finalTotal / 4;
            return { 
              ...prev, 
              currentStep: 'init', 
              removedThisLine: newRemoved,
              lineResult: lineResult 
            };
          }
        default:
          return prev;
      }
    });
  }, [recordLineResult]);

  // Auto-progress through changes once divided
  useEffect(() => {
    if (state.mode === 'manual' && stalks.currentStep !== 'divide' && stalks.currentStep !== 'init') {
      const timer = setTimeout(handleManualStep, 1000);
      return () => clearTimeout(timer);
    }
  }, [stalks.currentStep, handleManualStep, state.mode]);

  // --- Auto Mode Logic ---
  const handleAutoDivination = () => {
    const results = Array.from({ length: 6 }, () => {
      const r = Math.random();
      if (r < 0.0625) return 6;
      if (r < 0.375) return 7;
      if (r < 0.8125) return 8;
      return 9;
    });
    setState(s => ({ ...s, results }));
  };

  const getInterpretation = async () => {
    if (state.results.length < 6) return;
    
    setState(s => ({ ...s, isInterpreting: true }));
    
    const benBinary = state.results.map(r => (r === 7 || r === 9 ? '1' : '0')).join('');
    const zhiBinary = state.results.map(r => {
      if (r === 6) return '1';
      if (r === 9) return '0';
      return (r === 7 ? '1' : '0');
    }).join('');

    const benName = BINARY_TO_NAME[benBinary] || "未知卦";
    const zhiName = benBinary === zhiBinary ? benName : (BINARY_TO_NAME[zhiBinary] || "未知卦");
    const movingLines = state.results.map((r, i) => (r === 6 || r === 9 ? i : -1)).filter(i => i !== -1);

    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benGua: benName,
          zhiGua: zhiName,
          movingLines,
          question: state.question
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setState(s => ({ 
        ...s, 
        interpretationJson: data, 
        isInterpreting: false 
      }));
    } catch (error) {
      console.error(error);
      setState(s => ({ ...s, interpretation: "解卦失败，请检查网络连接。", isInterpreting: false }));
    }
  };

  const resetAll = () => {
    setState(prev => ({
      mode: prev.mode,
      results: [],
      question: '',
      interpretationJson: null,
      interpretation: '',
      isInterpreting: false,
    }));
    resetManualLine();
  };

  const handleTabSwitch = (nextMode: DivinationMode) => {
    setState(s => ({ ...s, mode: nextMode }));
    if (nextMode === 'manual' && stalks.currentStep === 'init') {
      resetManualLine();
    }
  };

  const manualStepHint: Record<ManualStep, string> = {
    init: '本爻已成，正准备起下一爻...',
    divide: '点击或滑动下方蓍草堆「分而为二」',
    man: '正在「挂一象人」...',
    count_left: '正在「揲之以四」数左策...',
    count_right: '正在「揲之以四」数右策...',
    collect: '正在「归奇于扐」...',
  };

  // --- Rendering Helpers ---

  const DetailedHexagramView = ({ 
    gua, 
    results, 
    title, 
    isZhi = false,
    highlights,
    primaryIndex,
  }: { 
    gua: GuaDetails; 
    results: number[]; 
    title: string; 
    badgeColor?: string;
    highlights: (number | string)[];
    primaryIndex?: number;
    isZhi?: boolean;
  }) => {
    if (!gua) return null;
    return (
      <div className="bg-white p-5 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-xs font-semibold tracking-widest text-stone-400 mb-1.5">
            <span className={isZhi ? 'text-crimson' : 'text-stone-500'}>{title}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-cursive text-ink">{gua.name}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          {/* Visual Column */}
          <div className="md:col-span-4 flex flex-col items-center">
             <div className="flex flex-col-reverse gap-3 sm:gap-4 w-full max-w-[180px] sm:max-w-[200px] px-7 py-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const originalR = results[i];
                  const r = isZhi 
                    ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                    : originalR;
                  
                  const isYang = r === 7 || r === 9;
                  const isMoving = (originalR === 6 || originalR === 9);
                  
                  let colorClass = "";
                  let yinClass = "";
                  if (r === 6) { colorClass = "yao-old-yin"; yinClass = "yao-line-yin-old"; }
                  else if (r === 9) { colorClass = "yao-old-yang"; }
                  else if (r === 8) { colorClass = "yao-young-yin"; yinClass = "yao-line-yin-young"; }
                  else if (r === 7) { colorClass = "yao-young-yang"; }

                  return (
                    <div key={i} className="group relative flex items-center h-6 sm:h-8">
                       <div className="flex-1">
                          <div className={`gua-line h-3 sm:h-4 w-full transition-all duration-500 ${!isYang ? 'gua-line-yin ' + yinClass : colorClass}`} />
                       </div>
                       {isMoving && <span className="absolute -left-5 text-crimson text-xs scale-125">●</span>}
                       <div className="absolute -right-6 text-[10px] font-bold text-stone-400 font-serif">
                          {['初', '二', '三', '四', '五', '上'][i]}
                       </div>
                    </div>
                  );
                })}
             </div>
             <div className="mt-5 sm:mt-6 p-4 bg-stone-50 rounded-2xl border border-stone-200/70 w-full">
                <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-1.5">大象传</div>
                <p className="text-xs sm:text-sm text-stone-600 italic leading-relaxed">{gua.daXiang}</p>
             </div>
          </div>

          {/* Details Column */}
          <div className="md:col-span-8 space-y-6 sm:space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className={`p-4 sm:p-6 rounded-2xl border transition-all ${highlights.includes('tuan') ? 'bg-amber-50/70 border-amber-300' : 'bg-stone-50/60 border-stone-200/70'}`}>
                  <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-1.5">卦辞</div>
                  <p className="text-base sm:text-lg font-serif leading-relaxed text-ink">{gua.guaCi}</p>
                </div>
                <div className={`p-4 sm:p-6 rounded-2xl border transition-all ${highlights.includes('tuan') ? 'bg-amber-50/70 border-amber-300' : 'bg-stone-50/60 border-stone-200/70'}`}>
                  <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-1.5">彖传</div>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">{gua.tuanZhuan}</p>
                </div>
             </div>

             <div className="space-y-2.5 sm:space-y-3">
                <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-2">爻辞与小象</div>
                <div className="flex flex-col-reverse gap-2.5 sm:gap-3">
                   {(() => {
                      const isQian = gua.name === "干";
                      const isKun = gua.name === "坤";
                      const isAllMoving = results.every(r => r === 6 || r === 9);
                      const showYong = isAllMoving && (isQian || isKun);
                      const yaosToShow = gua.yaoDetails.slice(0, showYong ? 7 : 6);
                      
                      return yaosToShow.map((yao, i) => {
                         const isYong = i === 6;
                         const isMoving = isYong || (results[i] === 6 || results[i] === 9);
                         const isHighlighted = highlights.includes(i);
                         const isPrimary = i === primaryIndex;
                        
                        let yaoTitle = "";
                        if (isYong) {
                           yaoTitle = isQian ? "用九" : "用六";
                        } else {
                           const originalR = results[i];
                           const r = isZhi 
                             ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                             : originalR;
                           const isYang = r === 7 || r === 9;
                           
                           const pos = ['二', '三', '四', '五'];
                           if (i === 0) yaoTitle = isYang ? "初九" : "初六";
                           else if (i === 5) yaoTitle = isYang ? "上九" : "上六";
                           else yaoTitle = isYang ? `九${pos[i-1]}` : `六${pos[i-1]}`;
                        }

                        return (
                          <div 
                            key={i} 
                            className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 transition-all
                              ${isHighlighted ? 'bg-amber-50/70 border-amber-300' : isMoving ? 'bg-crimson/[0.03] border-crimson/25' : 'bg-white border-stone-200'}
                            `}
                          >
                             <div className="flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1 font-serif font-bold text-ink whitespace-nowrap text-sm md:w-16">
                                <span>{yaoTitle}</span>
                                <div className="flex items-center gap-1.5 font-sans text-[11px]">
                                  {isPrimary && <span className="text-amber-700 font-bold">主占</span>}
                                  {isMoving && !isYong && <span className="text-crimson font-semibold">变爻</span>}
                                </div>
                             </div>
                             <div className="flex-1">
                                <div className="text-sm font-medium text-ink mb-1 leading-relaxed">{yao.yaoCi}</div>
                                <div className="text-xs text-stone-500 italic leading-relaxed">{yao.xiaoXiang}</div>
                             </div>
                          </div>
                        );
                      });
                   })()}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHexagram = (res: (number | null)[], label: string, hideMoving = false) => {
    return (
      <div className="flex flex-col items-center">
        <div className="flex flex-col-reverse gap-2.5 sm:gap-3 w-40 sm:w-48 px-6 py-4">
          {Array.from({ length: 6 }).map((_, i) => {
            const r = res[i];
            if (r === null || r === undefined) {
              return <div key={i} className="h-2.5 sm:h-3 w-full border border-dashed border-stone-300 rounded-full" />;
            }
            const isYang = r === 7 || r === 9;
            const isMoving = !hideMoving && (r === 6 || r === 9);
            
            let colorClass = "";
            let yinClass = "";
            if (r === 6) { colorClass = "yao-old-yin"; yinClass = "yao-line-yin-old"; }
            else if (r === 9) { colorClass = "yao-old-yang"; }
            else if (r === 8) { colorClass = "yao-young-yin"; yinClass = "yao-line-yin-young"; }
            else if (r === 7) { colorClass = "yao-young-yang"; }

            return (
              <div key={i} className="relative">
                <div className={`gua-line ${!isYang ? 'gua-line-yin ' + yinClass : colorClass}`} />
                {isMoving && <span className="moving-indicator">●</span>}
              </div>
            );
          })}
        </div>
        <div className="text-stone-400 tracking-[0.25em] text-xs font-bold mt-1">{label}</div>
      </div>
    );
  };

  const getGuaDetails = (res: number[], isZhi = false): HexagramData | null => {
    if (res.length < 6) return null;
    const binary = res.map(r => {
      if (isZhi) {
        if (r === 6) return '1';
        if (r === 9) return '0';
        return (r === 7 ? '1' : '0');
      }
      return (r === 7 || r === 9 ? '1' : '0');
    }).join('');
    
    const name = BINARY_TO_NAME[binary];
    if (!name) return null;
    return ICHING_DATA[name] || null;
  };

  const benGuaLocal = getGuaDetails(state.results);
  const zhiGuaLocal = getGuaDetails(state.results, true);
  const hasMoving = state.results.some(r => r === 6 || r === 9);
  const movingCount = state.results.filter(r => r === 6 || r === 9).length;
  const zhuXi = getZhuXiFocus(state.results, benGuaLocal?.name || "");

  const ImmediateGuaView = ({ 
    gua, 
    results, 
    title, 
    highlights,
    primaryIndex,
    isZhi = false 
  }: { 
    gua: any; 
    results: number[]; 
    title: string; 
    badgeColor?: string;
    highlights: (number | string)[];
    primaryIndex?: number;
    isZhi?: boolean;
  }) => {
    if (!gua) return null;
    return (
      <div className="bg-white p-5 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-xs font-semibold tracking-widest mb-1.5">
            <span className={isZhi ? 'text-crimson' : 'text-stone-500'}>{title}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-cursive text-ink">{gua.name}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          <div className="md:col-span-4 flex flex-col items-center">
             <div className="flex flex-col-reverse gap-3 sm:gap-4 w-full max-w-[180px] px-7 py-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const originalR = results[i];
                  const r = isZhi 
                    ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                    : originalR;
                    
                  const isYang = r === 7 || r === 9;
                  const isMoving = (originalR === 6 || originalR === 9);
                  
                  let colorClass = "";
                  let yinClass = "";
                  if (r === 6) { colorClass = "yao-old-yin"; yinClass = "yao-line-yin-old"; }
                  else if (r === 9) { colorClass = "yao-old-yang"; }
                  else if (r === 8) { colorClass = "yao-young-yin"; yinClass = "yao-line-yin-young"; }
                  else if (r === 7) { colorClass = "yao-young-yang"; }

                  return (
                    <div key={i} className="group relative flex items-center h-6 sm:h-8">
                       <div className="flex-1">
                          <div className={`gua-line h-3 sm:h-4 w-full transition-all duration-500 ${!isYang ? 'gua-line-yin ' + yinClass : colorClass}`} />
                       </div>
                       {isMoving && <span className="absolute -left-5 text-crimson text-xs scale-125">●</span>}
                       <div className="absolute -right-6 text-[10px] font-bold text-stone-400 font-serif">
                          {['初', '二', '三', '四', '五', '上'][i]}
                       </div>
                    </div>
                  );
                })}
             </div>
             <div className="mt-5 sm:mt-6 p-4 bg-stone-50 rounded-2xl border border-stone-200/70 w-full">
                <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-1.5">大象传</div>
                <p className="text-xs sm:text-sm text-stone-600 italic leading-relaxed">{gua.xiangZhuan || gua.daXiang}</p>
             </div>
          </div>

          <div className="md:col-span-8 space-y-6">
             <div className={`p-4 sm:p-6 rounded-2xl border transition-all ${highlights.includes('tuan') ? 'bg-amber-50/70 border-amber-300' : 'bg-stone-50/60 border-stone-200/70'}`}>
               <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-1.5">卦辞</div>
               <p className="text-base sm:text-lg font-serif leading-relaxed text-ink">{gua.guaCi}</p>
             </div>

             <div className="space-y-2.5 sm:space-y-3">
                <div className="text-[11px] font-bold text-stone-400 tracking-wider mb-2">爻辞</div>
                <div className="flex flex-col-reverse gap-2.5 sm:gap-3">
                   {(() => {
                      const isQian = gua.name === "干";
                      const isKun = gua.name === "坤";
                      const isAllMoving = results.every(r => r === 6 || r === 9);
                      const showYong = isAllMoving && (isQian || isKun);
                      const rawYaos = gua.yaoCi || gua.yaoDetails;
                      const yaosToShow = rawYaos.slice(0, showYong ? 7 : 6);

                      return yaosToShow.map((yao: any, i: number) => {
                        const isYong = i === 6;
                        const isMoving = isYong || (results[i] === 6 || results[i] === 9);
                        const isHighlighted = highlights.includes(i);
                        const isPrimary = i === primaryIndex;
                        const yaoText = typeof yao === 'string' ? yao : yao.yaoCi;
                        
                        let yaoTitle = "";
                        if (isYong) {
                           yaoTitle = isQian ? "用九" : "用六";
                        } else {
                           const originalR = results[i];
                           const r = isZhi 
                             ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                             : originalR;
                           const isYang = r === 7 || r === 9;
                           
                           const pos = ['二', '三', '四', '五'];
                           if (i === 0) yaoTitle = isYang ? "初九" : "初六";
                           else if (i === 5) yaoTitle = isYang ? "上九" : "上六";
                           else yaoTitle = isYang ? `九${pos[i-1]}` : `六${pos[i-1]}`;
                        }

                        return (
                          <div 
                            key={i} 
                            className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 transition-all
                              ${isHighlighted ? 'bg-amber-50/70 border-amber-300' : isMoving ? 'bg-crimson/[0.03] border-crimson/25' : 'bg-white border-stone-200'}
                            `}
                          >
                             <div className="flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1 font-serif font-bold text-ink whitespace-nowrap text-sm sm:w-14">
                                <span>{yaoTitle}</span>
                                <div className="flex items-center gap-1.5 font-sans text-[11px]">
                                  {isPrimary && <span className="text-amber-700 font-bold">主占</span>}
                                  {isMoving && !isYong && <span className="text-crimson font-semibold">变爻</span>}
                                </div>
                             </div>
                             <div className="flex-1 text-sm font-medium text-ink leading-relaxed">{yaoText}</div>
                          </div>
                        );
                      });
                   })()}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans selection:bg-crimson selection:text-white pb-16 sm:pb-24">
      <header className="pt-6 pb-4 sm:pt-12 sm:pb-6 px-4 text-center">
        <h1 className="font-cursive text-4xl sm:text-6xl md:text-7xl mb-2 text-ink">周易 · 揲蓍</h1>
        <p className="text-stone-400 tracking-[0.25em] sm:tracking-[0.4em] text-[11px] sm:text-xs uppercase font-medium">
          Wisdom of Divine Changes
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-6 sm:mb-10">
          <input 
            type="text" 
            placeholder="心诚则灵，输入您的困惑..."
            disabled={state.results.length === 6 && state.isInterpreting}
            className="w-full bg-transparent border-b-2 border-stone-200 py-3 sm:py-4 text-lg sm:text-2xl font-serif text-center focus:border-ink outline-none transition-colors placeholder:text-stone-300"
            value={state.question}
            onChange={(e) => setState(s => ({ ...s, question: e.target.value }))}
          />
        </div>

        {/* Two-Tab Divination Mode Switcher & Workspace */}
        {state.results.length < 6 && (
          <div className="space-y-6 sm:space-y-8">
            <div
              role="tablist"
              aria-label="起卦方式"
              className="grid grid-cols-2 gap-1.5 p-1.5 bg-stone-100 border border-stone-200 rounded-2xl max-w-md mx-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={state.mode === 'auto'}
                onClick={() => handleTabSwitch('auto')}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  state.mode === 'auto'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-stone-500 hover:text-ink'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                <span>及时问道</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={state.mode === 'manual'}
                onClick={() => handleTabSwitch('manual')}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  state.mode === 'manual'
                    ? 'bg-white text-crimson shadow-sm'
                    : 'text-stone-500 hover:text-ink'
                }`}
              >
                <Hand className="w-4 h-4 shrink-0" />
                <span>遵循古法</span>
              </button>
            </div>

            {state.mode === 'auto' && (
              <motion.div
                key="tab-auto"
                role="tabpanel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 md:p-12 text-center shadow-sm max-w-2xl mx-auto"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center mx-auto mb-5 text-ink">
                  <Cpu className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-ink mb-2">及时问道</h2>
                <p className="text-stone-500 text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-7">
                  依大衍筮法概率（老阴 1/16、少阳 5/16、少阴 7/16、老阳 3/16）自动模拟六爻演化，即时成卦。
                </p>
                <button
                  type="button"
                  onClick={handleAutoDivination}
                  className="w-full sm:w-auto min-h-[48px] bg-ink text-paper px-10 py-3.5 rounded-full text-base font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 whitespace-nowrap"
                >
                  <ScrollText className="w-5 h-5" />
                  <span>立即起卦</span>
                </button>
              </motion.div>
            )}

            {state.mode === 'manual' && (
              <motion.div
                key="tab-manual"
                role="tabpanel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white p-4 sm:p-8 md:p-10 rounded-3xl border border-stone-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-5 border-b border-stone-100">
                    <div>
                      <h2 className="font-serif text-lg sm:text-xl font-bold text-ink tabular-nums">
                        第 {displayLineIndex + 1} 爻 · 第 {displayChangeCount} 变
                      </h2>
                      <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
                        {manualStepHint[stalks.currentStep]}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="text-xs text-stone-400 tabular-nums">
                        已成 {state.results.length} / 6 爻
                      </span>
                      {state.results.length > 0 && (
                        <button
                          type="button"
                          onClick={resetAll}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors whitespace-nowrap"
                        >
                          重置起卦
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                    <div className="lg:col-span-8 space-y-4">
                      <StalkVisualizer stalks={stalks} onNextStep={handleManualStep} />
                      {stalks.currentStep === 'divide' && (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleManualStep()}
                            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-ink text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            随机分而为二
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-4 flex flex-col items-center justify-center bg-stone-50/70 border border-stone-200/70 rounded-2xl p-4 sm:p-6">
                      {renderHexagram(state.results, "起卦进度", true)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {state.results.length === 6 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 sm:space-y-12">
            
            <InterpretationGuide count={movingCount} />

            {/* Hexagram Display Section */}
            <div className="flex flex-col gap-6 sm:gap-10">
               {/* Primary Hexagram (Ben Gua) */}
               {state.interpretationJson ? (
                 <DetailedHexagramView 
                    gua={state.interpretationJson.benGuaDetails}
                    results={state.results}
                    title="本卦 · ORIGINAL"
                    highlights={zhuXi.highlights.ben}
                    primaryIndex={zhuXi.primary}
                 />
               ) : (
                 <ImmediateGuaView 
                    gua={benGuaLocal}
                    results={state.results}
                    title="本卦 · ORIGINAL"
                    highlights={zhuXi.highlights.ben}
                    primaryIndex={zhuXi.primary}
                 />
               )}

               {benGuaLocal?.name && (
                 <GuaTableDetailView 
                    guaName={benGuaLocal.name}
                    results={state.results}
                    highlights={zhuXi.highlights.ben}
                    primaryIndex={zhuXi.primary}
                 />
               )}

               {/* Secondary Hexagram (Zhi Gua) */}
               {hasMoving && zhiGuaLocal?.name && (
                 <>
                   {state.interpretationJson ? (
                     <DetailedHexagramView 
                         gua={state.interpretationJson.zhiGuaDetails}
                         results={state.results}
                         title="变卦 · TRANSITION"
                         isZhi={true}
                         highlights={zhuXi.highlights.zhi}
                         primaryIndex={zhuXi.primary}
                     />
                   ) : (
                     <ImmediateGuaView 
                         gua={zhiGuaLocal}
                         results={state.results}
                         title="变卦 · TRANSITION"
                         isZhi={true}
                         highlights={zhuXi.highlights.zhi}
                         primaryIndex={zhuXi.primary}
                     />
                   )}
                   <GuaTableDetailView 
                      guaName={zhiGuaLocal.name}
                      results={state.results}
                      highlights={zhuXi.highlights.zhi}
                      primaryIndex={zhuXi.primary}
                      isZhi={true}
                   />
                 </>
               )}
            </div>

            {/* Vernacular & Classical Master Commentaries (between original hexagram text and AI interpretation) */}
            {benGuaLocal?.name && (
              <ZhouyiFullCommentary
                benGuaName={benGuaLocal.name}
                zhiGuaName={zhiGuaLocal?.name || null}
                results={state.results}
                hasMoving={hasMoving}
                benHighlights={zhuXi.highlights.ben}
                zhiHighlights={zhuXi.highlights.zhi}
                primaryIndex={zhuXi.primary}
              />
            )}

            {/* Interpretation Action */}
            {!state.interpretationJson && !state.isInterpreting && (
              <div className="text-center py-4 sm:py-8 space-y-4">
                {state.interpretation && (
                  <div className="inline-flex items-center gap-2 text-sm text-crimson bg-crimson/5 border border-crimson/20 px-4 py-2.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{state.interpretation}</span>
                  </div>
                )}
                <div>
                  <button 
                    onClick={getInterpretation}
                    className="w-full sm:w-auto min-h-[52px] bg-ink text-white px-8 sm:px-14 py-4 rounded-full text-lg sm:text-xl font-bold shadow-lg hover:opacity-95 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-3 whitespace-nowrap"
                  >
                    <ScrollText className="w-5 h-5 sm:w-6 sm:h-6" /> 启发 AI 禅师
                  </button>
                </div>
              </div>
            )}

            {state.isInterpreting && (
              <div className="text-center py-14 sm:py-20 flex flex-col items-center gap-5">
                <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 text-crimson animate-spin" />
                <p className="text-stone-500 font-cursive text-2xl sm:text-3xl animate-pulse">大衍之数五十，其用四十有九...</p>
              </div>
            )}

            {state.interpretationJson && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-ink text-paper p-6 sm:p-10 md:p-16 rounded-3xl sm:rounded-[3rem] shadow-xl max-w-none font-serif"
              >
                <div className="text-center mb-8 sm:mb-12">
                  <div className="text-paper/50 text-xs tracking-widest uppercase mb-3">
                    禅师启发 · DIVINATION INSIGHT
                  </div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl text-paper leading-snug italic">
                    「 {state.interpretationJson.aphorism} 」
                  </h3>
                </div>
                
                <div className="prose prose-invert prose-stone max-w-none text-base sm:text-lg leading-relaxed text-paper/90">
                   <Markdown>{state.interpretationJson.interpretation}</Markdown>
                </div>
              </motion.div>
            )}

            <div className="flex justify-center pt-4 sm:pt-8">
              <button 
                onClick={resetAll}
                className="w-full sm:w-auto min-h-[44px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-8 py-3 rounded-full transition-colors inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" /> 重新起卦
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

