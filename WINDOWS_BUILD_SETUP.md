# Windows 네이티브 빌드 설정 가이드

## 문제
`atlstr.h` 헤더 파일을 찾을 수 없어 빌드 실패

## 해결 방법

### 1. Visual Studio Installer 실행
- 시작 메뉴에서 "Visual Studio Installer" 검색 및 실행
- 또는 `C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe` 실행

### 2. 수정 버튼 클릭
- "Visual Studio Build Tools 2022" 옆의 **"수정"** 버튼 클릭

### 3. 필요한 워크로드 확인
다음 워크로드가 체크되어 있는지 확인:
- ✅ **C++를 사용한 데스크톱 개발** (Desktop development with C++)

### 4. 개별 컴포넌트 추가
- **"개별 컴포넌트"** 탭 클릭
- 다음 항목들을 검색하여 체크:
  - ✅ **ATL (최신 v143 빌드 도구용)** (ATL for latest v143 build tools)
  - ✅ **C++ ATL (최신 v143 빌드 도구용)** (C++ ATL for latest v143 build tools)
  - ✅ **Windows 10 SDK (10.0.26100.0)** (이미 설치되어 있을 수 있음)

### 5. 수정 완료
- **"수정"** 버튼 클릭하여 설치 시작
- 설치 완료까지 몇 분 소요될 수 있습니다

### 6. 재빌드
설치 완료 후:
```bash
cd "C:\Users\Kyung\Mud Game\mud_client"
flutter clean
flutter pub get
flutter run -d windows
```

## 대안: flutter_secure_storage 최신 버전 사용

ATL 설치가 어려운 경우, 최신 버전의 flutter_secure_storage를 사용하면 문제가 해결될 수 있습니다:

```yaml
flutter_secure_storage: ^10.0.0  # 최신 버전
```

그 후:
```bash
flutter pub upgrade
flutter clean
flutter run -d windows
```

## 확인 방법

빌드가 성공하면 Windows 앱 창이 열립니다.
