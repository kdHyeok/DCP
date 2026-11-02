const fs = require('node:fs');
const path = require('node:path');

// 훅 입력을 확인하고 스킬 지침과 extra()의 결과를 additionalContext로 출력한다.
// extra는 실패해도 지침 주입을 막지 않도록 스스로 예외를 처리해야 한다.
module.exports = function inject(skill, extra = () => '') {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^﻿/, ''));
    if (!input || !['SessionStart', 'UserPromptSubmit'].includes(input.hook_event_name)) {
      throw new Error('Unsupported hook event');
    }
    const text = fs.readFileSync(path.join(__dirname, '../skills', skill, 'SKILL.md'), 'utf8');
    const instructions = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
    if (!instructions) throw new Error('Empty instructions');
    fs.writeSync(1, JSON.stringify({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: [instructions, extra()].filter(Boolean).join('\n\n'),
      },
    }) + '\n');
  } catch {
    process.stderr.write(`DCP: 훅 입력 또는 ${skill} 지침을 읽을 수 없습니다.\n`);
    process.exitCode = 1;
  }
};
