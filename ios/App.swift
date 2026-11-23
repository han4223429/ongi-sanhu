import UIKit
import WebKit

/// 온기산후 웹앱을 전체 화면으로 보여 주는 얇은 iOS 껍데기.
/// 화면과 로직은 전부 웹앱(Next.js)에 있고, 이 앱은 주소창 없이 열어 주는 역할만 한다.

private let appBackground = UIColor(red: 0xfd / 255, green: 0xf1 / 255, blue: 0xec / 255, alpha: 1)

@main
@objc(AppDelegate)
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

@objc(SceneDelegate)
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = WebViewController()
        window.backgroundColor = appBackground
        window.makeKeyAndVisible()
        self.window = window
    }
}

final class WebViewController: UIViewController, WKNavigationDelegate {
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    /// 시작 주소. 실행 인자 `-AppURL <주소>`가 있으면 그것을, 없으면 Info.plist의 AppURL을 쓴다.
    private let startURL: URL = {
        let text = UserDefaults.standard.string(forKey: "AppURL")
            ?? Bundle.main.object(forInfoDictionaryKey: "AppURL") as? String
            ?? "http://localhost:3000"
        return URL(string: text) ?? URL(string: "http://localhost:3000")!
    }()

    /// 첫 화면이 뜰 때까지 가리는 로딩 화면
    private let loadingOverlay = UIView()

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func loadView() {
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = appBackground
        webView.isOpaque = false
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        // 안전 영역(노치·홈 바)은 웹의 env(safe-area-inset-*)가 처리한다.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = self

        loadingOverlay.backgroundColor = appBackground
        loadingOverlay.translatesAutoresizingMaskIntoConstraints = false
        let spinner = UIActivityIndicatorView(style: .large)
        spinner.color = UIColor(red: 0x8a / 255, green: 0x3b / 255, blue: 0x34 / 255, alpha: 1)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        loadingOverlay.addSubview(spinner)
        view.addSubview(loadingOverlay)
        NSLayoutConstraint.activate([
            loadingOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            loadingOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            loadingOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            spinner.centerXAnchor.constraint(equalTo: loadingOverlay.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: loadingOverlay.centerYAnchor),
        ])

        // 개발 확인용 실행 인자 (simctl launch ... -SeedDemo 1 -AfterLoadJS "...").
        // -SeedDemo: 데모 프로필과 대화를 저장소에 넣고 시작. -AfterLoadJS: 로딩 후 실행할 스크립트.
        if UserDefaults.standard.bool(forKey: "SeedDemo") {
            let js = """
            if (!localStorage.getItem('ongi.profile.v1')) {
              var d = new Date(); d.setDate(d.getDate() - 51);
              var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              localStorage.setItem('ongi.profile.v1', JSON.stringify({birthDate: k, delivery: 'cesarean', cleared: true, symptoms: ['back_pain'], redFlags: [], minutes: 20}));
            }
            """
            webView.configuration.userContentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        webView.load(URLRequest(url: startURL))
    }

    private func hideOverlay() {
        UIView.animate(withDuration: 0.2, animations: { self.loadingOverlay.alpha = 0 }) { _ in
            self.loadingOverlay.removeFromSuperview()
        }
    }

    private var ranAfterLoad = false

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideOverlay()
        // 확인용 스크립트는 첫 로딩 뒤 한 번만 실행한다. (스크립트가 새로고침을 일으켜도 반복되지 않게)
        guard !ranAfterLoad else { return }
        ranAfterLoad = true
        guard let script = UserDefaults.standard.string(forKey: "AfterLoadJS"), !script.isEmpty else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            webView.evaluateJavaScript(script)
        }
    }

    /// 개발 서버가 꺼져 있을 때 빈 화면 대신 안내를 보여 준다.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let html = """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#fdf1ec;color:#3a2a26;font:17px -apple-system,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
        <div><p style="font-size:22px;margin:0 0 12px">연결하지 못했어요</p>
        <p style="color:#76615a;margin:0 0 24px">개발 서버가 켜져 있는지 확인해 주세요.<br>(\(startURL.absoluteString))</p>
        <a href="\(startURL.absoluteString)" style="display:inline-block;background:#8a3b34;color:#fff8f4;padding:14px 24px;border-radius:14px;text-decoration:none;font-weight:600">다시 시도</a></div>
        """
        hideOverlay()
        webView.loadHTMLString(html, baseURL: nil)
    }
}
