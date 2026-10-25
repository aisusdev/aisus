// IDE-01: "Show in aisus Map" in the editor's menu marks the boxes that cite the current file.
package aisus.intellij

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAwareAction

class ShowInMapAction : DumbAwareAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        e.presentation.isEnabledAndVisible = e.project != null && file != null && file.isInLocalFileSystem
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        val root = project.aisusRoot() ?: return
        val path = SourcePaths.relative(root, file.toNioPath()) ?: return Notify.info(project, "Show in aisus Map works on a file inside the project.")
        AisusToolWindow.show(project) { project.service<AisusProject>().map?.highlight(path) }
    }
}
