import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'models.dart';

class AuthState extends ChangeNotifier {
  User? user;
  Profile? profile;
  bool loading = true;
  StreamSubscription? _authSub, _profSub;

  AuthState() {
    _authSub = FirebaseAuth.instance.authStateChanges().listen((u) {
      _profSub?.cancel();
      _profSub = null;
      user = u;
      if (u == null) {
        profile = null;
        loading = false;
        notifyListeners();
        return;
      }
      loading = true;
      notifyListeners();
      _profSub = FirebaseFirestore.instance
          .collection('users')
          .doc(u.uid)
          .snapshots()
          .listen((s) {
        profile = s.exists ? Profile(s.id, s.data()!) : null;
        loading = false;
        notifyListeners();
      }, onError: (_) {
        profile = null;
        loading = false;
        notifyListeners();
      });
    });
  }

  Future<void> login(String email, String password) => FirebaseAuth.instance
      .signInWithEmailAndPassword(email: email, password: password);

  Future<void> logout() => FirebaseAuth.instance.signOut();

  @override
  void dispose() {
    _authSub?.cancel();
    _profSub?.cancel();
    super.dispose();
  }
}
