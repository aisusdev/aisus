// IDE-01: the plugin's balloons, in the "aisus" notification group.
package aisus.intellij

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project

object Notify {
    const val GROUP = "aisus"

    fun error(project: Project?, text: String) = show(project, text, NotificationType.ERROR)

    fun info(project: Project?, text: String) = show(project, text, NotificationType.INFORMATION)

    private fun show(project: Project?, text: String, type: NotificationType) {
        NotificationGroupManager.getInstance().getNotificationGroup(GROUP).createNotification(text, type).notify(project)
    }
}
