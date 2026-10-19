import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'account_screen.dart';
import 'auth_state.dart';
import 'dashboard_screen.dart';
import 'leaderboard_screen.dart';
import 'repairs_screen.dart';
import 'team_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _i = 0;

  Future<void> _logout() async {
    final ok = await confirmDialog(context,
        title: 'Sign out?',
        message: "You'll need to sign in again to continue.",
        confirmText: 'Sign out');
    if (ok && mounted) context.read<AuthState>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final admin = context.watch<AuthState>().profile!.role == 'admin';
    final tabs = <(String, IconData, IconData, Widget)>[
      ('Repairs', Icons.assignment_outlined, Icons.assignment, const RepairsScreen()),
      ('Dashboard', Icons.insights_outlined, Icons.insights, const DashboardScreen()),
      ('Leaderboard', Icons.emoji_events_outlined, Icons.emoji_events, const LeaderboardScreen()),
      if (admin) ('Team', Icons.groups_outlined, Icons.groups, const TeamScreen()),
      ('Account', Icons.person_outline, Icons.person, const AccountScreen()),
    ];
    if (_i >= tabs.length) _i = 0;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        titleSpacing: 16,
        title: Row(children: [
          const Logo(size: 36),
          const SizedBox(width: 12),
          Text(tabs[_i].$1,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, letterSpacing: -0.4)),
        ]),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: kLine)),
            child: IconButton(
                onPressed: _logout,
                icon: const Icon(Icons.logout, size: 20, color: kInk),
                tooltip: 'Sign out'),
          ),
        ],
      ),
      body: tabs[_i].$4,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _i,
        onDestinationSelected: (v) => setState(() => _i = v),
        destinations: [
          for (final t in tabs)
            NavigationDestination(
              icon: Icon(t.$2, color: kMuted),
              selectedIcon: Icon(t.$3, color: kBlue),
              label: t.$1,
            ),
        ],
      ),
    );
  }
}