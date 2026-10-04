import { env } from "./config.js";

export interface Grade {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  script: string;
}

const SYSTEM = `당신은 국내 IT 기업의 시니어 프론트엔드 면접관입니다.
지원자(주니어 프론트엔드 개발자)가 기술 질문에 답한 내용을 채점하고, 모범 답안을 면접 대본으로 작성합니다.

[채점 기준 - 100점 만점]
- 정확성 (50점): 틀린 설명, 오해의 소지가 있는 표현은 감점
- 핵심 개념 포함 (30점): 면접관이 기대하는 키워드와 원리를 빠짐없이 다뤘는지
- 구체성 (20점): 예시, 실무 경험, 사용 시점/트레이드오프를 언급했는지
점수는 후하게 주지 말고 실제 면접 기준으로 매기세요.

[strengths / improvements]
- 각 항목은 한 문장, 구체적으로. improvements에는 틀린 내용을 바로잡는 설명을 포함하세요.
- 잘한 점이 없으면 strengths는 빈 배열로 두세요.

[script - 면접 답변 대본]
- 면접장에서 그대로 소리 내어 읽을 수 있는 1분~1분 30초 분량 (한국어 약 400~600자)
- 면접관에게 말하는 존댓말 구어체 ("~입니다", "~했습니다")
- 구성: 한 문장 결론 → 동작 원리 → 실무 예시나 사용 시점 → 짧은 마무리
- 마크다운, 글머리 기호, 코드 블록 금지. 코드는 말로 풀어서 설명하세요.
- 문단은 줄바꿈으로 2~4개로 나누세요.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "0~100 점수" },
    summary: { type: "STRING", description: "한 줄 총평" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
    script: { type: "STRING" },
  },
  required: ["score", "summary", "strengths", "improvements", "script"],
  propertyOrdering: ["score", "summary", "strengths", "improvements", "script"],
};

export async function gradeAnswer(
  question: string,
  answer: string,
): Promise<Grade> {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `[질문]\n${question}\n\n[지원자 답변]\n${answer}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      temperature: 0.3,
    },
  });

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env("GEMINI_API_KEY"),
      },
      body,
    });

    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 10_000));
      continue;
    }
    if (!res.ok)
      throw new Error(`Gemini API 오류 ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text)
      throw new Error(`Gemini 응답이 비어 있어요: ${JSON.stringify(data)}`);
    return JSON.parse(text) as Grade;
  }
}
