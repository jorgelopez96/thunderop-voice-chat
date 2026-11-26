package com.thunderop.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // El WebView solo puede usar micrófono y cámara si la app tiene el permiso de Android: se piden al abrir.
    // Si se niegan, la llamada avisa "No hay permiso…" y se pueden dar después desde Ajustes → Apps → Thunderop.
    val faltan = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
      .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
    if (faltan.isNotEmpty()) ActivityCompat.requestPermissions(this, faltan.toTypedArray(), 1)
  }
}
