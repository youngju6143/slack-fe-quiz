export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았어요.`);
  return value;
}

export const QUESTION_EVENT = 'fe_quiz_question';
export const GRADE_EVENT = 'fe_quiz_grade';

// Slack이 앱 설정의 표시 이름을 반영하지 않아서 메시지마다 직접 지정 (chat:write.customize 권한 필요)
export const BOT_NAME = '맹넌이';
