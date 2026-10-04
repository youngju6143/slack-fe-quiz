export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았어요.`);
  return value;
}

export const QUESTION_EVENT = 'fe_quiz_question';
export const GRADE_EVENT = 'fe_quiz_grade';
