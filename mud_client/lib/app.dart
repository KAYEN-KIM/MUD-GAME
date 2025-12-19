import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/session_state.dart';
import 'features/auth/auth_screen.dart';
import 'features/home/home_screen.dart';
import 'core/endpoints.dart';

class MudApp extends StatelessWidget {
  const MudApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SessionState()..init(),
      child: MaterialApp(
        title: 'MUD Client',
        theme: ThemeData(
          primarySwatch: Colors.blue,
          useMaterial3: true,
        ),
        home: Consumer<SessionState>(
          builder: (context, session, _) {
            // 토큰이 있으면 홈으로, 없으면 인증 화면으로
            if (session.token != null) {
              return const HomeScreen();
            }
            
            // URL이 설정되지 않았으면 기본값 설정
            if (session.restUrl == null || session.wsUrl == null) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                session.setUrls(
                  Endpoints.getDefaultRestUrl(),
                  Endpoints.getDefaultWsUrl(),
                );
              });
            }
            
            return const AuthScreen();
          },
        ),
        routes: {
          '/auth': (_) => const AuthScreen(),
          '/home': (_) => const HomeScreen(),
        },
      ),
    );
  }
}

