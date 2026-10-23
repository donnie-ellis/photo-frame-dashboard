package com.wesbos.homehq;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen kiosk WebView for the Home HQ wall tablet.
 * - Immersive mode hides the status + navigation bars (true 1280x800).
 * - It is also a Home app, so it starts at boot once chosen as the default Home.
 * - Exit: hold two fingers still on the screen for 1.5s to go to the regular launcher.
 * - Remote debugging is OFF unless launched with the debug extra (every app on this device
 *   gets root, so the devtools socket should only exist while actively debugging):
 *     adb shell am start -n com.wesbos.homehq/.MainActivity --ez debug true
 * - Launch with a URL: adb shell am start -a android.intent.action.VIEW -d <url> -n com.wesbos.homehq/.MainActivity
 * - Set up a frame once (saved, used on every launch). The token is this frame's frame-bridge token,
 *   sent as the frame_token cookie to the saved URL's host only:
 *     adb shell am start -n com.wesbos.homehq/.MainActivity --es url http://<mac-ip>:8787/ --es token <token>
 *   Changing the url without a token clears the saved token, so it never follows a new host.
 * - If the page fails to load (at boot, Wi-Fi often isn't up yet), it retries with backoff, up to
 *   every 30s, until it loads.
 */
public class MainActivity extends Activity {
  static final String TAG = "HomeHQ";
  static final String DEFAULT_URL = "https://home-dashboard.wesbos.workers.dev/";
  static final String TOKEN_COOKIE = "frame_token";
  static final long EXIT_HOLD_MS = 1500;
  static final float EXIT_SLOP_PX = 60;
  static final long RETRY_MIN_MS = 2000;
  static final long RETRY_MAX_MS = 30000;

  private WebView web;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final int[] exitIds = new int[2];
  private final float[] exitX = new float[2];
  private final float[] exitY = new float[2];
  private boolean exitArmed;
  private boolean loadFailed;
  private long retryMs = RETRY_MIN_MS;
  private String retryUrl;

  private final Runnable retryLoad = new Runnable() {
    @Override
    public void run() {
      Log.i(TAG, "Retrying " + retryUrl);
      web.loadUrl(retryUrl);
    }
  };

  private final Runnable exitToLauncher = new Runnable() {
    @Override
    public void run() {
      exitArmed = false;
      Log.i(TAG, "Two-finger hold: exiting to launcher");
      Intent home = new Intent(Intent.ACTION_MAIN);
      home.addCategory(Intent.CATEGORY_HOME);
      home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      // When the kiosk is the default Home, a plain Home intent would just reopen it.
      for (ResolveInfo ri : getPackageManager().queryIntentActivities(home, 0)) {
        if (!ri.activityInfo.packageName.equals(getPackageName())) {
          home.setClassName(ri.activityInfo.packageName, ri.activityInfo.name);
          break;
        }
      }
      startActivity(home);
      finish();
    }
  };

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    applyDebugFlag(getIntent());
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_FULLSCREEN);

    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setUseWideViewPort(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    web.setWebViewClient(new KioskClient()); // keep navigation inside the kiosk
    setContentView(web);

    saveConfig(getIntent());
    setTokenCookie();
    String url = getIntent().getDataString();
    web.loadUrl(url != null ? url : prefs().getString("url", DEFAULT_URL));
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    applyDebugFlag(intent);
    String url = intent.getDataString();
    if (saveConfig(intent)) {
      setTokenCookie();
      if (url == null) url = prefs().getString("url", DEFAULT_URL);
    }
    if (url != null) web.loadUrl(url);
  }

  /** Retries the page when the main frame can't load, e.g. Wi-Fi isn't up yet at boot. */
  private class KioskClient extends WebViewClient {
    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
      handler.removeCallbacks(retryLoad);
      loadFailed = false;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
      if (req.isForMainFrame()) scheduleRetry(req.getUrl().toString(), "error " + err.getErrorCode() + " " + err.getDescription());
    }

    @Override
    public void onPageFinished(WebView view, String url) {
      if (!loadFailed) retryMs = RETRY_MIN_MS;
    }
  }

  private void scheduleRetry(String url, String why) {
    loadFailed = true;
    retryUrl = url;
    Log.w(TAG, "Load failed (" + why + "), retrying in " + retryMs + "ms: " + url);
    handler.removeCallbacks(retryLoad);
    handler.postDelayed(retryLoad, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  private SharedPreferences prefs() {
    return getSharedPreferences("kiosk", MODE_PRIVATE);
  }

  /** Saves the url/token extras, if any. Returns true when something changed. */
  private boolean saveConfig(Intent intent) {
    if (intent == null) return false;
    String url = intent.getStringExtra("url");
    String token = intent.getStringExtra("token");
    if (url == null && token == null) return false;
    SharedPreferences.Editor ed = prefs().edit();
    if (url != null) ed.putString("url", url);
    if (token != null) ed.putString("token", token);
    else ed.remove("token"); // new url, no token: don't send the old token to it
    ed.apply();
    Log.i(TAG, "Saved config: url " + (url != null ? url : "unchanged") + ", token " + (token != null ? "set" : "cleared"));
    return true;
  }

  /** Sets the frame_token cookie for the saved URL's origin, or removes it when there's no token. */
  private void setTokenCookie() {
    String url = prefs().getString("url", null);
    if (url == null) return;
    String token = prefs().getString("token", null);
    Uri u = Uri.parse(url);
    String origin = u.getScheme() + "://" + u.getAuthority();
    CookieManager cm = CookieManager.getInstance();
    cm.setCookie(origin, token != null
        ? TOKEN_COOKIE + "=" + token + "; Path=/; HttpOnly"
        : TOKEN_COOKIE + "=; Path=/; Max-Age=0");
    cm.flush();
  }

  /** Remote debugging only when explicitly requested; any normal launch turns it back off. */
  private void applyDebugFlag(Intent intent) {
    boolean debug = intent != null && intent.getBooleanExtra("debug", false);
    WebView.setWebContentsDebuggingEnabled(debug);
    Log.i(TAG, "WebView remote debugging " + (debug ? "ON" : "off"));
  }

  /** Watches for the two-finger exit hold; all touches still go to the page. */
  @Override
  public boolean dispatchTouchEvent(MotionEvent e) {
    switch (e.getActionMasked()) {
      case MotionEvent.ACTION_POINTER_DOWN:
        if (e.getPointerCount() == 2) {
          for (int i = 0; i < 2; i++) {
            exitIds[i] = e.getPointerId(i);
            exitX[i] = e.getX(i);
            exitY[i] = e.getY(i);
          }
          exitArmed = true;
          handler.removeCallbacks(exitToLauncher);
          handler.postDelayed(exitToLauncher, EXIT_HOLD_MS);
        } else {
          cancelExit(); // 3+ fingers
        }
        break;
      case MotionEvent.ACTION_MOVE:
        if (exitArmed) {
          for (int i = 0; i < 2; i++) {
            int idx = e.findPointerIndex(exitIds[i]);
            if (idx < 0 || Math.hypot(e.getX(idx) - exitX[i], e.getY(idx) - exitY[i]) > EXIT_SLOP_PX) {
              cancelExit();
              break;
            }
          }
        }
        break;
      case MotionEvent.ACTION_POINTER_UP:
      case MotionEvent.ACTION_UP:
      case MotionEvent.ACTION_CANCEL:
        cancelExit();
        break;
      default:
        break;
    }
    return super.dispatchTouchEvent(e);
  }

  private void cancelExit() {
    if (!exitArmed) return;
    exitArmed = false;
    handler.removeCallbacks(exitToLauncher);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemUi();
  }

  private void hideSystemUi() {
    getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }

  @Override
  public void onBackPressed() {
    if (web.canGoBack()) web.goBack();
  }
}
