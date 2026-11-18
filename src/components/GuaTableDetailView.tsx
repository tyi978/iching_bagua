import React from 'react';
import { Sparkles } from 'lucide-react';
import { GUA_DICT } from '../lib/guaDict';

const GUA_DICTIONARY = GUA_DICT as Record<string, any>;

interface GuaTableDetailViewProps {
  guaName: string;
  results: number[]; // 6, 7, 8, 9 representing bottom-to-top lines
  highlights: (number | string)[]; // Highlights from Zhu Xi (indices or 'tuan')
  primaryIndex?: number; // Main占 focus line index
  isZhi?: boolean; // Whether it is the changed hexagram
}

export const GuaTableDetailView: React.FC<GuaTableDetailViewProps> = ({
  guaName,
  results,
  highlights,
  primaryIndex,
  isZhi = false,
}) => {
  let normalizedName = guaName;
  if (normalizedName === '乾') normalizedName = '干';
  if (normalizedName === '遁') normalizedName = '遯';

  const guaInfo = GUA_DICTIONARY[normalizedName];

  if (!guaInfo) {
    return (
      <div className="p-6 bg-amber-50 text-amber-900 rounded-2xl border border-amber-200 text-center font-serif text-sm sm:text-base">
        未找到【{guaName}】的详细卦释数据。
      </div>
    );
  }

  const getTrigramNature = (name: string) => {
    const elements: Record<string, string> = {
      '干': '天 (健)', '坤': '地 (顺)', '震': '雷 (动)', '巽': '风 (入)',
      '坎': '水 (陷)', '离': '火 (丽)', '艮': '山 (止)', '兑': '泽 (悦)'
    };
    return elements[name] || '自然';
  };

  const hexagramIndex = Object.keys(GUA_DICTIONARY).indexOf(normalizedName) + 1;

  const rawYaoDetails = Array.isArray(guaInfo.yaoDetails) && guaInfo.yaoDetails.length > 0
    ? guaInfo.yaoDetails
    : (guaInfo.yaoCi || []).map((ci: string, idx: number) => ({
        yaoCi: ci,
        yaoXiang: guaInfo.yaoXiang?.[idx] || "",
      }));
  const hasBaiHua = rawYaoDetails.some((y: any) => Boolean(y.baiHua));
  const hasShaoYong = rawYaoDetails.some((y: any) => Boolean(y.shaoYong));
  const isQian = normalizedName === '干';
  const isKun = normalizedName === '坤';
  const isAllMoving = results.every(r => r === 6 || r === 9);
  const showYong = isAllMoving && (isQian || isKun);
  const yaosToShow = rawYaoDetails.slice(0, showYong ? 7 : 6);

  const summaryRows: { label: string; content: React.ReactNode; isHighlight?: boolean }[] = [
    {
      label: '卦辞原文',
      content: <span className="text-base sm:text-lg text-ink font-serif leading-relaxed">{guaInfo.guaCi}</span>,
    },
  ];
  if (guaInfo.guaCiBaiHua) {
    summaryRows.push({
      label: '白话译注',
      content: <span className="text-sm text-stone-600 font-sans leading-relaxed">{guaInfo.guaCiBaiHua}</span>,
    });
  }
  if (guaInfo.tuanZhuan) {
    summaryRows.push({
      label: '《彖传》曰',
      content: <span className="text-sm text-stone-600 font-serif leading-relaxed">{guaInfo.tuanZhuan}</span>,
    });
  }
  if (guaInfo.xiangZhuan) {
    summaryRows.push({
      label: '《大象传》曰',
      content: <span className="text-sm text-stone-600 font-serif italic leading-relaxed">{guaInfo.xiangZhuan}</span>,
    });
  }
  if (guaInfo.shaoYongGua) {
    summaryRows.push({
      label: '邵雍大师解卦',
      isHighlight: true,
      content: (
        <div className="text-sm text-stone-700 leading-relaxed font-sans">
          <div className="flex items-center gap-1.5 text-crimson font-medium mb-1 text-xs">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>北宋易理大宗核心断词</span>
          </div>
          {guaInfo.shaoYongGua}
        </div>
      ),
    });
  }

  return (
    <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-stone-200/80 shadow-sm overflow-hidden font-serif">
      {/* Header Section */}
      <div className="bg-stone-50/70 px-5 py-6 sm:px-8 sm:py-8 md:px-10 border-b border-stone-200/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 font-sans mb-2">
              <span className="text-crimson font-semibold">{isZhi ? '变卦' : '本卦'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">《易经》第 {hexagramIndex} 卦</span>
              <span aria-hidden="true">·</span>
              <span>{getTrigramNature(normalizedName)}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-cursive text-ink tracking-wide">
              {normalizedName}卦 <span className="font-serif text-lg sm:text-2xl text-stone-500">详解</span>
            </h2>
            <p className="text-stone-600 text-xs sm:text-sm font-sans mt-2 leading-relaxed max-w-2xl">
              {guaInfo.xiangZhuan}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 md:p-10 space-y-8 sm:space-y-10">
        {/* SECTION 1: 卦象总析对照 */}
        <div>
          <h3 className="text-sm sm:text-base font-bold text-ink tracking-wide font-sans mb-4">
            卦象总析对照
          </h3>

          {/* Mobile Stacked List (< md) */}
          <div className="md:hidden border border-stone-200 rounded-2xl divide-y divide-stone-200 overflow-hidden">
            {summaryRows.map((row) => (
              <div
                key={row.label}
                className={`p-4 space-y-1.5 ${row.isHighlight ? 'bg-crimson/[0.02]' : 'bg-white'}`}
              >
                <div className={`text-xs font-bold font-sans ${row.isHighlight ? 'text-crimson' : 'text-stone-500'}`}>
                  {row.label}
                </div>
                <div>{row.content}</div>
              </div>
            ))}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-hidden border border-stone-200 rounded-2xl">
            <table className="w-full text-left border-collapse table-fixed">
              <tbody className="divide-y divide-stone-200">
                {summaryRows.map((row) => (
                  <tr key={row.label} className={row.isHighlight ? 'bg-crimson/[0.01]' : ''}>
                    <td
                      className={`w-1/4 p-4 lg:p-5 font-bold border-r border-stone-200 align-top text-sm font-sans ${
                        row.isHighlight ? 'bg-crimson/[0.02] text-crimson' : 'bg-stone-50/70 text-stone-700'
                      }`}
                    >
                      {row.label}
                    </td>
                    <td className="w-3/4 p-4 lg:p-5 align-top">{row.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: 六爻流转详解 */}
        <div>
          <h3 className="text-sm sm:text-base font-bold text-ink tracking-wide font-sans mb-4">
            六爻流转详解
          </h3>

          {/* Mobile Stacked Yao Cards (< md) */}
          <div className="md:hidden space-y-3">
            {yaosToShow.map((yao: any, i: number) => {
              const isYong = i === 6;
              const isHighlight = highlights.includes(i);
              const isPrimary = i === primaryIndex;
              const originalR = results[i];
              const isMoving = isYong || (originalR === 6 || originalR === 9);

              let yaoTitle = "";
              if (isYong) {
                yaoTitle = isQian ? "用九" : "用六";
              } else {
                const r = isZhi
                  ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                  : originalR;
                const isYang = r === 7 || r === 9;
                const pos = ['二', '三', '四', '五'];
                if (i === 0) yaoTitle = isYang ? "初九" : "初六";
                else if (i === 5) yaoTitle = isYang ? "上九" : "上六";
                else yaoTitle = isYang ? `九${pos[i - 1]}` : `六${pos[i - 1]}`;
              }

              const txtYaoCi = yao.yaoCi || guaInfo.yaoCi?.[i] || "";
              const txtYaoXiang = yao.yaoXiang || guaInfo.yaoXiang?.[i] || "";
              const txtBaiHua = yao.baiHua || "";
              const txtShaoYong = yao.shaoYong || "";

              const cardStyle =
                isHighlight || isPrimary
                  ? "bg-amber-50/70 border-amber-300"
                  : isMoving
                  ? "bg-crimson/[0.03] border-crimson/25"
                  : "bg-white border-stone-200";

              return (
                <div key={i} className={`rounded-2xl border p-4 space-y-2 ${cardStyle}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif font-bold text-base text-ink">{yaoTitle}</span>
                    <div className="flex items-center gap-2 text-xs font-sans">
                      {isPrimary && (
                        <span className="text-amber-700 font-bold">主占</span>
                      )}
                      {isPrimary && isMoving && !isYong && (
                        <span className="text-stone-300" aria-hidden="true">·</span>
                      )}
                      {isMoving && !isYong && (
                        <span className="text-crimson font-semibold">变爻</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-ink leading-relaxed font-serif">{txtYaoCi}</p>
                  {txtYaoXiang && (
                    <p className="text-xs text-stone-500 italic leading-relaxed">{txtYaoXiang}</p>
                  )}
                  {hasBaiHua && txtBaiHua && (
                    <p className="text-xs text-stone-600 font-sans leading-relaxed pt-1 border-t border-stone-200/60">
                      {txtBaiHua}
                    </p>
                  )}
                  {hasShaoYong && txtShaoYong && (
                    <p className="text-xs text-stone-700 font-sans leading-relaxed pt-1 border-t border-stone-200/60">
                      {txtShaoYong}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Comparison Table (md+) */}
          <div className="hidden md:block overflow-hidden border border-stone-200 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-xs font-sans font-bold tracking-wider">
                  <th className="p-4 w-24 text-center">爻位</th>
                  <th className="p-4">爻辞原文</th>
                  <th className="p-4">小象传曰</th>
                  {hasBaiHua && <th className="p-4 w-1/4">现代白话翻译</th>}
                  {hasShaoYong && <th className="p-4 w-1/4">邵雍断词详解</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {yaosToShow.map((yao: any, i: number) => {
                  const isYong = i === 6;
                  const isHighlight = highlights.includes(i);
                  const isPrimary = i === primaryIndex;
                  const originalR = results[i];
                  const isMoving = isYong || (originalR === 6 || originalR === 9);

                  let yaoTitle = "";
                  if (isYong) {
                    yaoTitle = isQian ? "用九" : "用六";
                  } else {
                    const r = isZhi
                      ? (originalR === 6 ? 7 : originalR === 9 ? 8 : originalR)
                      : originalR;
                    const isYang = r === 7 || r === 9;
                    const pos = ['二', '三', '四', '五'];
                    if (i === 0) yaoTitle = isYang ? "初九" : "初六";
                    else if (i === 5) yaoTitle = isYang ? "上九" : "上六";
                    else yaoTitle = isYang ? `九${pos[i - 1]}` : `六${pos[i - 1]}`;
                  }

                  const txtYaoCi = yao.yaoCi || guaInfo.yaoCi?.[i] || "";
                  const txtYaoXiang = yao.yaoXiang || guaInfo.yaoXiang?.[i] || "";
                  const txtBaiHua = yao.baiHua || "";
                  const txtShaoYong = yao.shaoYong || "";

                  let rowBgClass = "bg-white hover:bg-stone-50/50";
                  if (isHighlight || isPrimary) {
                    rowBgClass = "bg-amber-50/60 hover:bg-amber-50/90";
                  } else if (isMoving) {
                    rowBgClass = "bg-crimson/[0.02] hover:bg-crimson/[0.04]";
                  }

                  return (
                    <tr key={i} className={`transition-colors ${rowBgClass}`}>
                      <td className="p-4 border-r border-stone-200 text-center font-bold text-ink align-middle font-serif">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm tracking-wide">{yaoTitle}</span>
                          {(isPrimary || (isMoving && !isYong)) && (
                            <div className="flex items-center gap-1 text-[10px] font-sans">
                              {isPrimary && <span className="text-amber-700 font-bold">主占</span>}
                              {isMoving && !isYong && <span className="text-crimson font-semibold">变爻</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top text-sm font-bold text-ink leading-relaxed font-serif">
                        {txtYaoCi}
                      </td>
                      <td className="p-4 align-top text-xs text-stone-500 italic leading-relaxed">
                        {txtYaoXiang}
                      </td>
                      {hasBaiHua && (
                        <td className="p-4 align-top text-xs text-stone-600 font-sans leading-relaxed">
                          {txtBaiHua}
                        </td>
                      )}
                      {hasShaoYong && (
                        <td className="p-4 align-top text-xs text-stone-700 font-sans leading-relaxed">
                          {txtShaoYong}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-stone-400 text-xs font-sans">
            注：红点标示为变爻，浅琥珀底色为依据朱熹《易学启蒙》判定之主占理爻。
          </p>
        </div>
      </div>
    </div>
  );
};
