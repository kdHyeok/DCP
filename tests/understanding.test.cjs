const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../plugins/dcp');
const hooks = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks.json'), 'utf8')).hooks;

function runHook(input, script = path.join(root, 'hooks/understanding.cjs')) {
  return spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 5000 });
}

for (const event of ['SessionStart', 'UserPromptSubmit']) {
  test(`${event}: host JSON receives the shared protocol, never the user's input`, () => {
    const result = runHook(JSON.stringify({ hook_event_name: event, prompt: 'DO_NOT_ECHO_ME' }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.hookEventName, event);
    const skill = fs.readFileSync(path.join(root, 'skills/understanding/SKILL.md'), 'utf8');
    assert.equal(output.additionalContext, skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim());
    assert.ok(!result.stdout.includes('DO_NOT_ECHO_ME'));
    assert.equal(hooks[event][0].hooks[0].type, 'command');
  });

  // Codex exports PLUGIN_ROOT; Claude Code exports CLAUDE_PLUGIN_ROOT.
  for (const rootVar of ['PLUGIN_ROOT', 'CLAUDE_PLUGIN_ROOT']) test(`${event}: the registered shell command works with spaces and Korean in ${rootVar}`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcp 한글 '));
    try {
      fs.cpSync(root, dir, { recursive: true });
      const env = { ...process.env, [rootVar]: dir };
      if (rootVar !== 'PLUGIN_ROOT') delete env.PLUGIN_ROOT;
      const result = spawnSync(hooks[event][0].hooks[0].command, {
        shell: true,
        env,
        input: JSON.stringify({ hook_event_name: event }),
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).hookSpecificOutput.hookEventName, event);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
}

test('invalid input and unregistered events do not inject instructions or echo input', () => {
  for (const input of ['', 'DO_NOT_ECHO_ME', 'null', '[]', '{}', '{"hook_event_name":"Stop"}']) {
    const result = runHook(input);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^DCP:/);
    assert.ok(!result.stderr.includes('DO_NOT_ECHO_ME'));
  }
});

test('a missing skill reports a hook failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcp-hook-test-'));
  try {
    const script = path.join(dir, 'understanding.cjs');
    fs.copyFileSync(path.join(root, 'hooks/understanding.cjs'), script);
    const result = runHook('{"hook_event_name":"SessionStart"}', script);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^DCP:/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('Codex hook package selects the native manifest and real components', () => {
  // A root Agent Plugin manifest takes precedence and currently suppresses plugin hooks in Codex.
  assert.equal(fs.existsSync(path.join(root, 'plugin.json')), false);
  const codex = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(codex.name, 'dcp');
  assert.ok(fs.statSync(path.join(root, codex.hooks)).isFile());
  assert.ok(fs.statSync(path.join(root, codex.skills, 'understanding/SKILL.md')).isFile());
});

test('Claude Code package exposes the same plugin through its own manifests', () => {
  const claude = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const codex = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(claude.name, codex.name);
  assert.equal(claude.version, codex.version);
  // Claude Code auto-loads hooks/hooks.json and skills/ from the plugin root.
  assert.ok(fs.statSync(path.join(root, 'hooks/hooks.json')).isFile());
  assert.ok(fs.statSync(path.join(root, 'skills/understanding/SKILL.md')).isFile());
  const market = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.claude-plugin/marketplace.json'), 'utf8'));
  const entry = market.plugins.find((plugin) => plugin.name === claude.name);
  assert.equal(path.resolve(__dirname, '..', entry.source), root);
});
