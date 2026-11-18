import { GoogleGenAI, Type } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { GUA_DICT } from "../src/lib/guaDict.js";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not defined in environment variables.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// We want to generate the detailed content in Batches to avoid output token limits.
const GUA_KEYS = Object.keys(GUA_DICT);
const BATCH_SIZE = 4; // Generate details for 4 hexagrams at a time to be safe and fast

async function generateBatch(keys: string[]) {
  console.log(`Generating batch for: ${keys.join(", ")}...`);

  const requestItems = keys.map(key => {
    const original = GUA_DICT[key];
    return {
      name: key, // e.g., "干"
      guaCi: original.guaCi,
      xiangZhuan: original.xiangZhuan,
      yaoCi: original.yaoCi,
      yaoXiang: original.yaoXiang
    };
  });

  const prompt = `
    你是一位对《周易》（易经）有极深研究的传统国学大师。
    请为以下 ${keys.length} 个卦象生成更详细的易学内容。
    注意：必须将繁体中文全部转换为【简体中文】。尤其是主卦名称，如果名单里是 “干” 卦，请确保在最终返回 JSON 时，name 字段的值仍然精确对应为 “干”（不要错写成 “乾”）。

    你收到的卦象基本数据如下：
    ${JSON.stringify(requestItems, null, 2)}

    你需要对每个卦象补充以下四个字段的数据：
    1. guaCiBaiHua: 卦辞的【白话文解释】。
    2. shaoYongGua: 卦辞的【北宋易学家邵雍解】（包含对主卦整体时运、财运、运势的核心分析，不少于 80 字）。
    3. yaoDetails: 一个数组，与 yaoCi 的长度完全一致。针对爻辞（yaoCi）和该爻对应的爻象（yaoXiang，如小象曰），提供对每一爻的更详尽解释，数组中的每个对象包含：
       - baiHua: 该爻的【白话文解释】（将爻辞和小象的内容融合进行通俗易懂的简体白话翻译解释）。
       - shaoYong: 该爻对应的【北宋易学家邵雍解】（对得此爻者的具体时运吉凶平平的邵雍断词解释，例如“平：得此爻者，宜沉稳待机...”，“吉：得此爻者，大吉大利...”等，不少于 40 字）。

    请严格按照定义的 JSON Schema 格式返回结果。请务必完整补全 ${keys.length} 个卦象，不要遗漏任何一爻。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              description: "Array of detailed hexagram interpretations",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  guaCiBaiHua: { type: Type.STRING },
                  shaoYongGua: { type: Type.STRING },
                  yaoDetails: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        baiHua: { type: Type.STRING },
                        shaoYong: { type: Type.STRING }
                      },
                      required: ["baiHua", "shaoYong"]
                    }
                  }
                },
                required: ["name", "guaCiBaiHua", "shaoYongGua", "yaoDetails"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Received empty response from Gemini");
    const parsed = JSON.parse(text);
    return parsed.results;
  } catch (error) {
    console.error(`Error generating batch for ${keys.join(", ")}:`, error);
    // Retry once after 2 seconds
    console.log("Retrying after 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  guaCiBaiHua: { type: Type.STRING },
                  shaoYongGua: { type: Type.STRING },
                  yaoDetails: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        baiHua: { type: Type.STRING },
                        shaoYong: { type: Type.STRING }
                      },
                      required: ["baiHua", "shaoYong"]
                    }
                  }
                },
                required: ["name", "guaCiBaiHua", "shaoYongGua", "yaoDetails"]
              }
            }
          },
          required: ["results"]
        }
      }
    });
    const parsed = JSON.parse(response.text!);
    return parsed.results;
  }
}

async function main() {
  const finalDict: Record<string, any> = {};
  
  // Read existing file if it exists to compile incrementally in case of interruptions
  const outputPath = path.join(process.cwd(), "src", "lib", "guaDict.json");
  let existingData: Record<string, any> = {};
  if (fs.existsSync(outputPath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      console.log(`Found existing output with ${Object.keys(existingData).length} hexagrams. Preparing to resume/complete...`);
    } catch (e) {
      existingData = {};
    }
  }

  const keysToProcess = GUA_KEYS;

  for (let i = 0; i < keysToProcess.length; i += BATCH_SIZE) {
    const batchKeys = keysToProcess.slice(i, i + BATCH_SIZE);
    
    // Check if all in batch are already in existingData and valid
    const allDone = batchKeys.every(k => {
      const g = existingData[k];
      return g && g.guaCiBaiHua && g.shaoYongGua && g.yaoDetails && g.yaoDetails.length > 0;
    });

    if (allDone) {
      console.log(`Skipping batch: ${batchKeys.join(", ")} (already generated)`);
      for (const k of batchKeys) {
        finalDict[k] = existingData[k];
      }
      continue;
    }

    try {
      const results = await generateBatch(batchKeys);
      for (const res of results) {
        let key = res.name;
        // Check standard name mappings
        if (key === "乾") key = "干";
        if (key === "遯") key = "遁";

        const original = GUA_DICT[key];
        if (!original) {
          console.warn(`WARNING: GUA_DICT matches no key for ${key}. Check model text output.`);
          continue;
        }

        // Combine original fields with newly generated fields
        finalDict[key] = {
          ...original,
          guaCiBaiHua: res.guaCiBaiHua,
          shaoYongGua: res.shaoYongGua,
          yaoDetails: original.yaoCi.map((ci: string, idx: number) => {
            const xiang = original.yaoXiang[idx] || "";
            const detailGen = res.yaoDetails[idx] || { baiHua: "", shaoYong: "" };
            return {
              yaoCi: ci,
              yaoXiang: xiang,
              baiHua: detailGen.baiHua,
              shaoYong: detailGen.shaoYong
            };
          })
        };
      }

      // Write increment to disk immediately
      const currentCombined = { ...existingData, ...finalDict };
      fs.writeFileSync(outputPath, JSON.stringify(currentCombined, null, 2), "utf8");
      console.log(`Saved progress: total of ${Object.keys(currentCombined).length} hexagrams generated.`);
    } catch (err) {
      console.error(`Failed to process batch ${batchKeys.join(", ")}:`, err);
      process.exit(1);
    }

    // Small delay between batches to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  console.log("Successful integration! GUA DICT updated with gua.md detailed translations!");
}

main().catch(err => {
  console.error("Critical Main Error:", err);
  process.exit(1);
});
