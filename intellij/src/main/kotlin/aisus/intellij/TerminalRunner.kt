// IDE-01: Generate runs in the IDE terminal, in a new tab opened in the repository.
package aisus.intellij

import com.intellij.openapi.project.Project
import com.intellij.terminal.frontend.toolwindow.TerminalToolWindowTabsManager
import com.intellij.util.concurrency.annotations.RequiresEdt
import java.nio.file.Path

object TerminalRunner {
    @RequiresEdt
    fun run(project: Project, root: Path, commandLine: String) {
        val tab = TerminalToolWindowTabsManager.getInstance(project)
            .createTabBuilder()
            .workingDirectory(root.toString())
            .tabName("aisus")
            .requestFocus(true)
            .createTab()
        tab.view.createSendTextBuilder().shouldExecute().send(commandLine)
    }
}
