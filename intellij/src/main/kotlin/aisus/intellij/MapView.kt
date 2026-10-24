// IDE-01: the map viewer in a JCEF browser. The page defines window.aisusPost before the viewer's
// script, so the viewer's first "ready" reaches Kotlin; messages to the page wait until that "ready".
// Every script on the page is allowed by its hash, and the layout's Blob workers by worker-src blob:.
// A theme change reloads the page, which posts "ready" again.
package aisus.intellij

import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.util.Disposer
import com.intellij.ui.JBColor
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import java.security.MessageDigest
import java.util.Base64
import javax.swing.JComponent

class MapView(
    parent: Disposable,
    private val viewerScript: String,
    private val viewerStyle: String,
    private val onMessage: (json: String) -> Unit,
) : Disposable {
    init {
        require(!viewerScript.contains("</script", ignoreCase = true)) { "The viewer bundle must not contain a closing script tag." }
    }

    private val browser: JBCefBrowser = JBCefBrowser.createBuilder().build()
    private val query: JBCefJSQuery
    private val pending = ArrayList<String>()
    private var generation = 0
    private var ready = false
    private var disposed = false

    val component: JComponent
        get() = browser.component

    init {
        Disposer.register(parent, this)
        Disposer.register(this, browser)
        // A JBCefBrowserBase-typed value picks create(JBCefBrowserBase) over the deprecated overload.
        val base: JBCefBrowserBase = browser
        // The query must exist before the browser component is first shown.
        query = JBCefJSQuery.create(base)
        Disposer.register(browser, query)
        query.addHandler { request ->
            // JCEF calls this on its own thread, so the message moves to the UI thread.
            val separator = request?.indexOf(':') ?: -1
            if (request != null && separator > 0) {
                val from = request.substring(0, separator).toIntOrNull()
                val json = request.substring(separator + 1)
                ApplicationManager.getApplication().invokeLater { receive(from, json) }
            }
            null
        }
        ApplicationManager.getApplication().messageBus.connect(this)
            .subscribe(LafManagerListener.TOPIC, LafManagerListener { reload() })
        reload()
    }

    /** Sends one message built by [Bridge]. It waits until the current page has posted "ready". */
    fun send(message: String) {
        if (ready) execute(message) else pending.add(message)
    }

    /** Loads the page again with the current IDE theme. */
    fun reload() {
        generation++
        ready = false
        pending.clear()
        browser.loadHTML(page(generation))
    }

    override fun dispose() {
        disposed = true
    }

    private fun receive(from: Int?, json: String) {
        if (disposed || from != generation) return
        if (Bridge.parse(json) == ViewerMessage.Ready) {
            ready = true
            pending.forEach { execute(it) }
            pending.clear()
        }
        onMessage(json)
    }

    private fun execute(message: String) {
        val cef = browser.cefBrowser
        cef.executeJavaScript(Bridge.deliver(message), cef.url, 0)
    }

    private fun page(generation: Int): String {
        val boot = "window.aisusDark = ${!JBColor.isBright()};\n" +
            "window.aisusPost = function (json) { var request = '$generation:' + json; ${query.inject("request")} };"
        val csp = "default-src 'none'; script-src ${hash(boot)} ${hash(viewerScript)}; style-src ${hash(viewerStyle)}; worker-src blob:"
        return "<!doctype html><html><head><meta charset=\"utf-8\">" +
            "<meta http-equiv=\"Content-Security-Policy\" content=\"$csp\">" +
            "<style>$viewerStyle</style></head><body>" +
            "<script>$boot</script><script>$viewerScript</script></body></html>"
    }

    companion object {
        /** Whether this IDE can show web pages. JCEF can still fail to start, and the constructor then throws. */
        fun isAvailable(): Boolean = JBCefApp.isSupported()

        private fun hash(text: String): String {
            val digest = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
            return "'sha256-" + Base64.getEncoder().encodeToString(digest) + "'"
        }
    }
}
