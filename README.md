# DCP (Donghyeok Custum Plugin)

Codex가 기능 구현을 마친 뒤, 사용자가 구현 방식을 이해했는지 질문하고 부족한 부분을 쉽게 설명하는 플러그인입니다.

코드가 완성되는 데서 끝나지 않고, 사용자가 핵심 동작과 이유를 자기 말로 설명할 수 있도록 돕습니다.

## 동작

```text
구현 및 검증 완료 → 핵심 질문 하나 → 사용자 답변 대기
  ├─ 이해함: 맞게 이해한 부분을 짚고 종료
  └─ 부족함: 부족한 부분만 쉽게 설명 → 다른 예제로 재질문 → 답변 대기
```

단순히 “이해했나요?”라고 묻는 대신 코드 흐름, 구현 이유, 입력에 따른 결과를 자기 말로 설명하도록 질문합니다.
“네”, “알겠어”만으로 이해했다고 판단하지 않고, 짧은 확인 질문을 이어 갑니다.
사용자가 이번 확인을 건너뛰면 현재 확인만 종료하고, 기능 자체를 끄라고 하면 다시 켤 때까지 자동 질문을 멈춥니다.
조사·계획·문서만 변경한 작업에는 자동 질문하지 않습니다.

예를 들어 숫자 범위를 제한하는 함수를 구현했다면 다음처럼 이어집니다.

```text
Codex: 문자열 '42'와 숫자 127은 각각 어떻게 처리되며, 그 이유는 무엇일까요?
사용자: 잘 모르겠어. 숫자처럼 생긴 문자열도 같은 숫자 아니야?
Codex: 숫자와 문자열의 차이를 실제 코드와 작은 예제로 설명합니다.
       그럼 문자열 '80'과 숫자 -5는 각각 어떻게 처리될까요?
사용자: 문자열은 숫자 검사에서 거부되고, -5는 0으로 제한돼.
Codex: 맞게 이해한 부분을 짚고 확인을 마칩니다.
```

위 내용은 동작을 요약한 예시입니다. 실제 테스트 대화는 [자동 훅 검증 결과](docs/validation/2026-11-01-auto-hooks.md)에 있습니다.

## 구성

