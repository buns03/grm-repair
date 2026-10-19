import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_state.dart';
import 'firebase_options.dart';
import 'home_shell.dart';
import 'login_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(ChangeNotifierProvider(create: (_) => AuthState(), child: const GrmApp()));
}

class GrmApp extends StatelessWidget {
  const GrmApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'GRM Repair',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const Gate(),
      );
}

class Gate extends StatelessWidget {
  const Gate({super.key});

  @override
  Widget build(BuildContext context) {
    final a = context.watch<AuthState>();
    if (a.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (a.user == null) return const LoginScreen();
    if (a.profile == null || !a.profile!.active) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  a.profile == null
                      ? 'Your account has no profile yet. Please contact an admin.'
                      : 'This account is disabled. Please contact an admin.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                OutlinedButton(onPressed: a.logout, child: const Text('Sign out')),
              ],
            ),
          ),
        ),
      );
    }
    return const HomeShell();
  }
}
