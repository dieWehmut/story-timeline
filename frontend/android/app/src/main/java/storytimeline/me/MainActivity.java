package storytimeline.me;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 注册插件（如果未来需要）
        registerPlugin();
    }

    private void registerPlugin() {
        ArrayList<Class<? extends Plugin>> plugins = new ArrayList<>();
        init(savedInstanceState, plugins);
    }
}