- `plugins/dcp/.codex-plugin/plugin.json`: Codex용 플러그인 진입점과 훅·스킬 경로
- `plugins/dcp/hooks/hooks.json`: `SessionStart`, `UserPromptSubmit` 훅 등록
- `plugins/dcp/hooks/understanding.cjs`: 이벤트 입력을 확인하고 학습 지침을 Codex에 전달
- `plugins/dcp/skills/understanding/SKILL.md`: 질문, 답변 판단, 쉬운 설명, 재질문의 공통 지침
- `.agents/plugins/marketplace.json`: 설치할 수 있는 로컬 마켓플레이스
- `plugins/dcp/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: Claude Code용 매니페스트와 마켓플레이스. Codex는 `.codex-plugin`을 먼저 읽으므로 영향받지 않습니다.
- 훅 명령은 Codex의 `PLUGIN_ROOT`, Claude Code의 `CLAUDE_PLUGIN_ROOT` 중 있는 값을 씁니다.

새 세션과 매 사용자 메시지에 동일한 지침을 주입합니다. 이해도 판단과 질문 대기는 AI가 현재 대화에서 수행합니다.
별도 API, 외부 라이브러리, 학습 기록 파일은 사용하지 않습니다.

## 설치

Node.js 18 이상과 플러그인·훅을 지원하는 Codex가 필요합니다. `node` 명령이 Codex 실행 환경의 PATH에 있어야 합니다.
GitHub 저장소를 마켓플레이스로 등록하고 설치합니다.

```powershell
codex plugin marketplace add kdHyeok/DCP --ref main
codex plugin add dcp@dcp-local
```

소스를 직접 확인하거나 개발하려면 복제한 폴더를 등록할 수도 있습니다.

```powershell
git clone https://github.com/kdHyeok/DCP.git
cd DCP
codex plugin marketplace add .
codex plugin add dcp@dcp-local
```

Claude Code에서는 같은 저장소를 Claude Code 마켓플레이스로 등록합니다. 훅·스킬은 Codex와 같은 파일을 씁니다.

```powershell
claude plugin marketplace add kdHyeok/DCP
claude plugin install dcp@dcp-local
```

Claude Code는 설치 즉시 훅이 활성화되며, 새 세션부터 적용됩니다.

Codex는 설치 후 `/hooks`에서 DCP의 `SessionStart`, `UserPromptSubmit` 두 훅을 검토·신뢰 승인한 다음 새 Codex 채팅을 시작합니다.
설치·활성화와 훅 신뢰 승인은 별개입니다. 다른 사용자의 승인 상태는 함께 설치되지 않습니다.
플러그인 자동 훅 외에 직접 호출하려면 `understanding` 스킬을 선택하고 확인할 구현을 지정합니다.
소스를 수정한 뒤에는 Codex의 설치 흐름으로 갱신하고 새 채팅에서 확인합니다. 설치 캐시를 직접 수정하지 않습니다.

## 검증

```powershell
npm test
```

자동 검증은 두 이벤트의 출력 형식, 입력 오류, 지침 누락, 매니페스트 연결을 확인합니다.
공백·한글이 포함된 경로에서 등록된 훅 명령을 실행하는 검사도 포함합니다.
실제 대화 품질은 설치한 새 채팅에서 다음 시나리오로 확인합니다.

1. 작은 기능을 구현하게 합니다. 완료 후 핵심 질문 하나를 하고 답변을 기다리는지 확인합니다.
2. `잘 모르겠어`라고 답합니다. 쉬운 설명과 다른 예제의 재질문이 나오는지 확인합니다.
3. 핵심 동작과 이유를 자기 말로 맞게 답합니다. 확인을 마치고 불필요한 질문을 멈추는지 확인합니다.
4. 다음 구현 후 `이번에는 건너뛰어`라고 요청합니다. 미확인 상태를 이해 완료로 포장하지 않고 건너뛰는지 확인합니다.

별도 의존성 설치 없이 테스트를 실행할 수 있습니다. 자동 검사 7개는 통과했습니다.
2026-11-01에는 Windows, Node.js 24.18.0, Codex 데스크톱 런타임 0.166.0-alpha.5.1, DCP 0.1.2에서 질문 → 쉬운 설명 → 재확인 → 종료를 검증했습니다.
스킬 호출을 금지한 요청에서도 자동 훅 5회가 실행되고 4턴 대화가 통과했습니다.
원인과 변경 사항, 훅 이벤트 및 대화 원문은 [자동 훅 검증 결과](docs/validation/2026-11-01-auto-hooks.md)를 참고하세요.

## 한계

지침을 주입하는 훅이며 도구 실행을 차단하는 게이트는 아닙니다. 모델이 지침을 따르지 않으면 질문을 빠뜨릴 수 있고,
답변의 이해도 판정도 모델의 판단입니다. 질문·답변 상태는 대화 문맥에만 있으므로 새 채팅에 자동으로 이어지지 않습니다.
일반 Codex 대화의 저장·전송 정책은 그대로 적용되며, DCP 훅 자체는 사용자 입력을 기록하거나 전송하지 않습니다.
Codex가 훅을 로드하도록 `.codex-plugin/plugin.json`만 사용합니다. 검증한 런타임에서는 플러그인 루트의 범용 `plugin.json`이 우선 선택되면 플러그인 훅이 생략됐습니다. 따라서 현재 패키지에는 이 파일을 추가하지 않으며, Codex 버전이 바뀌면 호환성을 다시 확인해야 합니다. 설치·활성화만으로 훅이 신뢰되지는 않습니다.
