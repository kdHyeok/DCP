# DCP 자동 훅 원인 수정 및 실제 대화 검증 — 2026-11-01

## 결과

DCP 0.1.2에서 자동 훅 발견, 신뢰 승인, 지침 전달, 구현 후 자동 질문과 재설명까지 모두 통과했습니다.

| 확인 항목 | 결과 |
| --- | --- |
| 수정 전 훅 발견 | 0.1.1은 설치·활성 상태였지만 DCP 훅이 0개 |
| 수정 후 훅 발견 | 0.1.2의 SessionStart와 UserPromptSubmit 2개 발견 |
| 신뢰 승인 | 검토한 두 훅의 현재 정의 해시와 내용 해시를 정상 설정 API로 승인 |
| 세션 시작 | SessionStart 1회 완료, context 항목 1개 전달 |
| 사용자 메시지 | UserPromptSubmit 4회 완료, 매번 context 항목 1개 전달 |
| 구현 후 자동 질문 | 스킬 호출·SKILL.md 읽기를 금지한 요청에서도 구현·검증 후 핵심 질문 |
| 모른다는 답변 | 쉬운 설명 후 다른 예제로 재질문 |
| 모호한 동의 | "응, 알겠어"만으로 완료하지 않고 다시 확인 |
| 올바른 설명 | 맞게 이해한 부분을 짚고 추가 질문 없이 종료 |
| 테스트 | 플러그인 단위 검사 7개, 구현 예제 검사 2개 통과 |

## 원인과 수정

이전 패키지는 루트 `plugins/dcp/plugin.json`과 `.codex-plugin/plugin.json`을 함께 포함했습니다.
범용 Agent Plugin 매니페스트가 선택되면 현재 Codex 로더의 `PluginManifestFormat::AgentPlugin` 분기가 훅 소스를 빈 목록으로 처리합니다.
따라서 범용 파일에 훅 경로를 추가해도 스킬과 설치 목록은 보이지만 자동 훅은 발견되지 않았습니다.

[OpenAI의 플러그인 로더 소스](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/loader.rs)의 `load_plugin` 함수에서 이 분기를 확인했고,
같은 로컬 설치에서 범용 매니페스트를 제거한 전후의 `hooks/list` 결과로 재현·해결을 확인했습니다.

수정 범위:

- 루트의 범용 `plugins/dcp/plugin.json` 제거
- `.codex-plugin/plugin.json`을 유일한 진입점으로 유지하고 버전을 0.1.2로 변경
- 루트 범용 매니페스트의 재도입을 막고 실제 훅·스킬 경로를 확인하는 회귀 검사 추가
- DCP 0.1.2 재설치
- DCP 두 훅만 신뢰 승인하고 기존 다른 훅의 승인 상태는 보존

훅 스크립트와 학습 지침은 변경하지 않았습니다. 승인 우회 플래그는 사용하지 않았습니다.
이 구성은 현재 사용 중인 Codex 런타임에서 확인한 호환성 조건이며, 향후 범용 형식의 훅 지원 여부는 별도 재검증해야 합니다.

## 테스트 조건

- Windows, Node.js 24.18.0
- 데스크톱과 같은 Codex 런타임: 0.166.0-alpha.5.1
- 모델: 사용자의 기본 모델 gpt-6.1-sol
- 대화는 ephemeral 모드로 실행해 사용자 채팅 목록에 저장하지 않음
- 테스트 대화에는 DCP 플러그인만 활성화했고, 해당 대화의 `hooks/list(threadId)`에서도 DCP 두 훅만 확인
- 질문 지침을 시험 사용자 프롬프트나 developerInstructions에 직접 넣지 않음
- 첫 프롬프트에 스킬 호출·SKILL.md 읽기 금지 조건을 추가
- 실제 모델의 명령 실행·파일 변경 이벤트에 SKILL.md 읽기나 understanding.cjs 수동 실행이 없는지 자동 검사
- 시험 답변은 테스트 클라이언트가 입력했으며 실제 사용자의 이해도를 평가한 결과가 아님

