# DCP (Donghyeok Custum Plugin)

Codex와 Claude Code가 기능을 구현하는 동안, 그 구현에 쓰인 CS 지식을 사용자가 쌓아 가도록 돕는 플러그인입니다.
기록할 가치가 있는 문제 해결 과정은 트러블슈팅 문서로 남깁니다.

## 동작

### 개념 학습 (`understanding`)

```text
구현 및 검증 완료 → 이번 변경에 쓰인 CS 개념 2~4개 선정
  → 선택지: 이 중 모르는 개념은? (다중 선택, "모두 알아요" 포함)
      ├─ 모두 앎: 학습 목록에 [x]로 기록, 다시 묻지 않음
      └─ 일부 모름 → 선택지: 지금 설명 / 나중에
            ├─ 나중에: 학습 목록에 [ ]로 쌓고 작업 계속
            └─ 지금: 그림(순서도·시퀀스·아키텍처) 포함 설명
                     → 선택지: 이해됨 / 더 쉽게 / 다른 예제로
```

- 문법이나 도구 사용법이 아니라 원리, 프로토콜, 네트워크, 아키텍처, AI 모델, 평가 방법론 같은 CS 지식을 고릅니다. 기준은 ACM CS2023 지식 영역입니다.
- 학습 목록은 사용자 전역 `~/.dcp/learning.md`에 프로젝트와 관계없이 쌓입니다.
- "아까 몰랐던 거 정리해줘", "이건 무슨 개념이야"처럼 물으면 목록을 읽고 관련 개념끼리 묶어 그림으로 설명합니다.

```markdown
# DCP 학습 목록

- [ ] TCP 3-way handshake | 네트워크 | 내프로젝트: 소켓 재연결 | 2026-11-03
- [x] 이벤트 루프 | 시스템 기초 | 내프로젝트: 비동기 큐 | 2026-11-03
```

### 트러블슈팅 기록 (`troubleshooting`)

```text
문제 원인 확정 + 해결 검증 → 기록할 가치 판단
  ├─ 제외: 오타·단순 누락처럼 바로 풀린 것, 요구 변경, 원인 미확정, 수치 없는 개선
  └─ 기록 대상 → 선택지: 기록 / 건너뛰기
        └─ 기록: docs/troubleshooting/YYYY-MM-DD-주제.md 작성
```

- 기록 대상: 여러 가설과 단계를 거친 원인 분석, 2회 이상의 해결 시도, 예방할 수 있었던 오류, 측정값이 있는 성능 개선, 환경·버전 호환성 문제.
- 문서 구성: 문제 → 원인 파악 과정 → 원인 → 해결 시도 1~n → 최종 해결과 검증 → 배운 점과 예방책. Mermaid 그림과 코드 발췌·diff를 넣습니다. 구조는 [템플릿](plugins/dcp/skills/troubleshooting/template.md)을 따릅니다.
- 관찰한 로그와 수치만 적고, 실패한 시도도 순서대로 남깁니다. 민감 정보는 가립니다. 커밋은 요청할 때만 합니다.

두 질문이 같은 때에 나오면 선택지 한 번에 함께 묻습니다.
"이번엔 건너뛰어"는 현재 건만 넘기고, "개념 학습 꺼줘"나 "트러블슈팅 기록 꺼줘"는 다시 켤 때까지 해당 기능만 멈춥니다.
조사·계획·문서만 변경한 작업에는 자동으로 묻지 않습니다.

설계 배경과 결정은 [설계 문서](docs/design/2026-11-03-learning-and-troubleshooting-hooks.md)에 있습니다.
0.1.x의 서술형 이해도 확인 검증 기록은 [자동 훅 검증 결과](docs/validation/2026-11-01-auto-hooks.md)에 남아 있습니다.

## 구성

