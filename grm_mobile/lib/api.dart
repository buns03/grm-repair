import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'util.dart';

// Default works over USB with:  adb reverse tcp:5000 tcp:5000
// Later: flutter run --dart-define=API_URL=https://your-server.example.com
const apiBase = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:5000');

Future<Map<String, dynamic>> api(String path,
    {String method = 'GET', Map<String, dynamic>? body}) async {
  final token = await FirebaseAuth.instance.currentUser!.getIdToken();
  final req = http.Request(method, Uri.parse('$apiBase$path'))
    ..headers['Content-Type'] = 'application/json'
    ..headers['Authorization'] = 'Bearer $token';
  if (body != null) req.body = jsonEncode(body);

  http.Response res;
  try {
    res = await http.Response.fromStream(
        await req.send().timeout(const Duration(seconds: 25)));
  } on SocketException {
    throw AppError('Cannot reach the server. Is it running?');
  } on TimeoutException {
    throw AppError('The server took too long to answer.');
  }

  Map<String, dynamic> data = {};
  try {
    data = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {}
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw AppError((data['error'] ?? 'Request failed').toString());
  }
  return data;
}
