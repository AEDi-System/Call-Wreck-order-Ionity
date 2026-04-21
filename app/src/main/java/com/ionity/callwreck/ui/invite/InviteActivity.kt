package com.ionity.callwreck.ui.invite

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.ionity.callwreck.R
import com.ionity.callwreck.databinding.ActivityInviteBinding
import com.ionity.callwreck.share.ApkShareManager
import kotlinx.coroutines.launch

/**
 * Invite screen – lets the user share the full application APK with friends
 * via Bluetooth, Wi-Fi Direct, or Google Drive.
 *
 * "Share the total app, not just a link."
 */
class InviteActivity : AppCompatActivity() {

    private lateinit var binding: ActivityInviteBinding
    private lateinit var apkShareManager: ApkShareManager

    // Permission launchers
    private val bluetoothPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.all { it }) shareViaBluetooth()
        else showPermissionDenied()
    }

    private val locationPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) shareViaWifiDirect()
        else showPermissionDenied()
    }

    private val driveSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        // Sign-in complete – retry the Drive upload on success
        lifecycleScope.launch {
            apkShareManager.uploadToDriveAndShare(
                onSuccess = { link -> shareLink(link) },
                onError   = { toast(R.string.error_drive_upload) }
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInviteBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.apply {
            setDisplayHomeAsUpEnabled(true)
            title = getString(R.string.invite_title)
        }

        apkShareManager = ApkShareManager(this)

        binding.btnShareBluetooth.setOnClickListener { requestBluetoothAndShare() }
        binding.btnShareWifi.setOnClickListener     { requestLocationAndShare() }
        binding.btnShareDrive.setOnClickListener    { shareViaDrive() }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    // ── Bluetooth ────────────────────────────────────────────────────────────

    private fun requestBluetoothAndShare() {
        val perms = bluetoothPermissions()
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) shareViaBluetooth() else bluetoothPermLauncher.launch(missing.toTypedArray())
    }

    private fun shareViaBluetooth() {
        lifecycleScope.launch {
            val uri = apkShareManager.getApkUri() ?: run {
                toast(R.string.error_apk_not_found); return@launch
            }
            val intent = Intent(Intent.ACTION_SEND).apply {
                type   = "application/vnd.android.package-archive"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, getString(R.string.app_name))
                putExtra(Intent.EXTRA_TEXT, getString(R.string.invite_message))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            // Let the OS chooser present Bluetooth among the options
            startActivity(Intent.createChooser(intent, getString(R.string.share_via_bluetooth)))
        }
    }

    // ── Wi-Fi Direct ─────────────────────────────────────────────────────────

    private fun requestLocationAndShare() {
        val perm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            Manifest.permission.NEARBY_WIFI_DEVICES
        else
            Manifest.permission.ACCESS_FINE_LOCATION
        if (ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED) {
            shareViaWifiDirect()
        } else {
            locationPermLauncher.launch(perm)
        }
    }

    private fun shareViaWifiDirect() {
        lifecycleScope.launch {
            val uri = apkShareManager.getApkUri() ?: run {
                toast(R.string.error_apk_not_found); return@launch
            }
            val intent = Intent(Intent.ACTION_SEND).apply {
                type   = "application/vnd.android.package-archive"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            // The OS chooser will surface Wi-Fi Direct (Nearby Share) capable apps
            startActivity(Intent.createChooser(intent, getString(R.string.share_via_wifi)))
        }
    }

    // ── Google Drive ──────────────────────────────────────────────────────────

    private fun shareViaDrive() {
        lifecycleScope.launch {
            val signInIntent = apkShareManager.getDriveSignInIntent()
            if (signInIntent != null) {
                driveSignInLauncher.launch(signInIntent)
            } else {
                apkShareManager.uploadToDriveAndShare(
                    onSuccess = { link -> shareLink(link) },
                    onError   = { toast(R.string.error_drive_upload) }
                )
            }
        }
    }

    private fun shareLink(link: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, link)
            putExtra(Intent.EXTRA_SUBJECT, getString(R.string.app_name))
        }
        startActivity(Intent.createChooser(intent, getString(R.string.share_drive_link)))
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun showPermissionDenied() = toast(R.string.error_permission_denied)

    private fun toast(resId: Int) =
        Toast.makeText(this, resId, Toast.LENGTH_SHORT).show()

    private fun bluetoothPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
        else
            arrayOf(
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN
            )
}
