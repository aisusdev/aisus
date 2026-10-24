// IDE-01: the "aisus" tool window, with its Map and Home tabs.
package aisus.intellij

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

object AisusToolWindow {
    const val ID = "aisus"
    const val MAP_TAB = "Map"
    const val HOME_TAB = "Home"

    /** Shows the tool window on [tab], then runs [then] on the UI thread. */
    fun show(project: Project, tab: String = MAP_TAB, then: () -> Unit = {}) {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(ID) ?: return
        toolWindow.activate({
            val contents = toolWindow.contentManager
            contents.findContent(tab)?.let { contents.setSelectedContent(it) }
            then()
        }, true)
    }
}
