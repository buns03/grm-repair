import 'package:flutter/material.dart';

const kBlue = Color(0xFF2563EB);
const kBlueDark = Color(0xFF1D4ED8);
const kBlueSoft = Color(0xFFEEF4FF);
const kNavy = Color(0xFF0C2150);
const kYellow = Color(0xFFF5B00A);
const kYellowSoft = Color(0xFFFFF4D1);
const kOk = Color(0xFF12A36B);
const kBad = Color(0xFFDC2626); // delete / errors only
const kInk = Color(0xFF0F1B36);
const kMuted = Color(0xFF6B7A99);
const kLine = Color(0xFFE2E9F5);
const kBg = Color(0xFFF3F6FC);

// Old name kept so the screens you didn't change turn blue automatically.
const kOrange = kBlue;

const softShadow = [
  BoxShadow(color: Color(0x120C2150), blurRadius: 20, offset: Offset(0, 8)),
];

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: kBlue).copyWith(
    primary: kBlue,
    onPrimary: Colors.white,
    secondary: kYellow,
    surface: Colors.white,
  );
  final r14 = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c, width: w),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: kBg,
      foregroundColor: kInk,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: border(kLine),
      enabledBorder: border(kLine),
      focusedBorder: border(kBlue, 1.6),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: r14,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 46),
        shape: r14,
        foregroundColor: kInk,
        side: const BorderSide(color: kLine),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: r14,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: const BorderSide(color: kLine),
      backgroundColor: Colors.white,
      selectedColor: kBlue.withOpacity(0.14),
      showCheckmark: false,
      labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: kInk),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 12,
      shadowColor: kNavy.withOpacity(0.25),
      height: 68,
      indicatorColor: kBlue.withOpacity(0.14),
      labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: kBlue,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    dividerTheme: const DividerThemeData(color: kLine, thickness: 1),
  );
}