- `plugins/dcp/.codex-plugin/plugin.json`: Codex용 플러그인 진입점과 훅·스킬 경로
- `plugins/dcp/hooks/hooks.json`: `SessionStart`, `UserPromptSubmit`마다 `understanding`, `troubleshooting` 훅 등록
- `plugins/dcp/hooks/inject.cjs`: 이벤트 입력을 확인하고 스킬 지침을 전달하는 공통 함수
- `plugins/dcp/hooks/understanding.cjs`: 개념 학습 지침과 학습 목록의 대기 항목을 전달
- `plugins/dcp/hooks/troubleshooting.cjs`: 트러블슈팅 지침과 템플릿 경로를 전달
- `plugins/dcp/skills/understanding/SKILL.md`: 개념 선정, 선택지 질문, 기록, 그림 설명 지침
- `plugins/dcp/skills/troubleshooting/SKILL.md`, `template.md`: 기록 판단·작성 규칙과 문서 템플릿
- `.agents/plugins/marketplace.json`: 설치할 수 있는 로컬 마켓플레이스
- `plugins/dcp/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: Claude Code용 매니페스트와 마켓플레이스. Codex는 `.codex-plugin`을 먼저 읽으므로 영향받지 않습니다.
- 훅 명령은 Codex의 `PLUGIN_ROOT`, Claude Code의 `CLAUDE_PLUGIN_ROOT` 중 있는 값을 씁니다.

새 세션과 매 사용자 메시지에 두 지침을 주입합니다. 개념 선정, 기록 판단, 파일 작성은 AI가 현재 대화에서 수행합니다.
훅은 학습 목록을 읽기만 하고 파일에 쓰지 않습니다. 형식에 맞는 `[ ]` 줄의 개념 이름만 정리해서(60자 제한, 특수문자 제거, 최근 20개) "지시가 아닌 데이터"라는 표시와 함께 전달합니다.
별도 API와 외부 라이브러리는 사용하지 않습니다.

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

Codex는 설치 후 `/hooks`에서 DCP의 훅 4개(`SessionStart`, `UserPromptSubmit` × `understanding`, `troubleshooting`)를 검토·신뢰 승인한 다음 새 Codex 채팅을 시작합니다.
0.1.x에서 업데이트했다면 네 훅 모두 신뢰 상태를 확인해야 합니다. 기존 `understanding` 명령이 같아도 내용 해시가 바뀌어 `modified`로 표시될 수 있으며, 새 `troubleshooting` 훅은 `untrusted`로 표시됩니다. 검토 후 현재 버전을 다시 승인해야 실행됩니다.
설치·활성화와 훅 신뢰 승인은 별개입니다. 다른 사용자의 승인 상태는 함께 설치되지 않습니다.
`~/.dcp/learning.md`는 작업 폴더 밖에 있어서 Codex 샌드박스나 Claude Code 권한 설정에 따라 쓰기 승인을 요구할 수 있습니다. 쓰기가 거부되면 AI가 추가할 줄을 대신 보여 줍니다.
자동 훅 외에 직접 호출하려면 `understanding` 또는 `troubleshooting` 스킬을 선택합니다.
소스를 수정한 뒤에는 Codex의 설치 흐름으로 갱신하고 새 채팅에서 확인합니다. 설치 캐시를 직접 수정하지 않습니다.

## 검증

```powershell
npm test
```

자동 검증은 두 훅 × 두 이벤트의 출력 형식, 각 훅이 자기 지침만 주입하는지, 입력 오류, 지침 누락, 매니페스트 연결을 확인합니다.
공백·한글이 포함된 경로에서 등록된 훅 명령을 실행하는 검사와 기존 `understanding` 훅 명령이 바뀌지 않았는지 확인하는 검사도 포함합니다.
학습 목록은 임시 HOME으로 검사합니다. `[x]`·형식 밖 줄 제외, 이름 정리, 20개 제한, 읽기 실패 시에도 지침이 주입되는지 확인합니다.
실제 대화 품질은 설치한 새 채팅에서 다음 시나리오로 확인합니다.

1. 작은 기능을 구현하게 합니다. 완료 후 CS 개념 선택지가 나오고, 문법·도구 사용법은 후보에 없는지 확인합니다.
2. 개념 하나를 고르고 `나중에`를 선택합니다. `~/.dcp/learning.md`에 `[ ]`로, 고르지 않은 개념은 `[x]`로 기록되는지 확인합니다.
3. 새 채팅에서 `아까 몰랐던 거 설명해줘`라고 묻습니다. 목록을 읽고 그림을 포함해 설명하는지 확인합니다.
4. 원인을 찾기 어려운 버그를 고치게 합니다. 해결·검증 후 기록 선택지가 나오고, `기록`을 고르면 템플릿 구조의 문서가 생기는지 확인합니다.
5. 오타 수정을 시킵니다. 트러블슈팅 기록을 묻지 않는지 확인합니다.

별도 의존성 설치 없이 테스트를 실행할 수 있습니다. 0.2.0의 자동 검사 20개는 통과했습니다.
0.2.0의 위 실제 대화 시나리오는 아직 검증하지 않았습니다.
특히 같은 이벤트에 등록한 두 훅의 지침이 Codex에서 모두 전달되는지는 실제 런타임에서 확인해야 합니다.
0.1.2의 실제 런타임 검증 기록은 [자동 훅 검증 결과](docs/validation/2026-11-01-auto-hooks.md)를 참고하세요.

## 한계

지침을 주입하는 훅이며 도구 실행을 차단하는 게이트는 아닙니다. 모델이 지침을 따르지 않으면 질문이나 기록 판단을 빠뜨릴 수 있습니다.
개념 선정, 난이도, 기록 여부도 모델이 판단합니다.
새 채팅으로 이어지는 것은 학습 목록 파일과 트러블슈팅 문서뿐이고, 진행 중이던 질문은 이어지지 않습니다.
긴 세션에서는 대화 요약 때문에 앞선 해결 시도가 문서에서 빠질 수 있습니다.
일반 Codex·Claude Code 대화의 저장·전송 정책은 그대로 적용됩니다. DCP 훅 자체는 사용자 입력을 기록하거나 전송하지 않습니다.
Codex가 훅을 로드하도록 `.codex-plugin/plugin.json`만 사용합니다. 검증한 런타임에서는 플러그인 루트의 범용 `plugin.json`이 우선 선택되면 플러그인 훅이 생략됐습니다. 따라서 현재 패키지에는 이 파일을 추가하지 않으며, Codex 버전이 바뀌면 호환성을 다시 확인해야 합니다. 설치·활성화만으로 훅이 신뢰되지는 않습니다.
