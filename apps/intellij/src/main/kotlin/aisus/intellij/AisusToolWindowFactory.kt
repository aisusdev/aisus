// IDE-01: builds the tool window's Map and Home tabs the first time it is shown.
package aisus.intellij

import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class AisusToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val map = MapPanel(project, toolWindow.disposable)
        project.service<AisusProject>().map = map
        val home = HomePanel(project, map)
        val factory = ContentFactory.getInstance()
        toolWindow.contentManager.addContent(factory.createContent(map, AisusToolWindow.MAP_TAB, false))
        toolWindow.contentManager.addContent(factory.createContent(home, AisusToolWindow.HOME_TAB, false))
    }
}
