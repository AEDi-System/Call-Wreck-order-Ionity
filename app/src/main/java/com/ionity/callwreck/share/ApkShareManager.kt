package com.ionity.callwreck.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.FileContent
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File as DriveFile
import com.google.api.services.drive.model.Permission
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/**
 * Manages sharing the app's own APK file via Bluetooth, Wi-Fi Direct, or
 * Google Drive.
 *
 * The APK is copied to the cache directory so that [FileProvider] can expose
 * it safely to other apps without requiring storage permissions on API 29+.
 */
class ApkShareManager(private val context: Context) {

    companion object {
        private const val APK_CACHE_DIR  = "apk_share"
        private const val APK_FILE_NAME  = "CallWreckIonity.apk"
        private const val DRIVE_SCOPE    = DriveScopes.DRIVE_FILE
        private const val APP_NAME       = "Call Wreck Ionity"
        private const val MIME_APK       = "application/vnd.android.package-archive"
    }

    // ── APK Uri (FileProvider) ────────────────────────────────────────────────

    /**
     * Copies the installed APK into the app's cache directory and returns a
     * [FileProvider] [Uri] that other apps can read.
     *
     * Returns `null` when the APK path cannot be resolved.
     */
    suspend fun getApkUri(): Uri? = withContext(Dispatchers.IO) {
        val sourceApk = getInstalledApkFile() ?: return@withContext null
        val cacheDir  = File(context.cacheDir, APK_CACHE_DIR).also { it.mkdirs() }
        val destApk   = File(cacheDir, APK_FILE_NAME)

        sourceApk.inputStream().use { input ->
            FileOutputStream(destApk).use { output -> input.copyTo(output) }
        }

        FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            destApk
        )
    }

    private fun getInstalledApkFile(): File? {
        val apkPath = context.packageManager
            .getApplicationInfo(context.packageName, 0)
            .sourceDir
        return File(apkPath).takeIf { it.exists() }
    }

    // ── Google Drive ──────────────────────────────────────────────────────────

    /**
     * Returns a Google Sign-In [Intent] if the user is not yet authenticated,
     * or `null` if a valid account is already signed in.
     */
    fun getDriveSignInIntent(): Intent? {
        val account = GoogleSignIn.getLastSignedInAccount(context)
        val hasScope = account?.grantedScopes?.contains(Scope(DRIVE_SCOPE)) == true
        if (account != null && hasScope) return null

        val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(DRIVE_SCOPE))
            .build()
        return GoogleSignIn.getClient(context, signInOptions).signInIntent
    }

    /**
     * Uploads the APK to the user's Google Drive, sets it publicly shareable,
     * and returns the download link via [onSuccess].
     */
    suspend fun uploadToDriveAndShare(
        onSuccess: (String) -> Unit,
        onError:   () -> Unit
    ) = withContext(Dispatchers.IO) {
        try {
            val account = GoogleSignIn.getLastSignedInAccount(context)
                ?: run { withContext(Dispatchers.Main) { onError() }; return@withContext }

            val credential = GoogleAccountCredential.usingOAuth2(
                context, listOf(DRIVE_SCOPE)
            ).also { it.selectedAccount = account.account }

            val driveService = Drive.Builder(
                NetHttpTransport(),
                GsonFactory.getDefaultInstance(),
                credential
            ).setApplicationName(APP_NAME).build()

            val sourceApk = getInstalledApkFile()
                ?: run { withContext(Dispatchers.Main) { onError() }; return@withContext }

            val metadata = DriveFile().apply {
                name     = APK_FILE_NAME
                mimeType = MIME_APK
            }
            val mediaContent = FileContent(MIME_APK, sourceApk)
            val uploadedFile = driveService.files()
                .create(metadata, mediaContent)
                .setFields("id, webContentLink")
                .execute()

            // Make the file publicly readable
            val permission = Permission().apply {
                type = "anyone"
                role = "reader"
            }
            driveService.permissions()
                .create(uploadedFile.id, permission)
                .execute()

            val link = uploadedFile.webContentLink ?: uploadedFile.id
            withContext(Dispatchers.Main) { onSuccess(link) }

        } catch (e: Exception) {
            withContext(Dispatchers.Main) { onError() }
        }
    }
}
