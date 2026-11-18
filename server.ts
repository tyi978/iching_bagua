import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GUA_DICT } from "./src/lib/guaDict";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API 路由：处理解卦
  app.post("/api/interpret", async (req, res) => {
    try {
      const { benGua, zhiGua, movingLines, question } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const effectiveZhiGua = zhiGua || benGua;
      const benData = GUA_DICT[benGua];
      const zhiData = GUA_DICT[effectiveZhiGua];

      if (!benData || !zhiData) {
        return res.status(400).json({ error: "卦象数据不全" });
      }

      const prompt = `
        你是一位精通《周易》与国学传统文化的占卜大师。
        用户求问：${question || "通用运势"}
        起卦结果如下：
        本卦：${benGua} (${benData.guaCi})
        变爻索引（0-5，从初爻到上爻）：${movingLines.join(", ")}
        之卦：${effectiveZhiGua} (${zhiData.guaCi})

        请根据卦辞、象传、爻辞以及阴阳消长之理，为用户提供深刻且具有指引意义的解读。
        重点解析变爻对当下局势的转化作用。

        请返回一个 JSON 对象，包含以下字段：
        - interpretation: 针对问题的深度解析与具体建议（Markdown 格式，建议 400 字左右）
        - aphorism: 一句话格言

        不要返回任何 Markdown 代码块，只返回纯 JSON。
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const aiText = response.text;
      const aiResult = JSON.parse(aiText);

      // Helper function to map Yao details correctly (handling Qian/Kun extra lines)
      const mapYaoDetails = (data: any) => {
        return data.yaoCi.slice(0, 6).map((ci: string, i: number) => ({
          yaoCi: ci,
          xiaoXiang: data.yaoXiang[i]
        }));
      };

      const finalResult = {
        benGuaDetails: {
          name: benGua,
          guaCi: benData.guaCi,
          tuanZhuan: benData.tuanZhuan,
          daXiang: benData.xiangZhuan,
          yaoDetails: mapYaoDetails(benData)
        },
        zhiGuaDetails: {
          name: effectiveZhiGua,
          guaCi: zhiData.guaCi,
          tuanZhuan: zhiData.tuanZhuan,
          daXiang: zhiData.xiangZhuan,
          yaoDetails: mapYaoDetails(zhiData)
        },
        interpretation: aiResult.interpretation,
        aphorism: aiResult.aphorism
      };

      res.json(finalResult);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
