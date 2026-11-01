const fs = require('node:fs');
const path = require('node:path');

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  if (!input || !['SessionStart', 'UserPromptSubmit'].includes(input.hook_event_name)) {
    throw new Error('Unsupported hook event');
  }
  const skill = fs.readFileSync(path.join(__dirname, '../skills/understanding/SKILL.md'), 'utf8');
  // shortcut: 이해 판단과 대기 상태는 모델의 대화 문맥에 맡긴다. 강제 차단이 필요해지면 상태 기반 게이트로 교체한다.
  const instructions = skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  if (!instructions) throw new Error('Empty instructions');
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      additionalContext: instructions,
    },
  }) + '\n');
} catch {
  process.stderr.write('DCP: 훅 입력 또는 이해도 확인 지침을 읽을 수 없습니다.\n');
  process.exitCode = 1;
}
