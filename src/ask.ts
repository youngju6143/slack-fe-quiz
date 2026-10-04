import { WebClient } from '@slack/web-api';
import { env, QUESTION_EVENT } from './config.js';
import { QUESTIONS } from './questions.js';

const slack = new WebClient(env('SLACK_BOT_TOKEN'));
const channel = env('SLACK_CHANNEL_ID');

/** 2026-01-05(월)부터 지난 평일 수. 주말은 건너뛰어서 평일마다 다음 질문이 나와요. */
function weekdayCount(now = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = Date.UTC(2026, 0, 5);
  const today = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const days = Math.floor((today - start) / 86_400_000);
  return Math.floor(days / 7) * 5 + Math.min(days % 7, 5);
}

const index = weekdayCount() % QUESTIONS.length;
const question = QUESTIONS[index];

await slack.chat.postMessage({
  channel,
  text: `*[오늘의 FE 질문 #${index + 1}]*\n${question}\n\n_스레드로 답변을 달면 AI가 채점해 드려요._`,
  metadata: {
    event_type: QUESTION_EVENT,
    event_payload: { index, question },
  },
});

console.log(`질문 #${index + 1} 전송: ${question}`);
