import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_state.dart';

class CraftingScreen extends StatefulWidget {
  const CraftingScreen({Key? key}) : super(key: key);

  @override
  State<CraftingScreen> createState() => _CraftingScreenState();
}

class _CraftingScreenState extends State<CraftingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = Provider.of<SessionState>(context, listen: false);
      session.requestCraftingRecipes();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = Provider.of<SessionState>(context);
    final recipes = session.availableRecipes;

    return Scaffold(
      appBar: AppBar(
        title: const Text('제작'),
        backgroundColor: Colors.brown[700],
      ),
      body: recipes.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: recipes.length,
              itemBuilder: (context, index) {
                final recipe = recipes[index];
                return _buildRecipeCard(recipe, session);
              },
            ),
    );
  }

  Widget _buildRecipeCard(Map<String, dynamic> recipe, SessionState session) {
    final name = recipe['name'] as String;
    final ingredients = recipe['ingredients'] as List;
    final requiredLevel = recipe['requiredLevel'] as int;
    final characterLevel = session.gameState.level ?? 1;
    final canCraft = characterLevel >= requiredLevel;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: Icon(
          Icons.construction,
          color: canCraft ? Colors.brown[700] : Colors.grey,
        ),
        title: Text(
          name,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: canCraft ? Colors.black87 : Colors.grey,
          ),
        ),
        subtitle: Text(
          '요구 레벨: $requiredLevel',
          style: TextStyle(
            fontSize: 11,
            color: canCraft ? Colors.green : Colors.red,
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '필요 재료:',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ...ingredients.map((ingredient) {
                  final itemId = ingredient['itemId'] as String;
                  final qty = ingredient['qty'] as int;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.circle, size: 8),
                        const SizedBox(width: 8),
                        Text('$itemId x$qty'),
                      ],
                    ),
                  );
                }).toList(),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: canCraft
                      ? () {
                          session.craftItem(recipeId: recipe['id'] as String);
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.brown[700],
                    minimumSize: const Size(double.infinity, 44),
                  ),
                  child: Text(canCraft ? '제작하기' : '레벨 부족'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

