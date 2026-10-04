import { WebClient } from '@slack/web-api';
import { env, GRADE_EVENT, QUESTION_EVENT } from './config.js';
import { gradeAnswer, type Grade } from './llm.js';

const slack = new WebClient(env('SLACK_BOT_TOKEN'));
const channel = env('SLACK_CHANNEL_ID');

type Meta = { event_type?: string; event_payload?: Record<string, unknown> };
type Msg = { ts?: string; text?: string; user?: string; bot_id?: string; reply_count?: number; metadata?: Meta };

const auth = await slack.auth.test();
const isMine = (m: Msg) => (!!m.bot_id && m.bot_id === auth.bot_id) || m.user === auth.user_id;

// 금요일 질문에 월요일 답해도 채점되도록 최근 4일치를 확인
const oldest = String(Math.floor(Date.now() / 1000) - 4 * 86_400);
const history = await slack.conversations.history({ channel, oldest, include_all_metadata: true, limit: 100 });

const questions = ((history.messages ?? []) as Msg[]).filter(
  (m) => isMine(m) && m.metadata?.event_type === QUESTION_EVENT && (m.reply_count ?? 0) > 0,
);

let graded = 0;
for (const q of questions) {
  const questionText = String(q.metadata?.event_payload?.question ?? q.text);
  const replies = await slack.conversations.replies({ channel, ts: q.ts!, include_all_metadata: true, limit: 200 });
  const thread = (replies.messages ?? []) as Msg[];

  const done = new Set(
    thread
      .filter((m) => isMine(m) && m.metadata?.event_type === GRADE_EVENT)
      .map((m) => String(m.metadata?.event_payload?.answer_ts)),
  );

  const pending = thread.slice(1).filter((m) => !isMine(m) && !m.bot_id && m.text?.trim() && !done.has(m.ts!));

  for (const answer of pending) {
    try {
      const result = await gradeAnswer(questionText, answer.text!);
      await slack.chat.postMessage({
        channel,
        thread_ts: q.ts,
        text: format(result, answer.user),
        metadata: { event_type: GRADE_EVENT, event_payload: { answer_ts: answer.ts! } },
      });
      graded++;
    } catch (e) {
      console.error(`채점 실패 (answer ts=${answer.ts})`, e);
      process.exitCode = 1;
    }
  }
}

console.log(`채점 완료: ${graded}건`);

function format(g: Grade, userId?: string): string {
  const bullets = (items: string[]) => items.map((s) => `• ${s}`).join('\n');
  const quote = (s: string) => s.trim().split('\n').map((line) => `> ${line}`).join('\n');
  const parts = [
    `${userId ? `<@${userId}> ` : ''}*점수: ${g.score} / 100*`,
    g.summary,
    g.strengths.length ? `*잘한 점*\n${bullets(g.strengths)}` : '',
    g.improvements.length ? `*보완할 점*\n${bullets(g.improvements)}` : '',
    `*면접 답변 대본*\n${quote(g.script)}`,
  ];
  return parts.filter(Boolean).join('\n\n');
}
