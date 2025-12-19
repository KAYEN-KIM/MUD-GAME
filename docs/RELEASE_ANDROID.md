# Android 릴리즈 가이드

MUD 게임 Android 앱의 릴리즈 빌드(AAB/APK) 생성 및 배포 가이드입니다.

---

## 🎯 목표

- ✅ Release AAB (Google Play용)
- ✅ 서명된 빌드 (keystore)
- ✅ GitHub Actions 자동화
- ✅ Artifact 관리

---

## 🔑 Keystore 생성 (최초 1회)

### 1. Keystore 파일 생성

**Windows PowerShell:**
```powershell
# Java keytool 경로 확인
where.exe keytool

# Keystore 생성
keytool -genkey -v -keystore mud-release.keystore -alias mud-key -keyalg RSA -keysize 2048 -validity 10000
```

**입력 정보:**
- Keystore password: 안전한 비밀번호 (기록 필수!)
- Key password: 안전한 비밀번호 (기록 필수!)
- 조직 정보: 실제 정보 입력

**생성 결과:**
```
mud-release.keystore 파일 생성
```

### 2. Keystore 정보 기록

**중요: 다음 정보를 안전하게 보관하세요!**
```
Keystore Path: mud-release.keystore
Keystore Password: ************
Key Alias: mud-key
Key Password: ************
```

> ⚠️ **주의**: Keystore를 분실하면 앱 업데이트가 불가능합니다!

---

## 🔐 GitHub Secrets 설정

### 1. Keystore를 Base64로 인코딩

**PowerShell:**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("mud-release.keystore")
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "Keystore base64 인코딩 완료 (클립보드에 복사됨)"
```

### 2. GitHub Secrets 등록

**GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret**

**필수 Secrets (4개):**

| Secret Name | Value | 설명 |
|------------|-------|------|
| `ANDROID_KEYSTORE_BASE64` | (위에서 복사한 base64) | Keystore 파일 (base64) |
| `ANDROID_KEYSTORE_PASSWORD` | (keystore password) | Keystore 비밀번호 |
| `ANDROID_KEY_ALIAS` | `mud-key` | Key alias |
| `ANDROID_KEY_PASSWORD` | (key password) | Key 비밀번호 |

---

## 🏗️ 로컬 빌드 (테스트용)

### Debug APK (서명 불필요)

```bash
cd mud_client
flutter build apk --debug
```

**결과:**
```
build/app/outputs/flutter-apk/app-debug.apk
```

### Release AAB (서명 필요)

#### 1. key.properties 생성

`mud_client/android/key.properties` 생성:

```properties
storePassword=<keystore-password>
keyPassword=<key-password>
keyAlias=mud-key
storeFile=../../mud-release.keystore
```

#### 2. build.gradle 설정 확인

`mud_client/android/app/build.gradle`에 다음이 포함되어 있는지 확인:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### 3. 빌드 실행

```bash
cd mud_client
flutter build appbundle --release
```

**결과:**
```
build/app/outputs/bundle/release/app-release.aab
```

---

## 🤖 GitHub Actions 자동 빌드

### 워크플로우: `.github/workflows/release-android.yml`

**트리거:**
- `workflow_dispatch` (수동 실행)
- `push tags: android-v*` (예: `android-v1.0.0`)

### 수동 실행

1. GitHub 저장소 → Actions → "Release Android Build"
2. "Run workflow" 클릭
3. Build mode 선택:
   - `debug`: 서명 없는 디버그 APK
   - `release`: 서명된 Release AAB/APK
4. "Run workflow" 실행

### 태그로 실행

```bash
git tag android-v1.0.0
git push origin android-v1.0.0
```

### Artifact 다운로드

워크플로우 실행 완료 후:
1. Actions → 해당 실행 클릭
2. Artifacts 섹션에서 다운로드:
   - `mud-game-apk-<sha>`
   - `mud-game-aab-<sha>` (release만)

---

## 📦 Google Play 배포

### 1. Google Play Console 설정

1. [Google Play Console](https://play.google.com/console) 접속
2. "앱 만들기" (최초 1회)
3. 앱 정보 입력

### 2. AAB 업로드

**수동 업로드 (현재):**
1. Play Console → Production → Create new release
2. AAB 파일 업로드
3. Release notes 작성
4. Review → Start rollout

**자동 업로드 (v2 예정):**
- Fastlane 또는 Google Play API 연동

### 3. 버전 관리

`mud_client/pubspec.yaml`:
```yaml
version: 1.0.0+1
# version: <major>.<minor>.<patch>+<build-number>
```

**버전 증가 규칙:**
- Major: 대규모 변경 (1.0.0 → 2.0.0)
- Minor: 기능 추가 (1.0.0 → 1.1.0)
- Patch: 버그 수정 (1.0.0 → 1.0.1)
- Build number: 항상 증가 (매 빌드마다)

---

## 🔍 체크리스트

### 릴리즈 전

- [ ] `pubspec.yaml` 버전 증가
- [ ] `flutter analyze` 통과
- [ ] 로컬 테스트 (debug 빌드)
- [ ] Release notes 작성
- [ ] Keystore/Secrets 확인

### 빌드 후

- [ ] AAB 파일 다운로드
- [ ] APK 로컬 설치 테스트 (optional)
- [ ] Google Play Console 업로드
- [ ] Git tag 푸시

---

## 🚨 문제 해결

### Keystore not found

**원인**: `key.properties` 경로가 잘못됨

**해결**:
```properties
# mud_client/android/key.properties
storeFile=../../mud-release.keystore  # 상대 경로 확인
```

### Signing config error

**원인**: Gradle signingConfig 설정 누락

**해결**: `build.gradle` 확인 (위 "로컬 빌드" 섹션 참조)

### GitHub Actions에서 빌드 실패

**원인**: Secrets 누락 또는 오타

**해결**:
1. Settings → Secrets 확인
2. Secret 이름 정확히 일치 확인
3. Keystore base64 재생성

---

## 📊 버전 히스토리 예시

| Version | Tag | Date | Changes |
|---------|-----|------|---------|
| 1.0.0+1 | android-v1.0.0 | 2025-12-20 | Initial release |
| 1.0.1+2 | android-v1.0.1 | 2025-12-25 | Bug fixes |
| 1.1.0+3 | android-v1.1.0 | 2026-01-10 | S2 release |

---

## 📚 관련 문서

- [Server 릴리즈](./RELEASE_SERVER.md)
- [릴리즈 체크리스트](./RELEASE_CHECKLIST.md)
- [프로덕션 배포](./DEPLOY_LOCAL_PRODLIKE.md)

---

**마지막 업데이트**: 2025-12-20