테스트용 함수는 처음에 입력을 그대로 반환하는 미구현 상태였고, 검사 2개가 모두 실패했습니다.
Codex가 `score.cjs`를 수정한 후 2개 모두 통과했습니다. 테스트 파일의 SHA-256은 수정 전후 동일했습니다.

```text
7DD585E4CDF96F01B2D52408D5660F8605BCE4DD3A4D4AD2F2B32FA5144934C9
```

## 대화 원문

### 1. 구현 요청

시험 사용자:

> 현재 폴더의 score.cjs에서 clampScore(score)를 구현해줘. 유한한 숫자만 받고 아니면 TypeError를 던져. 0 미만은 0, 100 초과는 100, 그 사이 숫자는 그대로 반환해. score.test.cjs는 수정하지 말고 node --test score.test.cjs로 검증해줘. 다른 파일은 수정하지 마. 이번 작업에서는 스킬을 호출하거나 SKILL.md를 읽지 말고 구현해줘.

Codex:

> `score.cjs`에 요청한 검증과 범위 제한을 구현했습니다. 다른 파일은 수정하지 않았고, `node --test score.test.cjs`로 테스트 2개 모두 통과했습니다.
>
> `clampScore('42')`와 `clampScore(127)`은 각각 어떻게 처리되며, 그 이유는 무엇일까요?

### 2. 이해하지 못한 답변

시험 사용자:

> 잘 모르겠어. 숫자처럼 생긴 문자열도 같은 숫자 아니야? 이해하기 쉽게 설명해줘.

Codex:

> 겉으로는 같아 보여도 JavaScript는 **숫자와 문자열을 서로 다른 종류의 값**으로 다뤄요.

이어 `42 + 1`은 `43`, `'42' + 1`은 `'421'`이라는 예를 보여 주고, `Number.isFinite`가 문자열을 자동 변환하지 않는다는 점을 설명했습니다. 마지막 질문:

> 그럼 `clampScore('80')`과 `clampScore(-5)`는 각각 어떻게 처리될까요?

### 3. 모호한 동의

시험 사용자:

> 응, 알겠어.

Codex:

> 그럼 `clampScore('80')`과 `clampScore(-5)`는 각각 어떤 결과가 나오는지, 이유와 함께 짧게 말해볼까요?

### 4. 이해를 입증한 답변

시험 사용자:

> 문자열 '150'은 숫자가 아니라 Number.isFinite 검사에서 실패해서 TypeError가 나. 숫자 150은 유한한 숫자니까 검사를 통과하고 100으로 제한돼. -7은 0이고 63은 그대로 63이야.

Codex:

> 맞아요. 유한한 숫자인지 먼저 검사하고, 통과한 값만 0~100 범위로 제한한다는 흐름을 정확히 이해하셨어요. 이해도 확인을 마칩니다.

## 증거 파일

- `.tmp/dcp-hook-fix/inspect-hooks.json`: 수정 후 두 훅의 미승인 상태
- `.tmp/dcp-hook-fix/trust-hooks.json`: 정상 승인 후 trusted 상태
- `.tmp/dcp-hook-fix/thread-hooks.json`: 실제 테스트 대화에 적용된 DCP 두 훅
- `.tmp/dcp-hook-fix/chat-events.jsonl`: 실제 훅·모델 메시지·도구·턴 이벤트
- `.tmp/dcp-hook-fix/chat-summary.json`: 훅 5회 완료와 대화 4턴 통과 검사
- `.tmp/dcp-hook-fix/chat-finals.json`: 최종 응답 원문
- `.tmp/dcp-hook-fix/verify.cjs`: 실제 런타임 검사 클라이언트
- `.tmp/dcp-hook-fix/fixture/`: 실제 구현·검증한 예제

임시 증거 파일은 Git 추적 대상에서 제외됩니다. 검증은 한 모델과 한 시나리오에 한정되며, 모델이 매번 지침을 동일하게 따르는 것을 보장하지 않습니다.
