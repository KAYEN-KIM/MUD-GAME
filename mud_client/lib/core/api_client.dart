import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  final String baseUrl;

  ApiClient(this.baseUrl);

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String characterName,
  }) async {
    try {
      final url = '$baseUrl/auth/register';
      print('[ApiClient] Register 요청 시작');
      print('[ApiClient] URL: $url');
      print('[ApiClient] Email: $email');
      print('[ApiClient] CharacterName: $characterName');
      
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'characterName': characterName,
        }),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('[ApiClient] Register 요청 타임아웃 (10초)');
          throw Exception('서버 연결 타임아웃. 서버가 실행 중인지 확인하세요.');
        },
      );

      // 디버깅을 위한 로그
      print('[ApiClient] Register response status: ${response.statusCode}');
      print('[ApiClient] Register response body: ${response.body}');

      if (response.statusCode == 201 || response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final errorBody = response.body;
        print('[ApiClient] Register 실패: ${response.statusCode} - $errorBody');
        throw Exception('회원가입 실패 (${response.statusCode}): $errorBody');
      }
    } catch (e) {
      print('[ApiClient] Register error: $e');
      print('[ApiClient] Error type: ${e.runtimeType}');
      if (e is http.ClientException) {
        print('[ApiClient] ClientException: ${e.message}');
        throw Exception('서버에 연결할 수 없습니다. 서버 주소와 방화벽을 확인하세요: ${e.message}');
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      // 디버깅을 위한 로그
      print('[ApiClient] Login response status: ${response.statusCode}');
      print('[ApiClient] Login response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final errorBody = response.body;
        throw Exception('로그인 실패 (${response.statusCode}): $errorBody');
      }
    } catch (e) {
      print('[ApiClient] Login error: $e');
      rethrow;
    }
  }
}

