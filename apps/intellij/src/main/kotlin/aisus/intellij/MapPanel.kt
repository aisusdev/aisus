// IDE-01: the Map tab. It shows the newest map, or the one picked on the Home tab, and opens a box's
// cited lines when it is clicked. Without JCEF, the map opens as a page in the browser instead.
package aisus.intellij

import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.io.IOException
import java.nio.file.Files
import javax.swing.JButton
import javax.swing.JPanel

class MapPanel(private val project: Project, parent: Disposable) : JPanel(BorderLayout()), Disposable {
    private val root = project.aisusRoot()
    private var shown: MapFile? = null
    private var highlighted: String? = null
    private val view: MapView? = if (MapView.isAvailable()) {
        try {
            MapView(this, AisusCore.viewerScript(), AisusCore.viewerStyle(), ::receive)
        } catch (e: IllegalStateException) {
            null
        } catch (e: IOException) {
            null
        }
    } else {
        null
    }

    init {
        Disposer.register(parent, this)
        add(view?.component ?: fallback(), BorderLayout.CENTER)
    }

    /** Shows [map], or the newest map when it is null. */
    fun show(map: MapFile? = null) {
        shown = map ?: root?.let { Maps.list(it).firstOrNull() }
        sendMap()
    }

    /** Marks the boxes citing the repository-relative [path]. */
    fun highlight(path: String) {
        highlighted = path
        val text = text() ?: return
        view?.send(Bridge.highlight(Bridge.boxesCiting(text, path), path))
    }

    override fun dispose() {}

    private fun text(): String? = try {
        shown?.let { Files.readString(it.file) }
    } catch (e: IOException) {
        null
    }

    private fun sendMap() {
        val map = shown
        val text = text()
        val message = if (map == null || text == null) Bridge.empty("No map of this folder yet. Generate one on the Home tab.") else Bridge.load(text, map.file.toString())
        view?.send(message ?: Bridge.empty("Can't show ${map?.run}: it is not valid JSON."))
        highlighted?.let { highlight(it) }
    }

    private fun receive(json: String) {
        when (val message = Bridge.parse(json)) {
            ViewerMessage.Ready -> {
                if (shown == null) shown = root?.let { Maps.list(it).firstOrNull() }
                sendMap()
            }
            is ViewerMessage.OpenSource -> open(message)
            else -> {}
        }
    }

    private fun open(message: ViewerMessage.OpenSource) {
        val text = text() ?: return
        val source = Bridge.source(text, message.componentId, message.index) ?: return
        val file = root?.let { SourcePaths.resolve(it, source.path) }
        if (file == null) Notify.error(project, "Invalid or stale source path: ${source.path}") else CodeNavigator.open(project, file, source.line, source.endLine)
    }

    private fun fallback(): JPanel {
        val panel = JPanel(FlowLayout(FlowLayout.LEFT))
        panel.border = JBUI.Borders.empty(8)
        panel.add(JBLabel("This IDE cannot show web pages here, so the map opens in your browser."))
        panel.add(JButton("Open the Map in the Browser").apply { addActionListener { openInBrowser() } })
        return panel
    }

    private fun openInBrowser() {
        val root = root ?: return
        val map = shown ?: Maps.list(root).firstOrNull() ?: return Notify.info(project, "No map of this folder yet. Generate one on the Home tab.")
        project.service<NodeCli>().run(root, { cli -> CoreCli.exportPage(cli, root, map.run) }) { output ->
            val page = CoreCli.writtenPage(root, output.stdout)
            if (page == null) Notify.error(project, "aisus could not write the map's page. ${output.stderr.take(300)}") else BrowserUtil.browse(page)
        }
    }
}
