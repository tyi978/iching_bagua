import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Compass,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  ScrollText,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface YaoCommentary {
  name: string;
  title: string;
  original_text: string;
  xiang_ci: string;
  vernacular_explanation: string;
  interpretations?: {
    shao_yong?: {
      fortune?: string;
      detail?: string;
    };
    fu_pei_rong?: Record<string, string>;
  };
  changed_hexagram?: {
    target_id: number;
    target_name: string;
    description: string;
  } | null;
}

interface HexagramCommentary {
  id: number;
  name: string;
  title: string;
  original_text: string;
  xiang_ci: string;
  vernacular_explanation: string;
  symbol?: string;
  upper_trigram?: string;
  lower_trigram?: string;
  binary_code?: string;
  interpretations: {
    duan_yi_tian_ji?: string;
    shao_yong?: {
      poem?: string;
      detail?: string;
    };
    fu_pei_rong?: Record<string, string>;
    traditional?: Record<string, string>;
    zhang_ming_ren?: Record<string, string>;
  };
  yaos: YaoCommentary[];
}

interface ZhouyiDataset {
  hexagrams: HexagramCommentary[];
}

interface ZhouyiFullCommentaryProps {
  benGuaName: string;
  zhiGuaName?: string | null;
  results: number[];
  hasMoving: boolean;
  benHighlights: (number | string)[];
  zhiHighlights: (number | string)[];
  primaryIndex?: number;
}

type CommentaryTab =
  | 'duan_yi_tian_ji'
  | 'shao_yong'
  | 'fu_pei_rong'
  | 'traditional'
  | 'zhang_ming_ren'
  | 'yaos';

const ZHOUYI_ASSET_URL = '/assets/aistudio/zhouyi_full_d31e7d07.json';

let cachedDataset: ZhouyiDataset | null = null;
let pendingPromise: Promise<ZhouyiDataset> | null = null;

function loadZhouyiDataset(): Promise<ZhouyiDataset> {
  if (cachedDataset) {
    return Promise.resolve(cachedDataset);
  }
  if (!pendingPromise) {
    pendingPromise = fetch(ZHOUYI_ASSET_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`无法加载白话与诸家解卦数据 (${res.status})`);
        }
        return res.json() as Promise<ZhouyiDataset>;
      })
      .then((data) => {
        cachedDataset = data;
        return data;
      })
      .catch((err) => {
        pendingPromise = null;
        throw err;
      });
  }
  return pendingPromise;
}

function normalizeHexagramName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '干') return '乾';
  if (trimmed === '大有') return '火天大有';
  if (trimmed === '遯') return '遁';
  return trimmed;
}

function findHexagram(dataset: ZhouyiDataset, guaName?: string | null): HexagramCommentary | null {
  if (!guaName) return null;
  const target = normalizeHexagramName(guaName);
  return (
    dataset.hexagrams.find((h) => h.name === target) ||
    dataset.hexagrams.find((h) => h.name.endsWith(target)) ||
    null
  );
}

const ZHANG_ASPECT_KEYS = new Set([
  '解释',
  '特性',
  '运势',
  '家运',
  '疾病',
  '胎孕',
  '子女',
  '周转',
  '买卖',
  '等人',
  '寻人',
  '失物',
  '外出',
  '考试',
  '诉讼',
  '求事',
  '改行',
  '开业',
]);

const COMMENTARY_TABS: { id: CommentaryTab; label: string }[] = [
  { id: 'duan_yi_tian_ji', label: '断易天机' },
  { id: 'shao_yong', label: '邵雍解卦' },
  { id: 'fu_pei_rong', label: '傅佩荣解' },
  { id: 'traditional', label: '传统解卦' },
  { id: 'zhang_ming_ren', label: '张铭仁解' },
  { id: 'yaos', label: '六爻详批' },
];

