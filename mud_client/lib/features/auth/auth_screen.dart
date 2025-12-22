import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../home/home_screen.dart';
import '../settings/settings_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _characterNameController = TextEditingController();
  bool _isLogin = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _characterNameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이메일과 비밀번호를 입력하세요.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final session = context.read<SessionState>();
      
      if (_isLogin) {
        // 로그인
        await session.login(
          _emailController.text,
          _passwordController.text,
        );
      } else {
        // 회원가입
        final characterName = _characterNameController.text.isEmpty
            ? _emailController.text.split('@')[0] // 이메일 앞부분을 캐릭터 이름으로 사용
            : _characterNameController.text;
        
        await session.register(
          _emailController.text,
          _passwordController.text,
          characterName,
        );
      }

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      print('[AuthScreen] Register error: $e');
      if (mounted) {
        String errorMessage = '오류: $e';
        // 더 친화적인 에러 메시지
        if (e.toString().contains('서버에 연결할 수 없습니다') || 
            e.toString().contains('Connection refused') ||
            e.toString().contains('Failed host lookup')) {
          errorMessage = '서버에 연결할 수 없습니다.\n설정 화면에서 서버 주소를 확인하세요.';
        } else if (e.toString().contains('타임아웃')) {
          errorMessage = '서버 응답이 없습니다.\n서버가 실행 중인지 확인하세요.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MUD Client'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: '서버 설정',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              const Icon(Icons.games, size: 80, color: Colors.blue),
              const SizedBox(height: 24),
              Text(
                _isLogin ? '로그인' : '회원가입',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: '이메일',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: '비밀번호',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
              ),
              if (!_isLogin) ...[
                const SizedBox(height: 16),
                TextField(
                  controller: _characterNameController,
                  decoration: const InputDecoration(
                    labelText: '캐릭터 이름 (선택사항)',
                    hintText: '비워두면 이메일 앞부분 사용',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_isLogin ? '로그인' : '회원가입'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: _isLoading ? null : () {
                  setState(() {
                    _isLogin = !_isLogin;
                  });
                },
                child: Text(_isLogin ? '회원가입으로 전환' : '로그인으로 전환'),
              ),
            ],
          ),
        ),
        ),
      ),
    );
  }
}

