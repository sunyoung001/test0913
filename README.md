# 생각코딩

Vite + React와 Firebase로 만든 블록 프로그래밍 과제 플랫폼입니다.

## Firebase 연결

1. Firebase Console에서 웹 앱을 등록합니다.
2. Authentication에서 Google 로그인을 활성화합니다.
3. Firestore Database와 Storage를 생성합니다.
4. `.env.example`을 `.env.local`로 복사하고 웹 앱 설정값을 입력합니다.
5. Firebase CLI로 보안 규칙을 배포합니다.

```bash
firebase deploy --only firestore:rules,storage
```

## 실행

```bash
npm install
npm run dev
```

Firebase 설정 전에는 화면 확인용 예시 데이터가 표시되지만, 과제 등록·학급 추가·파일 제출은 Firebase 연결 후 사용할 수 있습니다.

> 화면 역할 선택은 화면 이동용이며, 서버 권한은 Google 계정과 Firestore의 교사 역할로 별도 검사됩니다. 최초 관리자는 `su1413911@gmail.com`입니다.
