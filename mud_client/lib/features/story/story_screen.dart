import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';

class StoryScreen extends StatefulWidget {
  const StoryScreen({super.key});

  @override
  State<StoryScreen> createState() => _StoryScreenState();
}

class _StoryScreenState extends State<StoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionState>().requestStoryList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('메인 스토리'),
      ),
      body: Consumer<SessionState>(
        builder: (context, session, child) {
          final characterName = session.gameState.characterName;
          if (characterName == null) {
            return const Center(child: Text('캐릭터 정보를 불러오는 중...'));
          }

          // 서버에서 받은 실제 스토리 데이터 사용
          final chapters = session.storyChapters;
          
          if (chapters.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('스토리 목록을 불러오는 중...'),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16.0),
            itemCount: chapters.length,
            itemBuilder: (context, index) {
              final chapter = chapters[index];
              final isCompleted = chapter['completed'] as bool? ?? false;
              final requiredLevel = chapter['requiredLevel'] as int? ?? 999;
              final canStart =
                  chapter['canStart'] as bool? ?? ((session.gameState.level ?? 0) >= requiredLevel);
              final isLocked = !isCompleted && !canStart;
              final rewards = chapter['rewards'] as Map<String, dynamic>?;
              final rewardsText = rewards != null
                  ? 'EXP ${rewards['exp'] ?? 0}, 골드 ${rewards['gold'] ?? 0}'
                  : '보상 없음';
              final cinematicText = chapter['cinematicText'] as List?;

              return Card(
                margin: const EdgeInsets.symmetric(vertical: 8.0),
                color: isCompleted
                    ? Colors.green.shade50
                    : isLocked
                        ? Colors.grey.shade200
                        : null,
                child: ExpansionTile(
                  leading: Icon(
                    isCompleted
                        ? Icons.check_circle
                        : isLocked
                            ? Icons.lock
                            : Icons.play_circle_outline,
                    color: isCompleted
                        ? Colors.green
                        : isLocked
                            ? Colors.grey
                            : Colors.blue,
                  ),
                  title: Text(
                    '${chapter['title']}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('요구 레벨: $requiredLevel'),
                      Text('보상: $rewardsText'),
                      if (isCompleted)
                        const Text(
                          '완료됨',
                          style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                        )
                      else if (isLocked)
                        Text(
                          '레벨 $requiredLevel 필요',
                          style: const TextStyle(color: Colors.grey),
                        ),
                    ],
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '스토리',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          Text(chapter['description'] as String),
                          const SizedBox(height: 16),
                          Text(
                            '시네마틱',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          if (cinematicText != null && cinematicText.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: cinematicText
                                    .map((line) => Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 4),
                                          child: Text(
                                            line.toString(),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 14,
                                              fontStyle: FontStyle.italic,
                                            ),
                                          ),
                                        ))
                                    .toList(),
                              ),
                            )
                          else
                            const Text(
                              '시네마틱 텍스트 없음',
                              style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
                            ),
                          const SizedBox(height: 16),
                          if (!isLocked && !isCompleted)
                            ElevatedButton.icon(
                              onPressed: () {
                                final chapterId = chapter['id'] as String?;
                                if (chapterId != null) {
                                  session.completeStoryChapter(chapterId);
                                  // 서버에서 STORY_LIST를 다시 보내주므로 별도 갱신 호출은 생략
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('✅ ${chapter['title']} 완료 처리 요청')),
                                  );
                                }
                              },
                              icon: const Icon(Icons.play_arrow),
                              label: const Text('스토리 완료'),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

