// IDE-01: the Home tab: the composer, the maps, Review and Setup. Generate runs the agent in the IDE
// terminal; Review and Setup run the core CLI and show what it prints.
package aisus.intellij

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.ComboBox
import com.intellij.openapi.util.SystemInfo
import com.intellij.ui.TitledSeparator
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.awt.Font
import java.nio.file.Path
import javax.swing.DefaultListModel
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JPanel

class HomePanel(private val project: Project, private val map: MapPanel) : JPanel(BorderLayout()) {
    private val root: Path? = project.aisusRoot()
    private val focus = JBTextField().apply { emptyText.text = "Optional, such as \"payment flow\"" }
    private val agent = ComboBox(Agent.entries.toTypedArray())
    private val maps = DefaultListModel<MapFile>()
    private val mapList = JBList(maps).apply {
        cellRenderer = javax.swing.DefaultListCellRenderer().let { renderer ->
            javax.swing.ListCellRenderer<MapFile> { list, value, index, selected, focused -> renderer.getListCellRendererComponent(list, value?.run, index, selected, focused) }
        }
        visibleRowCount = 5
    }
    private val base = JBTextField("origin/main")
    private val output = JBTextArea(10, 40).apply {
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
        font = Font(Font.MONOSPACED, Font.PLAIN, font.size)
    }

    init {
        val form = FormBuilder.createFormBuilder()
            .addComponent(TitledSeparator("Generate a map"))
            .addLabeledComponent("Focus:", focus)
            .addLabeledComponent("Agent:", agent)
            .addComponent(row(button("Generate") { generate() }))
            .addComponent(TitledSeparator("Maps"))
            .addComponent(JBScrollPane(mapList))
            .addComponent(row(button("Open") { openMap() }, button("Refresh") { refreshMaps() }))
            .addComponent(TitledSeparator("Review changes"))
            .addLabeledComponent("Compare with:", base)
            .addComponent(row(button("Review") { review() }))
            .addComponent(TitledSeparator("Setup"))
            .addComponent(row(button("Check Setup") { runCli { cli, root -> CoreCli.preflight(cli, root) } }, button("Install Skills") { runCli { cli, root -> CoreCli.install(cli, root) } }))
            .addComponent(JBScrollPane(output))
            .panel
        form.border = JBUI.Borders.empty(8)
        add(JBScrollPane(form), BorderLayout.CENTER)
        refreshMaps()
    }

    private fun generate() {
        val root = root ?: return Notify.error(project, "Open a folder first.")
        val line = AgentLaunch.commandLine(AgentLaunch.argv(agent.item ?: Agent.CLAUDE, focus.text), SystemInfo.isWindows)
        TerminalRunner.run(project, root, line)
    }

    private fun refreshMaps() {
        maps.clear()
        root?.let { Maps.list(it).forEach(maps::addElement) }
    }

    private fun openMap() {
        val picked = mapList.selectedValue ?: maps.elements().toList().firstOrNull() ?: return
        map.show(picked)
        AisusToolWindow.show(project)
    }

    private fun review() {
        val compare = base.text.trim().ifEmpty { "origin/main" }
        runCli { cli, root -> CoreCli.check(cli, root, compare) }
    }

    private fun runCli(args: (cli: Path, root: Path) -> List<String>) {
        val root = root ?: return Notify.error(project, "Open a folder first.")
        output.text = "Running…"
        project.service<NodeCli>().run(root, { cli -> args(cli, root) }) { result ->
            output.text = result.stdout.ifBlank { result.stderr }.ifBlank { "Done, with exit code ${result.exitCode}." }
            output.caretPosition = 0
        }
    }

    private fun button(text: String, action: () -> Unit) = JButton(text).apply { addActionListener { action() } }

    private fun row(vararg components: JComponent) = JPanel(FlowLayout(FlowLayout.LEFT, 0, 0)).apply { components.forEach { add(it) } }
}
