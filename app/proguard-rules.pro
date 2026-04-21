# Add project-specific ProGuard rules here.
# By default, the flags in this file are appended to the flags specified in the
# Android SDK's proguard-android-optimize.txt.

# Keep Google API / Drive SDK classes
-keep class com.google.api.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.api.**
-dontwarn com.google.android.gms.**

# Keep our own share/service classes
-keep class com.ionity.callwreck.share.** { *; }
-keep class com.ionity.callwreck.service.** { *; }
