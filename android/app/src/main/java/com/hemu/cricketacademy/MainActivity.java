package com.hemu.cricketacademy;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // This app targets SDK 36, and from SDK 35 onward Android forces every
        // window edge-to-edge: the WebView is laid out behind the status bar
        // and the navigation bar. The `windowOptOutEdgeToEdgeEnforcement`
        // escape hatch is honoured on 35 but ignored on 36, so opting out is
        // not available here.
        //
        // The web layer can't compensate on its own either. Android's WebView
        // does not populate CSS `env(safe-area-inset-*)` for the system bars
        // (only, inconsistently, for display cutouts), so a `pt-[env(...)]` on
        // the app header resolves to 0px and the academy name keeps sitting
        // underneath the clock and battery icons.
        //
        // Padding the activity's content view by the measured inset heights
        // fixes it once, for every screen in the app, with no per-page CSS and
        // no change to how the same pages render in a desktop browser.
        final View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
