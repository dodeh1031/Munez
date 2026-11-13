package kr.special.stepguide

import android.annotation.SuppressLint
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import java.util.Locale

/**
 * assets/web 의 웹앱을 https://appassets.androidplatform.net/ 로 불러온다.
 * (file:// 이 아니라서 localStorage 가 안정적으로 유지된다.)
 * 소리는 WebView 의 Web Speech 대신 안드로이드 기본 TTS 로 낸다.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView, request: WebResourceRequest
            ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
        }

        initTts()
        webView.addJavascriptInterface(Bridge(), "NativeTTS")
        webView.loadUrl("https://appassets.androidplatform.net/web/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // 학생이 실수로 앱을 나가지 않도록 뒤로가기는 무시한다.
            }
        })
    }

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val r = tts?.setLanguage(Locale.KOREAN)
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) = notifyDone(id)
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String?) = notifyDone(id)
                    override fun onStop(id: String?, interrupted: Boolean) {
                        // 새 말이 이전 말을 끊은 경우에는 완료 신호를 보내지 않는다.
                    }
                })
            }
        }
    }

    private fun notifyDone(id: String?) {
        val n = id?.toIntOrNull() ?: return
        runOnUiThread {
            webView.evaluateJavascript("window.__ttsDone && window.__ttsDone($n)", null)
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun speak(text: String, rate: Float, volume: Float, id: Int) {
            val engine = tts
            if (engine == null || !ttsReady) {
                // 한국어 음성이 없으면 소리 없이 다음 흐름이 이어지도록 완료만 알린다.
                notifyDone(id.toString())
                return
            }
            engine.setSpeechRate(rate.coerceIn(0.3f, 1.5f))
            val params = Bundle().apply {
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume.coerceIn(0f, 1f))
            }
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, id.toString())
        }

        @JavascriptInterface
        fun stop() {
            tts?.stop()
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        webView.destroy()
        super.onDestroy()
    }
}
