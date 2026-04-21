package com.ionity.callwreck.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.ionity.callwreck.R

/**
 * Foreground service that hosts a Wi-Fi Direct (P2P) group and
 * streams the APK file to a connected peer.
 *
 * Start this service only after Wi-Fi Direct connection is established.
 * Pass the peer socket address via [EXTRA_PEER_ADDRESS].
 */
class WifiDirectTransferService : Service() {

    companion object {
        const val EXTRA_PEER_ADDRESS   = "peer_address"
        const val EXTRA_FILE_PATH      = "file_path"
        private const val CHANNEL_ID   = "wifi_transfer_channel"
        private const val NOTIF_ID     = 1001

        fun buildIntent(context: Context, peerAddress: String, filePath: String) =
            Intent(context, WifiDirectTransferService::class.java).apply {
                putExtra(EXTRA_PEER_ADDRESS, peerAddress)
                putExtra(EXTRA_FILE_PATH, filePath)
            }
    }

    private lateinit var wifiP2pManager: WifiP2pManager
    private lateinit var channel: WifiP2pManager.Channel

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
        wifiP2pManager = getSystemService(WIFI_P2P_SERVICE) as WifiP2pManager
        channel        = wifiP2pManager.initialize(this, mainLooper, null)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.getStringExtra(EXTRA_PEER_ADDRESS) == null) return START_NOT_STICKY
        if (intent.getStringExtra(EXTRA_FILE_PATH)     == null) return START_NOT_STICKY
        // Socket transfer to the peer is performed in a coroutine once Wi-Fi
        // Direct connection is established (to be implemented in transport layer).
        return START_REDELIVER_INTENT
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        wifiP2pManager.removeGroup(channel, null)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notif_transfer_title))
            .setContentText(getString(R.string.notif_transfer_text))
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()
}