export const ZhouyiFullCommentary: React.FC<ZhouyiFullCommentaryProps> = ({
  benGuaName,
  zhiGuaName,
  results,
  hasMoving,
  benHighlights,
  zhiHighlights,
  primaryIndex,
}) => {
  const [dataset, setDataset] = useState<ZhouyiDataset | null>(cachedDataset);
  const [loading, setLoading] = useState(!cachedDataset);
  const [error, setError] = useState<string | null>(null);
  const [activeGua, setActiveGua] = useState<'ben' | 'zhi'>('ben');
  const [activeTab, setActiveTab] = useState<CommentaryTab>('duan_yi_tian_ji');
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (cachedDataset) {
      setDataset(cachedDataset);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadZhouyiDataset()
      .then((data) => {
        if (!mounted) return;
        setDataset(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || '白话详解加载失败');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveGua('ben');
  }, [benGuaName, zhiGuaName]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm p-8 sm:p-12 text-center">
        <Loader2 className="w-7 h-7 text-stone-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-stone-500">正在载入白话文解释与诸家解卦…</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm p-6 sm:p-8 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-crimson">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || '未能载入白话详解数据'}</span>
        </div>
      </div>
    );
  }

  const benHex = findHexagram(dataset, benGuaName);
  const zhiHex = hasMoving && zhiGuaName && zhiGuaName !== benGuaName ? findHexagram(dataset, zhiGuaName) : null;
  const currentHex = activeGua === 'zhi' && zhiHex ? zhiHex : benHex;
  const currentHighlights = activeGua === 'zhi' && zhiHex ? zhiHighlights : benHighlights;

  if (!currentHex) {
    return null;
  }

  const isQian = currentHex.name === '乾';
  const isKun = currentHex.name === '坤';
  const isAllMoving = results.length === 6 && results.every((r) => r === 6 || r === 9);
  const showYong = isAllMoving && (isQian || isKun) && currentHex.yaos.length >= 7;
  const yaosToShow = currentHex.yaos.slice(0, showYong ? 7 : 6);

  // Relevant yaos to surface directly in the top vernacular block
  const highlightYaoIndices = currentHighlights.filter((h): h is number => typeof h === 'number');
  const movingIndices = results
    .map((r, idx) => (r === 6 || r === 9 ? idx : -1))
    .filter((idx) => idx >= 0);
  const spotlightIndices = Array.from(
    new Set([
      ...(typeof primaryIndex === 'number' ? [primaryIndex] : []),
      ...highlightYaoIndices,
      ...(activeGua === 'ben' ? movingIndices : []),
    ])
  ).filter((idx) => idx >= 0 && idx < yaosToShow.length);

  const vernacularParagraphs = currentHex.vernacular_explanation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const interp = currentHex.interpretations || {};
  const tradEntries = Object.entries(interp.traditional || {});
  const tradOverview = interp.traditional?.overview;
  const tradAspects = tradEntries.filter(([k]) => k !== 'overview');

  const fprEntries = Object.entries(interp.fu_pei_rong || {});

  const zmrEntries = Object.entries(interp.zhang_ming_ren || {});
  const zmrOverviewEntry = zmrEntries.find(([k]) => k === 'overview' || !ZHANG_ASPECT_KEYS.has(k));
  const zmrAspects = zmrEntries.filter(([k]) => k !== zmrOverviewEntry?.[0]);

  const renderDuanYi = () => {
    if (!interp.duan_yi_tian_ji) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <ScrollText className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">《断易天机》解</h4>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 text-sm sm:text-base text-stone-700 leading-relaxed">
          {interp.duan_yi_tian_ji}
        </div>
      </section>
    );
  };

  const renderShaoYong = () => {
    const sy = interp.shao_yong;
    if (!sy || (!sy.poem && !sy.detail)) return null;
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
          <Sparkles className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">
            北宋易学家邵雍解 · 邵雍河洛理数解卦
          </h4>
        </div>
        <div className="space-y-3">
          {sy.poem && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
              <div className="text-[11px] font-bold text-amber-800 tracking-wider mb-1.5">理数断诗</div>
              <p className="text-base sm:text-lg font-serif text-ink leading-relaxed">{sy.poem}</p>
            </div>
          )}
          {sy.detail && (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 text-sm sm:text-base text-stone-700 leading-relaxed">
              {sy.detail}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderFuPeiRong = () => {
    if (fprEntries.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink">
          <UserCheck className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">
            台湾国学大儒傅佩荣解 · 傅佩荣解卦手册
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fprEntries.map(([label, text]) => (
            <div
              key={label}
              className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-1.5"
            >
              <div className="text-xs font-bold text-stone-500 tracking-wider">{label}</div>
              <p className="text-sm text-ink leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderTraditional = () => {
    if (tradEntries.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <BookOpen className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">传统解卦</h4>
        </div>
        {tradOverview && (
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 text-sm sm:text-base text-stone-700 leading-relaxed">
            {tradOverview}
          </div>
        )}
        {tradAspects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tradAspects.map(([label, text]) => (
              <div
                key={label}
                className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-1.5"
              >
                <div className="text-xs font-bold text-crimson tracking-wider">{label}</div>
                <p className="text-sm text-stone-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderZhangMingRen = () => {
    if (zmrEntries.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <Compass className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">台湾张铭仁解卦</h4>
        </div>
        {zmrOverviewEntry && (
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-1.5">
            <div className="text-xs font-bold text-stone-500 tracking-wider">
              {zmrOverviewEntry[0] === 'overview' ? '总论' : `${zmrOverviewEntry[0]}卦总论`}
            </div>
            <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
              {zmrOverviewEntry[1]}
            </p>
          </div>
        )}
        {zmrAspects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {zmrAspects.map(([label, text]) => (
              <div
                key={label}
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/80 space-y-1"
              >
                <div className="text-xs font-bold text-stone-500">{label}</div>
                <p className="text-sm text-stone-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderYaosDetail = () => {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-ink">
          <Layers className="w-4 h-4 text-crimson shrink-0" />
          <h4 className="text-sm sm:text-base font-bold tracking-wide">六爻白话与名家详批</h4>
        </div>
        <div className="space-y-3">
          {yaosToShow.map((yao, idx) => {
            const isYong = idx === 6;
            const isPrimary = idx === primaryIndex;
            const isHighlight = currentHighlights.includes(idx);
            const isMoving = !isYong && (results[idx] === 6 || results[idx] === 9);
            const yaoLines = (yao.vernacular_explanation || '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean);
            const yaoSy = yao.interpretations?.shao_yong;
            const yaoFprEntries = Object.entries(yao.interpretations?.fu_pei_rong || {});

            const cardClass =
              isHighlight || isPrimary
                ? 'bg-amber-50/60 border-amber-300'
                : isMoving
                ? 'bg-crimson/[0.02] border-crimson/25'
                : 'bg-white border-stone-200';

            return (
              <div key={yao.name + idx} className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-serif">
                    <span className="text-base font-bold text-ink">{yao.name}</span>
                    <span className="text-sm text-stone-600">{yao.original_text.replace(/^[^。]*。/, '') || yao.original_text}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-sans">
                    {isPrimary && <span className="text-amber-700 font-bold">主占</span>}
                    {isPrimary && isMoving && <span className="text-stone-300" aria-hidden="true">·</span>}
                    {isMoving && <span className="text-crimson font-semibold">变爻</span>}
                    {yaoSy?.fortune && (
                      <>
                        {(isPrimary || isMoving) && (
                          <span className="text-stone-300" aria-hidden="true">·</span>
                        )}
                        <span className="text-stone-600 font-medium">吉凶：{yaoSy.fortune}</span>
                      </>
                    )}
                  </div>
                </div>

                {yao.xiang_ci && (
                  <p className="text-xs text-stone-500 font-serif italic leading-relaxed">{yao.xiang_ci}</p>
                )}

                {yaoLines.length > 0 && (
                  <div className="space-y-1 text-sm text-ink leading-relaxed">
                    {yaoLines.map((line, lIdx) => (
                      <p key={lIdx}>{line}</p>
                    ))}
                  </div>
                )}

                {yaoSy?.detail && (
                  <div className="pt-2.5 border-t border-stone-200/70 text-xs sm:text-sm text-stone-700 leading-relaxed">
                    <span className="font-bold text-ink">邵雍解：</span>
                    {yaoSy.detail}
                  </div>
                )}

                {yaoFprEntries.length > 0 && (
                  <div className="pt-2.5 border-t border-stone-200/70 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
                    {yaoFprEntries.map(([k, v]) => (
                      <div key={k} className="leading-relaxed">
                        <span className="font-bold text-stone-500">{k}：</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {yao.changed_hexagram && (
                  <div className="pt-2.5 border-t border-stone-200/70 text-xs text-stone-600 leading-relaxed">
                    <span className="font-bold text-crimson">
                      变卦（之{yao.changed_hexagram.target_name}）：
                    </span>
                    {yao.changed_hexagram.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-stone-50/70 px-5 py-6 sm:px-8 sm:py-8 md:px-10 border-b border-stone-200/80">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-2">
              <span className="text-crimson font-semibold">白话文与诸家详释</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">周易第 {currentHex.id} 卦</span>
              {currentHex.upper_trigram && currentHex.lower_trigram && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    上{currentHex.upper_trigram}下{currentHex.lower_trigram}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-ink flex items-center gap-2.5">
              {currentHex.symbol && (
                <span className="text-3xl sm:text-4xl font-normal" aria-hidden="true">
                  {currentHex.symbol}
                </span>
              )}
              <span>{currentHex.name}卦 · 白话与名家解卦</span>
            </h3>
          </div>

          {zhiHex && (
            <div
              role="tablist"
              aria-label="切换本卦与变卦详释"
              className="grid grid-cols-2 gap-1 p-1 bg-stone-200/70 rounded-xl self-start md:self-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeGua === 'ben'}
                onClick={() => setActiveGua('ben')}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  activeGua === 'ben'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-stone-600 hover:text-ink'
                }`}
              >
                本卦 · {benHex?.name}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeGua === 'zhi'}
                onClick={() => setActiveGua('zhi')}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  activeGua === 'zhi'
                    ? 'bg-white text-crimson shadow-sm'
                    : 'text-stone-600 hover:text-ink'
                }`}
              >
                变卦 · {zhiHex.name}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8">
        {/* Always Visible Section: 白话文解释 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-base sm:text-lg font-bold text-ink tracking-wide flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-crimson shrink-0" />
              <span>白话文解释</span>
            </h4>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-3">
            <div className="text-xs sm:text-sm font-serif text-stone-500 space-y-1 pb-3 border-b border-stone-200/70">
              <p className="font-semibold text-ink">{currentHex.original_text}</p>
              {currentHex.xiang_ci && <p className="italic">{currentHex.xiang_ci}</p>}
            </div>
            <div className="space-y-2 text-sm sm:text-base text-ink leading-relaxed">
              {vernacularParagraphs.map((para, index) => (
                <p key={index}>{para}</p>
              ))}
            </div>
          </div>

          {/* Spotlight: Primary / Moving Yaos Vernacular Summary */}
          {spotlightIndices.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-amber-800 tracking-wider">
                主占 / 变爻白话提要
              </div>
              <div className="space-y-2.5">
                {spotlightIndices.map((idx) => {
                  const yao = yaosToShow[idx];
                  const isPrimary = idx === primaryIndex;
                  const isMoving = idx < 6 && (results[idx] === 6 || results[idx] === 9);
                  const yaoLines = (yao.vernacular_explanation || '')
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);

                  return (
                    <div
                      key={yao.name + idx}
                      className="p-4 rounded-2xl bg-amber-50/60 border border-amber-300/80 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-serif font-bold text-sm sm:text-base text-ink">
                          {yao.name} · {yao.original_text.replace(/^[^。]*。/, '') || yao.original_text}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          {isPrimary && <span className="text-amber-800 font-bold">主占</span>}
                          {isPrimary && isMoving && (
                            <span className="text-stone-300" aria-hidden="true">·</span>
                          )}
                          {isMoving && <span className="text-crimson font-semibold">变爻</span>}
                          {yao.interpretations?.shao_yong?.fortune && (
                            <>
                              <span className="text-stone-300" aria-hidden="true">·</span>
                              <span className="text-stone-600 font-medium">
                                断：{yao.interpretations.shao_yong.fortune}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-stone-700 leading-relaxed">
                        {yaoLines.map((line, lIdx) => (
                          <p key={lIdx}>{line}</p>
                        ))}
                      </div>
                      {yao.interpretations?.shao_yong?.detail && (
                        <p className="text-xs sm:text-sm text-stone-600 pt-1.5 border-t border-amber-200/70 leading-relaxed">
                          <span className="font-bold text-amber-900">邵雍解：</span>
                          {yao.interpretations.shao_yong.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Master Commentaries Navigation & View Toggle */}
        <section className="space-y-4 sm:space-y-5 pt-2 border-t border-stone-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-ink tracking-wide">
                诸家解卦汇参
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                涵盖《断易天机》、邵雍河洛理数、傅佩荣解卦手册、传统解卦与张铭仁解卦
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpandAll((prev) => !prev)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs sm:text-sm font-semibold text-ink transition-colors inline-flex items-center justify-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              {expandAll ? (
                <>
                  <Minimize2 className="w-4 h-4 shrink-0" />
                  <span>分页查看</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 shrink-0" />
                  <span>展开全部诸家解卦</span>
                </>
              )}
            </button>
          </div>

          {!expandAll && (
            <div
              role="tablist"
              aria-label="选择诸家解卦典籍"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 bg-stone-100 border border-stone-200 rounded-2xl"
            >
              {COMMENTARY_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      selected
                        ? 'bg-white text-crimson shadow-sm'
                        : 'text-stone-600 hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {expandAll ? (
            <div className="space-y-8 pt-2">
              {renderDuanYi()}
              {renderShaoYong()}
              {renderFuPeiRong()}
              {renderTraditional()}
              {renderZhangMingRen()}
              {renderYaosDetail()}
            </div>
          ) : (
            <div role="tabpanel" className="pt-1">
              {activeTab === 'duan_yi_tian_ji' && renderDuanYi()}
              {activeTab === 'shao_yong' && renderShaoYong()}
              {activeTab === 'fu_pei_rong' && renderFuPeiRong()}
              {activeTab === 'traditional' && renderTraditional()}
              {activeTab === 'zhang_ming_ren' && renderZhangMingRen()}
              {activeTab === 'yaos' && renderYaosDetail()}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
