import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';
import '../../core/models/quest_models.dart';
import 'widgets/reset_timer_widget.dart';
import 'widgets/season_progress_widget.dart';
import 'widgets/quest_card.dart';

class QuestScreen extends StatefulWidget {
  const QuestScreen({super.key});

  @override
  State<QuestScreen> createState() => _QuestScreenState();
}

class _QuestScreenState extends State<QuestScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    
    // 화면 진입 시 QUEST_LIST 요청
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<SessionState>();
      session.requestQuestList();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<QuestTemplateView> _getQuestsByCadence(List<QuestTemplateView> quests, QuestCadence? cadence) {
    return quests.where((q) => q.cadence == cadence).toList();
  }

  List<QuestActiveView> _getQuestsByCadenceActive(List<QuestActiveView> quests, QuestCadence? cadence) {
    return quests.where((q) => q.cadence == cadence).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('📜 퀘스트'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '데일리', icon: Icon(Icons.today, size: 18)),
            Tab(text: '주간', icon: Icon(Icons.calendar_view_week, size: 18)),
            Tab(text: '메타', icon: Icon(Icons.emoji_events, size: 18)),
            Tab(text: '스토리', icon: Icon(Icons.book, size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        child: Consumer<SessionState>(
          builder: (context, session, _) {
            final availableQuests = session.availableQuests;
            final activeQuests = session.activeQuests;

            return Column(
              children: [
                // 리셋 타이머 & 시즌 진행도
                const ResetTimerWidget(),
                const SeasonProgressWidget(),
                
                // 퀘스트 리스트
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildQuestTab(
                        context,
                        session,
                        _getQuestsByCadence(availableQuests, QuestCadence.daily),
                        _getQuestsByCadenceActive(activeQuests, QuestCadence.daily),
                      ),
                      _buildQuestTab(
                        context,
                        session,
                        _getQuestsByCadence(availableQuests, QuestCadence.weekly),
                        _getQuestsByCadenceActive(activeQuests, QuestCadence.weekly),
                      ),
                      _buildQuestTab(
                        context,
                        session,
                        _getQuestsByCadence(availableQuests, QuestCadence.meta),
                        _getQuestsByCadenceActive(activeQuests, QuestCadence.meta),
                      ),
                      _buildQuestTab(
                        context,
                        session,
                        _getQuestsByCadence(availableQuests, QuestCadence.story),
                        _getQuestsByCadenceActive(activeQuests, QuestCadence.story),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildQuestTab(
    BuildContext context,
    SessionState session,
    List<QuestTemplateView> available,
    List<QuestActiveView> active,
  ) {
    if (available.isEmpty && active.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inbox_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              '퀘스트가 없습니다.',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => session.requestQuestList(),
              child: const Text('새로고침'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        session.requestQuestList();
        await Future.delayed(const Duration(milliseconds: 500));
      },
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: available.length + active.length,
        itemBuilder: (context, index) {
          if (index < available.length) {
            final quest = available[index];
            return QuestCard(
              availableQuest: quest,
              onAccept: () {
                session.questAccept(quest.questId);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${quest.title} 수락 요청...')),
                );
                // 서버가 QUEST_LIST를 푸시하므로 자동 갱신됨
              },
            );
          } else {
            final quest = active[index - available.length];
            return QuestCard(
              activeQuest: quest,
              onTurnIn: () {
                session.questTurnIn(quest.questId);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${quest.title} 제출 요청...')),
                );
                // 서버가 QUEST_LIST를 푸시하므로 자동 갱신됨
              },
            );
          }
        },
      ),
    );
  }
}

