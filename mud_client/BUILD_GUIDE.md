# Windows 빌드 및 배포 가이드

## 현재 빌드 상태

### Debug 빌드 (개발용)
- **위치**: `build\windows\x64\runner\Debug\`
- **실행 파일**: `mud_client.exe` (~0.98 MB)
- **필요한 파일들**:
  - `mud_client.exe` - 메인 실행 파일
  - `flutter_windows.dll` - Flutter 엔진 (~40.5 MB)
  - `data\` 폴더 - 리소스 파일들 (assets, fonts 등)

### Release 빌드 (배포용)
Release 빌드를 생성하려면:
```bash
cd mud_client
flutter build windows --release
```

Release 빌드는 다음 위치에 생성됩니다:
- `build\windows\x64\runner\Release\`

---

## 배포 방법

### ❌ 단일 EXE 파일로 빌드 불가
Flutter Windows 앱은 **단일 exe 파일로 빌드되지 않습니다**. 
다음 파일들이 함께 필요합니다:

### ✅ 배포 패키지 구성

배포하려면 다음 폴더 전체를 복사하세요:

```
Release/
├── mud_client.exe          # 실행 파일
├── flutter_windows.dll      # Flutter 엔진 DLL
├── data/                    # 리소스 폴더
│   ├── flutter_assets/      # 게임 리소스
│   └── icudtl.dat          # ICU 데이터
└── (기타 필요한 DLL들)
```

### 📦 배포 패키징 스크립트

배포용 폴더를 생성하는 PowerShell 스크립트:

```powershell
# 배포 폴더 생성
$releasePath = "build\windows\x64\runner\Release"
$distPath = "dist\mud_client"

# Release 빌드 생성
flutter build windows --release

# 배포 폴더 복사
if (Test-Path $distPath) { Remove-Item $distPath -Recurse -Force }
New-Item -ItemType Directory -Path $distPath -Force
Copy-Item "$releasePath\*" -Destination $distPath -Recurse

Write-Host "배포 패키지가 생성되었습니다: $distPath"
```

---

## 실행 방법

### 개발 중 실행
```bash
flutter run -d windows
```

### 빌드된 실행 파일 직접 실행
```bash
# Debug 빌드
.\build\windows\x64\runner\Debug\mud_client.exe

# Release 빌드
.\build\windows\x64\runner\Release\mud_client.exe
```

---

## 파일 크기 최적화

### 현재 크기
- `mud_client.exe`: ~0.98 MB
- `flutter_windows.dll`: ~40.5 MB
- `data\` 폴더: ~수 MB
- **총합**: 약 50-60 MB

### 최적화 옵션
1. **AOT 컴파일**: Release 빌드에서 자동 적용됨
2. **리소스 최적화**: 불필요한 assets 제거
3. **UPX 압축**: exe 파일 압축 (선택사항)

---

## 참고사항

- Debug 빌드는 개발/테스트용입니다
- Release 빌드는 배포용으로 최적화되어 있습니다
- 모든 파일을 함께 배포해야 정상 작동합니다
- 단일 exe로 만들려면 별도의 패키징 도구(예: Inno Setup, NSIS) 사용 필요
